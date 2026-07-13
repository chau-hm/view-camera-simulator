import React from "react";
import type { DerivedOpticsState } from "../../types/optics";
import { getArchitectureReferenceObjectProbePoint, referenceObjects, type ReferenceObjectDef } from "../../scenes/architectureRiseGeometry";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import type { GroundGlassWorldBlurSample } from "../../render/groundGlassBlur";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import type { GroundGlassRttRuntimeInfo } from "../../render/groundGlassRttDimensions";

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
};

export const OpticalDebugPanel: React.FC<OpticalDebugPanelProps> = ({ sceneId, mode, taskId, opticsState, focalLengthMm, focusDistanceMm, aperture, renderQuality, rttRuntimeInfo }) => {
  const lens = opticsState.lensCenterWorld;
  const film = opticsState.filmPlane.point;
  const filmNormal = opticsState.filmPlane.normal;
  const axis = opticsState.opticalAxis.direction;

  const internalWidth = rttRuntimeInfo?.internalWidthPx ?? 1024;
  const logicalWidth = rttRuntimeInfo?.logicalWidthPx ?? 800;

  // If architecture scene, compute per-reference-object blur diagnostics
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
  }, [sceneId, opticsState, focalLengthMm, aperture, internalWidth, logicalWidth]);

  return (
    <div className="simulator-info-card simulator-info-card--debug optical-debug">
      <details className="optical-debug__details">
        <summary className="optical-debug__summary">
          <span>Optical Debug</span>
          <span className="optical-debug__summary-meta">{sceneId} · {opticsState.diagnostics.focusPlaneModel}</span>
        </summary>

        <div className="optical-debug__content">
          <details open className="optical-debug__group">
            <summary>Optical state</summary>
            <div className="optical-debug__group-content">
              <div><strong>Scene:</strong> {sceneId}</div>
              <div><strong>Mode:</strong> {mode} {taskId ? `(task: ${taskId})` : ''}</div>
              <div><strong>Focal length:</strong> {focalLengthMm} mm</div>
              <div><strong>Aperture:</strong> f/{aperture}</div>
              <div><strong>Focus distance:</strong> {typeof focusDistanceMm === 'number' ? focusDistanceMm.toFixed(1) + ' mm' : '—'}</div>
              <div><strong>Lens center:</strong> {lens.x.toFixed(1)}, {lens.y.toFixed(1)}, {lens.z.toFixed(1)} mm</div>
              <div><strong>Film center:</strong> {film.x.toFixed(1)}, {film.y.toFixed(1)}, {film.z.toFixed(1)} mm</div>
              <div><strong>Film normal:</strong> {filmNormal.x.toFixed(3)}, {filmNormal.y.toFixed(3)}, {filmNormal.z.toFixed(3)}</div>
              <div><strong>Optical axis:</strong> {axis.x.toFixed(3)}, {axis.y.toFixed(3)}, {axis.z.toFixed(3)}</div>
              <div><strong>Focus plane model:</strong> {opticsState.diagnostics.focusPlaneModel}</div>
              <div><strong>DOF model:</strong> {opticsState.diagnostics.depthOfFieldModel ?? '—'}</div>
            </div>
          </details>

          <details className="optical-debug__group">
            <summary>Render pipeline</summary>
            <div className="optical-debug__group-content">
              <div><strong>Quality:</strong> {renderQuality}</div>
              <div><strong>Display:</strong> {rttRuntimeInfo?.logicalWidthPx ?? '—'}×{rttRuntimeInfo?.logicalHeightPx ?? '—'}</div>
              <div><strong>Configured DPR:</strong> {rttRuntimeInfo?.configuredCanvasDpr ?? '—'}</div>
              <div><strong>Renderer DPR:</strong> {rttRuntimeInfo?.rendererPixelRatio ?? '—'}</div>
              <div><strong>Drawing buffer:</strong> {rttRuntimeInfo?.drawingBufferWidthPx ?? '—'}×{rttRuntimeInfo?.drawingBufferHeightPx ?? '—'}</div>
              <div><strong>Internal render:</strong> {rttRuntimeInfo?.internalWidthPx ?? '—'}×{rttRuntimeInfo?.internalHeightPx ?? '—'}</div>
              <div><strong>RTT color:</strong> {rttRuntimeInfo?.colorTargetWidthPx ?? '—'}×{rttRuntimeInfo?.colorTargetHeightPx ?? '—'}</div>
              <div><strong>RTT depth:</strong> {rttRuntimeInfo?.depthTargetWidthPx ?? '—'}×{rttRuntimeInfo?.depthTargetHeightPx ?? '—'}</div>
              <div><strong>RTT blur:</strong> {rttRuntimeInfo?.blurTargetWidthPx ?? '—'}×{rttRuntimeInfo?.blurTargetHeightPx ?? '—'}</div>
              <div><strong>Resolution scale:</strong> {typeof rttRuntimeInfo?.resolutionScale === 'number' ? rttRuntimeInfo.resolutionScale.toFixed(2) + '×' : '—'}</div>
              <div><strong>Zoom render scale:</strong> {typeof rttRuntimeInfo?.zoomRenderScale === 'number' ? rttRuntimeInfo.zoomRenderScale.toFixed(2) + '×' : '—'}</div>
              <div><strong>Clamped:</strong> {rttRuntimeInfo?.wasClamped ? 'Yes' : 'No'}</div>
              <div><strong>Generation:</strong> {rttRuntimeInfo?.resourceGeneration ?? '—'}</div>
            </div>
          </details>

          {refDiagnostics ? (
            <details className="optical-debug__group">
              <summary>Reference object diagnostics</summary>
              <div className="optical-debug__group-content optical-debug-reference-list">
                {refDiagnostics.map((d: { id: string; role?: string; probe: { x: number; y: number; z: number }; sample: GroundGlassWorldBlurSample; logicalBlurRadiusPx: number }) => {
                  const fmt = (n: number | null | undefined, digits = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toFixed(digits));
                  const fmtNormalized = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toFixed(3));
                  const insideDofText = d.sample.region === 'unresolved' ? 'Unresolved' : (d.sample.insideDepthOfField ? 'Yes' : 'No');
                  return (
                    <details key={d.id}>
                      <summary>
                        {d.id}
                        <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 12 }}> {d.sample.region} · {d.logicalBlurRadiusPx ? d.logicalBlurRadiusPx.toFixed(2) : '—'} px blur</span>
                      </summary>
                      <div style={{ fontSize: 12, marginTop: 6 }}>
                        <div><strong>{d.id}</strong> ({d.role ?? 'unknown'})</div>
                        <div>Probe: {d.probe.x.toFixed(1)}, {d.probe.y.toFixed(1)}, {d.probe.z.toFixed(1)} mm</div>
                        <div>Region: {d.sample.region}</div>
                        <div>Target ray: {fmt(d.sample.targetRayDistanceMm, 1)} mm</div>
                        <div>Near ray: {d.sample.nearRayDistanceMm !== null ? fmt(d.sample.nearRayDistanceMm, 1) + ' mm' : '—'}</div>
                        <div>Focus ray: {d.sample.focusRayDistanceMm !== null ? fmt(d.sample.focusRayDistanceMm, 1) + ' mm' : '—'}</div>
                        <div>Far ray: {d.sample.farRayDistanceMm !== null ? fmt(d.sample.farRayDistanceMm, 1) + ' mm' : (d.sample.depthOfFieldModel === 'parallel' ? '—' : '∞')}</div>
                        <div>Inside DOF: {insideDofText}</div>
                        <div>Normalized defocus: {fmtNormalized(d.sample.normalizedDefocus)}</div>
                        <div>CoC: {d.sample.circleOfConfusionDiameterMm ? d.sample.circleOfConfusionDiameterMm.toFixed(4) : '—'} mm ({d.sample.circleOfConfusionDiameterPx ? d.sample.circleOfConfusionDiameterPx.toFixed(3) : '—'} px)</div>
                        <div>Blur radius: {d.sample.blurRadiusPx ? d.sample.blurRadiusPx.toFixed(3) : '—'} internal px, {d.logicalBlurRadiusPx ? d.logicalBlurRadiusPx.toFixed(3) : '—'} display px</div>
                        {d.sample.diagnosticReason ? <div style={{ color: '#b91c1c' }}>Reason: {d.sample.diagnosticReason}</div> : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>
          ) : null}
        </div>
      </details>
    </div>
  );
};

export default OpticalDebugPanel;
