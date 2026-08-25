import React from "react";
import type { DerivedOpticsState } from "../../types/optics";
import {
  getArchitectureReferenceObjectProbePoint,
  referenceObjects,
  type ReferenceObjectDef,
} from "../../scenes/architectureRiseGeometry";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import type { GroundGlassWorldBlurSample } from "../../render/groundGlassBlur";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
} from "../../render/groundGlassRttDimensions";
import { deriveScheimpflugConstruction } from "../../core/optics/scheimpflugConstruction";
import type { CameraMovementGroundGlassComparison } from "../../scenes/cameraMovementGroundGlassComparison";
import {
  getLazySceneAssets,
  getPreloadSceneAssets,
  getRequiredSceneAssets,
} from "../../scenes/definitions";

type OpticalDebugLayer = {
  label: "Original" | "Current";
  channel: GroundGlassRttChannel;
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  focusDistanceMm: number;
  aperture: number;
  rttRuntimeInfo?: GroundGlassRttRuntimeInfo | null;
};

type OpticalDebugComparison = Pick<
  CameraMovementGroundGlassComparison,
  "original" | "current"
>;

type OpticalDebugPanelProps = {
  sceneId: string;
  mode: string;
  taskId?: string | null;
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  focusDistanceMm: number;
  aperture: number;
  renderQuality?: string;
  rttRuntimeInfo?: GroundGlassRttRuntimeInfo | null;
  rttRuntimeInfoByChannel?: Partial<
    Record<GroundGlassRttChannel, GroundGlassRttRuntimeInfo | null>
  >;
  channel?: GroundGlassRttChannel;
  comparison?: OpticalDebugComparison | null;
};

type OpticalDebugLayerDetailsProps = {
  sceneId: string;
  mode: string;
  taskId?: string | null;
  channel: GroundGlassRttChannel;
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  focusDistanceMm: number;
  aperture: number;
  renderQuality?: string;
  rttRuntimeInfo?: GroundGlassRttRuntimeInfo | null;
};

