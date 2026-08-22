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

struct GroundGlassPhysicalBlurFootprint {
  float valid;
  float signedCocMm;
  float majorRadiusMm;
  float minorRadiusMm;
  float orientationRad;
};

GroundGlassPhysicalBlurFootprint neutralPhysicalBlurFootprint(){
  GroundGlassPhysicalBlurFootprint result;
  result.valid = 0.0;
  result.signedCocMm = 0.0;
  result.majorRadiusMm = 0.0;
  result.minorRadiusMm = 0.0;
  result.orientationRad = 0.0;
  return result;
}

float wrapFootprintOrientationRad(float angle){
  const float footprintPi = 3.14159265359;
  float wrapped = mod(angle, footprintPi);
  return wrapped < 0.0 ? wrapped + footprintPi : wrapped;
}

GroundGlassPhysicalBlurFootprint calculatePhysicalBlurFootprintFromWorldPosition(vec3 worldPos){
  GroundGlassPhysicalBlurFootprint result = neutralPhysicalBlurFootprint();
  if(!isFiniteVec3(worldPos) ||
     !isFiniteVec3(lensCenterWorld) ||
     !isFiniteVec3(lensPlaneNormal) ||
     !isFiniteVec3(lensPlaneBasisX) ||
     !isFiniteVec3(lensPlaneBasisY) ||
     !isFiniteVec3(filmPlanePoint) ||
     !isFiniteVec3(filmPlaneNormal) ||
     !isFiniteVec3(filmPlaneBasisX) ||
     !isFiniteVec3(filmPlaneBasisY) ||
     !isFiniteFloat(focalLengthMm) || focalLengthMm <= 0.0 ||
     !isFiniteFloat(fNumber) || fNumber <= 0.0) return result;

  vec3 toObject = worldPos - lensCenterWorld;
  float objectDistanceMm = dot(toObject, lensPlaneNormal) * 1000.0;
  if(!isFiniteFloat(objectDistanceMm) || objectDistanceMm <= 1e-4) return result;

  float focalLengthWorld = focalLengthMm * 0.001;
  float objectDistanceWorld = objectDistanceMm * 0.001;
  float apertureRadiusWorld = focalLengthWorld / (2.0 * fNumber);
  if(!isFiniteFloat(apertureRadiusWorld) || apertureRadiusWorld <= 0.0) return result;

  vec3 lateralObjectOffset = toObject - lensPlaneNormal * objectDistanceWorld;
  bool imagePointIsFinite = abs(objectDistanceMm - focalLengthMm) > 0.0001;
  float idealImageDistanceMm = 0.0;
  vec3 imagePoint = vec3(0.0);
  vec3 imageDirection = vec3(0.0);
  float signedSide = -1.0;

  if(imagePointIsFinite){
    float denominator = objectDistanceMm - focalLengthMm;
    if(!isFiniteFloat(denominator) || abs(denominator) <= 1e-4) return result;
    idealImageDistanceMm = (focalLengthMm * objectDistanceMm) / denominator;
    if(!isFiniteFloat(idealImageDistanceMm) || abs(idealImageDistanceMm) <= 1e-6) return result;
    float idealImageDistanceWorld = idealImageDistanceMm * 0.001;
    imagePoint = lensCenterWorld -
      lensPlaneNormal * idealImageDistanceWorld -
      lateralObjectOffset * (idealImageDistanceWorld / objectDistanceWorld);
    imageDirection = idealImageDistanceMm < 0.0
      ? lensCenterWorld - imagePoint
      : imagePoint - lensCenterWorld;
    float imagePlaneDeltaMm = dot(imagePoint - filmPlanePoint, filmPlaneNormal) * 1000.0;
    if(!isFiniteFloat(imagePlaneDeltaMm)) return result;
    if(abs(imagePlaneDeltaMm) > 0.0001) signedSide = imagePlaneDeltaMm < 0.0 ? -1.0 : 1.0;
    else signedSide = 0.0;
  } else {
    // At U = f the ideal image is at infinity and the post-lens rays are
    // parallel. The finite film projection still has a deterministic limit.
    imageDirection = normalize(
      -lensPlaneNormal - lateralObjectOffset / objectDistanceWorld
    );
    if(!isFiniteVec3(imageDirection) || length(imageDirection) <= 1e-6) return result;
    signedSide = -1.0;
  }
  if(!isFiniteVec3(imageDirection) || length(imageDirection) <= 1e-6) return result;

  float centerDistance = intersectRayPlaneDist(
    lensCenterWorld,
    imageDirection,
    filmPlanePoint,
    filmPlaneNormal
  );
  if(centerDistance <= 0.0) return result;
  // This is the closed-form first derivative of the symmetric +/- aperture
  // edge construction at the aperture centre. It is the same local affine
  // map, but avoids four redundant ray/plane intersections per full-res
  // fragment while preserving the CPU reference contract.
  vec3 filmDelta = filmPlanePoint - lensCenterWorld;
  vec3 apertureX = lensPlaneBasisX * apertureRadiusWorld;
  vec3 apertureY = lensPlaneBasisY * apertureRadiusWorld;
  vec3 mappedX = vec3(0.0);
  vec3 mappedY = vec3(0.0);
  if(imagePointIsFinite){
    vec3 imageVector = imagePoint - lensCenterWorld;
    float denominator = dot(imageVector, filmPlaneNormal);
    if(!isFiniteFloat(denominator) || abs(denominator) <= 1e-6) return result;
    float rayParameter = dot(filmDelta, filmPlaneNormal) / denominator;
    if(!isFiniteFloat(rayParameter)) return result;
    mappedX = (
      apertureX - imageVector * dot(apertureX, filmPlaneNormal) / denominator
    ) * (1.0 - rayParameter);
    mappedY = (
      apertureY - imageVector * dot(apertureY, filmPlaneNormal) / denominator
    ) * (1.0 - rayParameter);
  } else {
    float denominator = dot(imageDirection, filmPlaneNormal);
    if(!isFiniteFloat(denominator) || abs(denominator) <= 1e-6) return result;
    mappedX = apertureX - imageDirection * dot(apertureX, filmPlaneNormal) / denominator;
    mappedY = apertureY - imageDirection * dot(apertureY, filmPlaneNormal) / denominator;
  }
  if(!isFiniteVec3(mappedX) || !isFiniteVec3(mappedY)) return result;

  float matrix00 = dot(mappedX, filmPlaneBasisX) * 1000.0;
  float matrix10 = dot(mappedX, filmPlaneBasisY) * 1000.0;
  float matrix01 = dot(mappedY, filmPlaneBasisX) * 1000.0;
  float matrix11 = dot(mappedY, filmPlaneBasisY) * 1000.0;
  float covariance00 = matrix00 * matrix00 + matrix01 * matrix01;
  float covariance01 = matrix00 * matrix10 + matrix01 * matrix11;
  float covariance11 = matrix10 * matrix10 + matrix11 * matrix11;
  float traceHalf = (covariance00 + covariance11) * 0.5;
  float discriminant = length(vec2((covariance00 - covariance11) * 0.5, covariance01));
  float majorRadiusMm = sqrt(max(0.0, traceHalf + discriminant));
  float minorRadiusMm = sqrt(max(0.0, traceHalf - discriminant));
  if(!isFiniteFloat(majorRadiusMm) || !isFiniteFloat(minorRadiusMm)) return result;

  float orientationRad = 0.0;
  if(majorRadiusMm - minorRadiusMm > 1e-6){
    orientationRad = wrapFootprintOrientationRad(
      0.5 * atan(2.0 * covariance01, covariance00 - covariance11)
    );
  }
  float signedCocMm = signedSide * 2.0 * sqrt(max(0.0, majorRadiusMm * minorRadiusMm));
  if(!isFiniteFloat(signedCocMm)) return result;

  result.valid = 1.0;
  result.signedCocMm = signedCocMm;
  result.majorRadiusMm = majorRadiusMm;
  result.minorRadiusMm = minorRadiusMm;
  result.orientationRad = orientationRad;
  return result;
}

