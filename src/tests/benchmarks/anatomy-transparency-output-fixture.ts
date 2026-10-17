import * as THREE from "three";
import {
  MaterialAwareMaterialTracker,
  isMaterialAwareRenderable,
  readObserverOutputSourceMaterial,
} from "../../render/backend/materialAwareMaterialTracker";
import { getObserverMaterialSignatures } from "../../render/backend/observerMaterialSignatures";
import { resolveObserverRendererRuntime } from "../../render/backend/observerVisualPipelineCapabilities";

type OutputMode = "standard" | "material-aware";
type SourceFamily = "basic" | "standard" | "line";
type Layout = "grid" | "alpha-grid" | "overlap" | "depth" | "mutation";
type FixtureCommand = Readonly<{
  layout: Layout;
  family?: SourceFamily;
  layerCount?: number;
  order?: "natural" | "near-first" | "far-first";
  depthWrite?: boolean;
  premultipliedAlpha?: boolean;
  stage?: "normal" | "highlighted" | "dimmed" | "ghost" | "aperture" | "rear-back-replacement";
}>;

type FixtureWindow = Window & {
  __setAnatomyOutputFixture?: (command: FixtureCommand) => void;
};

type FixtureRenderer = THREE.WebGLRenderer & {
  isWebGPURenderer?: boolean;
  alpha?: boolean;
  init?: () => Promise<void>;
};

const query = new URLSearchParams(window.location.search);
const backend = query.get("backend") === "webgpu" ? "webgpu" : "webgl";
const outputMode: OutputMode = query.get("output") === "material-aware" ? "material-aware" : "standard";
const outputPolicy = backend === "webgpu" ? outputMode : "standard";
const alphaValues = [1, 0.9, 0.5, 0.25, 0.16, 0.08] as const;
const colors = [
  { name: "gray", hex: "#808080" },
  { name: "white", hex: "#ffffff" },
  { name: "amber", hex: "#f59e0b" },
  { name: "dark", hex: "#111827" },
] as const;
const backgroundColor = "#64748b";
const canvasAlpha = true;
const gridWidth = 16;
const gridHeight = 9;
const canvas = document.createElement("canvas");
canvas.setAttribute("aria-label", "Anatomy material output investigation fixture");
document.body.append(canvas);

let renderer: FixtureRenderer;
let scene = new THREE.Scene();
let camera: THREE.OrthographicCamera;
let visualGroup = new THREE.Group();
let tracker: MaterialAwareMaterialTracker | null = null;
let trackerFrame = 0;
let command: FixtureCommand = { layout: "grid", family: "basic" };
let mutationSource: THREE.Material | null = null;
let mutationMesh: THREE.Mesh | null = null;
let renderFrame = 0;
let drawCalls: Array<{ name: string; renderOrder: number; z: number }> = [];
let fixtureError: string | null = null;
const sourceByRenderable = new WeakMap<THREE.Object3D, THREE.Material>();

const setError = (error: unknown): void => {
  fixtureError = error instanceof Error ? error.message : String(error);
  document.body.dataset.fixtureError = fixtureError;
};

const recordMaterial = (material: THREE.Material) => {
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: number;
    side?: number;
    toneMapped?: boolean;
    alphaTest?: number;
    roughness?: number;
    metalness?: number;
  };
  return {
    uuid: candidate.uuid,
    type: candidate.type,
    family: candidate.constructor.name,
    colorLinear: candidate.color
      ? [candidate.color.r, candidate.color.g, candidate.color.b]
      : null,
    colorSrgbHex: candidate.color?.getHexString(THREE.SRGBColorSpace) ?? null,
    emissiveLinear: candidate.emissive
      ? [candidate.emissive.r, candidate.emissive.g, candidate.emissive.b]
      : null,
    emissiveIntensity: candidate.emissiveIntensity ?? null,
    opacity: candidate.opacity ?? null,
    transparent: candidate.transparent ?? null,
    blending: candidate.blending ?? null,
    premultipliedAlpha: candidate.premultipliedAlpha,
    depthTest: candidate.depthTest ?? null,
    depthWrite: candidate.depthWrite ?? null,
    side: candidate.side ?? null,
    toneMapped: candidate.toneMapped ?? null,
    alphaTest: candidate.alphaTest ?? null,
    roughness: candidate.roughness ?? null,
    metalness: candidate.metalness ?? null,
    version: candidate.version,
  };
};

