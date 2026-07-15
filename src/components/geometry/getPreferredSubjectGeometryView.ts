export const MOVEMENT_VIEW_EPSILON_DEG = 1e-4;

export type SubjectGeometryView = "side" | "top";

const SCENE_DEFAULT_SUBJECT_VIEW: Readonly<Record<string, SubjectGeometryView>> = {
  "table-tilt": "side",
  "shelf-swing": "top",
  "architecture-rise": "side",
  "focus-fundamentals-two-targets": "side",
};

export function getPreferredSubjectGeometryView({
  sceneId,
  tiltDeg,
  swingDeg,
}: {
  sceneId: string;
  tiltDeg: number;
  swingDeg: number;
}): SubjectGeometryView {
  const tiltMagnitude = Math.abs(tiltDeg);
  const swingMagnitude = Math.abs(swingDeg);
  const magnitudeDifference = tiltMagnitude - swingMagnitude;

  // Treat effectively equal movements as a tie so floating-point noise cannot
  // repeatedly flip the instructional view around the crossover point.
  if (Math.abs(magnitudeDifference) <= MOVEMENT_VIEW_EPSILON_DEG) {
    return SCENE_DEFAULT_SUBJECT_VIEW[sceneId] ?? "side";
  }

  return magnitudeDifference > 0 ? "side" : "top";
}