// Legacy wedge scalar helpers remain available for diagnostics and teaching
// geometry. The rendered CoC/footprint field below is sourced from the
// canonical lens/film aperture projection instead.
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

// Signed physical neutral thin-lens CoC diameter from a depth-buffer sample.
// Distances are converted from the renderer's metres to millimetres here.
// Negative means the ideal image plane is behind the film (near/foreground);
// positive means it is in front of the film (far/background).
float calculateSignedPhysicalCoCDiameterMmFromDepth(float depth){
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
  if(abs(objectDistanceMm - focalLengthMm) <= 0.0001) return -apertureDiameterMm;

  float idealImageDistanceMm = (focalLengthMm * objectDistanceMm) /
    (objectDistanceMm - focalLengthMm);
  if(!isFiniteFloat(idealImageDistanceMm) || abs(idealImageDistanceMm) < 1e-8) return 0.0;

  // imageDistanceMm is the actual film distance F in the existing renderer
  // uniform contract; idealImageDistanceMm is the object's ideal V.
  float cocDiameterMm = apertureDiameterMm *
    abs(1.0 - imageDistanceMm / idealImageDistanceMm);
  if(!isFiniteFloat(cocDiameterMm) || cocDiameterMm < 0.0) return 0.0;
  if(cocDiameterMm <= 0.0) return 0.0;
  return idealImageDistanceMm > imageDistanceMm ? -cocDiameterMm : cocDiameterMm;
}

