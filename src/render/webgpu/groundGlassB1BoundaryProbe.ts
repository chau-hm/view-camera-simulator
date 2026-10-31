import * as THREE from "three";
import { MeshBasicNodeMaterial, type WebGPURenderer } from "three/webgpu";
import { texture, vec2 } from "three/tsl";
import {
  createGroundGlassB1ReconstructionNodes,
} from "./groundGlassApertureGatherNodes";
import {
  reconstructGroundGlassB1Reference,
} from "./groundGlassB1Reference";
import type {
  GroundGlassB1BoundaryProbeCaseReadback,
  GroundGlassB1BoundaryProbeReadback,
  GroundGlassB1BoundaryProbeRequest,
} from "./groundGlassWebGpuTestSeam";

type BoundaryProbeRenderer = InstanceType<typeof WebGPURenderer>;

type BoundaryProbeCase = Readonly<{
  id: string;
  physicalValueMm: number;
  validityCode: 1 | 2;
  farValues: readonly [number, number, number, number];
}>;

const sourceBytes = new Uint8Array([64, 128, 192, 255]);

const cases: readonly BoundaryProbeCase[] = [
  {
    id: "physical-positive-half-maximum-and-gather-rgba-maximum",
    physicalValueMm: 65504,
    validityCode: 1,
    // B1's far target writes opaque alpha by contract; exercise the RGBA16F
    // boundary in every sampled RGB channel while retaining that alpha value.
    farValues: [65504, 65504, 65504, 1],
  },
  {
    id: "physical-negative-half-maximum-is-near-side",
    physicalValueMm: -65504,
    validityCode: 1,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "physical-largest-half-value-below-maximum",
    physicalValueMm: 65472,
    validityCode: 1,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "m4-unrepresentable-overflow-preserves-validity-code-two",
    physicalValueMm: 65536,
    // The RGBA16F storage conversion saturates this input to the maximum finite
    // half value; M4's validity code remains the authoritative overflow signal.
    validityCode: 2,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "physical-nan",
    physicalValueMm: Number.NaN,
    validityCode: 1,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "physical-positive-infinity",
    physicalValueMm: Number.POSITIVE_INFINITY,
    validityCode: 1,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "physical-negative-infinity",
    physicalValueMm: Number.NEGATIVE_INFINITY,
    validityCode: 1,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "m4-validity-code-two-remains-authoritative",
    physicalValueMm: 65504,
    validityCode: 2,
    farValues: [0.6, 0.2, 0.1, 1],
  },
  {
    id: "far-gather-nan-channel-fails-closed",
    physicalValueMm: 1,
    validityCode: 1,
    farValues: [Number.NaN, 0.2, 0.1, 1],
  },
  {
    id: "far-gather-infinity-channel-fails-closed",
    physicalValueMm: 1,
    validityCode: 1,
    farValues: [0.6, Number.POSITIVE_INFINITY, 0.1, 1],
  },
];

const halfBits = (value: number): number => {
  if (Number.isNaN(value)) return 0x7e00;
  if (value === Number.POSITIVE_INFINITY) return 0x7c00;
  if (value === Number.NEGATIVE_INFINITY) return 0xfc00;
  if (value > 65504) return 0x7bff;
  if (value < -65504) return 0xfbff;
  return THREE.DataUtils.toHalfFloat(value);
};

const makeDataTexture = (
  data: Uint8Array | Uint16Array | Float32Array,
  type: THREE.TextureDataType,
): THREE.DataTexture => {
  const output = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, type);
  output.colorSpace = THREE.NoColorSpace;
  output.minFilter = THREE.NearestFilter;
  output.magFilter = THREE.NearestFilter;
  output.generateMipmaps = false;
  output.needsUpdate = true;
  return output;
};

const rgba4 = (values: Uint16Array | Uint8Array): readonly [number, number, number, number] => {
  if (values.length !== 4) throw new RangeError("B1 boundary probe expected one RGBA texel");
  return [values[0]!, values[1]!, values[2]!, values[3]!];
};

const halfBits4 = (values: unknown): readonly [number, number, number, number] => {
  if (!(values instanceof Uint16Array) || values.length !== 4) {
    throw new Error("B1 boundary probe RGBA16F readback did not return four binary16 values");
  }
  return rgba4(values);
};

const makeTarget = (type: THREE.TextureDataType): THREE.RenderTarget => {
  const target = new THREE.RenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  return target;
};

const makeScene = (
  geometry: THREE.PlaneGeometry,
  outputNode: NonNullable<MeshBasicNodeMaterial["outputNode"]>,
  materials: MeshBasicNodeMaterial[],
  scenes: THREE.Scene[],
): THREE.Scene => {
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  material.outputNode = outputNode;
  materials.push(material);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geometry, material));
  scenes.push(scene);
  return scene;
};

