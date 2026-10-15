import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { color, vec4, workingToColorSpace } from "three/tsl";
import {
  resolveObserverRendererRuntime,
  resolveObserverVisualPipelineCapabilities,
  type ObserverVisualPipelineCapabilities,
} from "./observerVisualPipelineCapabilities";
import { observerOutputSourceMaterial } from "./observerMaterialOutputIdentity";
import {
  adaptObserverMaterialForOutput,
  OBSERVER_MATERIAL_MAP_SLOTS,
  type MaterialAwareNode,
} from "./materialAwareNodeMaterials";

const MAP_SLOTS = OBSERVER_MATERIAL_MAP_SLOTS;

type MaterialWithMaps = THREE.Material & Partial<Record<(typeof MAP_SLOTS)[number], THREE.Texture | null>>;
type Renderable = (THREE.Mesh | THREE.Line | THREE.Points) & {
  material: THREE.Material | THREE.Material[];
};
type AdapterOwnership = "architecture-rise-subject" | "observer-output-policy";
type ManagedNodeMaterial = Readonly<{
  source: THREE.Material;
  output: MaterialAwareNode;
  ownership: AdapterOwnership;
  lastSeenFrame: number;
  signature: string;
  shaderSignature: string;
}>;

type DurationWindow = {
  values: Float64Array;
  next: number;
  count: number;
  totalMs: number;
  maxMs: number;
};

type OutputPolicyPerformance = {
  schemaVersion: 1;
  rendererGeneration: number;
  detailedSampleIntervalFrames: number;
  inventoryRefreshIntervalFrames: number;
  frameCount: number;
  managedMaterialCount: number;
  materialAssignmentCount: number;
  adaptedMaterialCreations: number;
  materialAssignmentReplacements: number;
  materialSignatureEvaluations: number;
  inventoryBuildCount: number;
  disposedNodeMaterials: number;
  diagnosticDomWrites: number;
  sceneTraversal: DurationWindow;
  materialSignatures: DurationWindow;
  materialAdaptation: DurationWindow;
  staleCleanup: DurationWindow;
  inventoryAndDiagnostics: DurationWindow;
  controllerCallback: DurationWindow;
};

const PERFORMANCE_WINDOW_SIZE = 600;
const DETAILED_SAMPLE_INTERVAL_FRAMES = 30;
const INVENTORY_REFRESH_INTERVAL_FRAMES = 60;
const READ_PERFORMANCE_EVENT = "vcs:observer-verification:read-output-policy-performance";

const createDurationWindow = (): DurationWindow => ({
  values: new Float64Array(PERFORMANCE_WINDOW_SIZE),
  next: 0,
  count: 0,
  totalMs: 0,
  maxMs: 0,
});

const recordDuration = (window: DurationWindow, durationMs: number): void => {
  window.values[window.next] = durationMs;
  window.next = (window.next + 1) % window.values.length;
  window.count += 1;
  window.totalMs += durationMs;
  window.maxMs = Math.max(window.maxMs, durationMs);
};

const summarizeDurationWindow = (window: DurationWindow) => {
  const rollingSampleCount = Math.min(window.count, window.values.length);
  const rollingValues = window.count <= window.values.length
    ? Array.from(window.values.slice(0, rollingSampleCount))
    : Array.from(window.values);
  rollingValues.sort((left, right) => left - right);
  const percentile = (fraction: number): number | null => rollingValues.length === 0
    ? null
    : rollingValues[Math.min(rollingValues.length - 1, Math.ceil(rollingValues.length * fraction) - 1)] ?? null;
  return {
    sampleCount: window.count,
    rollingSampleCount,
    cumulativeMeanMs: window.count > 0 ? window.totalMs / window.count : null,
    cumulativeMaxMs: window.count > 0 ? window.maxMs : null,
    rollingMedianMs: percentile(0.5),
    rollingP95Ms: percentile(0.95),
  };
};

