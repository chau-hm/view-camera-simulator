import { GroundGlassRTT } from "./GroundGlassRTT";
import type { GroundGlassFrameResult, GroundGlassRendererGenerationIdentity } from "./backend/groundGlassBackendContracts";
import type { GroundGlassFrameRequest } from "./groundGlassFrameRequest";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import type { EffectiveCameraMovementCalibration } from "../scenes/cameraMovementEffectiveCalibration";
import type { GroundGlassRttRuntimeInfoChangeHandler } from "./groundGlassRttDimensions";
import type { GroundGlassCleanupOutcome } from "./groundGlassRenderHostState";
import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";

export type GroundGlassWebGLAdapterProps = Readonly<{
  request: GroundGlassFrameRequest;
  generation: GroundGlassRendererGenerationIdentity;
  onAdapterStarted: (generation: GroundGlassRendererGenerationIdentity) => void;
  onRendererMounted: (
    generation: GroundGlassRendererGenerationIdentity,
    actualExecutionApi: "webgl" | "webgl2",
  ) => void;
  onFrameResult: (result: GroundGlassFrameResult) => void;
  onRuntimeInfoChange?: GroundGlassRttRuntimeInfoChangeHandler;
  onAdapterDisposed: (
    generation: GroundGlassRendererGenerationIdentity,
    outcome: GroundGlassCleanupOutcome,
  ) => void;
}>;

/** Thin prop/lifecycle adapter. GroundGlassRTT retains its Canvas and all WebGL resource ownership. */
export const GroundGlassWebGLAdapter = ({
  request,
  generation,
  onAdapterStarted,
  onRendererMounted,
  onFrameResult,
  onRuntimeInfoChange,
  onAdapterDisposed,
}: GroundGlassWebGLAdapterProps) => (
  <GroundGlassRTT
    // The request owns a deeply frozen semantic snapshot. GroundGlassRTT's existing API predates
    // that readonly contract but only reads these values; keep the compatibility cast here.
    opticsState={request.opticsState as unknown as DerivedOpticsState}
    focalLengthMm={request.focalLengthMm}
    scene={request.scene as unknown as SceneDefinition}
    widthPx={request.widthPx}
    heightPx={request.heightPx}
    aperture={request.aperture}
    previewMode={request.previewMode}
    rawDebug={request.rawDebug}
    renderQuality={request.renderQuality}
    channel={request.channel}
    inspectionWindow={request.inspectionWindow as unknown as GroundGlassInspectionWindow}
    presentationRegion={request.presentationRegion}
    effectiveCameraMovementCalibration={request.effectiveCameraMovementCalibration as unknown as EffectiveCameraMovementCalibration | undefined}
    rendererGeneration={generation}
    acceptedRequestIdentity={request.identity}
    onAdapterStarted={onAdapterStarted}
    onRendererMounted={onRendererMounted}
    onFrameResult={onFrameResult}
    onAdapterDisposed={onAdapterDisposed}
    onRuntimeInfoChange={onRuntimeInfoChange}
  />
);
