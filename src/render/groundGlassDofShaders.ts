// Shared GLSL helpers for GroundGlass DOF (testable without WebGL)
export const groundGlassSharedGlsl = `
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
  float denom = dot(rd, planeNormal);
  if (abs(denom) < 1e-6) return -1.0;
  return dot(planePoint - ro, planeNormal) / denom;
}

// normalized defocus using wedge interval ordering
float calculateNormalizedWedgeDefocus(float targetDist, float nearDist, float focusDist, float farDist, float hasFiniteFar){
  if (targetDist < nearDist){
    float denom = max(1e-6, focusDist - nearDist);
    return 1.0 + (nearDist - targetDist) / denom;
  } else if (targetDist <= focusDist){
    float denom = max(1e-6, focusDist - nearDist);
    return (focusDist - targetDist) / denom;
  } else if (hasFiniteFar < 0.5){
    // open-ended far
    float denom = max(1e-6, focusDist - nearDist);
    return (targetDist - focusDist) / denom;
  } else if (targetDist <= farDist){
    float denom = max(1e-6, farDist - focusDist);
    return (targetDist - focusDist) / denom;
  } else {
    float denom = max(1e-6, farDist - focusDist);
    return 1.0 + (targetDist - farDist) / denom;
  }
}

float calculateWedgeBlurRadiusPx(float normalizedDef, float boundaryBlurRadiusPx, float displayBlurScale, float maximumBlurRadiusPx){
  return clamp(normalizedDef * boundaryBlurRadiusPx * displayBlurScale, 0.0, maximumBlurRadiusPx);
}
`;

// Shared declarations for uniforms used by both shaders
export const groundGlassUniformDecls = `
uniform float renderWidth;
uniform float renderHeight;
uniform float maxCoC;
uniform float focalLengthMm;
uniform float fNumber;
uniform float imageDistanceMm;
uniform float sensorWidthMm;
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
uniform float boundaryBlurRadiusPx;
uniform float displayBlurScale;
uniform float maximumBlurRadiusPx;
`;