const makeSourceMaterial = (
  family: SourceFamily,
  options: {
    color: string;
    opacity: number;
    transparent: boolean;
    toneMapped: boolean;
    depthWrite?: boolean;
    depthTest?: boolean;
    premultipliedAlpha?: boolean;
  },
): THREE.Material => {
  const common = {
    color: options.color,
    opacity: options.opacity,
    transparent: options.transparent,
    toneMapped: options.toneMapped,
    depthWrite: options.depthWrite ?? !options.transparent,
    depthTest: options.depthTest ?? true,
    premultipliedAlpha: options.premultipliedAlpha ?? false,
    side: THREE.DoubleSide,
  };
  if (family === "basic") return new THREE.MeshBasicMaterial(common);
  if (family === "standard") {
    return new THREE.MeshStandardMaterial({
      ...common,
      roughness: 0.72,
      metalness: 0,
    });
  }
  return new THREE.LineBasicMaterial(common);
};

const removeVisuals = (): void => {
  tracker?.dispose();
  tracker = null;
  mutationSource = null;
  mutationMesh = null;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  visualGroup.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry);
      const assigned = object.material;
      if (Array.isArray(assigned)) assigned.forEach((material) => materials.add(material));
      else materials.add(assigned);
    }
  });
  scene.remove(visualGroup);
  visualGroup.clear();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
};

const installTrackingForCandidate = (): void => {
  if (outputPolicy !== "material-aware") return;
  tracker = new MaterialAwareMaterialTracker(trackerFrame + 1);
};

const addDrawObserver = (object: THREE.Object3D): void => {
  object.onBeforeRender = () => {
    if (command.layout === "grid") return;
    drawCalls.push({
      name: object.name,
      renderOrder: object.renderOrder,
      z: Number(object.position.z.toFixed(4)),
    });
  };
};

const addBackground = (): void => {
  const geometry = new THREE.PlaneGeometry(gridWidth, gridHeight);
  const material = new THREE.MeshBasicMaterial({
    color: backgroundColor,
    toneMapped: false,
    depthTest: true,
    depthWrite: true,
  });
  const background = new THREE.Mesh(geometry, material);
  background.name = "opaque-reference-background";
  background.position.z = -2;
  sourceByRenderable.set(background, material);
  visualGroup.add(background);
};

const addGrid = (family: SourceFamily): void => {
  const planeGeometry = new THREE.PlaneGeometry(0.78, 0.72);
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.36, 0, 0),
    new THREE.Vector3(0.36, 0, 0),
  ]);

  let column = 0;
  for (const color of colors) {
    for (const toneMapped of [true, false]) {
      for (const transparent of [true, false]) {
        for (let row = 0; row < alphaValues.length; row += 1) {
          const opacity = alphaValues[row]!;
          const material = makeSourceMaterial(family, {
            color: color.hex,
            opacity,
            transparent,
            toneMapped,
            depthWrite: transparent ? false : true,
          });
          const geometry = family === "line" ? lineGeometry : planeGeometry;
          const object = family === "line"
            ? new THREE.Line(geometry, material)
            : new THREE.Mesh(geometry, material);
          object.name = "grid-" + family + "-" + color.name +
            "-tone-" + String(toneMapped) + "-transparent-" +
            String(transparent) + "-alpha-" + opacity;
          object.position.set(column - 7.5, 2.5 - row, 0);
          sourceByRenderable.set(object, material);
          addDrawObserver(object);
          visualGroup.add(object);
        }
        column += 1;
      }
    }
  }
};

