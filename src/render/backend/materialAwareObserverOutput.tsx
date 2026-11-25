import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { color, vec4, workingToColorSpace } from "three/tsl";
import {
  resolveObserverRendererRuntime,
  resolveObserverVisualPipelineCapabilities,
  type ObserverVisualPipelineCapabilities,
} from "./observerVisualPipelineCapabilities";
import {
  MaterialAwareMaterialTracker,
  isMaterialAwareRenderable,
  type MaterialOutputOwner,
  type UnsupportedMaterialAssignment,
} from "./materialAwareMaterialTracker";
import {
  buildArchitectureRiseMaterialInventory,
  type ObserverMaterialInventory,
} from "./architectureRiseMaterialInventory";
import { buildAnatomyMaterialInventory } from "./anatomyMaterialInventory";
import {
  isArchitectureRiseMaterialOutputReady,
  resolveArchitectureRiseMaterialOutputOwner,
} from "./architectureRiseMaterialOutputAdapter";
import {
  inspectAnatomyMaterialOutputReadiness,
  createAnatomyMaterialOutputVariantOwner,
  resolveAnatomyMaterialOutputOwner,
} from "./anatomyMaterialOutputAdapter";
import {
  ANATOMY_OUTPUT_INTERVENTION_EVENT,
  ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT,
  resolveAnatomyOutputIntervention,
  type AnatomyOutputInterventionMode,
  type AnatomyOutputInterventionRenderable,
  type AnatomyOutputInterventionSelection,
} from "./anatomyMaterialOutputIntervention";
import { classifyAnatomyMaterialRole } from "../anatomyMaterialRoles";
import { readObserverOutputSourceMaterial } from "./observerMaterialOutputIdentity";
import { readAnatomyBellowsCompositingOverride } from "./anatomyBellowsCompositingIntervention";
import { isAnatomyRendererGenerationCurrent } from "../anatomyRenderableContribution";
import type { ConceptualCameraAnatomyPresentation } from "../ConceptualViewCamera";
import { getObserverMaterialSignatures } from "./observerMaterialSignatures";
import {
  advanceMaterialAwareReadinessTiming,
  startMaterialAwareReadinessTiming,
  type MaterialAwareReadinessTiming,
} from "./materialAwareReadinessTiming";

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
  readinessFrameCount: number;
  readinessWaitMs: number | null;
  managedMaterialCount: number;
  peakManagedMaterialCount: number;
  attachmentCount: number;
  peakAttachmentCount: number;
  trackedRenderableCount: number;
  peakTrackedRenderableCount: number;
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
  readinessFrameCount: 0,
  readinessWaitMs: null,
  managedMaterialCount: 0,
  peakManagedMaterialCount: 0,
  attachmentCount: 0,
  peakAttachmentCount: 0,
  trackedRenderableCount: 0,
  peakTrackedRenderableCount: 0,
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
  readinessFrameCount: metrics.readinessFrameCount,
  readinessWaitMs: metrics.readinessWaitMs,
  managedMaterialCount: metrics.managedMaterialCount,
  peakManagedMaterialCount: metrics.peakManagedMaterialCount,
  attachmentCount: metrics.attachmentCount,
  peakAttachmentCount: metrics.peakAttachmentCount,
  trackedRenderableCount: metrics.trackedRenderableCount,
  peakTrackedRenderableCount: metrics.peakTrackedRenderableCount,
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

type OutputPolicyStatus = "pending" | "active" | "failed";

export type MaterialAwareOutputPolicyControllerProps = Readonly<{
  rendererGeneration: number;
  onFailure: (reason: string) => void;
  onCapabilitiesChange: (
    generation: number,
    capabilities: ObserverVisualPipelineCapabilities | null,
  ) => void;
  anatomyPresentation?: ConceptualCameraAnatomyPresentation | null;
  allowAnatomyOutputIntervention?: boolean;
}>;

