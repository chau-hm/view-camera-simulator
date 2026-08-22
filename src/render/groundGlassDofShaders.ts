// Shared GLSL helpers for GroundGlass DOF (testable without WebGL)
export const groundGlassSharedGlsl = `
bool isFiniteFloat(float value){
  return value == value && abs(value) < 1e20;
}

bool isFiniteVec3(vec3 value){
  return isFiniteFloat(value.x) && isFiniteFloat(value.y) && isFiniteFloat(value.z);
}

// world reconstruction
float viewZFromDepth(float depth, float near, float far){
  float z_n = depth * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z_n * (far - near));
}

vec3 reconstructWorldPosition(vec2 uv, float depth, mat4 inverseProjectionMatrix, mat4 cameraMatrixWorld){
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 viewPos = inverseProjectionMatrix * clip;
  viewPos /= viewPos.w;
  vec4 worldPos = cameraMatrixWorld * viewPos;
  return worldPos.xyz;
}

float intersectRayPlaneDist(vec3 ro, vec3 rd, vec3 planePoint, vec3 planeNormal){
  if(!isFiniteVec3(ro) || !isFiniteVec3(rd) || !isFiniteVec3(planePoint) || !isFiniteVec3(planeNormal)) return -1.0;
  float denom = dot(rd, planeNormal);
  if (!isFiniteFloat(denom) || abs(denom) < 1e-6) return -1.0;
  float distance = dot(planePoint - ro, planeNormal) / denom;
  if (!isFiniteFloat(distance) || distance <= 0.0) return -1.0;
  return distance;
}

// normalized defocus using wedge interval ordering
float calculateNormalizedWedgeDefocus(float targetDist, float nearDist, float focusDist, float farDist, float hasFiniteFar){
  if(!isFiniteFloat(targetDist) || targetDist <= 0.0 ||
     !isFiniteFloat(nearDist) || nearDist <= 0.0 ||
     !isFiniteFloat(focusDist) || focusDist <= 0.0 ||
     focusDist - nearDist <= 1e-6) return 1.0;
  if(hasFiniteFar >= 0.5 &&
     (!isFiniteFloat(farDist) || farDist <= 0.0 || farDist - focusDist <= 1e-6)) return 1.0;

  float normalizedDefocus = 0.0;
  if (targetDist < nearDist){
    normalizedDefocus = 1.0 + (nearDist - targetDist) / (focusDist - nearDist);
  } else if (targetDist <= focusDist){
    normalizedDefocus = (focusDist - targetDist) / (focusDist - nearDist);
  } else if (hasFiniteFar < 0.5){
    // open-ended far
    normalizedDefocus = (targetDist - focusDist) / (focusDist - nearDist);
  } else if (targetDist <= farDist){
    normalizedDefocus = (targetDist - focusDist) / (farDist - focusDist);
  } else {
    normalizedDefocus = 1.0 + (targetDist - farDist) / (farDist - focusDist);
  }

  // One is the finite CoC boundary used for unresolved wedge samples.
  if(!isFiniteFloat(normalizedDefocus) || normalizedDefocus < 0.0) return 1.0;
  return normalizedDefocus;
}

// Convert a physical CoC diameter in mm to a kernel blur radius in internal pixels
float cocDiameterMmToBlurRadiusPx(float cocDiameterMm){
  if(!isFiniteFloat(cocDiameterMm) || cocDiameterMm < 0.0 ||
     !isFiniteFloat(renderWidth) || renderWidth <= 0.0 ||
     !isFiniteFloat(filmWidthMm) || filmWidthMm <= 0.0 ||
     !isFiniteFloat(displayBlurScale) || displayBlurScale <= 0.0 ||
     !isFiniteFloat(maximumBlurRadiusPx) || maximumBlurRadiusPx < 0.0) return 0.0;
  float diameterPx = cocDiameterMm * renderWidth / filmWidthMm;
  if(!isFiniteFloat(diameterPx)) return 0.0;
  float radiusPx = diameterPx * 0.5 * displayBlurScale;
  if(!isFiniteFloat(radiusPx)) return 0.0;
  return clamp(radiusPx, 0.0, maximumBlurRadiusPx);
}

float safeUnresolvedWedgeBlurRadiusPx(){
  return cocDiameterMmToBlurRadiusPx(circleOfConfusionMm);
}

// Shared depth sample weight helper
float calculateDepthSampleWeight(float centerDepth, float sampleDepth){
  if(!isFiniteFloat(centerDepth) || !isFiniteFloat(sampleDepth)) return 0.0;
  float centerUmm = abs(viewZFromDepth(centerDepth, near, far)) * 1000.0;
  float sampleUmm = abs(viewZFromDepth(sampleDepth, near, far)) * 1000.0;
  if(!isFiniteFloat(centerUmm) || !isFiniteFloat(sampleUmm)) return 0.0;
  float deltaMm = abs(sampleUmm - centerUmm);
  float rejectMm = max(20.0, centerUmm * 0.015);
  if(!isFiniteFloat(deltaMm) || !isFiniteFloat(rejectMm)) return 0.0;
  return 1.0 - smoothstep(rejectMm * 0.5, rejectMm, deltaMm);
}

// Parallel thin-lens path that takes a depth buffer value (non-linear) and returns blur radius in px
float calculateParallelBlurRadiusPxFromDepth(float depth){
  if(!isFiniteFloat(depth) || !isFiniteFloat(near) || !isFiniteFloat(far) || far <= near ||
     !isFiniteFloat(focalLengthMm) || focalLengthMm <= 0.0 ||
     !isFiniteFloat(fNumber) || fNumber <= 0.0 ||
     !isFiniteFloat(imageDistanceMm) || imageDistanceMm <= 0.0) return 0.0;
  float viewZ = viewZFromDepth(depth, near, far);
  if(!isFiniteFloat(viewZ)) return 0.0;
  float U = abs(viewZ) * 1000.0;
  float f = focalLengthMm;
  if(!isFiniteFloat(U) || U <= f + 0.0001) return 0.0;
  float vObject = (f * U) / (U - f);
  if(!isFiniteFloat(vObject) || vObject <= 0.0) return 0.0;
  float apertureDiameter = f / max(1.0, fNumber);
  float cocMm = apertureDiameter * abs(1.0 - (imageDistanceMm / vObject));
  if(!isFiniteFloat(cocMm) || cocMm < 0.0) return 0.0;
  return cocDiameterMmToBlurRadiusPx(cocMm);
}

// Wedge path that computes normalized defocus from a world position then converts to blur radius
float calculateWedgeBlurRadiusPxFromWorldPosition(vec3 worldPos){
  if(!isFiniteVec3(worldPos) || !isFiniteVec3(lensCenterWorld)) return 0.0;
  vec3 toWorld = worldPos - lensCenterWorld;
  float targetDist = length(toWorld);
  if(!isFiniteFloat(targetDist) || targetDist <= 0.0) return 0.0;
  vec3 rd = toWorld / targetDist;
  float tFocus = intersectRayPlaneDist(lensCenterWorld, rd, focusPlanePoint, focusPlaneNormal);
  float tNear = intersectRayPlaneDist(lensCenterWorld, rd, nearPlanePoint, nearPlaneNormal);
  float tFar = hasFiniteFar > 0.5 ? intersectRayPlaneDist(lensCenterWorld, rd, farPlanePoint, farPlaneNormal) : -1.0;
  // A plane supplied by the derived optics state must be reachable by the
  // forward ray. Substituting targetDist/focusDist-1 reverses the wedge for
  // non-forward intersections and creates an artificial maximum blur.
  if(tFocus <= 0.0 || tNear <= 0.0) return safeUnresolvedWedgeBlurRadiusPx();
  if(tNear >= tFocus) return safeUnresolvedWedgeBlurRadiusPx();
  if(hasFiniteFar > 0.5 && tFar > 0.0 && tFar <= tFocus) return safeUnresolvedWedgeBlurRadiusPx();

  float focusDist = tFocus;
  float nearDist = tNear;
  // A finite far plane can be unreachable by an individual forward ray. In
  // that case the ray has an open-ended far interval; only a reachable far
  // intersection participates in finite interval ordering.
  float usableFiniteFar = hasFiniteFar > 0.5 && tFar > 0.0 ? 1.0 : 0.0;
  float farDist = usableFiniteFar > 0.5 ? tFar : -1.0;
  float nd = calculateNormalizedWedgeDefocus(targetDist, nearDist, focusDist, farDist, usableFiniteFar);
  if(!isFiniteFloat(nd) || nd < 0.0) return safeUnresolvedWedgeBlurRadiusPx();
  float cocMm = nd * circleOfConfusionMm;
  if(!isFiniteFloat(cocMm) || cocMm < 0.0) return safeUnresolvedWedgeBlurRadiusPx();
  return cocDiameterMmToBlurRadiusPx(cocMm);
}
`;

// Shared declarations for uniforms used by both shaders
export const groundGlassUniformDecls = `
uniform float renderWidth;
uniform float renderHeight;
uniform float focalLengthMm;
uniform float fNumber;
uniform float imageDistanceMm;
uniform float near;
uniform float far;
uniform float useRaw;
uniform float dofMode;
uniform vec3 lensCenterWorld;
uniform vec3 focusPlanePoint;
uniform vec3 focusPlaneNormal;
uniform vec3 nearPlanePoint;
uniform vec3 nearPlaneNormal;
uniform vec3 farPlanePoint;
uniform vec3 farPlaneNormal;
uniform float hasFiniteFar;
uniform mat4 inverseProjectionMatrix;
uniform mat4 cameraMatrixWorld;
// physical blur calibration shared between passes
uniform float displayBlurScale;
uniform float maximumBlurRadiusPx;
uniform float circleOfConfusionMm;
uniform float filmWidthMm;
`;