const createOutputPolicyPerformance = (rendererGeneration: number): OutputPolicyPerformance => ({
  schemaVersion: 1,
  rendererGeneration,
  detailedSampleIntervalFrames: DETAILED_SAMPLE_INTERVAL_FRAMES,
  inventoryRefreshIntervalFrames: INVENTORY_REFRESH_INTERVAL_FRAMES,
  frameCount: 0,
  managedMaterialCount: 0,
  materialAssignmentCount: 0,
  adaptedMaterialCreations: 0,
  materialAssignmentReplacements: 0,
  materialSignatureEvaluations: 0,
  inventoryBuildCount: 0,
  disposedNodeMaterials: 0,
  diagnosticDomWrites: 0,
  sceneTraversal: createDurationWindow(),
  materialSignatures: createDurationWindow(),
  materialAdaptation: createDurationWindow(),
  staleCleanup: createDurationWindow(),
  inventoryAndDiagnostics: createDurationWindow(),
  controllerCallback: createDurationWindow(),
});

const serializeOutputPolicyPerformance = (metrics: OutputPolicyPerformance): string => JSON.stringify({
  schemaVersion: metrics.schemaVersion,
  rendererGeneration: metrics.rendererGeneration,
  detailedSampleIntervalFrames: metrics.detailedSampleIntervalFrames,
  inventoryRefreshIntervalFrames: metrics.inventoryRefreshIntervalFrames,
  frameCount: metrics.frameCount,
  managedMaterialCount: metrics.managedMaterialCount,
  materialAssignmentCount: metrics.materialAssignmentCount,
  adaptedMaterialCreations: metrics.adaptedMaterialCreations,
  materialAssignmentReplacements: metrics.materialAssignmentReplacements,
  materialSignatureEvaluations: metrics.materialSignatureEvaluations,
  meanSignatureEvaluationsPerFrame: metrics.frameCount > 0
    ? metrics.materialSignatureEvaluations / metrics.frameCount
    : 0,
  inventoryBuildCount: metrics.inventoryBuildCount,
  disposedNodeMaterials: metrics.disposedNodeMaterials,
  diagnosticDomWrites: metrics.diagnosticDomWrites,
  timing: {
    sceneTraversal: summarizeDurationWindow(metrics.sceneTraversal),
    materialSignatures: summarizeDurationWindow(metrics.materialSignatures),
    materialAdaptation: summarizeDurationWindow(metrics.materialAdaptation),
    staleCleanup: summarizeDurationWindow(metrics.staleCleanup),
    inventoryAndDiagnostics: summarizeDurationWindow(metrics.inventoryAndDiagnostics),
    controllerCallback: summarizeDurationWindow(metrics.controllerCallback),
  },
  measurement: "Development-only CPU callback instrumentation; browser scheduling and GPU execution are not measured here.",
});

export type ObserverMaterialInventoryEntry = Readonly<{
  role: string;
  sourceMaterialFamily: string;
  nodeMaterialFamily: string;
  materialInstances: number;
  meshAssignments: number;
  lit: boolean;
  transparentInstances: number;
  opacityRange: readonly [number, number];
  toneMappedInstances: number;
  depthTestInstances: number;
  depthWriteInstances: number;
  shadowCasterAssignments: number;
  shadowReceiverAssignments: number;
  blendingModes: readonly string[];
  sides: readonly string[];
  textureSlots: Readonly<Record<string, Readonly<{
    count: number;
    colorSpaces: readonly string[];
    repeatValues: readonly (readonly [number, number])[];
    wrapModes: readonly (readonly [number | null, number | null])[];
  }>>>;
  environmentMappedInstances: number;
  normalScaleValues: readonly (readonly [number, number])[];
  roughnessValues: readonly number[];
  metalnessValues: readonly number[];
  owner: string;
  status: "supported" | "unsupported";
}>;

export type ObserverMaterialInventory = Readonly<{
  sceneId: "architecture-rise";
  frame: number;
  totalMeshAssignments: number;
  distinctMaterialInstances: number;
  adaptedMaterialInstances: number;
  unsupportedMaterialInstances: number;
  unsupported: readonly Readonly<{ objectName: string; materialFamily: string }>[];
  families: readonly ObserverMaterialInventoryEntry[];
  background: Readonly<{ authoredColor: string; nodeInstalled: boolean }>;
  environment: Readonly<{
    assigned: boolean;
    textureType: string | null;
    colorSpace: string | null;
    intensity: number;
  }>;
  lighting: Readonly<{
    hemisphereLights: number;
    directionalLights: number;
    shadowCastingDirectionalLights: number;
    shadowMapSizes: readonly (readonly [number, number])[];
  }>;
}>;

