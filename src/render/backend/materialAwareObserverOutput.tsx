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
  type UnsupportedMaterialAssignment,
} from "./materialAwareMaterialTracker";
import {
  buildArchitectureRiseMaterialInventory,
  type ObserverMaterialInventory,
} from "./architectureRiseMaterialInventory";
import {
  isArchitectureRiseMaterialOutputReady,
  resolveArchitectureRiseMaterialOutputOwner,
} from "./architectureRiseMaterialOutputAdapter";
import { getObserverMaterialSignatures } from "./observerMaterialSignatures";

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
}>;

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
  const lastInventoryRef = useRef<ObserverMaterialInventory | null>(null);
  const lastInventoryRefreshFrameRef = useRef(0);
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

    return () => {
      materialTracker.dispose();
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
  }, [backgroundNode, gl, materialTracker, onCapabilitiesChange, performanceRef, rendererGeneration, reportFailure, scene]);

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
        const reconciliation = materialTracker.reconcileRenderable(
          object,
          resolveArchitectureRiseMaterialOutputOwner(object, materialTracker.controllerOwner),
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
      const attachmentCountBeforeCleanup = materialTracker.attachmentCount;
      if (materialTracker.releaseStaleMaterials(currentFrame) > 0) materialInventoryDirty = true;
      if (materialTracker.attachmentCount !== attachmentCountBeforeCleanup) materialInventoryDirty = true;
      if (collectDetailedSample) recordDuration(performance.staleCleanup, window.performance.now() - cleanupStartedAt);

      const architectureSubjectMounted = isArchitectureRiseMaterialOutputReady(scene);
      const inventoryStartedAt = collectDetailedSample ? window.performance.now() : 0;
      const previousInventory = lastInventoryRef.current;
      const inventoryNeedsRefresh = materialInventoryDirty ||
        unsupported.length > 0 ||
        !previousInventory ||
        previousInventory.totalMeshAssignments !== meshAssignmentCount ||
        currentFrame - lastInventoryRefreshFrameRef.current >= INVENTORY_REFRESH_INTERVAL_FRAMES;
      if (inventoryNeedsRefresh) {
        lastInventoryRef.current = buildArchitectureRiseMaterialInventory(scene, currentFrame, unsupported);
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
