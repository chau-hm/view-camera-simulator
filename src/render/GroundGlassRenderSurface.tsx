import { useCallback, useState } from "react";
import { REVISION } from "three";
import type { DerivedOpticsState } from "../types/optics";
import { GroundGlassRenderHost } from "./GroundGlassRenderHost";
import type { GroundGlassBackendDiagnostics } from "./backend/groundGlassBackendDiagnostics";
import { normalizeGroundGlassFrameRequestInput } from "./groundGlassFrameRequest";
import { isGroundGlassRttScene } from "./groundGlassRttScenes";
import type { SceneDefinition } from "../types/scene";
import type { EffectiveCameraMovementCalibration } from "../scenes/cameraMovementEffectiveCalibration";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "./groundGlassRttDimensions";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";

export type GroundGlassRenderSurfaceProps = {
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  scene: SceneDefinition;
  apertureNumber: number;
  previewMode: "raw" | "upright";
  rawDebug?: boolean;
  sceneShiftX: number;
  sceneShiftY: number;
  sceneRotationDeg: number;
  focusScale: number;
  widthPx: number;
  heightPx: number;
  renderQuality: import("../types/ui").RenderQualityProfile;
  channel?: GroundGlassRttChannel;
  inspectionWindow?: GroundGlassInspectionWindow;
  presentationRegion?: import("../scenes/cameraMovementSceneCalibration").CameraMovementPresentationRegion;
  effectiveCameraMovementCalibration?: EffectiveCameraMovementCalibration;
  runtimeInfo?: GroundGlassRttRuntimeInfo | null;
  onRuntimeInfoChange?: GroundGlassRttRuntimeInfoChangeHandler;
};