float calculatePhysicalCoCDiameterMmFromDepth(float depth){
  return abs(calculateSignedPhysicalCoCDiameterMmFromDepth(depth));
}

// A malformed or unreachable wedge has no trustworthy near/far side. Return
// neutral rather than fabricating a positive far-side classification.
float safeUnresolvedWedgeCoCDiameterMm(){
  return 0.0;
}

float calculateSignedWedgeCoCDiameterMmFromWorldPosition(vec3 worldPos){
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
  if(cocDiameterMm <= 0.0) return 0.0;
  return targetDist < tFocus ? -cocDiameterMm : cocDiameterMm;
}

float calculateWedgeCoCDiameterMmFromWorldPosition(vec3 worldPos){
  return abs(calculateSignedWedgeCoCDiameterMmFromWorldPosition(worldPos));
}

float calculateSignedCoCDiameterMmAtFragment(vec2 uv, float depth){
  vec3 worldPos = reconstructWorldPosition(uv, depth, inverseProjectionMatrix, cameraMatrixWorld);
  GroundGlassPhysicalBlurFootprint footprint =
    calculatePhysicalBlurFootprintFromWorldPosition(worldPos);
  if(footprint.valid > 0.5) return footprint.signedCocMm;
  // Geometry is canonical input to this path. If it is unresolved, remain
  // neutral rather than fabricating a side from a scalar wedge fallback.
  return 0.0;
}

float calculateCoCDiameterMmAtFragment(vec2 uv, float depth){
  return abs(calculateSignedCoCDiameterMmAtFragment(uv, depth));
}

// The physical CoC is normally stored directly as signed millimetres in the
// half-float target. The byte fallback uses an explicit RGBA8 code contract:
// code 128 is neutral, codes 0..127 are negative, and codes 129..255 are
// positive. Encoding is deliberately after the optical calculation so storage
// capability cannot change the CoC semantics.
float encodeSignedPhysicalCoCDiameterMm(float signedCocMm){
  if(!isFiniteFloat(signedCocMm)) return cocStorageEncoded < 0.5 ? 0.0 : 128.0 / 255.0;
  if(cocStorageEncoded < 0.5) return signedCocMm;
  if(!isFiniteFloat(cocStorageMaxMm) || cocStorageMaxMm <= 0.0) return 128.0 / 255.0;
  float normalized = clamp(signedCocMm / cocStorageMaxMm, -1.0, 1.0);
  float byteCode = normalized < 0.0
    ? floor(128.0 + normalized * 128.0 + 0.5)
    : floor(128.0 + normalized * 127.0 + 0.5);
  return clamp(byteCode, 0.0, 255.0) / 255.0;
}

float decodeStoredSignedCoCDiameterMm(float storedCoc){
  if(!isFiniteFloat(storedCoc)) return 0.0;
  if(cocStorageEncoded < 0.5) return storedCoc;
  if(!isFiniteFloat(cocStorageMaxMm) || cocStorageMaxMm <= 0.0) return 0.0;
  float byteCode = floor(clamp(storedCoc, 0.0, 1.0) * 255.0 + 0.5);
  if(byteCode < 128.0) return ((byteCode - 128.0) / 128.0) * cocStorageMaxMm;
  if(byteCode > 128.0) return ((byteCode - 128.0) / 127.0) * cocStorageMaxMm;
  return 0.0;
}