type OutputPolicyStatus = "pending" | "active" | "failed";

export type MaterialAwareOutputPolicyControllerProps = Readonly<{
  rendererGeneration: number;
  onFailure: (reason: string) => void;
  onCapabilitiesChange: (
    generation: number,
    capabilities: ObserverVisualPipelineCapabilities | null,
  ) => void;
}>;

const readSource = (material: THREE.Material): THREE.Material | null =>
  (material as THREE.Material & { [observerOutputSourceMaterial]?: THREE.Material })[
    observerOutputSourceMaterial
  ] ?? null;

const stableValue = (value: unknown): unknown => {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object") {
    const record = value as Record<string, unknown> & { isColor?: boolean; isTexture?: boolean };
    if (record.isColor === true) {
      const colorValue = value as THREE.Color;
      return [colorValue.r, colorValue.g, colorValue.b];
    }
    if (record.isTexture === true) {
      const texture = value as THREE.Texture;
      return [texture.uuid, texture.colorSpace, texture.wrapS, texture.wrapT, texture.repeat.x, texture.repeat.y];
    }
    if ("x" in record && "y" in record && Object.keys(record).length < 8) {
      return [record.x, record.y, "z" in record ? record.z : null, "w" in record ? record.w : null];
    }
  }
  return undefined;
};

const materialSignature = (material: THREE.Material): string => JSON.stringify(
  Object.entries(material)
    .map(([key, value]) => [key, stableValue(value)] as const)
    .filter((entry) => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)),
);

const materialShaderSignature = (material: THREE.Material): string => {
  const candidate = material as MaterialWithMaps & {
    alphaTest?: number;
    alphaHash?: boolean;
    alphaToCoverage?: boolean;
    clipIntersection?: boolean;
    flatShading?: boolean;
    fog?: boolean;
    lights?: boolean;
    wireframe?: boolean;
    vertexColors?: boolean;
  };
  return JSON.stringify([
    material.type,
    material.transparent,
    material.side,
    material.blending,
    material.depthTest,
    material.depthWrite,
    material.colorWrite,
    material.toneMapped,
    candidate.alphaTest,
    candidate.alphaHash,
    candidate.alphaToCoverage,
    candidate.clipIntersection,
    candidate.flatShading,
    candidate.fog,
    candidate.lights,
    candidate.wireframe,
    candidate.vertexColors,
    ...MAP_SLOTS.map((slot) => candidate[slot]?.uuid ?? null),
  ]);
};

const isRenderable = (object: THREE.Object3D): object is Renderable =>
  object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points;

const objectRole = (object: THREE.Object3D): string => {
  let current: THREE.Object3D | null = object;
  const names: string[] = [];
  while (current) {
    names.push(current.name);
    if (current.name === "architecture-rise-subject") return "architecture-rise-subject";
    if (current.name === "camera-rig-placement" || current.name === "original-ghost-camera-rig-placement") {
      return "conceptual-camera";
    }
    current = current.parent;
  }
  if (names.includes("teaching-shadow-subject")) return "focus-targets";
  if (names.some((name) => /(?:overlay|optical|physical-image-circle|physical-coverage|scheimpflug|lens-plane-helper|focus-plane|dof-plane)/i.test(name))) {
    return "optical-helpers";
  }
  return "observer-other";
};

const mapProperties = (material: THREE.Material) => {
  const candidate = material as MaterialWithMaps;
  return Object.fromEntries(MAP_SLOTS.flatMap((slot) => {
    const texture = candidate[slot];
    if (!texture) return [];
    return [[slot, {
      colorSpace: texture.colorSpace || "none",
      repeat: [texture.repeat.x, texture.repeat.y] as const,
      wrapS: texture.wrapS,
      wrapT: texture.wrapT,
    }]];
  }));
};

