import * as THREE from "three";
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu";
import { Fn, texture, uv, vec2, vec4 } from "three/tsl";
import { resolveObserverRendererRuntime } from "../../../render/backend/observerVisualPipelineCapabilities";
import {
  createGroundGlassApertureGatherNodes,
  createGroundGlassB1ReconstructionNodes,
  createGroundGlassGatherCenterProvenanceNode,
  createGroundGlassGatherIdentityNode,
  createGroundGlassResearchCompositeNode,
  createGroundGlassSelectedGatherProvenanceNode,
  createGroundGlassSourceIdentityNode,
} from "../../../render/webgpu/groundGlassApertureGatherNodes";

const SOURCE_WIDTH = 128;
const SOURCE_HEIGHT = 96;
const PROBE_SOURCE = [68, 26] as const;
const NEAR_CENTER = [69, 27] as const;
const FAR_FEATURE_SOURCE = [62, 23] as const;
const YELLOW_FEATURE = { left: 60, right: 64, top: 20, bottom: 26 } as const;
const TOP_UV = vec2(uv().x, uv().y.oneMinus());

type Rgba = readonly [number, number, number, number];
type ScenarioId = "full32" | "half32" | "half64";
type LayerId = "far-b0" | "far-b1" | "near" | "composite";

type ScenarioResult = Readonly<{
  scenarioId: ScenarioId;
  gatherSize: Readonly<{ widthPx: number; heightPx: number }>;
  sampleCount: 32 | 64;
  stagesAtProbe: Readonly<Record<string, unknown>>;
  metrics: Readonly<Record<string, number>>;
  timings: Readonly<{ renderAndReadbackMs: number; gpuTimestampDurationMs: null }>;
}>;

type Rq3cResult = Readonly<{
  schemaVersion: 1;
  evidenceClass: "synthetic-shared-tsl-research";
  sourceCommit: string;
  sourceTreeDirty: boolean;
  sceneSourceRevision: null;
  rendererRevision: string;
  runtime: Readonly<{
    rendererFamily: string;
    actualExecutionApi: string;
    internalFallback: "none" | "not-native";
    applicationFallback: "not-applicable";
  }>;
  coordinateContract: Readonly<{
    sourcePixels: "integer top-origin";
    gatherPixels: "integer top-origin";
    fullscreenTextureUv: "(u, 1-v)";
    targetReadbackOrigin: "top" | "bottom";
    targetReadbackConversion: "identity-verified origin; reverse rows only when bottom-origin";
    filter: "nearest, clamp-to-edge, no mipmaps";
  }>;
  controlledInputs: Readonly<{
    dimensions: Readonly<{ widthPx: number; heightPx: number }>;
    nearMask: "x + y >= 96";
    sourceColor: Readonly<{ near: Rgba; far: Rgba; farFeature: Rgba }>;
    signedPhysicalCocMm: Readonly<{ near: number; far: number }>;
    depthMap: "synthetic normalized depth values: near 0.45, far 0.62";
    validityCode: 1;
    filmMm: readonly [36, 24];
    maxRadiusPx: 12;
  }>;
  scenarios: readonly ScenarioResult[];
}>;

declare global {
  interface Window {
    __rq3c?: Readonly<{
      result: Rq3cResult;
      display: (scenarioId: ScenarioId, layer: LayerId) => Promise<void>;
      dispose: () => Promise<void>;
    }>;
  }
}

const toHalf = (value: number): number => THREE.DataUtils.toHalfFloat(value);

const makeTexture = <T extends Uint8Array | Uint16Array | Float32Array>(
  data: T,
  width: number,
  height: number,
  type: THREE.TextureDataType,
): THREE.DataTexture => {
  const output = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, type);
  output.colorSpace = THREE.NoColorSpace;
  output.minFilter = THREE.NearestFilter;
  output.magFilter = THREE.NearestFilter;
  output.wrapS = THREE.ClampToEdgeWrapping;
  output.wrapT = THREE.ClampToEdgeWrapping;
  output.generateMipmaps = false;
  output.needsUpdate = true;
  return output;
};

