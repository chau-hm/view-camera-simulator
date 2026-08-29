export const MOVEMENT_VIEW_EPSILON_DEG = 1e-4;

export type SubjectGeometryView = "side" | "top";

export function getPreferredSubjectGeometryView({
  defaultView,
  tiltDeg,
  swingDeg,
}: {
  defaultView: SubjectGeometryView;
  tiltDeg: number;
  swingDeg: number;
}): SubjectGeometryView {
  const tiltMagnitude = Math.abs(tiltDeg);
  const swingMagnitude = Math.abs(swingDeg);
  const magnitudeDifference = tiltMagnitude - swingMagnitude;

  // Treat effectively equal movements as a tie so floating-point noise cannot
  // repeatedly flip the instructional view around the crossover point.
  if (Math.abs(magnitudeDifference) <= MOVEMENT_VIEW_EPSILON_DEG) {
    return defaultView;
  }

  return magnitudeDifference > 0 ? "side" : "top";
}
