import type * as THREE from "three";

/** Shared test-only GLSL for PR R and Observer appearance diagnostics. */
export const PROBE_DISTANCE_CUBE_CORRECTION_GLSL = `
  bool resolveProbePoint(
    samplerCube tProbeDistance,
    vec3 panePosition,
    vec3 paneNormal,
    vec3 physicalReflectedDirection,
    vec3 probeOrigin,
    int correctionIterations,
    out vec3 correctedDirection,
    out vec3 correctedPoint
  ){
    vec3 direction = normalize(physicalReflectedDirection);
    for(int iteration = 0; iteration < 8; iteration++){
      if(iteration >= correctionIterations) break;
      vec4 distanceSample = textureCube(tProbeDistance, direction);
      if(distanceSample.a < 0.5 || distanceSample.r <= 0.0) return false;
      vec3 sampledPoint = probeOrigin + direction * distanceSample.r;
      float rayDistance = dot(sampledPoint - panePosition, physicalReflectedDirection);
      vec3 pointOnPhysicalRay = panePosition + physicalReflectedDirection * max(rayDistance, 0.0001);
      vec3 originToProjectedPoint = pointOnPhysicalRay - probeOrigin;
      float directionLengthSquared = dot(originToProjectedPoint, originToProjectedPoint);
      if(directionLengthSquared <= 0.00000001) return false;
      direction = originToProjectedPoint * inversesqrt(directionLengthSquared);
    }
    vec4 finalDistanceSample = textureCube(tProbeDistance, direction);
    if(finalDistanceSample.a < 0.5 || finalDistanceSample.r <= 0.0) return false;
    correctedDirection = direction;
    correctedPoint = probeOrigin + direction * finalDistanceSample.r;
    return true;
  }
`;

/** One CPU ideal correction step, using the same projection and epsilon as PR R. */
export const correctProbeDirectionFromRadialHit = (
  probeOrigin: THREE.Vector3,
  panePoint: THREE.Vector3,
  physicalReflectedDirection: THREE.Vector3,
  sampledPoint: THREE.Vector3,
): THREE.Vector3 | null => {
  const projectedDistance = sampledPoint.clone()
    .sub(panePoint)
    .dot(physicalReflectedDirection);
  const nextDirection = panePoint.clone().addScaledVector(
    physicalReflectedDirection,
    Math.max(projectedDistance, 1e-4),
  ).sub(probeOrigin);
  if (!Number.isFinite(nextDirection.lengthSq()) || nextDirection.lengthSq() <= 1e-12) {
    return null;
  }
  return nextDirection.normalize();
};