const makeRenderTarget = (
  width: number,
  height: number,
  type: THREE.TextureDataType,
): THREE.RenderTarget => {
  const target = new THREE.RenderTarget(width, height, {
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
  target.texture.wrapS = THREE.ClampToEdgeWrapping;
  target.texture.wrapT = THREE.ClampToEdgeWrapping;
  target.texture.generateMipmaps = false;
  return target;
};

const buildControlledInputs = () => {
  const source = new Uint16Array(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
  const physical = new Uint16Array(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
  const depth = new Float32Array(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
  const validity = new Uint8Array(SOURCE_WIDTH * SOURCE_HEIGHT * 4);
  const nearColor: Rgba = [0.9, 0.03, 0.02, 1];
  const farColor: Rgba = [0.025, 0.08, 0.85, 1];
  const farFeature: Rgba = [1, 0.85, 0.05, 1];

  for (let yTop = 0; yTop < SOURCE_HEIGHT; yTop += 1) {
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const isNear = x + yTop >= 96;
      const isFeature = !isNear
        && x >= YELLOW_FEATURE.left && x < YELLOW_FEATURE.right
        && yTop >= YELLOW_FEATURE.top && yTop < YELLOW_FEATURE.bottom;
      const color = isNear ? nearColor : isFeature ? farFeature : farColor;
      // DataTexture row zero is sampled at v=0 on this WebGPU path; the
      // shared nodes already convert fullscreen UVs to the controlled top row.
      const index = (yTop * SOURCE_WIDTH + x) * 4;
      source.set(color.map(toHalf), index);
      physical.set([
        toHalf(isNear ? -1.5615 : 0.9258),
        toHalf(1.2),
        toHalf(1.2),
        toHalf(0),
      ], index);
      const normalizedDepth = isNear ? 0.45 : 0.62;
      depth.set([normalizedDepth, 0, 0, 1], index);
      validity.set([1, 0, 0, 255], index);
    }
  }

  return {
    nearColor,
    farColor,
    farFeature,
    source: makeTexture(source, SOURCE_WIDTH, SOURCE_HEIGHT, THREE.HalfFloatType),
    physical: makeTexture(physical, SOURCE_WIDTH, SOURCE_HEIGHT, THREE.HalfFloatType),
    // The shared node samples only the depth texture's red channel. This
    // controlled data texture keeps the native gather input deterministic.
    depth: makeTexture(depth, SOURCE_WIDTH, SOURCE_HEIGHT, THREE.FloatType) as unknown as THREE.DepthTexture,
    validity: makeTexture(validity, SOURCE_WIDTH, SOURCE_HEIGHT, THREE.UnsignedByteType),
  };
};

const asFloatRgba = (raw: unknown): Float32Array => {
  if (raw instanceof Float32Array) return raw;
  if (raw instanceof Uint16Array) return Float32Array.from(raw, THREE.DataUtils.fromHalfFloat);
  if (raw instanceof Uint8Array) return Float32Array.from(raw, (value) => value / 255);
  throw new Error("Unexpected native render-target readback type");
};

const compactReadbackRows = (
  pixels: Uint8Array | Uint16Array | Float32Array,
  width: number,
  height: number,
): Uint8Array | Uint16Array | Float32Array => {
  const elementsPerRow = width * 4;
  const tightLength = elementsPerRow * height;
  if (pixels.length === tightLength) return pixels;
  const bytesPerRow = elementsPerRow * pixels.BYTES_PER_ELEMENT;
  const paddedRowElements = Math.ceil(bytesPerRow / 256) * 256 / pixels.BYTES_PER_ELEMENT;
  const expectedPaddedLength = (height - 1) * paddedRowElements + elementsPerRow;
  if (pixels.length !== expectedPaddedLength) {
    throw new Error(`Unexpected readback row pitch: ${pixels.length} elements for ${width}x${height}`);
  }
  const output = pixels instanceof Uint8Array
    ? new Uint8Array(tightLength)
    : pixels instanceof Uint16Array
      ? new Uint16Array(tightLength)
      : new Float32Array(tightLength);
  for (let y = 0; y < height; y += 1) {
    output.set(pixels.subarray(y * paddedRowElements, y * paddedRowElements + elementsPerRow), y * elementsPerRow);
  }
  return output;
};

const inferReadbackOrigin = (
  pixels: Float32Array,
  width: number,
  height: number,
): "top" | "bottom" => {
  let topMismatches = 0;
  let bottomMismatches = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (pixels[offset] !== x || pixels[offset + 1] !== y) topMismatches += 1;
      if (pixels[offset] !== x || pixels[offset + 1] !== height - 1 - y) bottomMismatches += 1;
    }
  }
  if (topMismatches === 0) return "top";
  if (bottomMismatches === 0) return "bottom";
  throw new Error(`GPU identity readback has unresolved row origin (${topMismatches}/${bottomMismatches} mismatches)`);
};

const readTopPixel = async (
  renderer: WebGPURenderer,
  target: THREE.RenderTarget,
  x: number,
  yTop: number,
  readbackOrigin: "top" | "bottom",
): Promise<readonly number[]> => {
  const raw = await renderer.readRenderTargetPixelsAsync(
    target,
    x,
    readbackOrigin === "top" ? yTop : target.height - 1 - yTop,
    1,
    1,
  );
  return Array.from(asFloatRgba(raw));
};

const readTopImage = async (
  renderer: WebGPURenderer,
  target: THREE.RenderTarget,
  readbackOrigin: "top" | "bottom",
): Promise<Float32Array> => {
  const readback = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
  const raw = asFloatRgba(compactReadbackRows(
    readback as Uint8Array | Uint16Array | Float32Array, target.width, target.height,
  ));
  const top = new Float32Array(raw.length);
  for (let yTop = 0; yTop < target.height; yTop += 1) {
    const yRead = readbackOrigin === "top" ? yTop : target.height - 1 - yTop;
    const sourceOffset = yRead * target.width * 4;
    const destinationOffset = yTop * target.width * 4;
    top.set(raw.subarray(sourceOffset, sourceOffset + target.width * 4), destinationOffset);
  }
  return top;
};

const main = async (): Promise<void> => {
  const status = document.querySelector<HTMLElement>("#status");
  const canvas = document.querySelector<HTMLCanvasElement>("#rq3c-canvas");
  const resultElement = document.querySelector<HTMLElement>("#result");
  if (!status || !canvas || !resultElement) throw new Error("RQ3C fixture DOM is incomplete");

  const renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
  const textures: THREE.Texture[] = [];
  const targets: THREE.RenderTarget[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const scenes: THREE.Scene[] = [];
  let geometry: THREE.PlaneGeometry | null = null;
  let displayMaterials: MeshBasicNodeMaterial[] = [];
  let displayScene: THREE.Scene | null = null;
  let published = false;

  const dispose = async (): Promise<void> => {
    renderer.setRenderTarget(null);
    displayScene?.clear();
    scenes.forEach((scene) => scene.clear());
    materials.forEach((material) => material.dispose());
    displayMaterials.forEach((material) => material.dispose());
    geometry?.dispose();
    targets.forEach((target) => target.dispose());
    textures.forEach((input) => input.dispose());
    await renderer.dispose();
  };

  try {
    await renderer.init();
    renderer.setPixelRatio(1);
    renderer.setSize(SOURCE_WIDTH, SOURCE_HEIGHT, false);
    renderer.outputColorSpace = THREE.NoColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1);
    const runtime = resolveObserverRendererRuntime(renderer);
    if (runtime.rendererFamily !== "webgpu-renderer" || runtime.executionBackend !== "webgpu") {
      throw new Error(`Native WebGPU required; observed ${JSON.stringify(runtime)}`);
    }

    const inputs = buildControlledInputs();
    textures.push(inputs.source, inputs.physical, inputs.depth, inputs.validity);
    textures.forEach((input) => renderer.initTexture(input));
    geometry = new THREE.PlaneGeometry(2, 2);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    camera.coordinateSystem = renderer.coordinateSystem;
    camera.updateProjectionMatrix();
    const projectionCamera = new THREE.PerspectiveCamera(40, SOURCE_WIDTH / SOURCE_HEIGHT, 0.01, 2);
    projectionCamera.coordinateSystem = renderer.coordinateSystem;
    projectionCamera.updateProjectionMatrix();

    const results = new Map<ScenarioId, ScenarioResult>();
    const displayTargets = new Map<string, THREE.RenderTarget>();
    let observedReadbackOrigin: "top" | "bottom" = "bottom";
    const renderTo = (scene: THREE.Scene, target: THREE.RenderTarget): void => {
      renderer.setRenderTarget(target);
      renderer.setViewport(0, 0, target.width, target.height);
      renderer.setScissorTest(false);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
    };

    const scenarioInputs = [
      { id: "full32", scale: 1, sampleCount: 32 },
      { id: "half32", scale: 0.5, sampleCount: 32 },
      { id: "half64", scale: 0.5, sampleCount: 64 },
    ] as const;

    for (const scenario of scenarioInputs) {
      const startedAt = performance.now();
      const gatherWidth = Math.floor(SOURCE_WIDTH * scenario.scale);
      const gatherHeight = Math.floor(SOURCE_HEIGHT * scenario.scale);
      const farTarget = makeRenderTarget(gatherWidth, gatherHeight, THREE.HalfFloatType);
      const nearTarget = makeRenderTarget(gatherWidth, gatherHeight, THREE.HalfFloatType);
      const b0Target = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.HalfFloatType);
      const b1Target = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.HalfFloatType);
      const nearSourceTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.HalfFloatType);
      const compositeTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.HalfFloatType);
      const decisionTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.UnsignedByteType);
      const sourceIdentityTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.FloatType);
      const gatherIdentityTarget = makeRenderTarget(gatherWidth, gatherHeight, THREE.FloatType);
      const centerProvenanceTarget = makeRenderTarget(gatherWidth, gatherHeight, THREE.FloatType);
      const selectedProvenanceTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.FloatType);
      const inputProbeTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.FloatType);
      const physicalProbeTarget = makeRenderTarget(SOURCE_WIDTH, SOURCE_HEIGHT, THREE.FloatType);
      targets.push(
        farTarget, nearTarget, b0Target, b1Target, nearSourceTarget, compositeTarget, decisionTarget,
        sourceIdentityTarget, gatherIdentityTarget, centerProvenanceTarget,
        selectedProvenanceTarget, inputProbeTarget, physicalProbeTarget,
      );
      targets.slice(-13).forEach((target) => renderer.initRenderTarget(target));

      const gatherNodes = createGroundGlassApertureGatherNodes({
        sourceColorTexture: inputs.source,
        sceneDepthTexture: inputs.depth,
        physicalTexture: inputs.physical,
        validityTexture: inputs.validity,
        state: {
          sourceWidthPx: SOURCE_WIDTH,
          sourceHeightPx: SOURCE_HEIGHT,
          sampledFilmWidthMm: 36,
          sampledFilmHeightMm: 24,
          maximumRadiusPx: 12,
          sampleCount: scenario.sampleCount,
          inverseProjection: projectionCamera.projectionMatrixInverse.clone(),
        },
      });
      const sourceIdentity = createGroundGlassSourceIdentityNode(SOURCE_WIDTH, SOURCE_HEIGHT);
      const gatherIdentity = createGroundGlassGatherIdentityNode(gatherWidth, gatherHeight);
      const centerProvenance = createGroundGlassGatherCenterProvenanceNode(
        sourceIdentityTarget.texture, SOURCE_WIDTH, SOURCE_HEIGHT,
      );
      const selectedProvenance = createGroundGlassSelectedGatherProvenanceNode({
        gatherIdentityTexture: gatherIdentityTarget.texture,
        gatherCenterProvenanceTexture: centerProvenanceTarget.texture,
      });
      const b1Nodes = createGroundGlassB1ReconstructionNodes({
        sourceColorTexture: inputs.source,
        gatherFarTexture: farTarget.texture,
        physicalTexture: inputs.physical,
        validityTexture: inputs.validity,
        gatherCenterProvenanceTexture: centerProvenanceTarget.texture,
        selectedProvenanceTexture: selectedProvenanceTarget.texture,
        sourceWidthPx: SOURCE_WIDTH,
        sourceHeightPx: SOURCE_HEIGHT,
        gatherWidthPx: gatherWidth,
        gatherHeightPx: gatherHeight,
      });
      const b0Node = Fn(() => {
        const value = texture(farTarget.texture, TOP_UV);
        return vec4(value.rgb, 1);
      })();
      const inputProbeNode = Fn(() => {
        const color = texture(inputs.source, TOP_UV);
        const depth = texture(inputs.depth, TOP_UV).r;
        return vec4(color.rgb, depth);
      })();
      const physicalProbeNode = Fn(() => {
        const physical = texture(inputs.physical, TOP_UV);
        const validityCode = texture(inputs.validity, TOP_UV).r.mul(255);
        return vec4(physical.r, physical.g, physical.b, validityCode);
      })();
      const nearSourceNode = Fn(() => {
        const value = texture(nearTarget.texture, TOP_UV);
        return vec4(value.rgb, value.a);
      })();
      const nodesToScenes: Array<readonly [string, NonNullable<MeshBasicNodeMaterial["outputNode"]>]> = [
        ["source-identity", sourceIdentity.outputNode],
        ["gather-identity", gatherIdentity.outputNode],
        ["center-provenance", centerProvenance.outputNode],
        ["selected-provenance", selectedProvenance],
        ["far-gather", gatherNodes.farOutput],
        ["near-gather", gatherNodes.nearOutput],
        ["far-b0", b0Node],
        ["far-b1", b1Nodes.farOutput],
        ["b1-decision", b1Nodes.decisionOutput],
        ["near-source-grid", nearSourceNode],
        ["research-composite", createGroundGlassResearchCompositeNode({
          farTexture: b1Target.texture,
          nearTexture: nearTarget.texture,
        })],
        ["input-probe", inputProbeNode],
        ["physical-probe", physicalProbeNode],
      ];
      const sceneById = new Map<string, THREE.Scene>();
      for (const [id, node] of nodesToScenes) {
        const material = new MeshBasicNodeMaterial({ toneMapped: false });
        material.outputNode = node;
        materials.push(material);
        const scene = new THREE.Scene();
        scene.add(new THREE.Mesh(geometry, material));
        scenes.push(scene);
        sceneById.set(id, scene);
      }
      const renderNamed = (id: string, target: THREE.RenderTarget): void => {
        const scene = sceneById.get(id);
        if (!scene) throw new Error(`Missing RQ3C stage scene ${id}`);
        renderTo(scene, target);
      };

      renderNamed("source-identity", sourceIdentityTarget);
      renderNamed("gather-identity", gatherIdentityTarget);
      renderNamed("center-provenance", centerProvenanceTarget);
      renderNamed("far-gather", farTarget);
      renderNamed("near-gather", nearTarget);
      renderNamed("selected-provenance", selectedProvenanceTarget);
      renderNamed("far-b0", b0Target);
      renderNamed("far-b1", b1Target);
      renderNamed("b1-decision", decisionTarget);
      renderNamed("near-source-grid", nearSourceTarget);
      renderNamed("research-composite", compositeTarget);
      renderNamed("input-probe", inputProbeTarget);
      renderNamed("physical-probe", physicalProbeTarget);
      const sourceIdentityReadback = await renderer.readRenderTargetPixelsAsync(
        sourceIdentityTarget, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT,
      );
      const compactSourceIdentity = compactReadbackRows(
        sourceIdentityReadback as Uint8Array | Uint16Array | Float32Array,
        SOURCE_WIDTH,
        SOURCE_HEIGHT,
      );
      const readbackOrigin = inferReadbackOrigin(
        asFloatRgba(compactSourceIdentity), SOURCE_WIDTH, SOURCE_HEIGHT,
      );
      observedReadbackOrigin = readbackOrigin;
      const readPixel = (target: THREE.RenderTarget, x: number, yTop: number) =>
        readTopPixel(renderer, target, x, yTop, readbackOrigin);

      const [sourcePixel, nearCenterPixel] = await Promise.all([
        readPixel(inputProbeTarget, ...PROBE_SOURCE),
        readPixel(inputProbeTarget, ...NEAR_CENTER),
      ]);
      const [sourcePhysicalPixel, nearCenterPhysicalPixel] = await Promise.all([
        readPixel(physicalProbeTarget, ...PROBE_SOURCE),
        readPixel(physicalProbeTarget, ...NEAR_CENTER),
      ]);
      const featureGatherX = Math.floor((FAR_FEATURE_SOURCE[0] + 0.5) * gatherWidth / SOURCE_WIDTH);
      const featureGatherY = Math.floor((FAR_FEATURE_SOURCE[1] + 0.5) * gatherHeight / SOURCE_HEIGHT);
      const [featureColorAndDepth, featurePhysicalAndValidity, featureSelectedProvenance,
        featureGatherIdentity, featureCenterProvenance, featureFarGather,
        featureB0, featureB1] = await Promise.all([
        readPixel(inputProbeTarget, ...FAR_FEATURE_SOURCE),
        readPixel(physicalProbeTarget, ...FAR_FEATURE_SOURCE),
        readPixel(selectedProvenanceTarget, ...FAR_FEATURE_SOURCE),
        readPixel(gatherIdentityTarget, featureGatherX, featureGatherY),
        readPixel(centerProvenanceTarget, featureGatherX, featureGatherY),
        readPixel(farTarget, featureGatherX, featureGatherY),
        readPixel(b0Target, ...FAR_FEATURE_SOURCE),
        readPixel(b1Target, ...FAR_FEATURE_SOURCE),
      ]);
      const [sourceIdentityAtProbe, gatherIdentityAtSelected, centerProvenanceAtSelected,
        selectedProvenanceAtProbe, farTargetAtSelected, nearTargetAtSelected,
        b0AtProbe, b1AtProbe, decisionAtProbe, compositeAtProbe] = await Promise.all([
        readPixel(sourceIdentityTarget, ...PROBE_SOURCE),
        readPixel(gatherIdentityTarget, Math.floor((PROBE_SOURCE[0] + 0.5) * gatherWidth / SOURCE_WIDTH),
          Math.floor((PROBE_SOURCE[1] + 0.5) * gatherHeight / SOURCE_HEIGHT)),
        readPixel(centerProvenanceTarget,
          Math.floor((PROBE_SOURCE[0] + 0.5) * gatherWidth / SOURCE_WIDTH),
          Math.floor((PROBE_SOURCE[1] + 0.5) * gatherHeight / SOURCE_HEIGHT)),
        readPixel(selectedProvenanceTarget, ...PROBE_SOURCE),
        readPixel(farTarget,
          Math.floor((PROBE_SOURCE[0] + 0.5) * gatherWidth / SOURCE_WIDTH),
          Math.floor((PROBE_SOURCE[1] + 0.5) * gatherHeight / SOURCE_HEIGHT)),
        readPixel(nearTarget,
          Math.floor((PROBE_SOURCE[0] + 0.5) * gatherWidth / SOURCE_WIDTH),
          Math.floor((PROBE_SOURCE[1] + 0.5) * gatherHeight / SOURCE_HEIGHT)),
        readPixel(b0Target, ...PROBE_SOURCE),
        readPixel(b1Target, ...PROBE_SOURCE),
        readPixel(decisionTarget, ...PROBE_SOURCE),
        readPixel(compositeTarget, ...PROBE_SOURCE),
      ]);

      const b0 = await readTopImage(renderer, b0Target, readbackOrigin);
      const b1 = await readTopImage(renderer, b1Target, readbackOrigin);
      const near = await readTopImage(renderer, nearSourceTarget, readbackOrigin);
      let farEdgeLeakPixelsB0 = 0;
      let farEdgeLeakEnergyB0 = 0;
      let farEdgeLeakPixelsB1 = 0;
      let farEdgeLeakEnergyB1 = 0;
      let nearSpreadPixels = 0;
      let nearCoverageEnergy = 0;
      let farFeatureSpreadPixelsB0 = 0;
      let farFeatureSpreadEnergyB0 = 0;
      let farFeatureSpreadPixelsB1 = 0;
      let farFeatureSpreadEnergyB1 = 0;
      for (let yTop = 0; yTop < SOURCE_HEIGHT; yTop += 1) {
        for (let x = 0; x < SOURCE_WIDTH; x += 1) {
          const offset = (yTop * SOURCE_WIDTH + x) * 4;
          const isNear = x + yTop >= 96;
          const nearDistance = Math.abs(x + yTop - 96);
          if (!isNear && nearDistance <= 2) {
            const redB0 = Math.max(0, (b0[offset] ?? 0) - (inputs.farColor[0] ?? 0));
            const redB1 = Math.max(0, (b1[offset] ?? 0) - (inputs.farColor[0] ?? 0));
            if (redB0 > 0.25) farEdgeLeakPixelsB0 += 1;
            if (redB1 > 0.25) farEdgeLeakPixelsB1 += 1;
            farEdgeLeakEnergyB0 += redB0;
            farEdgeLeakEnergyB1 += redB1;
          }
          const nearAlpha = near[(yTop * SOURCE_WIDTH + x) * 4 + 3] ?? 0;
          if (!isNear && nearDistance <= 4 && nearAlpha > 0.01) {
            nearSpreadPixels += 1;
            nearCoverageEnergy += nearAlpha;
          }
          const inFeature = x >= YELLOW_FEATURE.left && x < YELLOW_FEATURE.right
            && yTop >= YELLOW_FEATURE.top && yTop < YELLOW_FEATURE.bottom;
          const dxToFeature = x < YELLOW_FEATURE.left ? YELLOW_FEATURE.left - x
            : x >= YELLOW_FEATURE.right ? x - YELLOW_FEATURE.right + 1 : 0;
          const dyToFeature = yTop < YELLOW_FEATURE.top ? YELLOW_FEATURE.top - yTop
            : yTop >= YELLOW_FEATURE.bottom ? yTop - YELLOW_FEATURE.bottom + 1 : 0;
          const withinFarFeatureSupport = (dxToFeature / 4.27) ** 2 + (dyToFeature / 4.8) ** 2 <= 1;
          if (!isNear && !inFeature && withinFarFeatureSupport) {
            const backgroundYellowSignal = Math.min(inputs.farColor[0], inputs.farColor[1]);
            const signalB0 = Math.max(0, Math.min(b0[offset] ?? 0, b0[offset + 1] ?? 0) - backgroundYellowSignal);
            const signalB1 = Math.max(0, Math.min(b1[offset] ?? 0, b1[offset + 1] ?? 0) - backgroundYellowSignal);
            if (signalB0 > 0.02) farFeatureSpreadPixelsB0 += 1;
            if (signalB1 > 0.02) farFeatureSpreadPixelsB1 += 1;
            farFeatureSpreadEnergyB0 += signalB0;
            farFeatureSpreadEnergyB1 += signalB1;
          }
        }
      }

      const stagesAtProbe = {
        sourcePixelTopOrigin: PROBE_SOURCE,
        sourceColorAndDepthGpu: sourcePixel,
        sourceIdentityGpu: sourceIdentityAtProbe,
        sourcePhysicalAndValidityGpu: sourcePhysicalPixel,
        selectedGatherTexelTopOrigin: gatherIdentityAtSelected.slice(0, 2),
        selectedGatherTexelIdentityGpu: gatherIdentityAtSelected,
        observedGatherCenterSourceIdentityGpu: centerProvenanceAtSelected,
        selectedProvenanceGpu: selectedProvenanceAtProbe,
        observedNearCenterSourceTopOrigin: NEAR_CENTER,
        nearCenterColorAndDepthGpu: nearCenterPixel,
        nearCenterPhysicalAndValidityGpu: nearCenterPhysicalPixel,
        farGatherAtSelectedTexelGpu: farTargetAtSelected,
        nearGatherAndCoverageAtSelectedTexelGpu: nearTargetAtSelected,
        mappedFarB0AtSourcePixelGpu: b0AtProbe,
        b1FarAtSourcePixelGpu: b1AtProbe,
        b1DecisionAtSourcePixelGpu: decisionAtProbe,
        finalResearchCompositeAtSourcePixelGpu: compositeAtProbe,
        physicalCocSource: "controlled M4-like synthetic texture; no M4 equation or registered scene claim",
        farFeatureProbeGpu: {
          sourcePixelTopOrigin: FAR_FEATURE_SOURCE,
          sourceColorAndDepth: featureColorAndDepth,
          sourcePhysicalAndValidity: featurePhysicalAndValidity,
          selectedProvenance: featureSelectedProvenance,
          selectedGatherIdentity: featureGatherIdentity,
          observedGatherCenterSourceIdentity: featureCenterProvenance,
          farGatherAtSelectedTexel: featureFarGather,
          mappedFarB0AtSourcePixel: featureB0,
          b1FarAtSourcePixel: featureB1,
        },
      };
      const scenarioResult: ScenarioResult = {
        scenarioId: scenario.id,
        gatherSize: { widthPx: gatherWidth, heightPx: gatherHeight },
        sampleCount: scenario.sampleCount,
        stagesAtProbe,
        metrics: {
          farEdgeLeakPixelsB0,
          farEdgeLeakEnergyB0,
          farEdgeLeakPixelsB1,
          farEdgeLeakEnergyB1,
          nearSpreadPixels,
          nearCoverageEnergy,
          farFeatureSpreadPixelsB0,
          farFeatureSpreadEnergyB0,
          farFeatureSpreadPixelsB1,
          farFeatureSpreadEnergyB1,
        },
        timings: {
          renderAndReadbackMs: performance.now() - startedAt,
          gpuTimestampDurationMs: null,
        },
      };
      results.set(scenario.id, scenarioResult);
      displayTargets.set(`${scenario.id}:far-b0`, b0Target);
      displayTargets.set(`${scenario.id}:far-b1`, b1Target);
      displayTargets.set(`${scenario.id}:near`, nearSourceTarget);
      displayTargets.set(`${scenario.id}:composite`, compositeTarget);
    }

    const result: Rq3cResult = {
      schemaVersion: 1,
      evidenceClass: "synthetic-shared-tsl-research",
      sourceCommit: "provided-by-playwright-test",
      sourceTreeDirty: true,
      sceneSourceRevision: null,
      rendererRevision: THREE.REVISION,
      runtime: {
        rendererFamily: runtime.rendererFamily,
        actualExecutionApi: runtime.executionBackend,
        internalFallback: runtime.executionBackend === "webgpu" ? "none" : "not-native",
        applicationFallback: "not-applicable",
      },
      coordinateContract: {
        sourcePixels: "integer top-origin",
        gatherPixels: "integer top-origin",
        fullscreenTextureUv: "(u, 1-v)",
        targetReadbackOrigin: observedReadbackOrigin,
        targetReadbackConversion: "identity-verified origin; reverse rows only when bottom-origin",
        filter: "nearest, clamp-to-edge, no mipmaps",
      },
      controlledInputs: {
        dimensions: { widthPx: SOURCE_WIDTH, heightPx: SOURCE_HEIGHT },
        nearMask: "x + y >= 96",
        sourceColor: { near: inputs.nearColor, far: inputs.farColor, farFeature: inputs.farFeature },
        signedPhysicalCocMm: { near: -1.5615, far: 0.9258 },
        depthMap: "synthetic normalized depth values: near 0.45, far 0.62",
        validityCode: 1,
        filmMm: [36, 24],
        maxRadiusPx: 12,
      },
      scenarios: Array.from(results.values()),
    };
    resultElement.textContent = JSON.stringify(result, null, 2);

    const display = async (scenarioId: ScenarioId, layer: LayerId): Promise<void> => {
      const target = displayTargets.get(`${scenarioId}:${layer}`);
      if (!target) throw new Error(`Missing display target ${scenarioId}:${layer}`);
      displayMaterials.forEach((material) => material.dispose());
      displayMaterials = [];
      displayScene?.clear();
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      material.colorNode = texture(target.texture, TOP_UV);
      displayMaterials.push(material);
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(geometry!, material));
      displayScene = scene;
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    };
    window.__rq3c = { result, display, dispose };
    published = true;
    await display("half32", "far-b0");
    status.textContent = "complete";
  } catch (error) {
    status.textContent = "failed";
    resultElement.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    throw error;
  } finally {
    if (!published) await dispose();
  }
};

void main().catch((error: unknown) => {
  const status = document.querySelector<HTMLElement>("#status");
  if (status) status.textContent = "failed";
  console.error(error);
});