const OpticalDebugLayerDetails: React.FC<OpticalDebugLayerDetailsProps> = ({
  sceneId,
  mode,
  taskId,
  channel,
  opticsState,
  focalLengthMm,
  focusDistanceMm,
  aperture,
  renderQuality,
  rttRuntimeInfo,
}) => {
  const lens = opticsState.lensCenterWorld;
  const film = opticsState.filmPlane.point;
  const filmNormal = opticsState.filmPlane.normal;
  const axis = opticsState.opticalAxis.direction;
  const scheimpflug = React.useMemo(
    () =>
      deriveScheimpflugConstruction({
        filmPlane: opticsState.filmPlane,
        lensPlane: opticsState.lensPlane,
        focusPlane: opticsState.focusPlane,
      }),
    [opticsState.filmPlane, opticsState.focusPlane, opticsState.lensPlane],
  );

  const internalWidth = rttRuntimeInfo?.internalWidthPx ?? 1024;
  const logicalWidth = rttRuntimeInfo?.logicalWidthPx ?? 800;

  const refDiagnostics = React.useMemo(() => {
    if (sceneId !== "architecture-rise") return null;
    return referenceObjects.map((obj: ReferenceObjectDef) => {
      const probe = getArchitectureReferenceObjectProbePoint(obj);
      const sample = sampleGroundGlassBlurAtWorldPoint({
        worldPoint: probe,
        opticsState,
        focalLengthMm,
        aperture,
        circleOfConfusionMm: 0.1,
        filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
        renderWidthPx: internalWidth,
        maximumBlurRadiusPx: 60,
        displayBlurScale: 1,
      });
      const logicalBlurRadiusPx = sample.blurRadiusPx * (logicalWidth / Math.max(1, internalWidth));
      return { id: obj.id, role: obj.role, probe, sample, logicalBlurRadiusPx };
    });
  }, [aperture, focalLengthMm, internalWidth, logicalWidth, opticsState, sceneId]);

  return (
    <>
      <details open className="optical-debug__group">
        <summary>Optical state</summary>
        <div className="optical-debug__group-content">
          <div><strong>Scene:</strong> {sceneId}</div>
          <div><strong>Mode:</strong> {mode} {taskId ? `(task: ${taskId})` : ""}</div>
          <div><strong>Focal length:</strong> {focalLengthMm} mm</div>
          <div><strong>Aperture:</strong> f/{aperture}</div>
          <div><strong>Focus distance:</strong> {typeof focusDistanceMm === "number" ? `${focusDistanceMm.toFixed(1)} mm` : "—"}</div>
          <div><strong>Lens center:</strong> {lens.x.toFixed(1)}, {lens.y.toFixed(1)}, {lens.z.toFixed(1)} mm</div>
          <div data-testid="optical-debug-front-y-mm"><strong>Front standard Y:</strong> {lens.y.toFixed(1)} mm</div>
          <div><strong>Film center:</strong> {film.x.toFixed(1)}, {film.y.toFixed(1)}, {film.z.toFixed(1)} mm</div>
          <div><strong>Film normal:</strong> {filmNormal.x.toFixed(3)}, {filmNormal.y.toFixed(3)}, {filmNormal.z.toFixed(3)}</div>
          <div><strong>Optical axis:</strong> {axis.x.toFixed(3)}, {axis.y.toFixed(3)}, {axis.z.toFixed(3)}</div>
          <div><strong>Focus plane model:</strong> {opticsState.diagnostics.focusPlaneModel}</div>
          <div><strong>DOF model:</strong> {opticsState.diagnostics.depthOfFieldModel ?? "—"}</div>
          <div><strong>Ground Glass DOF:</strong> {opticsState.diagnostics.groundGlassDofModel ?? "—"}</div>
        </div>
      </details>

      <details className="optical-debug__group">
        <summary>Scheimpflug construction</summary>
        <div className="optical-debug__group-content">
          <div><strong>Construction valid:</strong> {scheimpflug.isValid ? "Yes" : "No"}</div>
          {scheimpflug.commonLine ? (
            <>
              <div>
                <strong>Scheimpflug line point:</strong>{" "}
                {scheimpflug.commonLine.point.x.toFixed(3)}, {scheimpflug.commonLine.point.y.toFixed(3)}, {scheimpflug.commonLine.point.z.toFixed(3)} mm
              </div>
              <div>
                <strong>Scheimpflug line direction:</strong>{" "}
                {scheimpflug.commonLine.direction.x.toFixed(6)}, {scheimpflug.commonLine.direction.y.toFixed(6)}, {scheimpflug.commonLine.direction.z.toFixed(6)}
              </div>
            </>
          ) : null}
          <div>
            <strong>Scheimpflug point residual:</strong>{" "}
            {scheimpflug.pointResidualMm === null ? "—" : `${scheimpflug.pointResidualMm.toFixed(6)} mm`}
          </div>
          <div>
            <strong>Scheimpflug direction residual:</strong>{" "}
            {scheimpflug.directionResidual === null ? "—" : scheimpflug.directionResidual.toFixed(9)}
          </div>
          {scheimpflug.unavailableReason ? (
            <div><strong>Unavailable reason:</strong> {scheimpflug.unavailableReason}</div>
          ) : null}
        </div>
      </details>

      <details className="optical-debug__group">
        <summary>Render pipeline</summary>
        <div className="optical-debug__group-content">
          <div><strong>Channel:</strong> {channel}</div>
          <div><strong>Runtime owner:</strong> {rttRuntimeInfo?.ownerId ?? "Pending"}</div>
          <div><strong>Quality:</strong> {renderQuality}</div>
          <div><strong>Logical dimensions:</strong> {rttRuntimeInfo ? `${rttRuntimeInfo.logicalWidthPx}×${rttRuntimeInfo.logicalHeightPx}` : "—"}</div>
          <div><strong>Configured DPR:</strong> {rttRuntimeInfo?.configuredCanvasDpr ?? "—"}</div>
          <div><strong>Renderer DPR:</strong> {rttRuntimeInfo?.rendererPixelRatio ?? "—"}</div>
          <div><strong>Internal dimensions:</strong> {rttRuntimeInfo ? `${rttRuntimeInfo.internalWidthPx}×${rttRuntimeInfo.internalHeightPx}` : "—"}</div>
          <div><strong>Drawing buffer:</strong> {rttRuntimeInfo ? `${rttRuntimeInfo.drawingBufferWidthPx}×${rttRuntimeInfo.drawingBufferHeightPx}` : "—"}</div>
          <div><strong>Render targets:</strong> {rttRuntimeInfo ? `color ${rttRuntimeInfo.colorTargetWidthPx}×${rttRuntimeInfo.colorTargetHeightPx}, depth ${rttRuntimeInfo.depthTargetWidthPx}×${rttRuntimeInfo.depthTargetHeightPx}, final ${rttRuntimeInfo.finalTargetWidthPx}×${rttRuntimeInfo.finalTargetHeightPx}` : "—"}</div>
          <div><strong>Resource generation:</strong> {rttRuntimeInfo?.resourceGeneration ?? "—"}</div>
          <div><strong>Lattice subject generation:</strong> {rttRuntimeInfo?.latticeSubjectGeneration ?? "—"}</div>
          <div><strong>Lattice geometry:</strong> {rttRuntimeInfo?.latticeGeometryId ?? "—"} / {rttRuntimeInfo?.latticeGeometryKey ?? "—"}</div>
          <div><strong>Lattice resource key:</strong> {rttRuntimeInfo?.latticeResourceKey ?? "—"}</div>
          <div><strong>Lattice presentation:</strong> {rttRuntimeInfo?.latticePresentationRegion ?? "—"}</div>
          <div><strong>Camera configured:</strong> {rttRuntimeInfo?.cameraConfigurationOk === undefined ? "—" : rttRuntimeInfo.cameraConfigurationOk ? "Yes" : "No"}</div>
          <div><strong>Camera position:</strong> {rttRuntimeInfo?.cameraPositionWorld?.map((value) => value.toFixed(3)).join(", ") ?? "—"}</div>
          <div><strong>Camera up:</strong> {rttRuntimeInfo?.cameraUpWorld?.map((value) => value.toFixed(3)).join(", ") ?? "—"}</div>
          <div><strong>Camera forward:</strong> {rttRuntimeInfo?.cameraForwardWorld?.map((value) => value.toFixed(3)).join(", ") ?? "—"}</div>
          <div><strong>Clip range:</strong> {typeof rttRuntimeInfo?.cameraNearWorld === "number" ? rttRuntimeInfo.cameraNearWorld.toFixed(3) : "—"}–{typeof rttRuntimeInfo?.cameraFarWorld === "number" ? rttRuntimeInfo.cameraFarWorld.toFixed(3) : "—"} world</div>
          <div><strong>Projection determinant:</strong> {typeof rttRuntimeInfo?.projectionDeterminant === "number" ? rttRuntimeInfo.projectionDeterminant.toExponential(3) : "—"}</div>
          <div><strong>Depth texture:</strong> {rttRuntimeInfo?.depthTextureAvailable === undefined ? "—" : rttRuntimeInfo.depthTextureAvailable ? "Available" : "Fallback"}</div>
          <div><strong>Uniforms finite:</strong> {rttRuntimeInfo?.uniformsFinite === undefined ? "—" : rttRuntimeInfo.uniformsFinite ? "Yes" : `No (${rttRuntimeInfo.uniformPreparationError ?? "unknown"})`}</div>
          <div><strong>Raw RTT sanity:</strong> {rttRuntimeInfo?.rawContentful === undefined ? "—" : `${rttRuntimeInfo.rawContentful ? "Content" : "Background only"} · variance ${rttRuntimeInfo.rawColorVariance?.toFixed(1) ?? "—"} · ${rttRuntimeInfo.rawNonBackgroundPixelCount ?? "—"} pixels`}</div>
          <div><strong>Final RTT sanity:</strong> {rttRuntimeInfo?.finalContentful === undefined ? "—" : `${rttRuntimeInfo.finalContentful ? "Content" : "Background only"} · variance ${rttRuntimeInfo.finalColorVariance?.toFixed(1) ?? "—"} · ${rttRuntimeInfo.finalNonBackgroundPixelCount ?? "—"} pixels`}</div>
          <div><strong>Sanity error:</strong> {rttRuntimeInfo?.renderSanityError ?? "—"}</div>
          <div><strong>Resolution scale:</strong> {typeof rttRuntimeInfo?.resolutionScale === "number" ? `${rttRuntimeInfo.resolutionScale.toFixed(2)}×` : "—"}</div>
          <div><strong>Zoom render scale:</strong> {typeof rttRuntimeInfo?.zoomRenderScale === "number" ? `${rttRuntimeInfo.zoomRenderScale.toFixed(2)}×` : "—"}</div>
          <div><strong>Clamped:</strong> {rttRuntimeInfo?.wasClamped ? "Yes" : "No"}</div>
        </div>
      </details>

      {rttRuntimeInfo?.profilingEnabled ? (
        <details className="optical-debug__group" data-testid="ground-glass-profiling">
          <summary>Ground Glass DOF profiling</summary>
          <div className="optical-debug__group-content">
            <div><strong>Backend:</strong> {rttRuntimeInfo.profilingBackend ?? "—"}</div>
            <div><strong>Timing unit:</strong> {rttRuntimeInfo.profilingSnapshot?.timingUnit ?? "—"}</div>
            <div><strong>GPU query state:</strong> {rttRuntimeInfo.profilingSnapshot?.profilingDiagnostics.gpuQueryState ?? "—"}</div>
            <div><strong>Frame timing samples:</strong> {rttRuntimeInfo.profilingSnapshot?.frame.count ?? 0}</div>
            <div><strong>Cumulative GPU frames:</strong> {rttRuntimeInfo.profilingSnapshot?.profilingDiagnostics.framesCompletedGpu ?? 0}</div>
            <div><strong>GPU queries:</strong> {rttRuntimeInfo.profilingSnapshot ? `${rttRuntimeInfo.profilingSnapshot.profilingDiagnostics.queriesCompleted} completed · ${rttRuntimeInfo.profilingSnapshot.profilingDiagnostics.pendingQueries} pending / ${rttRuntimeInfo.profilingSnapshot.profilingDiagnostics.queryPoolSize} slots` : "—"}</div>
            <div><strong>GPU frame admission:</strong> {rttRuntimeInfo.profilingSnapshot ? `${rttRuntimeInfo.profilingSnapshot.profilingDiagnostics.framesAccepted} accepted · ${rttRuntimeInfo.profilingSnapshot.profilingDiagnostics.framesRejectedCapacity} capacity-skipped` : "—"}</div>
            {rttRuntimeInfo.profilingSnapshot?.profilingDiagnostics.lastGpuQueryError ? (
              <div><strong>GPU query error:</strong> {rttRuntimeInfo.profilingSnapshot.profilingDiagnostics.lastGpuQueryError}</div>
            ) : null}
            <div><strong>Approx. FPS:</strong> {rttRuntimeInfo.profilingSnapshot?.approxFps?.toFixed(1) ?? "—"} (frame timing, display-capped if applicable)</div>
            <pre
              data-testid="ground-glass-profiling-snapshot"
              style={{ maxHeight: "16rem", overflow: "auto", whiteSpace: "pre-wrap" }}
            >
              {JSON.stringify(rttRuntimeInfo.profilingSnapshot ?? null, null, 2)}
            </pre>
          </div>
        </details>
      ) : null}

      {refDiagnostics ? (
        <details className="optical-debug__group">
          <summary>Reference object diagnostics</summary>
          <div className="optical-debug__group-content optical-debug-reference-list">
            {refDiagnostics.map((d: { id: string; role?: string; probe: { x: number; y: number; z: number }; sample: GroundGlassWorldBlurSample; logicalBlurRadiusPx: number }) => {
              const fmt = (n: number | null | undefined, digits = 1) => n === null || n === undefined || !Number.isFinite(n) ? "—" : Number(n).toFixed(digits);
              const fmtNormalized = (n: number | null | undefined) => n === null || n === undefined || !Number.isFinite(n) ? "—" : Number(n).toFixed(3);
              const insideDofText = d.sample.region === "unresolved" ? "Unresolved" : d.sample.insideDepthOfField ? "Yes" : "No";
              return (
                <details key={d.id}>
                  <summary>
                    {d.id}
                    <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}> {d.sample.region} · {d.logicalBlurRadiusPx ? d.logicalBlurRadiusPx.toFixed(2) : "—"} px blur</span>
                  </summary>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    <div><strong>{d.id}</strong> ({d.role ?? "unknown"})</div>
                    <div>Probe: {d.probe.x.toFixed(1)}, {d.probe.y.toFixed(1)}, {d.probe.z.toFixed(1)} mm</div>
                    <div>Region: {d.sample.region}</div>
                    <div>Target ray: {fmt(d.sample.targetRayDistanceMm, 1)} mm</div>
                    <div>Near ray: {d.sample.nearRayDistanceMm !== null ? `${fmt(d.sample.nearRayDistanceMm, 1)} mm` : "—"}</div>
                    <div>Focus ray: {d.sample.focusRayDistanceMm !== null ? `${fmt(d.sample.focusRayDistanceMm, 1)} mm` : "—"}</div>
                    <div>Far ray: {d.sample.farRayDistanceMm !== null ? `${fmt(d.sample.farRayDistanceMm, 1)} mm` : d.sample.depthOfFieldModel === "parallel" ? "—" : "∞"}</div>
                    <div>Inside DOF: {insideDofText}</div>
                    <div>Normalized defocus: {fmtNormalized(d.sample.normalizedDefocus)}</div>
                    <div>CoC: {d.sample.circleOfConfusionDiameterMm ? d.sample.circleOfConfusionDiameterMm.toFixed(4) : "—"} mm ({d.sample.circleOfConfusionDiameterPx ? d.sample.circleOfConfusionDiameterPx.toFixed(3) : "—"} px)</div>
                    <div>Blur radius: {d.sample.blurRadiusPx ? d.sample.blurRadiusPx.toFixed(3) : "—"} internal px, {d.logicalBlurRadiusPx ? d.logicalBlurRadiusPx.toFixed(3) : "—"} display px</div>
                    {d.sample.diagnosticReason ? <div style={{ color: "#b91c1c" }}>Reason: {d.sample.diagnosticReason}</div> : null}
                  </div>
                </details>
              );
            })}
          </div>
        </details>
      ) : null}
    </>
  );
};