float encodeGroundGlassFootprintRadiusMm(float radiusMm){
  if(!isFiniteFloat(radiusMm) || radiusMm <= 0.0) return 0.0;
  if(cocStorageEncoded < 0.5) return radiusMm;
  if(!isFiniteFloat(footprintStorageMaxMm) || footprintStorageMaxMm <= 0.0) return 0.0;
  return clamp(radiusMm / footprintStorageMaxMm, 0.0, 1.0);
}

float decodeStoredGroundGlassFootprintRadiusMm(float storedRadius){
  if(!isFiniteFloat(storedRadius)) return 0.0;
  if(cocStorageEncoded < 0.5) return max(0.0, storedRadius);
  if(!isFiniteFloat(footprintStorageMaxMm) || footprintStorageMaxMm <= 0.0) return 0.0;
  return clamp(storedRadius, 0.0, 1.0) * footprintStorageMaxMm;
}

float encodeGroundGlassFootprintOrientation(float orientationRad){
  if(!isFiniteFloat(orientationRad)) return 0.0;
  return wrapFootprintOrientationRad(orientationRad) / 3.14159265359;
}

float decodeStoredGroundGlassFootprintOrientation(float storedOrientation){
  if(!isFiniteFloat(storedOrientation)) return 0.0;
  return clamp(storedOrientation, 0.0, 1.0) * 3.14159265359;
}

vec2 footprintMajorAxisPx(float majorRadiusMm, float orientationRad){
  if(!isFiniteFloat(majorRadiusMm) || majorRadiusMm <= 0.0 ||
     !isFiniteFloat(renderWidth) || renderWidth <= 0.0 ||
     !isFiniteFloat(renderHeight) || renderHeight <= 0.0 ||
     !isFiniteFloat(filmWidthMm) || filmWidthMm <= 0.0 ||
     !isFiniteFloat(filmHeightMm) || filmHeightMm <= 0.0 ||
     !isFiniteFloat(displayBlurScale) || displayBlurScale <= 0.0) return vec2(0.0);
  float angle = decodeStoredGroundGlassFootprintOrientation(orientationRad);
  return vec2(
    cos(angle) * majorRadiusMm * renderWidth / filmWidthMm,
    sin(angle) * majorRadiusMm * renderHeight / filmHeightMm
  ) * displayBlurScale;
}

vec2 footprintMinorAxisPx(float minorRadiusMm, float orientationRad){
  if(!isFiniteFloat(minorRadiusMm) || minorRadiusMm <= 0.0 ||
     !isFiniteFloat(renderWidth) || renderWidth <= 0.0 ||
     !isFiniteFloat(renderHeight) || renderHeight <= 0.0 ||
     !isFiniteFloat(filmWidthMm) || filmWidthMm <= 0.0 ||
     !isFiniteFloat(filmHeightMm) || filmHeightMm <= 0.0 ||
     !isFiniteFloat(displayBlurScale) || displayBlurScale <= 0.0) return vec2(0.0);
  float angle = decodeStoredGroundGlassFootprintOrientation(orientationRad);
  return vec2(
    -sin(angle) * minorRadiusMm * renderWidth / filmWidthMm,
    cos(angle) * minorRadiusMm * renderHeight / filmHeightMm
  ) * displayBlurScale;
}

float footprintClampScale(vec2 majorAxisPx, vec2 minorAxisPx){
  float extentPx = max(length(majorAxisPx), length(minorAxisPx));
  if(!isFiniteFloat(extentPx) || extentPx <= 0.0 ||
     !isFiniteFloat(maximumCoCRadiusPx) || maximumCoCRadiusPx < 0.0) return 0.0;
  return min(1.0, maximumCoCRadiusPx / extentPx);
}

vec2 orientedFootprintOffsetPx(
  vec2 diskOffset,
  vec2 majorAxisPx,
  vec2 minorAxisPx,
  float clampScale
){
  return (majorAxisPx * diskOffset.x + minorAxisPx * diskOffset.y) * clampScale;
}

