import React from "react";
import type { DerivedOpticsState } from "../../types/optics";
import { useAppStore } from "../../state/appStore";
import { getArchitectureReferenceObjectProbePoint, referenceObjects, type ReferenceObjectDef } from "../../scenes/architectureRiseGeometry";
import { sampleGroundGlassBlurAtWorldPoint } from "../../render/groundGlassBlur";
import type { GroundGlassWorldBlurSample } from "../../render/groundGlassBlur";
import { CAMERA_CONSTANTS } from "../../utils/constants";

type OpticalDebugPanelProps = {
  sceneId: string;
  mode: string;
  taskId?: string | null;
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  focusDistanceMm: number;
  aperture: number;
};

export const OpticalDebugPanel: React.FC<OpticalDebugPanelProps> = ({ sceneId, mode, taskId, opticsState, focalLengthMm, focusDistanceMm, aperture }) => {
  const lens = opticsState.lensCenterWorld;
  const film = opticsState.filmPlane.point;
  const filmNormal = opticsState.filmPlane.normal;
  const axis = opticsState.opticalAxis.direction;

  const rttInfo = useAppStore((s) => s.groundGlassRttRuntimeInfo);
  const internalWidth = rttInfo?.internalWidthPx ?? 1024;
  const logicalWidth = rttInfo?.logicalWidthPx ?? 800;

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
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: 13 }}>
        <div><strong>Scene:</strong> {sceneId}</div>
        <div><strong>Mode:</strong> {mode} {taskId ? `(task: ${taskId})` : ''}</div>
        <div style={{ marginTop: 6 }}><strong>Optics</strong></div>
        <div>Focal length: {focalLengthMm} mm</div>
        <div>Aperture: f/{aperture}</div>
        <div>Focus distance: {focusDistanceMm.toFixed(1)} mm</div>
        <div style={{ marginTop: 6 }}><strong>Lens center</strong></div>
        <div>{lens.x.toFixed(1)}, {lens.y.toFixed(1)}, {lens.z.toFixed(1)} mm</div>
        <div style={{ marginTop: 6 }}><strong>Film center</strong></div>
        <div>{film.x.toFixed(1)}, {film.y.toFixed(1)}, {film.z.toFixed(1)} mm</div>
        <div style={{ marginTop: 6 }}><strong>Normals</strong></div>
        <div>Film normal: {filmNormal.x.toFixed(3)}, {filmNormal.y.toFixed(3)}, {filmNormal.z.toFixed(3)}</div>
        <div>Optical axis: {axis.x.toFixed(3)}, {axis.y.toFixed(3)}, {axis.z.toFixed(3)}</div>

        {refDiagnostics ? (
          <div style={{ marginTop: 8 }}>
            <div><strong>Reference object DOF diagnostics</strong></div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {refDiagnostics.map((d: { id: string; role?: string; probe: { x: number; y: number; z: number }; sample: GroundGlassWorldBlurSample; logicalBlurRadiusPx: number }) => (
                <div key={d.id} style={{ marginBottom: 6 }}>
                  <div><strong>{d.id}</strong> ({d.role ?? 'unknown'})</div>
                  <div>Probe: {d.probe.x.toFixed(1)}, {d.probe.y.toFixed(1)}, {d.probe.z.toFixed(1)} mm</div>
                  <div>Region: {d.sample.region}</div>
                  <div>Target ray: {d.sample.targetRayDistanceMm.toFixed(1)} mm</div>
                  <div>Near ray: {d.sample.nearRayDistanceMm !== null ? d.sample.nearRayDistanceMm.toFixed(1) + ' mm' : '—'}</div>
                  <div>Focus ray: {d.sample.focusRayDistanceMm !== null ? d.sample.focusRayDistanceMm.toFixed(1) + ' mm' : '—'}</div>
                  <div>Far ray: {d.sample.farRayDistanceMm !== null ? d.sample.farRayDistanceMm.toFixed(1) + ' mm' : (d.sample.depthOfFieldModel === 'parallel' ? '—' : '∞')}</div>
                  <div>Inside DOF: {d.sample.insideDepthOfField ? 'yes' : 'no'}</div>
                  <div>Normalized defocus: {Number.isFinite(d.sample.normalizedDefocus) ? d.sample.normalizedDefocus.toFixed(3) : 'NaN'}</div>
                  <div>CoC: {d.sample.circleOfConfusionDiameterMm.toFixed(4)} mm ({d.sample.circleOfConfusionDiameterPx.toFixed(3)} px)</div>
                  <div>Blur radius: {d.sample.blurRadiusPx.toFixed(3)} internal px, {d.logicalBlurRadiusPx.toFixed(3)} display px</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OpticalDebugPanel;