/**
 * Runs the actual M5 B1 TSL node on controlled RGBA16F inputs using an already
 * mounted native WebGPU renderer. This helper never constructs a renderer.
 */
export const runGroundGlassB1BoundaryProbe = async (input: Readonly<{
  request: GroundGlassB1BoundaryProbeRequest;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererRevision: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  renderer: BoundaryProbeRenderer;
  queue: Readonly<{ onSubmittedWorkDone: () => Promise<void> }>;
  textureFormat: (texture: THREE.Texture) => string | null;
}>): Promise<GroundGlassB1BoundaryProbeReadback> => {
  const textures: THREE.DataTexture[] = [];
  const targets: THREE.RenderTarget[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const scenes: THREE.Scene[] = [];
  let geometry: THREE.PlaneGeometry | null = null;
  let safeToDispose = false;
  try {
    const physicalData = new Uint16Array(4);
    const gatherData = new Uint16Array(4);
    const validityData = new Uint8Array(4);
    const sourceTexture = makeDataTexture(sourceBytes, THREE.UnsignedByteType);
    const physicalTexture = makeDataTexture(physicalData, THREE.HalfFloatType);
    const validityTexture = makeDataTexture(validityData, THREE.UnsignedByteType);
    const gatherTexture = makeDataTexture(gatherData, THREE.HalfFloatType);
    const centerProvenanceTexture = makeDataTexture(
      new Float32Array([0, 0, 0.5, 0.5]), THREE.FloatType,
    );
    const selectedProvenanceTexture = makeDataTexture(
      new Float32Array([0, 0, 0, 0]), THREE.FloatType,
    );
    textures.push(
      sourceTexture,
      physicalTexture,
      validityTexture,
      gatherTexture,
      centerProvenanceTexture,
      selectedProvenanceTexture,
    );

    const targetsByName = {
      physical: makeTarget(THREE.HalfFloatType),
      gather: makeTarget(THREE.HalfFloatType),
      b1: makeTarget(THREE.HalfFloatType),
      decision: makeTarget(THREE.UnsignedByteType),
    };
    targets.push(...Object.values(targetsByName));
    targets.forEach((target) => input.renderer.initRenderTarget(target));
    textures.forEach((value) => input.renderer.initTexture(value));

    const nodes = createGroundGlassB1ReconstructionNodes({
      sourceColorTexture: sourceTexture,
      gatherFarTexture: gatherTexture,
      physicalTexture,
      validityTexture,
      gatherCenterProvenanceTexture: centerProvenanceTexture,
      selectedProvenanceTexture,
      sourceWidthPx: 1,
      sourceHeightPx: 1,
      gatherWidthPx: 1,
      gatherHeightPx: 1,
    });
    geometry = new THREE.PlaneGeometry(2, 2);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    camera.coordinateSystem = input.renderer.coordinateSystem;
    camera.updateProjectionMatrix();
    const physicalScene = makeScene(
      geometry, texture(physicalTexture, vec2(0.5, 0.5)), materials, scenes,
    );
    const gatherScene = makeScene(
      geometry, texture(gatherTexture, vec2(0.5, 0.5)), materials, scenes,
    );
    const b1Scene = makeScene(geometry, nodes.farOutput, materials, scenes);
    const decisionScene = makeScene(geometry, nodes.decisionOutput, materials, scenes);

    const renderTo = (scene: THREE.Scene, target: THREE.RenderTarget): void => {
      input.renderer.setRenderTarget(target);
      input.renderer.setViewport(0, 0, 1, 1);
      input.renderer.setScissorTest(false);
      input.renderer.clear(true, false, false);
      input.renderer.render(scene, camera);
    };
    const readTarget = (target: THREE.RenderTarget): Promise<unknown> =>
      input.renderer.readRenderTargetPixelsAsync(target, 0, 0, 1, 1);
    const records: GroundGlassB1BoundaryProbeCaseReadback[] = [];

    for (const probeCase of cases) {
      physicalData.set([
        halfBits(probeCase.physicalValueMm),
        halfBits(1),
        halfBits(1),
        halfBits(1),
      ]);
      gatherData.set(probeCase.farValues.map(halfBits));
      validityData.set([probeCase.validityCode, 0, 0, 255]);
      physicalTexture.needsUpdate = true;
      gatherTexture.needsUpdate = true;
      validityTexture.needsUpdate = true;

      safeToDispose = false;
      renderTo(physicalScene, targetsByName.physical);
      renderTo(gatherScene, targetsByName.gather);
      renderTo(b1Scene, targetsByName.b1);
      renderTo(decisionScene, targetsByName.decision);
      await input.queue.onSubmittedWorkDone();
      safeToDispose = true;

      safeToDispose = false;
      const [physicalRaw, gatherRaw, b1Raw, decisionRaw] = await Promise.all([
        readTarget(targetsByName.physical),
        readTarget(targetsByName.gather),
        readTarget(targetsByName.b1),
        readTarget(targetsByName.decision),
      ]);
      safeToDispose = true;
      const storedPhysicalHalfBits = halfBits4(physicalRaw);
      const storedGatherHalfBits = halfBits4(gatherRaw);
      const gpuB1HalfBits = halfBits4(b1Raw);
      const storedPhysicalRgba = storedPhysicalHalfBits.map(THREE.DataUtils.fromHalfFloat) as
        unknown as readonly [number, number, number, number];
      const storedGatherRgba = storedGatherHalfBits.map(THREE.DataUtils.fromHalfFloat) as
        unknown as readonly [number, number, number, number];
      const gpuB1Rgba = gpuB1HalfBits.map(THREE.DataUtils.fromHalfFloat) as
        unknown as readonly [number, number, number, number];
      const gpuDecisionRgba8 = rgba4(decisionRaw as Uint8Array);
      const cpu = reconstructGroundGlassB1Reference({
        source: { widthPx: 1, heightPx: 1 },
        gather: { widthPx: 1, heightPx: 1 },
        sourceRgba: Float32Array.from(sourceBytes, (value) => value / 255),
        gatherFarRgba: Float32Array.from(storedGatherRgba),
        physicalRgba: Float32Array.from(storedPhysicalRgba),
        validity: new Uint8Array([probeCase.validityCode]),
        observedSelectedGatherIds: new Int32Array([0, 0]),
        observedSelectedCenterSourceIds: new Int32Array([0, 0]),
        observedGatherCenterSourceIds: new Int32Array([0, 0]),
      });
      let gpuCpuMaximumError = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        const gpu = gpuB1Rgba[channel]!;
        const reference = cpu.farRgba[channel]!;
        if (!Number.isFinite(gpu) || !Number.isFinite(reference)) {
          gpuCpuMaximumError = Number.POSITIVE_INFINITY;
          break;
        }
        gpuCpuMaximumError = Math.max(gpuCpuMaximumError, Math.abs(gpu - reference));
      }
      records.push({
        id: probeCase.id,
        inputSignedCocMm: probeCase.physicalValueMm,
        inputValidityCode: probeCase.validityCode,
        inputSourceRgba: Array.from(sourceBytes, (value) => value / 255) as [number, number, number, number],
        inputFarRgba: probeCase.farValues,
        storedPhysicalHalfBits,
        storedPhysicalRgba,
        storedGatherHalfBits,
        storedGatherRgba,
        gpuDecisionRgba8,
        gpuB1HalfBits,
        gpuB1Rgba,
        cpuEligible: cpu.eligible[0]!,
        cpuFallbackReason: cpu.fallbackReason[0]!,
        cpuSelectedPath: cpu.selectedPath[0]!,
        cpuB1Rgba: [cpu.farRgba[0]!, cpu.farRgba[1]!, cpu.farRgba[2]!, cpu.farRgba[3]!],
        gpuCpuMaximumError,
      });
    }

    await input.queue.onSubmittedWorkDone();
    safeToDispose = true;
    return {
      token: input.request.token,
      requestId: input.requestId,
      channelId: input.channelId,
      sceneId: input.sceneId,
      rendererGenerationId: input.rendererGenerationId,
      rendererFamily: input.rendererFamily,
      actualExecutionApi: input.actualExecutionApi,
      internalFallback: input.internalFallback,
      rendererRevision: input.rendererRevision,
      targetFormats: {
        sourceColor: input.textureFormat(sourceTexture),
        physical: input.textureFormat(physicalTexture),
        validity: input.textureFormat(validityTexture),
        farGather: input.textureFormat(gatherTexture),
        provenance: input.textureFormat(selectedProvenanceTexture),
        b1: input.textureFormat(targetsByName.b1.texture),
        decision: input.textureFormat(targetsByName.decision.texture),
      },
      cases: records,
    };
  } finally {
    if (!safeToDispose) {
      try {
        await input.queue.onSubmittedWorkDone();
        safeToDispose = true;
      } catch {
        // Keep temporary handles alive until the owning renderer is retired if queue completion
        // cannot be established; disposing them while submitted work is uncertain is unsafe.
      }
    }
    if (safeToDispose) {
      try { input.renderer.setRenderTarget(null); } catch { /* Preserve the original probe result. */ }
      scenes.forEach((scene) => scene.clear());
      materials.forEach((material) => material.dispose());
      geometry?.dispose();
      targets.forEach((target) => target.dispose());
      textures.forEach((value) => value.dispose());
    }
  }
};