float ellipseFootprintWeight(
  vec2 offsetPx,
  vec2 majorAxisPx,
  vec2 minorAxisPx,
  float clampScale
){
  vec2 major = majorAxisPx * clampScale;
  vec2 minor = minorAxisPx * clampScale;
  float determinant = major.x * minor.y - major.y * minor.x;
  if(!isFiniteFloat(determinant) || abs(determinant) <= 1e-6) return 0.0;
  vec2 local = vec2(
    (offsetPx.x * minor.y - offsetPx.y * minor.x) / determinant,
    (-offsetPx.x * major.y + offsetPx.y * major.x) / determinant
  );
  float distanceInEllipse = length(local);
  float edgeWidth = 1.0 / max(1.0, max(length(major), length(minor)));
  return 1.0 - smoothstep(1.0, 1.0 + edgeWidth, distanceInEllipse);
}

// Convert physical CoC diameter to a gather radius in source-texture pixels.
// The cap is a quality/display bound, applied only after the physical result
// has been computed; it is not part of the optical kernel.
float cocDiameterMmToGatherRadiusPx(float cocDiameterMm){
  cocDiameterMm = abs(cocDiameterMm);
  if(!isFiniteFloat(cocDiameterMm) ||
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

float depthDistanceMm(float depth){
  if(!isFiniteFloat(depth) || depth < 0.0 || depth > 1.0 ||
     !isFiniteFloat(near) || !isFiniteFloat(far) || far <= near) return -1.0;
  float distanceMm = abs(viewZFromDepth(depth, near, far)) * 1000.0;
  return isFiniteFloat(distanceMm) && distanceMm > 0.0 ? distanceMm : -1.0;
}

float depthToleranceMm(float centerDistanceMm){
  if(!isFiniteFloat(centerDistanceMm) || centerDistanceMm <= 0.0) return 0.0;
  return max(20.0, centerDistanceMm * 0.015);
}

// Far/background gather is asymmetric: samples that are geometrically in
// front of the center surface are occluders and cannot freely mix into it.
float calculateFarSampleWeight(
  float centerDepth,
  float sampleDepth,
  float sampleSignedCocMm
){
  if(!isFiniteFloat(centerDepth) || !isFiniteFloat(sampleDepth)) return 0.0;
  float centerUmm = depthDistanceMm(centerDepth);
  float sampleUmm = depthDistanceMm(sampleDepth);
  if(centerUmm <= 0.0 || sampleUmm <= 0.0 || !isFiniteFloat(sampleSignedCocMm)) return 0.0;
  float toleranceMm = depthToleranceMm(centerUmm);
  if(sampleSignedCocMm < -0.00001 || sampleUmm < centerUmm - toleranceMm) return 0.0;
  return 1.0;
}

// Near/foreground gather is allowed to scatter outside the center silhouette,
// but a nearer center surface still occludes a farther near-side sample.
float calculateNearSampleWeight(
  float centerDepth,
  float sampleDepth,
  float centerSignedCocMm,
  float sampleSignedCocMm
){
  if(!isFiniteFloat(centerDepth) || !isFiniteFloat(sampleDepth) ||
     !isFiniteFloat(centerSignedCocMm) || !isFiniteFloat(sampleSignedCocMm) ||
     sampleSignedCocMm >= -0.00001) return 0.0;
  float centerUmm = depthDistanceMm(centerDepth);
  float sampleUmm = depthDistanceMm(sampleDepth);
  if(centerUmm <= 0.0 || sampleUmm <= 0.0) return 0.0;
  float toleranceMm = depthToleranceMm(centerUmm);
  if(centerSignedCocMm < -0.00001 && sampleUmm > centerUmm + toleranceMm) return 0.0;
  return 1.0;
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
uniform vec3 lensPlaneNormal;
uniform vec3 lensPlaneBasisX;
uniform vec3 lensPlaneBasisY;
uniform vec3 filmPlanePoint;
uniform vec3 filmPlaneNormal;
uniform vec3 filmPlaneBasisX;
uniform vec3 filmPlaneBasisY;
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
uniform float filmHeightMm;
uniform float sampleCount;
uniform float cocStorageEncoded;
uniform float cocStorageMaxMm;
uniform float footprintStorageMaxMm;
uniform float gatherLayer;
`;