type MaterialAwareOutputSceneAdapter = Readonly<{
  sceneId: ObserverMaterialInventory["sceneId"];
  resolveOwner: typeof resolveArchitectureRiseMaterialOutputOwner;
  buildInventory: (
    scene: THREE.Scene,
    frame: number,
    unsupported: readonly UnsupportedMaterialAssignment[],
  ) => ObserverMaterialInventory;
  inspectReadiness: (
    scene: THREE.Scene,
    inventory: ObserverMaterialInventory | null,
    trackedAttachments: number,
    backgroundInstalled: boolean,
    unsupported: readonly UnsupportedMaterialAssignment[],
  ) => Readonly<{ ready: boolean; reason: string | null; evidence?: Readonly<Record<string, number>> }>;
  readinessTimeoutMs: number;
}>;

const architectureRiseAdapter: MaterialAwareOutputSceneAdapter = {
  sceneId: "architecture-rise",
  resolveOwner: resolveArchitectureRiseMaterialOutputOwner,
  buildInventory: buildArchitectureRiseMaterialInventory,
  inspectReadiness: (scene) => ({
    ready: isArchitectureRiseMaterialOutputReady(scene),
    reason: isArchitectureRiseMaterialOutputReady(scene)
      ? null
      : "registered-architecture-rise-subject-not-mounted",
    evidence: { registeredSubjectMounted: Number(isArchitectureRiseMaterialOutputReady(scene)) },
  }),
  readinessTimeoutMs: 0,
};

const anatomyAdapter: MaterialAwareOutputSceneAdapter = {
  sceneId: "view-camera-anatomy",
  resolveOwner: resolveAnatomyMaterialOutputOwner,
  buildInventory: buildAnatomyMaterialInventory,
  inspectReadiness: (scene, inventory, attachments, backgroundInstalled, unsupported) => {
    const result = inspectAnatomyMaterialOutputReadiness(
      scene,
      inventory,
      attachments,
      backgroundInstalled,
      unsupported,
    );
    return {
      ready: result.ready,
      reason: result.reason,
      evidence: {
        registeredSubjectRenderables: result.registeredSubjectRenderables,
        expectedSubjectRenderables: result.expectedSubjectRenderables,
        conceptualCameraRenderables: result.conceptualCameraRenderables,
        materialAssignments: result.materialAssignments,
        trackedAttachments: result.trackedAttachments,
      },
    };
  },
  readinessTimeoutMs: 12_000,
};

const FAILURE_INJECTION_EVENT = "vcs:observer-verification:inject-output-policy-failure";
const READINESS_FAILURE_INJECTION_EVENT =
  "vcs:observer-verification:inject-output-policy-readiness-failure";

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
  container.removeAttribute("data-observer-output-policy-readiness");
  container.removeAttribute("data-observer-output-policy-readiness-reason");
  container.removeAttribute("data-observer-output-policy-readiness-evidence");
  container.removeAttribute("data-observer-output-policy-scene-adapter");
  container.removeAttribute("data-observer-anatomy-output-intervention-hook");
  container.removeAttribute("data-observer-anatomy-output-intervention-mode");
  container.removeAttribute("data-observer-anatomy-output-intervention-requested-mode");
  container.removeAttribute("data-observer-anatomy-output-intervention-scope");
  container.removeAttribute("data-observer-anatomy-output-intervention-target-count");
  container.removeAttribute("data-observer-anatomy-output-intervention-output-transform");
  container.removeAttribute("data-observer-anatomy-output-intervention-error");
  container.removeAttribute("data-observer-anatomy-output-intervention-generation");
  container.removeAttribute("data-observer-anatomy-output-intervention-renderable-ids");
};

type MaterialAwareOutputControllerProps = MaterialAwareOutputPolicyControllerProps & Readonly<{
  adapter: MaterialAwareOutputSceneAdapter;
  allowFailureInjection?: boolean;
}>;

type ActiveAnatomyOutputIntervention = Readonly<{
  requestId: string;
  generation: number;
  mode: AnatomyOutputInterventionMode;
  selection: AnatomyOutputInterventionSelection;
}>;

