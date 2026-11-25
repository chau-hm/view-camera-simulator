import * as THREE from "three";

/**
 * A renderer-available Probe result. This intentionally carries no physical
 * hit point, expected object name, or placement-oracle score.
 */
export type RuntimeProbeCandidate = Readonly<{
  probeIndex: number;
  q: THREE.Vector3;
}>;

export type RuntimeProbeSelection = Readonly<{
  probeIndex: number;
  residualM: number;
}>;

/**
 * Winner-takes-one runtime rule: discard missing candidates, then choose the
 * candidate point nearest the pane's reflected ray, breaking exact ties by
 * lower Probe index.
 */
export const selectRuntimeProbeByPaneRay = (
  panePoint: THREE.Vector3,
  physicalReflectedDirection: THREE.Vector3,
  candidates: readonly (RuntimeProbeCandidate | null)[],
): RuntimeProbeSelection | null => {
  const direction = physicalReflectedDirection.clone().normalize();
  let selected: RuntimeProbeSelection | null = null;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const projectedDistance = candidate.q.clone().sub(panePoint).dot(direction);
    const pointOnRay = panePoint.clone().addScaledVector(direction, Math.max(projectedDistance, 1e-4));
    const residualM = candidate.q.distanceTo(pointOnRay);
    if (!Number.isFinite(residualM)) continue;
    if (
      selected === null ||
      residualM < selected.residualM ||
      (residualM === selected.residualM && candidate.probeIndex < selected.probeIndex)
    ) {
      selected = { probeIndex: candidate.probeIndex, residualM };
    }
  }

  return selected;
};