export const GroundGlassRenderSurface = ({
  opticsState,
  focalLengthMm,
  scene,
  apertureNumber,
  previewMode,
  rawDebug,
  sceneShiftX,
  sceneShiftY,
  sceneRotationDeg,
  focusScale,
  widthPx,
  heightPx,
  renderQuality,
  channel = "default",
  inspectionWindow,
  presentationRegion,
  effectiveCameraMovementCalibration,
  runtimeInfo: explicitRuntimeInfo,
  onRuntimeInfoChange: explicitRuntimeInfoChange,
}: GroundGlassRenderSurfaceProps) => {
  const rttRuntimeInfo = explicitRuntimeInfo;
  const runtimeInfoChange = explicitRuntimeInfoChange;
  const sceneId = scene.id;
  const [backendDiagnostics, setBackendDiagnostics] = useState<GroundGlassBackendDiagnostics | null>(null);
  const testEvidenceEnabled = import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true";
  const policyDecision = backendDiagnostics?.policySelection.policyDecision;
  const policyEvidenceRevisions = policyDecision?.status === "authorized" &&
      policyDecision.sceneEligibility.status === "eligible"
    ? policyDecision.sceneEligibility.evidenceRevisions.join(",")
    : undefined;
  const backendDetails = backendDiagnostics?.backendDetails;
  const webGpuBackendDetails = backendDetails?.backend === "webgpu" ? backendDetails : null;
  const handleBackendDiagnosticsChange = useCallback((
    _channel: GroundGlassRttChannel,
    diagnostics: GroundGlassBackendDiagnostics | null,
  ) => setBackendDiagnostics(diagnostics), []);
  if (isGroundGlassRttScene(sceneId)) {
    return (
      <div
        data-testid="ground-glass-rtt"
        data-three-revision={import.meta.env.DEV ? REVISION : undefined}
        data-rtt-channel={channel}
        data-rtt-scene-id={sceneId}
        data-renderer-generation={backendDiagnostics?.rendererGeneration?.generationId}
        data-frame-request-id={backendDiagnostics?.requestIdentity.requestId}
        data-frame-channel-id={backendDiagnostics?.requestIdentity.channelId}
        data-frame-scene-id={backendDiagnostics?.requestIdentity.sceneId}
        data-policy-requested-backend={testEvidenceEnabled ? backendDiagnostics?.policySelection.requestedBackend ?? "default" : undefined}
        data-policy-selected-backend={backendDiagnostics?.policySelection.status === "selected"
          ? backendDiagnostics.policySelection.selectedBackend
          : "unavailable"}
        data-policy-evidence-revisions={import.meta.env.DEV ? policyEvidenceRevisions : undefined}
        data-mounted-renderer-revision={import.meta.env.DEV ? webGpuBackendDetails?.rendererRevision : undefined}
        data-mounted-verification-evidence-revision={import.meta.env.DEV
          ? webGpuBackendDetails?.verificationEvidenceRevision
          : undefined}
        data-attempted-backend={testEvidenceEnabled ? backendDiagnostics?.attemptedBackend.status === "not-started"
          ? "not-started"
          : backendDiagnostics?.attemptedBackend.backend : undefined}
        data-backend-attempt-status={testEvidenceEnabled ? backendDiagnostics?.attemptedBackend.status : undefined}
        data-pilot-session-id={backendDiagnostics?.pilotSessionId ?? undefined}
        data-pilot-retry-status={backendDiagnostics?.retryState?.status ?? "none"}
        data-pilot-retry-epoch={backendDiagnostics?.retryState?.retryEpoch}
        data-pilot-recovery-action={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.pilotRecoveryAction?.action
          : undefined}
        data-pilot-recovery-result={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.pilotRecoveryAction?.status
          : undefined}
        data-pilot-recovery-reason={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.pilotRecoveryAction?.reason ?? undefined
          : undefined}
        data-pilot-retry-failure-count={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.retryState?.failureHistory.length
          : undefined}
        data-pilot-failure-backend={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.lastFailure?.backend
          : undefined}
        data-pilot-failure-stage={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.lastFailure?.stage
          : undefined}
        data-pilot-failure-pass={import.meta.env.DEV && import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"
          ? backendDiagnostics?.lastFailure?.failedPass ?? undefined
          : undefined}
        data-last-failure-host-id={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.hostId : undefined}
        data-last-failure-channel-id={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.generation.channelId : undefined}
        data-last-failure-session-id={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.pilotSessionId ?? undefined : undefined}
        data-last-failure-retry-epoch={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.retryEpoch ?? undefined : undefined}
        data-last-failure-generation-id={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.generation.generationId : undefined}
        data-last-failure-request-id={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.request?.requestId : undefined}
        data-last-failure-scene-id={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.request?.sceneId : undefined}
        data-last-failure-operation={testEvidenceEnabled ? backendDiagnostics?.lastFailure?.failedPass ?? undefined : undefined}
        data-application-fallback={backendDiagnostics?.applicationFallback.status ?? "unknown"}
        data-mounted-renderer-family={backendDiagnostics?.mountedRuntime.status === "mounted" ? backendDiagnostics.mountedRuntime.rendererFamily : undefined}
        data-actual-execution-api={backendDiagnostics?.mountedRuntime.status === "mounted" ? backendDiagnostics.mountedRuntime.actualExecutionApi : undefined}
        data-internal-fallback={testEvidenceEnabled && backendDiagnostics?.mountedRuntime.status === "mounted" ? backendDiagnostics.mountedRuntime.internalFallback : undefined}
        data-render-host-lifecycle={backendDiagnostics?.lifecycleStatus}
        data-frame-result-status={backendDiagnostics?.frame.current?.status}
        data-last-completed-request-id={backendDiagnostics?.frame.lastSuccessfullyCompleted?.request.requestId}
        data-render-cleanup-status={backendDiagnostics?.cleanup?.status}
        data-rtt-camera-ok={rttRuntimeInfo?.cameraConfigurationOk === undefined ? undefined : String(rttRuntimeInfo.cameraConfigurationOk)}
        data-rtt-depth-available={rttRuntimeInfo?.depthTextureAvailable === undefined ? undefined : String(rttRuntimeInfo.depthTextureAvailable)}
        data-rtt-uniforms-finite={rttRuntimeInfo?.uniformsFinite === undefined ? undefined : String(rttRuntimeInfo.uniformsFinite)}
        data-rtt-dof-mode={rttRuntimeInfo?.dofMode}
        data-rtt-raw-contentful={rttRuntimeInfo?.rawContentful === undefined ? undefined : String(rttRuntimeInfo.rawContentful)}
        data-rtt-final-contentful={rttRuntimeInfo?.finalContentful === undefined ? undefined : String(rttRuntimeInfo.finalContentful)}
        data-rtt-raw-variance={rttRuntimeInfo?.rawColorVariance}
        data-rtt-final-variance={rttRuntimeInfo?.finalColorVariance}
        data-rtt-raw-non-background={rttRuntimeInfo?.rawNonBackgroundPixelCount}
        data-rtt-final-non-background={rttRuntimeInfo?.finalNonBackgroundPixelCount}
        data-rtt-resource-generation={rttRuntimeInfo?.resourceGeneration}
        data-rtt-owner-id={rttRuntimeInfo?.ownerId}
        data-rtt-focal-length-mm={rttRuntimeInfo?.focalLengthMm}
        data-rtt-lattice-edge-count={rttRuntimeInfo?.latticeEdgeCount}
        data-rtt-lattice-geometry-id={rttRuntimeInfo?.latticeGeometryId}
        data-rtt-lattice-geometry-key={rttRuntimeInfo?.latticeGeometryKey}
        data-rtt-lattice-presentation-key={rttRuntimeInfo?.latticePresentationKey}
        data-rtt-lattice-resource-key={rttRuntimeInfo?.latticeResourceKey}
        data-rtt-lattice-presentation-region={rttRuntimeInfo?.latticePresentationRegion}
        data-rtt-lattice-subject-generation={rttRuntimeInfo?.latticeSubjectGeneration}
        data-rtt-ground-glass-illuminance-gain={rttRuntimeInfo?.groundGlassIlluminanceGain}
        data-rtt-natural-illumination-enabled={rttRuntimeInfo?.groundGlassNaturalIlluminationEnabled === undefined ? undefined : String(rttRuntimeInfo.groundGlassNaturalIlluminationEnabled)}
        data-rtt-natural-illumination-kind={rttRuntimeInfo?.groundGlassNaturalIlluminationKind}
        data-rtt-natural-illumination-image-distance-mm={rttRuntimeInfo?.groundGlassNaturalIlluminationImageDistanceMm}
        data-rtt-natural-illumination-offset-x-mm={rttRuntimeInfo?.groundGlassNaturalIlluminationOffsetXMm}
        data-rtt-natural-illumination-offset-y-mm={rttRuntimeInfo?.groundGlassNaturalIlluminationOffsetYMm}
        data-rtt-coverage-enabled={rttRuntimeInfo?.groundGlassCoverageEnabled === undefined ? undefined : String(rttRuntimeInfo.groundGlassCoverageEnabled)}
        data-rtt-coverage-kind={rttRuntimeInfo?.groundGlassCoverageKind}
        data-rtt-physical-boundary-blur-radius-px={rttRuntimeInfo?.groundGlassPhysicalBoundaryRadiusPx}
        data-rtt-coverage-radius-mm={rttRuntimeInfo?.groundGlassCoverageRadiusMm}
        data-rtt-coverage-offset-x-mm={rttRuntimeInfo?.groundGlassCoverageOffsetXMm}
        data-rtt-coverage-offset-y-mm={rttRuntimeInfo?.groundGlassCoverageOffsetYMm}
        data-rtt-coverage-conic-quadratic={rttRuntimeInfo?.groundGlassCoverageConicQuadratic}
        data-rtt-coverage-conic-axial={rttRuntimeInfo?.groundGlassCoverageConicAxial}
        data-rtt-camera-position={rttRuntimeInfo?.cameraPositionWorld?.join(",")}
        data-rtt-camera-up={rttRuntimeInfo?.cameraUpWorld?.join(",")}
        data-rtt-camera-forward={rttRuntimeInfo?.cameraForwardWorld?.join(",")}
        data-rtt-logical-width={rttRuntimeInfo?.logicalWidthPx}
        data-rtt-logical-height={rttRuntimeInfo?.logicalHeightPx}
        data-rtt-resolution-scale={rttRuntimeInfo?.resolutionScale}
        data-rtt-effective-device-pixel-ratio={rttRuntimeInfo?.effectiveDevicePixelRatio}
        data-rtt-internal-width={rttRuntimeInfo?.internalWidthPx}
        data-rtt-internal-height={rttRuntimeInfo?.internalHeightPx}
        data-rtt-canvas-css-width={rttRuntimeInfo?.canvasCssWidthPx}
        data-rtt-canvas-css-height={rttRuntimeInfo?.canvasCssHeightPx}
        data-rtt-color-target-width={rttRuntimeInfo?.colorTargetWidthPx}
        data-rtt-color-target-height={rttRuntimeInfo?.colorTargetHeightPx}
        data-rtt-depth-target-width={rttRuntimeInfo?.depthTargetWidthPx}
        data-rtt-depth-target-height={rttRuntimeInfo?.depthTargetHeightPx}
        data-rtt-blur-target-width={rttRuntimeInfo?.blurTargetWidthPx}
        data-rtt-blur-target-height={rttRuntimeInfo?.blurTargetHeightPx}
        data-rtt-gather-scale={rttRuntimeInfo?.gatherScale}
        data-rtt-final-target-width={rttRuntimeInfo?.finalTargetWidthPx}
        data-rtt-final-target-height={rttRuntimeInfo?.finalTargetHeightPx}
        data-rtt-horizontal-shader-width={rttRuntimeInfo?.horizontalShaderRenderWidthPx}
        data-rtt-horizontal-shader-height={rttRuntimeInfo?.horizontalShaderRenderHeightPx}
        data-rtt-vertical-shader-width={rttRuntimeInfo?.verticalShaderRenderWidthPx}
        data-rtt-vertical-shader-height={rttRuntimeInfo?.verticalShaderRenderHeightPx}
        data-rtt-was-clamped={rttRuntimeInfo?.wasClamped === undefined ? undefined : String(rttRuntimeInfo.wasClamped)}
        data-rtt-sanity-state={rttRuntimeInfo?.renderSanityStateKey}
        data-rtt-sanity-error={rttRuntimeInfo?.renderSanityError ?? undefined}
        data-rtt-frame-error={rttRuntimeInfo?.frameExecutionError ?? undefined}
        data-rtt-failed-pass={rttRuntimeInfo?.failedPass}
        data-rtt-inspection-window-active={rttRuntimeInfo?.inspectionWindowActive === undefined ? undefined : String(rttRuntimeInfo.inspectionWindowActive)}
        data-rtt-inspection-center-u={rttRuntimeInfo?.inspectionCenterU}
        data-rtt-inspection-center-v={rttRuntimeInfo?.inspectionCenterV}
        data-rtt-sampled-film-width-mm={rttRuntimeInfo?.sampledFilmWidthMm}
        data-rtt-sampled-film-height-mm={rttRuntimeInfo?.sampledFilmHeightMm}
        data-rtt-profiling-enabled={rttRuntimeInfo?.profilingEnabled === undefined ? undefined : String(rttRuntimeInfo.profilingEnabled)}
        data-rtt-profiling-backend={rttRuntimeInfo?.profilingBackend}
        data-rtt-profiling-raw-debug={rttRuntimeInfo?.profilingSnapshot?.rawDebug === undefined ? undefined : String(rttRuntimeInfo.profilingSnapshot.rawDebug)}
        data-rtt-profiling-frame-count={rttRuntimeInfo?.profilingSnapshot?.frame.count}
        data-rtt-profiling-approx-fps={rttRuntimeInfo?.profilingSnapshot?.approxFps}
        data-rtt-profiling-ground-glass-count={rttRuntimeInfo?.profilingSnapshot?.groundGlassGpu?.count ?? rttRuntimeInfo?.profilingSnapshot?.groundGlassCpuSubmit?.count}
        data-rtt-profiling-physical-dof-count={rttRuntimeInfo?.profilingSnapshot?.physicalDofGpu?.count ?? rttRuntimeInfo?.profilingSnapshot?.physicalDofCpuSubmit?.count}
        data-rtt-profiling-gpu-state={rttRuntimeInfo?.profilingSnapshot?.profilingDiagnostics.gpuQueryState}
        data-rtt-profiling-gpu-frames-completed={rttRuntimeInfo?.profilingSnapshot?.profilingDiagnostics.framesCompletedGpu}
        data-rtt-profiling-gpu-queries-completed={rttRuntimeInfo?.profilingSnapshot?.profilingDiagnostics.queriesCompleted}
        data-rtt-profiling-gpu-pending-queries={rttRuntimeInfo?.profilingSnapshot?.profilingDiagnostics.pendingQueries}
        data-rtt-profiling-gpu-last-error={rttRuntimeInfo?.profilingSnapshot?.profilingDiagnostics.lastGpuQueryError ?? undefined}
        style={{ position: "absolute", inset: 0 }}
      >
        <GroundGlassRenderHost
          request={normalizeGroundGlassFrameRequestInput({
            opticsState,
            focalLengthMm,
            scene,
            widthPx,
            heightPx,
            aperture: apertureNumber,
            previewMode,
            rawDebug,
            renderQuality,
            channel,
            inspectionWindow,
            presentationRegion,
            effectiveCameraMovementCalibration,
          })}
          onRuntimeInfoChange={runtimeInfoChange}
          onDiagnosticsChange={handleBackendDiagnosticsChange}
        />
      </div>
    );
  }

  return (
    <canvas
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        transform: `translate(${sceneShiftX}px, ${sceneShiftY}px) rotate(${sceneRotationDeg}deg) scale(${focusScale})`,
        transformOrigin: "center",
      }}
    />
  );
};
