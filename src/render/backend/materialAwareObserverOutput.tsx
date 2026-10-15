import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
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
  const frameRef = useRef(0);
  const currentGenerationRef = useRef(rendererGeneration);
  const failureCalledRef = useRef(false);
  const lastReportRef = useRef("");
  const lastStatusRef = useRef<OutputPolicyStatus>("pending");
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;
  currentGenerationRef.current = rendererGeneration;

  const reportFailure = (container: HTMLElement | null, reason: string) => {
    if (failureCalledRef.current) return;
    failureCalledRef.current = true;
    lastStatusRef.current = "failed";
    setDiagnosticAttributes(container, "failed", undefined, reason);
    onFailureRef.current(reason);
  };

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
      clearDiagnosticAttributes(container);
    };
  }, [backgroundNode, gl, onCapabilitiesChange, rendererGeneration, scene]);

  useFrame(() => {
    if (failureCalledRef.current || currentGenerationRef.current !== rendererGeneration) return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    frameRef.current += 1;
    const currentFrame = frameRef.current;
    const seenSources = new Set<THREE.Material>();
    const unsupported: Array<Readonly<{ objectName: string; materialFamily: string }>> = [];

    // R3F attaches its scene background after layout effects. Reassert the
    // explicitly display-encoded background before this frame is rendered.
    scene.background = null;
    scene.backgroundNode = backgroundNode;

    scene.traverse((object) => {
      if (!isRenderable(object)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const nextMaterials = sourceMaterials.map((attached) => {
        const source = readSource(attached) ?? attached;
        seenSources.add(source);
        const existing = managedMaterialsRef.current.get(source);
        if (existing) {
          const nextSignature = materialSignature(source);
          const nextShaderSignature = materialShaderSignature(source);
          if (nextSignature !== existing.signature) {
            existing.output.copy(source);
            if (nextShaderSignature !== existing.shaderSignature) existing.output.needsUpdate = true;
            managedMaterialsRef.current.set(source, {
              ...existing,
              lastSeenFrame: currentFrame,
              signature: nextSignature,
              shaderSignature: nextShaderSignature,
            });
          } else {
            managedMaterialsRef.current.set(source, { ...existing, lastSeenFrame: currentFrame });
          }
          return existing.output;
        }

        const output = adaptObserverMaterialForOutput(source);
        if (!output) {
          unsupported.push({ objectName: object.name || object.type, materialFamily: source.type });
          return attached;
        }
        const owner: AdapterOwnership = isOwnedByArchitectureRiseSubject(object)
          ? "architecture-rise-subject"
          : "observer-output-policy";
        managedMaterialsRef.current.set(source, {
          source,
          output,
          ownership: owner,
          lastSeenFrame: currentFrame,
          signature: materialSignature(source),
          shaderSignature: materialShaderSignature(source),
        });
        return output;
      });
      if (nextMaterials.some((material, index) => material !== sourceMaterials[index])) {
        object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]!;
      }
    });

    // R3F-owned camera and overlay materials can be detached by visibility
    // controls. Release their node counterpart after two missed frames. The
    // registered subject's disposer owns its NodeMaterials and textures.
    managedMaterialsRef.current.forEach((record, source) => {
      if (seenSources.has(source) || currentFrame - record.lastSeenFrame < 2) return;
      if (record.ownership !== "architecture-rise-subject") record.output.dispose();
      managedMaterialsRef.current.delete(source);
    });

    const architectureSubjectMounted = scene.getObjectByName("architecture-rise-subject") !== undefined;
    const inventory = buildInventory(scene, currentFrame, unsupported);
    const reportKey = JSON.stringify({ ...inventory, frame: 0 });
    if (reportKey !== lastReportRef.current) {
      lastReportRef.current = reportKey;
      setDiagnosticAttributes(container, lastStatusRef.current, inventory);
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
      setDiagnosticAttributes(container, "active", inventory);
    }
  });

  return null;
};