type MutableInventoryFamily = {
  role: string;
  sourceMaterialFamily: string;
  nodeMaterialFamily: string;
  sources: Set<THREE.Material>;
  meshAssignments: number;
  lit: boolean;
  transparentInstances: number;
  opacityValues: number[];
  toneMappedInstances: number;
  depthTestInstances: number;
  depthWriteInstances: number;
  shadowCasterAssignments: number;
  shadowReceiverAssignments: number;
  blendingModes: Set<string>;
  sides: Set<string>;
  textureSlots: Map<string, {
    count: number;
    colorSpaces: Set<string>;
    repeats: Set<string>;
    wrapping: Set<string>;
  }>;
  environmentMappedInstances: number;
  normalScales: Set<string>;
  roughnessValues: Set<number>;
  metalnessValues: Set<number>;
  owner: string;
};

const buildInventory = (
  scene: THREE.Scene,
  frame: number,
  unsupported: readonly Readonly<{ objectName: string; materialFamily: string }>[],
): ObserverMaterialInventory => {
  const families = new Map<string, MutableInventoryFamily>();
  const adaptedSources = new Set<THREE.Material>();
  const unsupportedSources = new Set<THREE.Material>();
  let totalMeshAssignments = 0;
  scene.traverse((object) => {
    if (!isRenderable(object)) return;
    const role = objectRole(object);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((attached) => {
      totalMeshAssignments += 1;
      const source = readSource(attached) ?? attached;
      const nodeFamily = attached.type;
      const familyKey = `${role}/${source.type}/${nodeFamily}`;
      let family = families.get(familyKey);
      if (!family) {
        family = {
          role,
          sourceMaterialFamily: source.type,
          nodeMaterialFamily: nodeFamily,
          sources: new Set(),
          meshAssignments: 0,
          lit: source instanceof THREE.MeshStandardMaterial,
          transparentInstances: 0,
          opacityValues: [],
          toneMappedInstances: 0,
          depthTestInstances: 0,
          depthWriteInstances: 0,
          shadowCasterAssignments: 0,
          shadowReceiverAssignments: 0,
          blendingModes: new Set(),
          sides: new Set(),
          textureSlots: new Map(),
          environmentMappedInstances: 0,
          normalScales: new Set(),
          roughnessValues: new Set(),
          metalnessValues: new Set(),
          owner: role === "architecture-rise-subject"
            ? "disposeArchitectureRiseGroup -> disposeTeachingSubjectResources"
            : "Observer output-policy controller (NodeMaterial); React Three Fiber (authored material)",
        };
        families.set(familyKey, family);
      }
      family.sources.add(source);
      if (readSource(attached)) adaptedSources.add(source);
      else unsupportedSources.add(source);
      family.meshAssignments += 1;
      if (source.transparent) family.transparentInstances += 1;
      family.opacityValues.push(source.opacity);
      if (source.toneMapped) family.toneMappedInstances += 1;
      if (source.depthTest) family.depthTestInstances += 1;
      if (source.depthWrite) family.depthWriteInstances += 1;
      if (object.castShadow) family.shadowCasterAssignments += 1;
      if (object.receiveShadow) family.shadowReceiverAssignments += 1;
      family.blendingModes.add(String(source.blending));
      family.sides.add(String(source.side));
      const mapped = mapProperties(source);
      Object.entries(mapped).forEach(([slot, details]) => {
        const typed = details as {
          colorSpace: string;
          repeat: readonly [number, number];
          wrapS: number;
          wrapT: number;
        };
        const slotSummary = family!.textureSlots.get(slot) ?? {
          count: 0,
          colorSpaces: new Set<string>(),
          repeats: new Set<string>(),
          wrapping: new Set<string>(),
        };
        slotSummary.count += 1;
        slotSummary.colorSpaces.add(typed.colorSpace);
        slotSummary.repeats.add(JSON.stringify(typed.repeat));
        slotSummary.wrapping.add(JSON.stringify([typed.wrapS, typed.wrapT]));
        family!.textureSlots.set(slot, slotSummary);
      });
      if ((source as MaterialWithMaps & { envMap?: THREE.Texture | null }).envMap) {
        family.environmentMappedInstances += 1;
      }
      const sourceWithPbr = source as THREE.MeshStandardMaterial;
      if (sourceWithPbr.normalScale) family.normalScales.add(JSON.stringify(sourceWithPbr.normalScale.toArray()));
      if (Number.isFinite(sourceWithPbr.roughness)) family.roughnessValues.add(sourceWithPbr.roughness);
      if (Number.isFinite(sourceWithPbr.metalness)) family.metalnessValues.add(sourceWithPbr.metalness);
    });
  });

  let hemisphereLights = 0;
  let directionalLights = 0;
  let shadowCastingDirectionalLights = 0;
  const shadowMapSizes = new Set<string>();
  scene.traverse((object) => {
    if (object instanceof THREE.HemisphereLight) hemisphereLights += 1;
    if (object instanceof THREE.DirectionalLight) {
      directionalLights += 1;
      if (object.castShadow) shadowCastingDirectionalLights += 1;
      shadowMapSizes.add(JSON.stringify([object.shadow.mapSize.x, object.shadow.mapSize.y]));
    }
  });
  const environment = scene.environment;
  const supportedFamilies = [...families.values()].map((family): ObserverMaterialInventoryEntry => {
    const textureSlots = Object.fromEntries([...family.textureSlots.entries()].map(([slot, value]) => [slot, {
      count: value.count,
      colorSpaces: [...value.colorSpaces].sort(),
      repeatValues: [...value.repeats].map((entry) => JSON.parse(entry) as readonly [number, number]),
      wrapModes: [...value.wrapping].map((entry) => JSON.parse(entry) as readonly [number, number]),
    }]));
    const opacityMin = Math.min(...family.opacityValues);
    const opacityMax = Math.max(...family.opacityValues);
    return {
      role: family.role,
      sourceMaterialFamily: family.sourceMaterialFamily,
      nodeMaterialFamily: family.nodeMaterialFamily,
      materialInstances: family.sources.size,
      meshAssignments: family.meshAssignments,
      lit: family.lit,
      transparentInstances: family.transparentInstances,
      opacityRange: [opacityMin, opacityMax],
      toneMappedInstances: family.toneMappedInstances,
      depthTestInstances: family.depthTestInstances,
      depthWriteInstances: family.depthWriteInstances,
      shadowCasterAssignments: family.shadowCasterAssignments,
      shadowReceiverAssignments: family.shadowReceiverAssignments,
      blendingModes: [...family.blendingModes].sort(),
      sides: [...family.sides].sort(),
      textureSlots,
      environmentMappedInstances: family.environmentMappedInstances,
      normalScaleValues: [...family.normalScales].map((entry) => JSON.parse(entry) as readonly [number, number]),
      roughnessValues: [...family.roughnessValues].sort((left, right) => left - right),
      metalnessValues: [...family.metalnessValues].sort((left, right) => left - right),
      owner: family.owner,
      status: family.sources.size > 0 && [...family.sources].every((source) => adaptedSources.has(source))
        ? "supported"
        : "unsupported",
    };
  }).sort((left, right) => `${left.role}/${left.sourceMaterialFamily}`.localeCompare(`${right.role}/${right.sourceMaterialFamily}`));

  return {
    sceneId: "architecture-rise",
    frame,
    totalMeshAssignments,
    distinctMaterialInstances: new Set([...families.values()].flatMap((family) => [...family.sources])).size,
    adaptedMaterialInstances: adaptedSources.size,
    unsupportedMaterialInstances: unsupportedSources.size,
    unsupported,
    families: supportedFamilies,
    background: { authoredColor: "#f8fafc", nodeInstalled: scene.backgroundNode !== null },
    environment: {
      assigned: environment !== null,
      textureType: environment ? String(environment.type) : null,
      colorSpace: environment?.colorSpace ?? null,
      intensity: scene.environmentIntensity,
    },
    lighting: {
      hemisphereLights,
      directionalLights,
      shadowCastingDirectionalLights,
      shadowMapSizes: [...shadowMapSizes].map((value) => JSON.parse(value) as readonly [number, number]),
    },
  };
};