export const OpticalDebugPanel: React.FC<OpticalDebugPanelProps> = ({
  sceneId,
  mode,
  taskId,
  opticsState,
  focalLengthMm,
  focusDistanceMm,
  aperture,
  renderQuality,
  rttRuntimeInfo,
  rttRuntimeInfoByChannel,
  channel = "default",
  comparison,
}) => {
  const comparisonId = React.useId();
  const defaultLayer: OpticalDebugLayer = {
    label: "Current",
    channel,
    opticsState,
    focalLengthMm,
    focusDistanceMm,
    aperture,
    rttRuntimeInfo:
      channel === "default"
        ? rttRuntimeInfo
        : rttRuntimeInfoByChannel?.[channel] ?? rttRuntimeInfo ?? null,
  };
  const comparisonLayers: OpticalDebugLayer[] | null = comparison
    ? [
        {
          label: "Original",
          channel: "camera-movement-original",
          opticsState: comparison.original.opticsState,
          focalLengthMm: comparison.original.camera.focalLengthMm,
          focusDistanceMm: comparison.original.camera.focusDistanceMm,
          aperture: comparison.original.camera.aperture,
          rttRuntimeInfo:
            rttRuntimeInfoByChannel?.["camera-movement-original"] ?? null,
        },
        {
          label: "Current",
          channel: "camera-movement-current",
          opticsState: comparison.current.opticsState,
          focalLengthMm: comparison.current.camera.focalLengthMm,
          focusDistanceMm: comparison.current.camera.focusDistanceMm,
          aperture: comparison.current.camera.aperture,
          rttRuntimeInfo:
            rttRuntimeInfoByChannel?.["camera-movement-current"] ?? null,
        },
      ]
    : null;
  const sceneAssetCounts = React.useMemo(
    () => ({
      required: getRequiredSceneAssets(sceneId).length,
      lazy: getLazySceneAssets(sceneId).length,
      preload: getPreloadSceneAssets(sceneId).length,
    }),
    [sceneId],
  );

  return (
    <div className="simulator-info-card simulator-info-card--debug optical-debug">
      <details className="optical-debug__details">
        <summary className="optical-debug__summary">
          <span>Optical Debug</span>
          <span className="optical-debug__summary-meta">
            {sceneId} · {comparison ? "Original / Current" : opticsState.diagnostics.focusPlaneModel}
          </span>
        </summary>

        <div className="optical-debug__content">
          <details className="optical-debug__group" data-testid="optical-debug-scene-assets">
            <summary>Scene assets</summary>
            <div className="optical-debug__group-content">
              <div><strong>Required:</strong> {sceneAssetCounts.required}</div>
              <div><strong>Lazy for current scene:</strong> {sceneAssetCounts.lazy}</div>
              <div><strong>Preload for next scene:</strong> {sceneAssetCounts.preload}</div>
            </div>
          </details>

          {comparisonLayers ? (
            <div className="optical-debug__comparison" aria-label="Original and Current optical diagnostics">
              {comparisonLayers.map((layer) => {
                const layerId = `${comparisonId}-${layer.label.toLowerCase()}`;
                const descriptionId = `${layerId}-description`;
                return (
                  <section key={layer.label} className="optical-debug__layer" aria-labelledby={layerId} aria-describedby={descriptionId}>
                    <h3 id={layerId}>{layer.label}</h3>
                    <p id={descriptionId}>Diagnostics for the {layer.label.toLowerCase()} Ground Glass channel ({layer.channel}).</p>
                    <OpticalDebugLayerDetails
                      sceneId={sceneId}
                      mode={mode}
                      taskId={taskId}
                      channel={layer.channel}
                      opticsState={layer.opticsState}
                      focalLengthMm={layer.focalLengthMm}
                      focusDistanceMm={layer.focusDistanceMm}
                      aperture={layer.aperture}
                      renderQuality={renderQuality}
                      rttRuntimeInfo={layer.rttRuntimeInfo}
                    />
                  </section>
                );
              })}
            </div>
          ) : (
            <OpticalDebugLayerDetails
              sceneId={sceneId}
              mode={mode}
              taskId={taskId}
              channel={defaultLayer.channel}
              opticsState={defaultLayer.opticsState}
              focalLengthMm={defaultLayer.focalLengthMm}
              focusDistanceMm={defaultLayer.focusDistanceMm}
              aperture={defaultLayer.aperture}
              renderQuality={renderQuality}
              rttRuntimeInfo={defaultLayer.rttRuntimeInfo}
            />
          )}
        </div>
      </details>
    </div>
  );
};

export default OpticalDebugPanel;