const addPlane = (
  name: string,
  material: THREE.Material,
  z: number,
  renderOrder = 0,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), material);
  mesh.name = name;
  mesh.position.z = z;
  mesh.renderOrder = renderOrder;
  sourceByRenderable.set(mesh, material);
  addDrawObserver(mesh);
  visualGroup.add(mesh);
  return mesh;
};

const addOverlap = (
  layerCount: number,
  order: "natural" | "near-first" | "far-first",
  premultipliedAlpha: boolean,
): void => {
  const layerDefinitions = [
    { name: "far", color: "#16a34a", opacity: 0.28, z: -0.5 },
    { name: "middle", color: "#60a5fa", opacity: 0.36, z: 0 },
    { name: "near", color: "#f59e0b", opacity: 0.45, z: 0.5 },
  ] as const;
  const active = layerDefinitions.slice(0, Math.max(1, Math.min(3, layerCount)));
  active.forEach((layer, index) => {
    const renderOrder = order === "natural"
      ? 0
      : order === "near-first"
        ? active.length - index - 1
        : index;
    const material = makeSourceMaterial("basic", {
      color: layer.color,
      opacity: layer.opacity,
      transparent: true,
      toneMapped: true,
      depthWrite: false,
      premultipliedAlpha,
    });
    const plane = addPlane("overlap-" + layer.name, material, layer.z, renderOrder);
    plane.rotation.set(index === 0 ? 0.12 : index === 1 ? -0.1 : 0.08, index === 1 ? 0.16 : -0.12, 0);
  });
};