const setDiagnosticAttributes = (
  container: HTMLElement | null,
  status: OutputPolicyStatus,
  inventory?: ObserverMaterialInventory,
  failure?: string,
): void => {
  if (!container) return;
  container.setAttribute("data-observer-output-policy-installed", status === "active" ? "material-aware" : "pending");
  container.setAttribute("data-observer-output-policy-status", status);
  if (inventory) {
    container.setAttribute("data-observer-output-policy-material-count", String(inventory.adaptedMaterialInstances));
    container.setAttribute("data-observer-output-policy-unsupported-count", String(inventory.unsupportedMaterialInstances));
    container.setAttribute("data-observer-material-inventory", JSON.stringify(inventory));
  }
  if (status === "pending") {
    container.removeAttribute("data-observer-output-policy-material-count");
    container.removeAttribute("data-observer-output-policy-unsupported-count");
    container.removeAttribute("data-observer-material-inventory");
  }
  if (failure) container.setAttribute("data-observer-output-policy-failure", failure);
};

const clearDiagnosticAttributes = (container: HTMLElement | null): void => {
  if (!container) return;
  container.removeAttribute("data-observer-output-policy-status");
  container.removeAttribute("data-observer-output-policy-material-count");
  container.removeAttribute("data-observer-output-policy-unsupported-count");
  container.removeAttribute("data-observer-material-inventory");
};

