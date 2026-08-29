import type { DerivedOpticsState } from "../types/optics";
import { GroundGlassRTT } from "./GroundGlassRTT";
import { isGroundGlassRttScene } from "./groundGlassRttScenes";
import type { SceneDefinition } from "../types/scene";
import type { EffectiveCameraMovementCalibration } from "../scenes/cameraMovementEffectiveCalibration";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "./groundGlassRttDimensions";

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
  zoomEnabled?: boolean;
  channel?: GroundGlassRttChannel;
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
  zoomEnabled,
  channel = "default",
  presentationRegion,
  effectiveCameraMovementCalibration,
  runtimeInfo: explicitRuntimeInfo,
  onRuntimeInfoChange: explicitRuntimeInfoChange,
}: GroundGlassRenderSurfaceProps) => {
  const rttRuntimeInfo = explicitRuntimeInfo;
  const runtimeInfoChange = explicitRuntimeInfoChange;
  const sceneId = scene.id;
  if (isGroundGlassRttScene(sceneId)) {
    return (
      <div
        data-testid="ground-glass-rtt"
        data-rtt-channel={channel}
        data-rtt-scene-id={sceneId}
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
        data-rtt-camera-position={rttRuntimeInfo?.cameraPositionWorld?.join(",")}
        data-rtt-camera-up={rttRuntimeInfo?.cameraUpWorld?.join(",")}
        data-rtt-camera-forward={rttRuntimeInfo?.cameraForwardWorld?.join(",")}
        data-rtt-logical-width={rttRuntimeInfo?.logicalWidthPx}
        data-rtt-logical-height={rttRuntimeInfo?.logicalHeightPx}
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
        data-rtt-final-target-width={rttRuntimeInfo?.finalTargetWidthPx}
        data-rtt-final-target-height={rttRuntimeInfo?.finalTargetHeightPx}
        data-rtt-horizontal-shader-width={rttRuntimeInfo?.horizontalShaderRenderWidthPx}
        data-rtt-horizontal-shader-height={rttRuntimeInfo?.horizontalShaderRenderHeightPx}
        data-rtt-vertical-shader-width={rttRuntimeInfo?.verticalShaderRenderWidthPx}
        data-rtt-vertical-shader-height={rttRuntimeInfo?.verticalShaderRenderHeightPx}
        data-rtt-was-clamped={rttRuntimeInfo?.wasClamped === undefined ? undefined : String(rttRuntimeInfo.wasClamped)}
        data-rtt-sanity-state={rttRuntimeInfo?.renderSanityStateKey}
        data-rtt-sanity-error={rttRuntimeInfo?.renderSanityError ?? undefined}
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
        <GroundGlassRTT
          opticsState={opticsState}
          focalLengthMm={focalLengthMm}
          scene={scene}
          widthPx={widthPx}
          heightPx={heightPx}
          aperture={apertureNumber}
          previewMode={previewMode}
          rawDebug={rawDebug}
          renderQuality={renderQuality}
          zoomEnabled={zoomEnabled}
          channel={channel}
          presentationRegion={presentationRegion}
          effectiveCameraMovementCalibration={effectiveCameraMovementCalibration}
          onRuntimeInfoChange={runtimeInfoChange}
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
