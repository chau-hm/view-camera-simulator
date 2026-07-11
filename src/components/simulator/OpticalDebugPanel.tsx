import React from "react";
import type { DerivedOpticsState } from "../../types/optics";

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
      </div>
    </div>
  );
};

export default OpticalDebugPanel;
