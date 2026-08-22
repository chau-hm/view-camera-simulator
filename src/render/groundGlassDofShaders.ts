// Shared GLSL helpers for the physical Ground Glass DOF pipeline.
// The neutral path keeps CoC in millimetres until the gather pass converts it
// to source-texture pixels. This leaves the optical calculation independent of
// the gather resolution and ready for later oriented-plane extensions.
export const groundGlassSharedGlsl = `
bool isFiniteFloat(float value){
  return value == value && abs(value) < 1e20;
}

bool isFiniteVec3(vec3 value){
  return isFiniteFloat(value.x) && isFiniteFloat(value.y) && isFiniteFloat(value.z);
}

float viewZFromDepth(float depth, float near, float far){
  float zNdc = depth * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - zNdc * (far - near));
}

vec3 reconstructWorldPosition(vec2 uv, float depth, mat4 inverseProjectionMatrix, mat4 cameraMatrixWorld){
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 viewPos = inverseProjectionMatrix * clip;
  if (!isFiniteFloat(viewPos.w) || abs(viewPos.w) < 1e-8) return vec3(0.0);
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

// Normalized defocus using the derived finite-depth wedge intervals. The
// scalar is converted to the calibrated physical CoC diameter below; later
// oriented-plane work can replace this helper without changing the gather.
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
    normalizedDefocus = (targetDist - focusDist) / (focusDist - nearDist);
  } else if (targetDist <= farDist){
    normalizedDefocus = (targetDist - focusDist) / (farDist - focusDist);
  } else {
    normalizedDefocus = 1.0 + (targetDist - farDist) / (farDist - focusDist);
  }

  if(!isFiniteFloat(normalizedDefocus) || normalizedDefocus < 0.0) return 1.0;
  return normalizedDefocus;
}

// Physical neutral thin-lens CoC diameter from a depth-buffer sample.
// Distances are converted from the renderer's metres to millimetres here.
// This is the GPU counterpart of computePhysicalCoCDiameterMm in thinLensModel.
float calculatePhysicalCoCDiameterMmFromDepth(float depth){
  if(!isFiniteFloat(depth) || depth < 0.0 || depth > 1.0 ||
     !isFiniteFloat(near) || !isFiniteFloat(far) || far <= near ||
     !isFiniteFloat(focalLengthMm) || focalLengthMm <= 0.0 ||
     !isFiniteFloat(fNumber) || fNumber <= 0.0 ||
     !isFiniteFloat(imageDistanceMm) || imageDistanceMm <= 0.0) return 0.0;

  float viewZ = viewZFromDepth(depth, near, far);
  if(!isFiniteFloat(viewZ)) return 0.0;

  float objectDistanceMm = abs(viewZ) * 1000.0;
  float apertureDiameterMm = focalLengthMm / fNumber;
  if(!isFiniteFloat(objectDistanceMm) || objectDistanceMm <= 0.0 ||
     !isFiniteFloat(apertureDiameterMm) || apertureDiameterMm <= 0.0) return 0.0;

  // U = f is the finite physical limiting case: V tends to infinity and
  // the cone on a finite film plane has the aperture diameter as its limit.
  if(abs(objectDistanceMm - focalLengthMm) <= 0.0001) return apertureDiameterMm;

  float idealImageDistanceMm = (focalLengthMm * objectDistanceMm) /
    (objectDistanceMm - focalLengthMm);
  if(!isFiniteFloat(idealImageDistanceMm) || abs(idealImageDistanceMm) < 1e-8) return 0.0;

  // imageDistanceMm is the actual film distance F in the existing renderer
  // uniform contract; idealImageDistanceMm is the object's ideal V.
  float cocDiameterMm = apertureDiameterMm *
    abs(1.0 - imageDistanceMm / idealImageDistanceMm);
  if(!isFiniteFloat(cocDiameterMm) || cocDiameterMm < 0.0) return 0.0;
  return cocDiameterMm;
}

float safeUnresolvedWedgeCoCDiameterMm(){
  if(!isFiniteFloat(circleOfConfusionMm) || circleOfConfusionMm < 0.0) return 0.0;
  return circleOfConfusionMm;
}

float calculateWedgeCoCDiameterMmFromWorldPosition(vec3 worldPos){
  if(!isFiniteVec3(worldPos) || !isFiniteVec3(lensCenterWorld)) return safeUnresolvedWedgeCoCDiameterMm();
  vec3 toWorld = worldPos - lensCenterWorld;
  float targetDist = length(toWorld);
  if(!isFiniteFloat(targetDist) || targetDist <= 0.0) return safeUnresolvedWedgeCoCDiameterMm();
  vec3 rd = toWorld / targetDist;
  float tFocus = intersectRayPlaneDist(lensCenterWorld, rd, focusPlanePoint, focusPlaneNormal);
  float tNear = intersectRayPlaneDist(lensCenterWorld, rd, nearPlanePoint, nearPlaneNormal);
  float tFar = hasFiniteFar > 0.5 ? intersectRayPlaneDist(lensCenterWorld, rd, farPlanePoint, farPlaneNormal) : -1.0;

  // A plane supplied by the derived optics state must be reachable by the
  // forward ray. Invalid ordering is unresolved rather than a fabricated
  // sharp value.
  if(tFocus <= 0.0 || tNear <= 0.0 || tNear >= tFocus ||
     (hasFiniteFar > 0.5 && tFar > 0.0 && tFar <= tFocus)) {
    return safeUnresolvedWedgeCoCDiameterMm();
  }

  float usableFiniteFar = hasFiniteFar > 0.5 && tFar > 0.0 ? 1.0 : 0.0;
  float farDist = usableFiniteFar > 0.5 ? tFar : -1.0;
  float normalizedDefocus = calculateNormalizedWedgeDefocus(
    targetDist,
    tNear,
    tFocus,
    farDist,
    usableFiniteFar
  );
  if(!isFiniteFloat(normalizedDefocus) || normalizedDefocus < 0.0) {
    return safeUnresolvedWedgeCoCDiameterMm();
  }

  float cocDiameterMm = normalizedDefocus * circleOfConfusionMm;
  if(!isFiniteFloat(cocDiameterMm) || cocDiameterMm < 0.0) {
    return safeUnresolvedWedgeCoCDiameterMm();
  }
  return cocDiameterMm;
}

float calculateCoCDiameterMmAtFragment(vec2 uv, float depth){
  if(dofMode < 0.5) return calculatePhysicalCoCDiameterMmFromDepth(depth);
  vec3 worldPos = reconstructWorldPosition(uv, depth, inverseProjectionMatrix, cameraMatrixWorld);
  return calculateWedgeCoCDiameterMmFromWorldPosition(worldPos);
}

// The physical CoC is normally stored directly as millimetres in the
// half-float target. The byte fallback stores a normalized value whose range
// is chosen by the CPU from the configured maximum gather radius. Encoding is
// deliberately after the optical calculation so storage capability cannot
// change the CoC semantics.
float encodePhysicalCoCDiameterMm(float cocMm){
  if(!isFiniteFloat(cocMm) || cocMm < 0.0) return 0.0;
  if(cocStorageEncoded < 0.5) return cocMm;
  if(!isFiniteFloat(cocStorageMaxMm) || cocStorageMaxMm <= 0.0) return 0.0;
  return clamp(cocMm / cocStorageMaxMm, 0.0, 1.0);
}

float decodeStoredCoCDiameterMm(float storedCoc){
  if(!isFiniteFloat(storedCoc) || storedCoc < 0.0) return 0.0;
  if(cocStorageEncoded < 0.5) return storedCoc;
  if(!isFiniteFloat(cocStorageMaxMm) || cocStorageMaxMm <= 0.0) return 0.0;
  return storedCoc * cocStorageMaxMm;
}

// Convert physical CoC diameter to a gather radius in source-texture pixels.
// The cap is a quality/display bound, applied only after the physical result
// has been computed; it is not part of the optical kernel.
float cocDiameterMmToGatherRadiusPx(float cocDiameterMm){
  if(!isFiniteFloat(cocDiameterMm) || cocDiameterMm < 0.0 ||
     !isFiniteFloat(renderWidth) || renderWidth <= 0.0 ||
     !isFiniteFloat(filmWidthMm) || filmWidthMm <= 0.0 ||
     !isFiniteFloat(displayBlurScale) || displayBlurScale <= 0.0 ||
     !isFiniteFloat(maximumCoCRadiusPx) || maximumCoCRadiusPx < 0.0) return 0.0;

  float diameterPx = cocDiameterMm * renderWidth / filmWidthMm * displayBlurScale;
  if(!isFiniteFloat(diameterPx)) return 0.0;
  float radiusPx = diameterPx * 0.5;
  if(!isFiniteFloat(radiusPx)) return 0.0;
  return clamp(radiusPx, 0.0, maximumCoCRadiusPx);
}

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
`;

// Shared declarations for uniforms used by the physical CoC, gather, and
// composite stages. The gather resolution is intentionally not represented by
// renderWidth/renderHeight: those values describe the full-resolution source
// used for physical CoC-to-pixel conversion.
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
uniform float displayBlurScale;
uniform float maximumCoCRadiusPx;
uniform float circleOfConfusionMm;
uniform float filmWidthMm;
uniform float sampleCount;
uniform float cocStorageEncoded;
uniform float cocStorageMaxMm;
`;