const isOwnedByArchitectureRiseSubject = (object: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.name === "architecture-rise-subject") return true;
    current = current.parent;
  }
  return false;
};

/**
 * The development-only candidate adapts only the three inventoried r186
 * material families. Unknown families keep the canvas hidden and request the
 * host's existing one-shot WebGL fallback.
 */
export const MaterialAwareOutputPolicyController = ({
  rendererGeneration,
  onFailure,
  onCapabilitiesChange,
}: MaterialAwareOutputPolicyControllerProps) => {
  const { gl, scene } = useThree();
  const backgroundNode = useMemo(() => workingToColorSpace(
    vec4(color(new THREE.Color("#f8fafc")), 1),
    THREE.SRGBColorSpace,
  ), []);
  const originalSettingsRef = useRef<Readonly<{
    sceneBackground: THREE.Color | THREE.Texture | null;
    backgroundNode: THREE.Scene["backgroundNode"];
    sceneVisible: boolean;
  }> | null>(null);
  const managedMaterialsRef = useRef(new Map<THREE.Material, ManagedNodeMaterial>());
  const lastInventoryRef = useRef<ObserverMaterialInventory | null>(null);
  const lastInventoryRefreshFrameRef = useRef(0);
  const frameRef = useRef(0);
  const performanceRef = useMemo(
    () => createOutputPolicyPerformance(rendererGeneration),
    [rendererGeneration],
  );
  const currentGenerationRef = useRef(rendererGeneration);
  const failureCalledRef = useRef(false);
  const lastReportRef = useRef("");
  const lastStatusRef = useRef<OutputPolicyStatus>("pending");
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;
  currentGenerationRef.current = rendererGeneration;

  useLayoutEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    const readPerformance = () => {
      container?.setAttribute(
        "data-observer-output-policy-performance",
        serializeOutputPolicyPerformance(performanceRef),
      );
    };
    window.addEventListener(READ_PERFORMANCE_EVENT, readPerformance);
    return () => window.removeEventListener(READ_PERFORMANCE_EVENT, readPerformance);
  }, [gl, performanceRef]);

  const reportFailure = useCallback((container: HTMLElement | null, reason: string) => {
    if (failureCalledRef.current) return;
    failureCalledRef.current = true;
    lastStatusRef.current = "failed";
    performanceRef.diagnosticDomWrites += 1;
    setDiagnosticAttributes(container, "failed", undefined, reason);
    onFailureRef.current(reason);
  }, [performanceRef]);

  useLayoutEffect(() => {
    const runtime = resolveObserverRendererRuntime(gl);
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (runtime.rendererFamily !== "webgpu-renderer") {
      reportFailure(container, `material-aware output requires WebGPURenderer; mounted ${runtime.rendererFamily}`);
      return;
    }
    if (gl.toneMapping !== THREE.NoToneMapping || gl.outputColorSpace !== THREE.LinearSRGBColorSpace) {
      reportFailure(container, "material-aware renderer output settings were not active after initialization");
      return;
    }

    originalSettingsRef.current = {
      sceneBackground: scene.background,
      backgroundNode: scene.backgroundNode,
      sceneVisible: scene.visible,
    };
    onCapabilitiesChange(
      rendererGeneration,
      resolveObserverVisualPipelineCapabilities(gl),
    );
    scene.background = null;
    scene.backgroundNode = backgroundNode;
    scene.visible = false;
    lastStatusRef.current = "pending";
    performanceRef.diagnosticDomWrites += 1;
    setDiagnosticAttributes(container, "pending");
    const managedMaterials = managedMaterialsRef.current;

    return () => {
      const original = originalSettingsRef.current;
      if (original) {
        scene.background = original.sceneBackground;
        scene.backgroundNode = original.backgroundNode;
        scene.visible = original.sceneVisible;
      }
      managedMaterials.forEach((record) => {
        if (record.ownership !== "architecture-rise-subject") record.output.dispose();
      });
      managedMaterials.clear();
      if (import.meta.env.DEV && typeof window !== "undefined") {
        const lifecycleReport = serializeOutputPolicyPerformance(performanceRef);
        queueMicrotask(() => {
          window.dispatchEvent(new CustomEvent("vcs:observer-output-policy-lifecycle", {
            detail: JSON.parse(lifecycleReport) as unknown,
          }));
        });
      }
      performanceRef.diagnosticDomWrites += 1;
      clearDiagnosticAttributes(container);
    };
  }, [backgroundNode, gl, onCapabilitiesChange, performanceRef, rendererGeneration, reportFailure, scene]);

  useFrame(() => {
    if (failureCalledRef.current || currentGenerationRef.current !== rendererGeneration) return;
    const performance = performanceRef;
    const callbackStartedAt = import.meta.env.DEV ? window.performance.now() : 0;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    try {
      frameRef.current += 1;
      const currentFrame = frameRef.current;
      const collectDetailedSample = import.meta.env.DEV &&
        (currentFrame === 1 || currentFrame % DETAILED_SAMPLE_INTERVAL_FRAMES === 0);
      const seenSources = new Set<THREE.Material>();
      const frameSignatures = new Map<THREE.Material, Readonly<{
        signature: string;
        shaderSignature: string;
      }>>();
      const unsupported: Array<Readonly<{ objectName: string; materialFamily: string }>> = [];
      let materialInventoryDirty = lastInventoryRef.current === null;
      let meshAssignmentCount = 0;

      // R3F attaches its scene background after layout effects. Reassert the
      // explicitly display-encoded background before this frame is rendered.
      scene.background = null;
      scene.backgroundNode = backgroundNode;

      const traversalStartedAt = collectDetailedSample ? window.performance.now() : 0;
      let materialSignatureMs = 0;
      let materialAdaptationMs = 0;
      const getSignatures = (source: THREE.Material) => {
        const cached = frameSignatures.get(source);
        if (cached) return cached;
        const signatureStartedAt = collectDetailedSample ? window.performance.now() : 0;
        const signatures = {
          signature: materialSignature(source),
          shaderSignature: materialShaderSignature(source),
        };
        performance.materialSignatureEvaluations += 1;
        if (collectDetailedSample) materialSignatureMs += window.performance.now() - signatureStartedAt;
        frameSignatures.set(source, signatures);
        return signatures;
      };
      scene.traverse((object) => {
        if (!isRenderable(object)) return;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshAssignmentCount += sourceMaterials.length;
        const nextMaterials = sourceMaterials.map((attached) => {
          const source = readSource(attached) ?? attached;
          const firstSourceUse = !seenSources.has(source);
          seenSources.add(source);
          const existing = managedMaterialsRef.current.get(source);
          if (existing) {
            if (firstSourceUse) {
              const next = getSignatures(source);
              if (next.signature !== existing.signature) {
                const adaptationStartedAt = collectDetailedSample ? window.performance.now() : 0;
                existing.output.copy(source);
                if (next.shaderSignature !== existing.shaderSignature) existing.output.needsUpdate = true;
                if (collectDetailedSample) materialAdaptationMs += window.performance.now() - adaptationStartedAt;
                materialInventoryDirty = true;
                managedMaterialsRef.current.set(source, {
                  ...existing,
                  lastSeenFrame: currentFrame,
                  signature: next.signature,
                  shaderSignature: next.shaderSignature,
                });
              } else if (existing.lastSeenFrame !== currentFrame) {
                managedMaterialsRef.current.set(source, { ...existing, lastSeenFrame: currentFrame });
              }
            }
            return existing.output;
          }

          const adaptationStartedAt = collectDetailedSample ? window.performance.now() : 0;
          const output = adaptObserverMaterialForOutput(source);
          if (collectDetailedSample) materialAdaptationMs += window.performance.now() - adaptationStartedAt;
          if (!output) {
            unsupported.push({ objectName: object.name || object.type, materialFamily: source.type });
            return attached;
          }
          const owner: AdapterOwnership = isOwnedByArchitectureRiseSubject(object)
            ? "architecture-rise-subject"
            : "observer-output-policy";
          const signatures = getSignatures(source);
          output.addEventListener("dispose", () => {
            performance.disposedNodeMaterials += 1;
          });
          performance.adaptedMaterialCreations += 1;
          managedMaterialsRef.current.set(source, {
            source,
            output,
            ownership: owner,
            lastSeenFrame: currentFrame,
            signature: signatures.signature,
            shaderSignature: signatures.shaderSignature,
          });
          materialInventoryDirty = true;
          return output;
        });
        if (nextMaterials.some((material, index) => material !== sourceMaterials[index])) {
          performance.materialAssignmentReplacements += nextMaterials.filter((material, index) =>
            material !== sourceMaterials[index],
          ).length;
          object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]!;
        }
      });
      if (collectDetailedSample) {
        recordDuration(performance.sceneTraversal, window.performance.now() - traversalStartedAt);
        recordDuration(performance.materialSignatures, materialSignatureMs);
        recordDuration(performance.materialAdaptation, materialAdaptationMs);
      }

      // R3F-owned camera and overlay materials can be detached by visibility
      // controls. Release their node counterpart after two missed frames. The
      // registered subject's disposer owns its NodeMaterials and textures.
      const cleanupStartedAt = collectDetailedSample ? window.performance.now() : 0;
      managedMaterialsRef.current.forEach((record, source) => {
        if (seenSources.has(source) || currentFrame - record.lastSeenFrame < 2) return;
        if (record.ownership !== "architecture-rise-subject") record.output.dispose();
        managedMaterialsRef.current.delete(source);
        materialInventoryDirty = true;
      });
      if (collectDetailedSample) recordDuration(performance.staleCleanup, window.performance.now() - cleanupStartedAt);

      const architectureSubjectMounted = scene.getObjectByName("architecture-rise-subject") !== undefined;
      const inventoryStartedAt = collectDetailedSample ? window.performance.now() : 0;
      const previousInventory = lastInventoryRef.current;
      const inventoryNeedsRefresh = materialInventoryDirty ||
        unsupported.length > 0 ||
        !previousInventory ||
        previousInventory.totalMeshAssignments !== meshAssignmentCount ||
        currentFrame - lastInventoryRefreshFrameRef.current >= INVENTORY_REFRESH_INTERVAL_FRAMES;
      if (inventoryNeedsRefresh) {
        lastInventoryRef.current = buildInventory(scene, currentFrame, unsupported);
        lastInventoryRefreshFrameRef.current = currentFrame;
        performance.inventoryBuildCount += 1;
      }
      const inventory = lastInventoryRef.current!;
      performance.materialAssignmentCount = meshAssignmentCount;
      performance.managedMaterialCount = managedMaterialsRef.current.size;
      const reportKey = JSON.stringify({ ...inventory, frame: 0 });
      if (reportKey !== lastReportRef.current) {
        lastReportRef.current = reportKey;
        performance.diagnosticDomWrites += 1;
        setDiagnosticAttributes(container, lastStatusRef.current, inventory);
      }
      if (collectDetailedSample) {
        recordDuration(performance.inventoryAndDiagnostics, window.performance.now() - inventoryStartedAt);
      }

      if (unsupported.length > 0) {
        scene.visible = false;
        reportFailure(container, `unsupported material family: ${unsupported.map((item) => `${item.objectName}/${item.materialFamily}`).join(", ")}`);
        return;
      }
      if (!architectureSubjectMounted) {
        scene.visible = false;
        return;
      }

      const original = originalSettingsRef.current;
      scene.visible = original?.sceneVisible ?? true;
      if (lastStatusRef.current !== "active") {
        lastStatusRef.current = "active";
        performance.diagnosticDomWrites += 1;
        setDiagnosticAttributes(container, "active", inventory);
      }
    } finally {
      if (import.meta.env.DEV) {
        performance.frameCount += 1;
        recordDuration(performance.controllerCallback, window.performance.now() - callbackStartedAt);
      }
    }
  });

  return null;
};
