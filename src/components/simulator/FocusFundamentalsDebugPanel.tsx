import { verticalFovDegreesFromImageDistance, focusPlaneWidthMm, focusPlaneHeightMm, cocDiameterMm } from "../../core/optics/thinLensModel";
import { getSceneById } from "../../scenes/definitions";
import { dot, subtract } from "../../core/math/vec";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { formatMillimeter } from "../../utils/formatters";

import type { DerivedOpticsState } from "../../types/optics";

type FocusFundamentalsDebugPanelProps = {
  sceneId: string;
  opticsState: DerivedOpticsState;
  focusDistanceMm: number;
  aperture: number | string;
};

export const FocusFundamentalsDebugPanel = ({ sceneId, opticsState, focusDistanceMm, aperture }: FocusFundamentalsDebugPanelProps) => {
  const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
  const vFov = verticalFovDegreesFromImageDistance(101.6, imgDist);
  const hFov = (2 * Math.atan(127 / (2 * imgDist))) * (180 / Math.PI);
  const focusW = focusPlaneWidthMm(127, focusDistanceMm, imgDist);
  const focusH = focusPlaneHeightMm(101.6, focusDistanceMm, imgDist);

  const sceneDef = sceneId ? getSceneById(sceneId) : undefined;

  const nearZ = opticsState.depthOfFieldNearPlane ? opticsState.depthOfFieldNearPlane.point.z : NaN;
  const farZ = opticsState.depthOfFieldFarPlane ? opticsState.depthOfFieldFarPlane.point.z : Number.POSITIVE_INFINITY;

  return (
    <div aria-label="FocusFundamentalsDebugPanel" style={{ display: "grid", gap: "0.125rem", fontSize: 12, borderTop: "1px dashed #e5e7eb", paddingTop: "0.5rem" }}>
      <strong>Focus Fundamentals Debug</strong>
      <span>Focal length: {CAMERA_CONSTANTS.focalLengthMm} mm</span>
      <span>Aperture: f/{aperture}</span>
      {opticsState.diagnostics?.isInfinityFocus ? (
        <div style={{ color: '#e5e7eb', fontSize: 13 }}>
          <div>Focus: ∞</div>
          <div>Last finite focus: {formatMillimeter(focusDistanceMm)}</div>
          <div>Lens extension: {formatMillimeter(Math.abs(opticsState.lensCenterWorld.z))}</div>
          <div>Extension beyond infinity: 0.00 mm</div>
          <div>Focus plane: ∞</div>
          <div>
            Near DOF: {opticsState.depthOfFieldNearPlane ? `${(opticsState.depthOfFieldNearPlane.point.z / 1000).toFixed(2)} m` : '—'}
            {opticsState.depthOfFieldNearPlane ? (
              (() => {
                const nearDist = dot(subtract(opticsState.depthOfFieldNearPlane!.point, opticsState.lensCenterWorld), opticsState.opticalAxis.direction);
                const cap = opticsState.sceneVisualCapDepthMm ?? 12000;
                const visible = Number.isFinite(nearDist) && nearDist <= cap;
                return <span> — {visible ? 'visible in current visual cap' : 'outside current visual cap'}</span>;
              })()
            ) : null}
          </div>
          <div>Far DOF: ∞</div>
          <div>Visual cap: {(opticsState.sceneVisualCapDepthMm ? (opticsState.sceneVisualCapDepthMm / 1000).toFixed(2) : '12.00')} m</div>
        </div>
      ) : (
        <span>Focus distance: {formatMillimeter(focusDistanceMm)}</span>
      )}
      <span>Image distance: {imgDist.toFixed(2)} mm</span>
      <span>Sensor: {CAMERA_CONSTANTS.filmWidthMm} × {CAMERA_CONSTANTS.filmHeightMm} mm</span>
      <span>Vertical FOV: {vFov.toFixed(3)}° | Horizontal FOV: {hFov.toFixed(3)}°</span>
      {!opticsState.diagnostics?.isInfinityFocus && (
        <span>Focus plane dims: {focusW.toFixed(2)} × {focusH.toFixed(2)} mm</span>
      )}
      <span>
        DOF near Z: {Number.isFinite(nearZ) ? `${nearZ.toFixed(2)} mm` : '—'} | DOF far Z: {Number.isFinite(farZ) ? `${farZ.toFixed(2)} mm` : '∞'}
      </span>
      {sceneDef?.focusTargets.map((t) => {
        // compute axial distance U from lens center along optical axis — do NOT use world Z directly
        const U = Math.max(1e-6, dot(subtract(t.worldPosition, opticsState.lensCenterWorld), opticsState.opticalAxis.direction));
        const coc = cocDiameterMm(CAMERA_CONSTANTS.focalLengthMm, aperture as number, imgDist, U);
        return (
          <span key={t.id}>{t.id}: axial depth {U.toFixed(2)} mm | CoC {coc.toFixed(3)} mm</span>
        );
      })}
    </div>
  );
};