const isAnatomyOutputInterventionMode = (value: unknown): value is AnatomyOutputInterventionMode =>
  value === "B0" || value === "B1" || value === "B2" || value === "B3" || value === "B4";

const isAnatomyOutputInterventionSelection = (
  value: unknown,
): value is AnatomyOutputInterventionSelection => {
  if (!value || typeof value !== "object") return false;
  const selection = value as Record<string, unknown>;
  if (selection.kind === "presentation-group") return true;
  return selection.kind === "renderable-ids" && Array.isArray(selection.renderableIds) &&
    selection.renderableIds.every((id) => typeof id === "string");
};

const collectAnatomyOutputInterventionRenderables = (
  scene: THREE.Scene,
): AnatomyOutputInterventionRenderable[] => {
  const records: AnatomyOutputInterventionRenderable[] = [];
  scene.traverse((object) => {
    if (!isMaterialAwareRenderable(object)) return;
    const classification = classifyAnatomyMaterialRole(object, scene);
    let visible = true;
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== scene) {
      visible &&= ancestor.visible;
      ancestor = ancestor.parent;
    }
    records.push({
      id: object.uuid,
      role: classification.role,
      cameraPart: classification.cameraPart,
      visible,
    });
  });
  return records;
};

/** Shared renderer-generation lifecycle and material reconciliation shell. */
const MaterialAwareOutputController = ({
  rendererGeneration,
  onFailure,
  onCapabilitiesChange,
  adapter,
  allowFailureInjection = false,
  anatomyPresentation = null,
  allowAnatomyOutputIntervention = false,
}: MaterialAwareOutputControllerProps) => {
  const { gl, scene } = useThree();
  const anatomyPresentationRef = useRef(anatomyPresentation);
  anatomyPresentationRef.current = anatomyPresentation;
  const anatomyOutputInterventionRef = useRef<ActiveAnatomyOutputIntervention | null>(null);
  const scopedAnatomyOwnersRef = useRef(new Map<string, MaterialOutputOwner>());
  const scopedBellowsCompositingOwnersRef = useRef(new Map<string, MaterialOutputOwner>());
  const retainedBellowsBaseOutputsRef = useRef(new Map<object, Readonly<{
    renderable: THREE.Object3D;
    release: () => void;
  }>>());
  const backgroundNode = useMemo(() => workingToColorSpace(
    vec4(color(new THREE.Color("#f8fafc")), 1),
    THREE.SRGBColorSpace,
  ), []);
  const originalSettingsRef = useRef<Readonly<{
    sceneBackground: THREE.Color | THREE.Texture | null;
    backgroundNode: THREE.Scene["backgroundNode"];
    sceneVisible: boolean;
  }> | null>(null);
  const lastInventoryRef = useRef<ObserverMaterialInventory | null>(null);
  const lastInventoryRefreshFrameRef = useRef(0);
  const readinessTimingRef = useRef<MaterialAwareReadinessTiming | null>(null);
  const injectedReadinessFailureRef = useRef<string | null>(null);
  const injectedUnsupportedRenderableRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef(0);
  const performanceRef = useMemo(
    () => createOutputPolicyPerformance(rendererGeneration),
    [rendererGeneration],
  );
  const materialTracker = useMemo(
    () => new MaterialAwareMaterialTracker(rendererGeneration, (output) => {
      output.addEventListener("dispose", () => {
        performanceRef.disposedNodeMaterials += 1;
      });
      performanceRef.adaptedMaterialCreations += 1;
    }),
    [performanceRef, rendererGeneration],
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

  useLayoutEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined" ||
        !allowAnatomyOutputIntervention || adapter.sceneId !== "view-camera-anatomy") return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (!container) return;
    const scopedAnatomyOwners = scopedAnatomyOwnersRef.current;

    const handleRequest = (event: Event) => {
      const request = (event as CustomEvent<unknown>).detail as Record<string, unknown> | null;
      const requestId = typeof request?.requestId === "string" ? request.requestId : "";
      const respond = (result: Readonly<Record<string, unknown>>) => {
        container.dispatchEvent(new CustomEvent(ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT, {
          detail: { requestId, generation: rendererGeneration, ...result },
        }));
      };
      if (!request || requestId.length === 0 || !isAnatomyOutputInterventionMode(request.mode)) {
        respond({ ok: false, reason: "invalid-intervention-request" });
        return;
      }
      if (!isAnatomyRendererGenerationCurrent(Number(request.generation), rendererGeneration)) {
        respond({ ok: false, reason: "stale-renderer-generation" });
        return;
      }
      const selection = request.selection === undefined
        ? { kind: "presentation-group" } as const
        : request.selection;
      if (!isAnatomyOutputInterventionSelection(selection)) {
        respond({ ok: false, reason: "invalid-selection" });
        return;
      }
      const resolution = resolveAnatomyOutputIntervention(
        request.mode,
        anatomyPresentationRef.current,
        collectAnatomyOutputInterventionRenderables(scene),
        selection,
      );
      if (!resolution.ok) {
        respond({ ok: false, reason: resolution.reason });
        return;
      }
      anatomyOutputInterventionRef.current = {
        requestId,
        generation: rendererGeneration,
        mode: request.mode,
        selection,
      };
      container.setAttribute("data-observer-anatomy-output-intervention-requested-mode", request.mode);
      respond({
        ok: true,
        mode: resolution.mode,
        targetGroup: resolution.targetGroup,
        outputTransform: resolution.outputTransform,
        renderableIds: resolution.renderableIds,
        semanticParts: resolution.semanticParts,
        selection: selection.kind,
      });
    };

    container.addEventListener(ANATOMY_OUTPUT_INTERVENTION_EVENT, handleRequest);
    container.setAttribute("data-observer-anatomy-output-intervention-hook", "ready");
    container.setAttribute("data-observer-anatomy-output-intervention-mode", "B0");
    return () => {
      container.removeEventListener(ANATOMY_OUTPUT_INTERVENTION_EVENT, handleRequest);
      anatomyOutputInterventionRef.current = null;
      scopedAnatomyOwners.clear();
      container.removeAttribute("data-observer-anatomy-output-intervention-hook");
      container.removeAttribute("data-observer-anatomy-output-intervention-mode");
      container.removeAttribute("data-observer-anatomy-output-intervention-requested-mode");
      container.removeAttribute("data-observer-anatomy-output-intervention-scope");
      container.removeAttribute("data-observer-anatomy-output-intervention-target-count");
      container.removeAttribute("data-observer-anatomy-output-intervention-output-transform");
      container.removeAttribute("data-observer-anatomy-output-intervention-error");
      container.removeAttribute("data-observer-anatomy-output-intervention-generation");
      container.removeAttribute("data-observer-anatomy-output-intervention-renderable-ids");
    };
  }, [adapter.sceneId, allowAnatomyOutputIntervention, gl, rendererGeneration, scene]);

  const reportFailure = useCallback((container: HTMLElement | null, reason: string) => {
    if (failureCalledRef.current) return;
    failureCalledRef.current = true;
    lastStatusRef.current = "failed";
    performanceRef.diagnosticDomWrites += 1;
    setDiagnosticAttributes(container, "failed", undefined, reason);
    onFailureRef.current(reason);
  }, [performanceRef]);

  useLayoutEffect(() => {
    if (!allowFailureInjection || !import.meta.env.DEV) return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (!container) return;
    const injectFailure = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (detail === "inject-unsupported-material") {
        const unsupported = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshPhysicalMaterial({ clearcoat: 0.5 }),
        );
        unsupported.name = "e2e-injected-unsupported-material";
        injectedUnsupportedRenderableRef.current = unsupported;
        scene.add(unsupported);
        return;
      }
      const reason = typeof detail === "string" && detail.length > 0
        ? detail
        : "test-injected-material-aware-output-failure";
      scene.visible = false;
      reportFailure(container, reason);
    };
    container.addEventListener(FAILURE_INJECTION_EVENT, injectFailure);
    container.setAttribute("data-observer-output-policy-failure-hook", "ready");
    return () => {
      container.removeEventListener(FAILURE_INJECTION_EVENT, injectFailure);
      container.removeAttribute("data-observer-output-policy-failure-hook");
      const unsupported = injectedUnsupportedRenderableRef.current;
      if (unsupported) {
        scene.remove(unsupported);
        unsupported.geometry.dispose();
        const materials = Array.isArray(unsupported.material)
          ? unsupported.material
          : [unsupported.material];
        materials.forEach((material) => material.dispose());
        injectedUnsupportedRenderableRef.current = null;
      }
    };
  }, [allowFailureInjection, gl, reportFailure, scene]);

  useLayoutEffect(() => {
    if (!allowFailureInjection || !import.meta.env.DEV) return;
    const container = gl.domElement.closest<HTMLElement>('[data-testid="scene-canvas"]');
    if (!container) return;
    const injectPersistentReadinessFailure = () => {
      injectedReadinessFailureRef.current = "e2e-injected-persistent-readiness-failure";
    };
    container.addEventListener(
      READINESS_FAILURE_INJECTION_EVENT,
      injectPersistentReadinessFailure,
    );
    return () => container.removeEventListener(
      READINESS_FAILURE_INJECTION_EVENT,
      injectPersistentReadinessFailure,
    );
  }, [allowFailureInjection, gl]);

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
    readinessTimingRef.current = startMaterialAwareReadinessTiming(
      rendererGeneration,
      window.performance.now(),
    );
    injectedReadinessFailureRef.current = null;
    lastStatusRef.current = "pending";
    const scopedAnatomyOwners = scopedAnatomyOwnersRef.current;
    const retainedBellowsBaseOutputs = retainedBellowsBaseOutputsRef.current;
    container?.setAttribute("data-observer-output-policy-scene-adapter", adapter.sceneId);
    container?.setAttribute("data-observer-output-policy-readiness", "pending");
    container?.removeAttribute("data-observer-output-policy-readiness-reason");
    performanceRef.diagnosticDomWrites += 1;
    setDiagnosticAttributes(container, "pending");

    return () => {
      retainedBellowsBaseOutputs.forEach(({ release }) => release());
      retainedBellowsBaseOutputs.clear();
      materialTracker.dispose();
      anatomyOutputInterventionRef.current = null;
      scopedAnatomyOwners.clear();
      readinessTimingRef.current = null;
      injectedReadinessFailureRef.current = null;
      const original = originalSettingsRef.current;
      if (original) {
        scene.background = original.sceneBackground;
        scene.backgroundNode = original.backgroundNode;
        scene.visible = original.sceneVisible;
      }
      performanceRef.managedMaterialCount = 0;
      performanceRef.attachmentCount = 0;
      performanceRef.trackedRenderableCount = 0;
      performanceRef.materialAssignmentCount = 0;
      performanceRef.diagnosticDomWrites += 1;
      if (import.meta.env.DEV && typeof window !== "undefined") {
        queueMicrotask(() => {
          const lifecycleReport = serializeOutputPolicyPerformance(performanceRef);
          window.dispatchEvent(new CustomEvent("vcs:observer-output-policy-lifecycle", {
            detail: JSON.parse(lifecycleReport) as unknown,
          }));
        });
      }
      clearDiagnosticAttributes(container);
    };
  }, [adapter, backgroundNode, gl, materialTracker, onCapabilitiesChange, performanceRef, rendererGeneration, reportFailure, scene]);

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
      const frameSignatures = new Map<THREE.Material, Readonly<{
        signature: string;
        shaderSignature: string;
      }>>();
      const unsupported: UnsupportedMaterialAssignment[] = [];
      let materialInventoryDirty = lastInventoryRef.current === null;
      let meshAssignmentCount = 0;
      const activeIntervention = adapter.sceneId === "view-camera-anatomy" &&
        allowAnatomyOutputIntervention
        ? anatomyOutputInterventionRef.current
        : null;
      const interventionResolution = activeIntervention &&
        isAnatomyRendererGenerationCurrent(activeIntervention.generation, rendererGeneration)
        ? resolveAnatomyOutputIntervention(
            activeIntervention.mode,
            anatomyPresentationRef.current,
            collectAnatomyOutputInterventionRenderables(scene),
            activeIntervention.selection,
          )
        : null;
      const interventionTargetIds = interventionResolution?.ok
        ? new Set(interventionResolution.renderableIds)
        : new Set<string>();
      const interventionMode = activeIntervention && interventionResolution?.ok
        ? activeIntervention.mode
        : "B0";
      if (allowAnatomyOutputIntervention && adapter.sceneId === "view-camera-anatomy") {
        container?.setAttribute("data-observer-anatomy-output-intervention-mode", interventionMode);
        container?.setAttribute("data-observer-anatomy-output-intervention-generation", String(rendererGeneration));
        if (interventionResolution?.ok) {
          container?.setAttribute(
            "data-observer-anatomy-output-intervention-scope",
            activeIntervention?.selection.kind ?? "presentation-group",
          );
          container?.setAttribute(
            "data-observer-anatomy-output-intervention-target-count",
            String(interventionResolution.renderableIds.length),
          );
          container?.setAttribute(
            "data-observer-anatomy-output-intervention-output-transform",
            interventionResolution.outputTransform ?? "material-aware",
          );
          container?.setAttribute(
            "data-observer-anatomy-output-intervention-renderable-ids",
            JSON.stringify(interventionResolution.renderableIds),
          );
          container?.removeAttribute("data-observer-anatomy-output-intervention-error");
        } else if (interventionResolution) {
          container?.setAttribute("data-observer-anatomy-output-intervention-error", interventionResolution.reason);
          container?.setAttribute("data-observer-anatomy-output-intervention-target-count", "0");
          container?.setAttribute("data-observer-anatomy-output-intervention-renderable-ids", "[]");
        } else {
          container?.setAttribute("data-observer-anatomy-output-intervention-target-count", "0");
          container?.setAttribute("data-observer-anatomy-output-intervention-renderable-ids", "[]");
        }
      }

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
        const signatures = getObserverMaterialSignatures(source);
        performance.materialSignatureEvaluations += 1;
        if (collectDetailedSample) materialSignatureMs += window.performance.now() - signatureStartedAt;
        frameSignatures.set(source, signatures);
        return signatures;
      };
      const measureAdaptation = <T,>(operation: () => T): T => {
        const adaptationStartedAt = collectDetailedSample ? window.performance.now() : 0;
        const result = operation();
        if (collectDetailedSample) materialAdaptationMs += window.performance.now() - adaptationStartedAt;
        return result;
      };
      scene.traverse((object) => {
        if (!isMaterialAwareRenderable(object)) return;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshAssignmentCount += sourceMaterials.length;
        const baseOwner = adapter.resolveOwner(object, materialTracker.controllerOwner);
        let outputOwner = baseOwner;
        if (activeIntervention && interventionResolution?.ok &&
            interventionResolution.outputTransform && interventionTargetIds.has(object.uuid)) {
          const selectionScope = activeIntervention.selection.kind === "presentation-group"
            ? `presentation-${interventionResolution.targetGroup}`
            : `renderables-${interventionResolution.renderableIds.join(",")}`;
          const variantKey = `${activeIntervention.mode}/${selectionScope}`;
          outputOwner = scopedAnatomyOwnersRef.current.get(variantKey) ??
            createAnatomyMaterialOutputVariantOwner(
              baseOwner,
              {},
              interventionResolution.outputTransform,
              activeIntervention.mode,
            );
          scopedAnatomyOwnersRef.current.set(variantKey, outputOwner);
        }
        const bellowsCompositingOverride = import.meta.env.DEV && adapter.sceneId === "view-camera-anatomy"
          ? readAnatomyBellowsCompositingOverride(object, rendererGeneration)
          : null;
        if (bellowsCompositingOverride) {
          const overrideKey = `${bellowsCompositingOverride.condition}/${object.uuid}`;
          if (!retainedBellowsBaseOutputsRef.current.has(bellowsCompositingOverride.identity)) {
            const attached = sourceMaterials[0];
            const source = attached ? readObserverOutputSourceMaterial(attached) ?? attached : null;
            if (!source) throw new Error("Anatomy Bellows source output disappeared before its scoped override attached");
            retainedBellowsBaseOutputsRef.current.set(bellowsCompositingOverride.identity, {
              renderable: object,
              release: materialTracker.retainOutput(source, baseOwner),
            });
          }
          outputOwner = scopedBellowsCompositingOwnersRef.current.get(overrideKey) ??
            createAnatomyMaterialOutputVariantOwner(
              baseOwner,
              bellowsCompositingOverride.identity,
              baseOwner.outputTransform ?? "material-aware",
              baseOwner.outputInterventionId ?? "B0",
              bellowsCompositingOverride.overrides,
            );
          scopedBellowsCompositingOwnersRef.current.set(overrideKey, outputOwner);
        }
        const reconciliation = materialTracker.reconcileRenderable(
          object,
          outputOwner,
          currentFrame,
          getSignatures,
          measureAdaptation,
        );
        unsupported.push(...reconciliation.unsupported);
        materialInventoryDirty ||= reconciliation.dirty;
        performance.materialAssignmentReplacements += reconciliation.assignmentReplacements;
        const nextMaterials = reconciliation.materials;
        if (nextMaterials.some((material, index) => material !== sourceMaterials[index])) {
          object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0]!;
        }
        if (!bellowsCompositingOverride) {
          for (const [identity, retained] of retainedBellowsBaseOutputsRef.current) {
            if (retained.renderable !== object) continue;
            retained.release();
            retainedBellowsBaseOutputsRef.current.delete(identity);
          }
        }
      });
      if (collectDetailedSample) {
        recordDuration(performance.sceneTraversal, window.performance.now() - traversalStartedAt);
        recordDuration(performance.materialSignatures, materialSignatureMs);
        recordDuration(performance.materialAdaptation, materialAdaptationMs);
      }

      // R3F-owned camera and overlay materials can be detached by visibility
      // controls. Release their node counterpart after two missed frames; a
      // scene adapter may route registered-subject copies to a longer owner.
      const cleanupStartedAt = collectDetailedSample ? window.performance.now() : 0;
      const attachmentCountBeforeCleanup = materialTracker.attachmentCount;
      if (materialTracker.releaseStaleMaterials(currentFrame) > 0) materialInventoryDirty = true;
      if (materialTracker.attachmentCount !== attachmentCountBeforeCleanup) materialInventoryDirty = true;
      if (collectDetailedSample) recordDuration(performance.staleCleanup, window.performance.now() - cleanupStartedAt);

      const inventoryStartedAt = collectDetailedSample ? window.performance.now() : 0;
      const previousInventory = lastInventoryRef.current;
      const inventoryNeedsRefresh = materialInventoryDirty ||
        unsupported.length > 0 ||
        !previousInventory ||
        previousInventory.totalMeshAssignments !== meshAssignmentCount ||
        currentFrame - lastInventoryRefreshFrameRef.current >= INVENTORY_REFRESH_INTERVAL_FRAMES;
      if (inventoryNeedsRefresh) {
        lastInventoryRef.current = adapter.buildInventory(scene, currentFrame, unsupported);
        lastInventoryRefreshFrameRef.current = currentFrame;
        performance.inventoryBuildCount += 1;
      }
      const inventory = lastInventoryRef.current!;
      performance.materialAssignmentCount = meshAssignmentCount;
      performance.managedMaterialCount = materialTracker.managedMaterialCount;
      performance.attachmentCount = materialTracker.attachmentCount;
      performance.trackedRenderableCount = materialTracker.trackedRenderableCount;
      performance.peakManagedMaterialCount = Math.max(
        performance.peakManagedMaterialCount,
        performance.managedMaterialCount,
      );
      performance.peakAttachmentCount = Math.max(
        performance.peakAttachmentCount,
        performance.attachmentCount,
      );
      performance.peakTrackedRenderableCount = Math.max(
        performance.peakTrackedRenderableCount,
        performance.trackedRenderableCount,
      );
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
      const readiness = adapter.inspectReadiness(
        scene,
        inventory,
        materialTracker.attachmentCount,
        scene.backgroundNode === backgroundNode,
        unsupported,
      );
      const injectedReadinessFailure = injectedReadinessFailureRef.current;
      const effectiveReadiness = injectedReadinessFailure
        ? { ...readiness, ready: false, reason: injectedReadinessFailure }
        : readiness;
      const currentReadinessTiming = readinessTimingRef.current ??
        startMaterialAwareReadinessTiming(rendererGeneration, window.performance.now());
      if (readinessTimingRef.current === null) {
        readinessTimingRef.current = currentReadinessTiming;
      }
      const timingNeedsAdvance =
        currentReadinessTiming.rendererGeneration !== rendererGeneration ||
        (currentReadinessTiming.phase === "initial-pending" && effectiveReadiness.ready) ||
        (adapter.readinessTimeoutMs > 0 &&
          (!effectiveReadiness.ready || currentReadinessTiming.phase === "recovery-pending"));
      let readinessTimedOut = false;
      if (timingNeedsAdvance) {
        const timingResult = advanceMaterialAwareReadinessTiming(
          currentReadinessTiming,
          rendererGeneration,
          effectiveReadiness.ready,
          window.performance.now(),
          adapter.readinessTimeoutMs,
        );
        readinessTimingRef.current = timingResult.timing;
        readinessTimedOut = timingResult.timedOut;
        performance.readinessWaitMs ??= timingResult.timing.initialReadinessWaitMs;
      }

      if (!effectiveReadiness.ready) {
        scene.visible = false;
        performance.readinessFrameCount += 1;
        container?.setAttribute("data-observer-output-policy-readiness", "pending");
        if (effectiveReadiness.reason) {
          container?.setAttribute("data-observer-output-policy-readiness-reason", effectiveReadiness.reason);
        }
        if (effectiveReadiness.evidence) {
          container?.setAttribute("data-observer-output-policy-readiness-evidence", JSON.stringify(effectiveReadiness.evidence));
        }
        if (readinessTimedOut) {
          reportFailure(
            container,
            "scene readiness timed out: " + (effectiveReadiness.reason ?? "unknown"),
          );
        }
        return;
      }

      const original = originalSettingsRef.current;
      scene.visible = original?.sceneVisible ?? true;
      performance.readinessWaitMs ??= readinessTimingRef.current?.initialReadinessWaitMs ?? null;
      container?.setAttribute("data-observer-output-policy-readiness", "ready");
      container?.removeAttribute("data-observer-output-policy-readiness-reason");
      if (readiness.evidence) {
        container?.setAttribute("data-observer-output-policy-readiness-evidence", JSON.stringify(readiness.evidence));
      }
      if (lastStatusRef.current !== "active") {
        lastStatusRef.current = "active";
        performance.diagnosticDomWrites += 1;
        setDiagnosticAttributes(container, "active", inventory);
      }
    } catch (error) {
      scene.visible = false;
      const reason = error instanceof Error ? error.message : String(error);
      reportFailure(container, `material-aware output reconciliation failed: ${reason}`);
    } finally {
      if (import.meta.env.DEV) {
        performance.frameCount += 1;
        recordDuration(performance.controllerCallback, window.performance.now() - callbackStartedAt);
      }
    }
  });

  return null;
};

/** Existing Architecture Rise integration remains a stable public controller export. */
export const MaterialAwareOutputPolicyController = (
  props: MaterialAwareOutputPolicyControllerProps,
) => <MaterialAwareOutputController {...props} adapter={architectureRiseAdapter} />;

/** Explicit development Anatomy opt-in uses the same controller with Anatomy ownership/readiness. */
export const AnatomyMaterialAwareOutputPolicyController = (
  props: MaterialAwareOutputPolicyControllerProps & Readonly<{ allowFailureInjection?: boolean }>,
) => <MaterialAwareOutputController {...props} adapter={anatomyAdapter} />;