const applyMutationStage = (
  stage: NonNullable<FixtureCommand["stage"]>,
): void => {
  if (!mutationSource || !mutationMesh) return;
  if (stage === "rear-back-replacement") {
    const replacement = makeSourceMaterial("basic", {
      color: "#475569",
      opacity: 0.4,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    mutationMesh.material = replacement;
    mutationSource = replacement;
    sourceByRenderable.set(mutationMesh, replacement);
    return;
  }

  const values = stage === "normal"
    ? { color: "#111827", opacity: 1, transparent: false, depthWrite: true, toneMapped: true }
    : stage === "highlighted"
      ? { color: "#f59e0b", opacity: 1, transparent: false, depthWrite: true, toneMapped: true }
      : stage === "dimmed"
        ? { color: "#111827", opacity: 0.25, transparent: true, depthWrite: false, toneMapped: true }
        : stage === "ghost"
          ? { color: "#111827", opacity: 0.35, transparent: true, depthWrite: false, toneMapped: true }
          : { color: "#f59e0b", opacity: 0.08, transparent: true, depthWrite: false, toneMapped: false };
  const source = mutationSource as THREE.Material & {
    color?: THREE.Color;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    toneMapped: boolean;
  };
  source.color?.set(values.color);
  source.opacity = values.opacity;
  source.transparent = values.transparent;
  source.depthWrite = values.depthWrite;
  source.toneMapped = values.toneMapped;
  source.needsUpdate = true;
};

const buildVisuals = (nextCommand: FixtureCommand): void => {
  if (nextCommand.layout === "mutation" && command.layout === "mutation" && mutationMesh) {
    command = nextCommand;
    applyMutationStage(nextCommand.stage ?? "normal");
    return;
  }

  removeVisuals();
  command = nextCommand;
  visualGroup = new THREE.Group();
  visualGroup.name = "anatomy-output-investigation-scene";
  scene.add(visualGroup);
  const clearAlphaView = nextCommand.layout === "alpha-grid";
  document.body.style.background = clearAlphaView ? "transparent" : backgroundColor;
  document.documentElement.style.background = clearAlphaView ? "transparent" : backgroundColor;
  if (nextCommand.layout !== "alpha-grid") addBackground();

  if (nextCommand.layout === "grid" || nextCommand.layout === "alpha-grid") {
    addGrid(nextCommand.family ?? "basic");
  } else if (nextCommand.layout === "overlap") {
    addOverlap(
      nextCommand.layerCount ?? 1,
      nextCommand.order ?? "natural",
      nextCommand.premultipliedAlpha ?? false,
    );
  } else if (nextCommand.layout === "depth") {
    const opaqueOccluder = makeSourceMaterial("basic", {
      color: "#1f2937",
      opacity: 1,
      transparent: false,
      toneMapped: false,
      depthWrite: true,
    });
    addPlane("opaque-subject-control", opaqueOccluder, -0.15);
    const transparentMaterial = makeSourceMaterial("basic", {
      color: "#f59e0b",
      opacity: 0.5,
      transparent: true,
      toneMapped: true,
      depthWrite: nextCommand.depthWrite ?? false,
      depthTest: true,
    });
    addPlane("transparent-front-plane", transparentMaterial, 0.35, nextCommand.order === "near-first" ? 0 : 1);
    const behindMaterial = makeSourceMaterial("basic", {
      color: "#60a5fa",
      opacity: 0.5,
      transparent: true,
      toneMapped: true,
      depthWrite: false,
      depthTest: true,
    });
    addPlane("transparent-back-plane", behindMaterial, 0.05, nextCommand.order === "near-first" ? 1 : 0);
  } else {
    const source = makeSourceMaterial("standard", {
      color: "#111827",
      opacity: 1,
      transparent: false,
      toneMapped: true,
      depthWrite: true,
    });
    mutationMesh = addPlane("mutable-camera-part", source, 0);
    mutationSource = source;
    applyMutationStage(nextCommand.stage ?? "normal");
  }

  installTrackingForCandidate();
};

const captureSnapshot = (): void => {
  const objects: Array<Record<string, unknown>> = [];
  visualGroup.traverse((object) => {
    if (!isMaterialAwareRenderable(object)) return;
    const attached = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!attached) return;
    const source = readObserverOutputSourceMaterial(attached) ??
      sourceByRenderable.get(object) ??
      attached;
    objects.push({
      name: object.name,
      objectId: object.id,
      position: object.position.toArray(),
      renderOrder: object.renderOrder,
      source: recordMaterial(source),
      output: recordMaterial(attached),
      sameMaterialIdentity: source === attached,
      sourceSignatures: getObserverMaterialSignatures(source),
    });
  });
  document.body.dataset.sceneSnapshot = JSON.stringify({
    layout: command.layout,
    family: command.family ?? null,
    stage: command.stage ?? null,
    frame: renderFrame,
    rendererFamily: document.body.dataset.rendererFamily,
    executionBackend: document.body.dataset.executionBackend,
    toneMapping: String(renderer.toneMapping),
    outputColorSpace: renderer.outputColorSpace,
    canvas: [canvas.width, canvas.height],
    camera: {
      position: camera.position.toArray(),
      quaternion: camera.quaternion.toArray(),
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
    },
    objects,
    drawOrder: drawCalls.slice(),
  });
};

const reconcileMaterials = (): void => {
  if (!tracker) return;
  trackerFrame += 1;
  visualGroup.traverse((object) => {
    if (!isMaterialAwareRenderable(object)) return;
    const current = object.material;
    const currentMaterials = Array.isArray(current) ? current : [current];
    const result = tracker!.reconcileRenderable(
      object,
      tracker!.controllerOwner,
      trackerFrame,
      getObserverMaterialSignatures,
    );
    if (result.materials.length !== currentMaterials.length) {
      throw new Error("Material tracker returned a mismatched material-slot count");
    }
    const changed = result.materials.some((material, index) => material !== currentMaterials[index]);
    if (changed) {
      object.material = Array.isArray(current) ? result.materials : result.materials[0]!;
    }
  });
  tracker.releaseStaleMaterials(trackerFrame);
};

const start = async (): Promise<void> => {
  try {
    document.body.dataset.fixtureError = "";
    document.body.dataset.fixtureReady = "pending";
    document.body.dataset.factoryAttempts = "0";
    document.body.dataset.applicationFallback = "none";
    document.body.dataset.initializationFailure = "none";
    document.body.dataset.outputPolicy = outputPolicy;

    if (backend === "webgpu") {
      document.body.dataset.factoryAttempts = "1";
      const gpu = (navigator as Navigator & {
        gpu?: { requestAdapter: () => Promise<unknown | null> };
      }).gpu;
      document.body.dataset.browserWebGpuApiPresent = String(Boolean(gpu));
      if (!gpu) throw new Error("navigator.gpu is unavailable");
      try {
        const adapter = await gpu.requestAdapter();
        document.body.dataset.adapterAvailability = adapter ? "available" : "unavailable";
      } catch {
        document.body.dataset.adapterAvailability = "request-rejected";
      }
      const { WebGPURenderer } = await import("three/webgpu");
    const webgpu = new WebGPURenderer({
        canvas,
      alpha: canvasAlpha,
        antialias: false,
        powerPreference: "high-performance",
      });
      try {
        await webgpu.init();
      } catch (error) {
        document.body.dataset.initializationFailure = "initialization";
        throw error;
      }
      renderer = webgpu as unknown as FixtureRenderer;
    } else {
      document.body.dataset.browserWebGpuApiPresent = String("gpu" in navigator);
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: canvasAlpha,
        antialias: false,
        powerPreference: "high-performance",
      });
    }

    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.toneMapping = outputPolicy === "material-aware"
      ? THREE.NoToneMapping
      : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = outputPolicy === "material-aware"
      ? THREE.LinearSRGBColorSpace
      : THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight("#ffffff", 0.7));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(0, 0, 5);
    scene.add(key);
    camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 50);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    buildVisuals(command);
    document.body.dataset.activeLayout = command.layout;
    document.body.dataset.activeFamily = command.family ?? "";
    document.body.dataset.activeStage = command.stage ?? "";

    const runtime = resolveObserverRendererRuntime(
      renderer as unknown as Parameters<typeof resolveObserverRendererRuntime>[0],
    );
    document.body.dataset.rendererFamily = runtime.rendererFamily;
    document.body.dataset.executionBackend = runtime.executionBackend;
    document.body.dataset.rendererToneMapping = String(renderer.toneMapping);
    document.body.dataset.rendererOutputColorSpace = renderer.outputColorSpace;
    document.body.dataset.outputPolicyStatus = outputPolicy === "material-aware" ? "active" : "standard";
    document.body.dataset.rendererAlpha = String(renderer.alpha ?? renderer.getContextAttributes?.()?.alpha ?? "unknown");

    const canvasWindow = window as FixtureWindow;
    canvasWindow.__setAnatomyOutputFixture = (nextCommand) => {
      drawCalls = [];
      buildVisuals(nextCommand);
      document.body.dataset.activeLayout = nextCommand.layout;
      document.body.dataset.activeFamily = nextCommand.family ?? "";
      document.body.dataset.activeStage = nextCommand.stage ?? "";
    };
    document.body.dataset.fixtureReady = "true";

    const render = () => {
      if (fixtureError) return;
      try {
        drawCalls = [];
        reconcileMaterials();
        renderer.render(scene, camera);
        renderFrame += 1;
        document.body.dataset.renderFrames = String(renderFrame);
        document.body.dataset.drawOrder = JSON.stringify(drawCalls);
        if (renderFrame % 2 === 0) captureSnapshot();
        requestAnimationFrame(render);
      } catch (error) {
        setError(error);
      }
    };
    requestAnimationFrame(render);
  } catch (error) {
    setError(error);
  }
};

window.addEventListener("vcs:anatomy-transparency-fixture", (event) => {
  const detail = (event as CustomEvent<FixtureCommand>).detail;
  if (!detail || !renderer) return;
  try {
    (window as FixtureWindow).__setAnatomyOutputFixture?.(detail);
  } catch (error) {
    setError(error);
  }
});

window.addEventListener("pagehide", () => {
  tracker?.dispose();
  renderer?.dispose();
});

void start();
