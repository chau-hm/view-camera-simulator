import { groundGlassSharedGlsl, groundGlassUniformDecls } from "./groundGlassDofShaders";

export const groundGlassVertexShader = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position,1.0); }`;

const sharedIntro = `${groundGlassUniformDecls} ${groundGlassSharedGlsl}`;

// constants: zero blur threshold and fixed sample layout
const zeroBlurThreshold = 0.125;
const maximumHalfSamples = 7; // symmetric taps -7..+7 => 15 taps

export const groundGlassHorizontalFragmentShader = `precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; ${sharedIntro}

void main(){
  vec2 uv = vUv;
  if(useRaw > 0.5){ gl_FragColor = texture2D(tColor, uv); return; }
  float centerDepth = texture2D(tDepth, uv).x;
  float radius = 0.0;
  if (dofMode < 0.5) {
    radius = calculateParallelBlurRadiusPxFromDepth(centerDepth);
  } else {
    vec3 worldPos = reconstructWorldPosition(uv, centerDepth, inverseProjectionMatrix, cameraMatrixWorld);
    radius = calculateWedgeBlurRadiusPxFromWorldPosition(worldPos);
  }

  if (radius <= ${zeroBlurThreshold}){
    gl_FragColor = texture2D(tColor, uv);
    return;
  }

  // continuous Gaussian family with fixed sample layout
  float sigma = max(0.35, radius * 0.6);
  float centerUmm = abs(viewZFromDepth(centerDepth, near, far)) * 1000.0;
  vec3 accum = vec3(0.0);
  float total = 0.0;

  for(int i = -${maximumHalfSamples}; i <= ${maximumHalfSamples}; ++i){
    float idx = float(i);
    float normalizedOffset = idx / float(${maximumHalfSamples});
    float offsetPx = normalizedOffset * radius;
    vec2 off = vec2(offsetPx / renderWidth, 0.0);
    float sampleDepth = texture2D(tDepth, uv + off).x;
    float depthWeight = calculateDepthSampleWeight(centerDepth, sampleDepth);

    // compat weight (soft) based on sample blur radius if wedge-mode
    float radiusCompatibility = 1.0;
    if(dofMode >= 0.5){
      vec3 worldSample = reconstructWorldPosition(uv + off, sampleDepth, inverseProjectionMatrix, cameraMatrixWorld);
      float sampleRadius = calculateWedgeBlurRadiusPxFromWorldPosition(worldSample);
      float radiusDelta = abs(sampleRadius - radius);
      float radiusTolerance = max(1.0, radius * 0.25);
      radiusCompatibility = 1.0 - smoothstep(radiusTolerance * 0.5, radiusTolerance, radiusDelta);
    }

    float offset2 = offsetPx * offsetPx;
    float s2 = sigma * sigma;
    float g = exp(-0.5 * offset2 / s2);
    float w = g * depthWeight * radiusCompatibility;
    if(w <= 1e-6) continue;
    vec3 c = texture2D(tColor, uv + off).rgb;
    accum += c * w;
    total += w;
  }

  if(total <= 1e-6){ gl_FragColor = texture2D(tColor, uv); return; }
  gl_FragColor = vec4(accum / total, 1.0);
}
`;

export const groundGlassVerticalFragmentShader = `precision highp float; varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; ${sharedIntro} uniform vec2 ringCenter; uniform float ringRadiusPx; uniform vec3 ringColor; uniform float ringOpacity; uniform float showRing; uniform float displayUpright;

void main(){
  vec2 screenUv = vUv;
  vec2 sampleUv = (displayUpright > 0.5) ? vec2(1.0 - screenUv.x, 1.0 - screenUv.y) : screenUv;
  if(useRaw > 0.5){ vec3 colorRaw = texture2D(tColor, sampleUv).rgb; vec3 color = colorRaw; if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); } gl_FragColor = vec4(color,1.0); return; }
  float centerDepth = texture2D(tDepth, sampleUv).x;
  float radius = 0.0;
  if (dofMode < 0.5) {
    radius = calculateParallelBlurRadiusPxFromDepth(centerDepth);
  } else {
    vec3 worldPos = reconstructWorldPosition(sampleUv, centerDepth, inverseProjectionMatrix, cameraMatrixWorld);
    radius = calculateWedgeBlurRadiusPxFromWorldPosition(worldPos);
  }

  if (radius <= ${zeroBlurThreshold}){
    vec3 color = texture2D(tColor, sampleUv).rgb;
    if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); }
    gl_FragColor = vec4(color,1.0);
    return;
  }

  float sigma = max(0.35, radius * 0.6);
  vec3 accum = vec3(0.0);
  float total = 0.0;

  for(int i = -${maximumHalfSamples}; i <= ${maximumHalfSamples}; ++i){
    float idx = float(i);
    float normalizedOffset = idx / float(${maximumHalfSamples});
    float offsetPx = normalizedOffset * radius;
    vec2 off = vec2(0.0, offsetPx / renderHeight);
    float sampleDepth = texture2D(tDepth, sampleUv + off).x;
    float depthWeight = calculateDepthSampleWeight(centerDepth, sampleDepth);

    float radiusCompatibility = 1.0;
    if(dofMode >= 0.5){
      vec3 worldSample = reconstructWorldPosition(sampleUv + off, sampleDepth, inverseProjectionMatrix, cameraMatrixWorld);
      float sampleRadius = calculateWedgeBlurRadiusPxFromWorldPosition(worldSample);
      float radiusDelta = abs(sampleRadius - radius);
      float radiusTolerance = max(1.0, radius * 0.25);
      radiusCompatibility = 1.0 - smoothstep(radiusTolerance * 0.5, radiusTolerance, radiusDelta);
    }

    float offset2 = offsetPx * offsetPx;
    float s2 = sigma * sigma;
    float g = exp(-0.5 * offset2 / s2);
    float w = g * depthWeight * radiusCompatibility;
    if(w <= 1e-6) continue;
    vec3 c = texture2D(tColor, sampleUv + off).rgb;
    accum += c * w;
    total += w;
  }

  vec3 color = accum / max(total, 1e-6);
  if(showRing > 0.5){ vec2 ringCenterScreen = (displayUpright > 0.5) ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y) : ringCenter; vec2 px = screenUv * vec2(renderWidth, renderHeight); vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight); float d = distance(px, centerPx); float r = ringRadiusPx; float ring = smoothstep(r - 1.5, r - 0.5, d) - smoothstep(r + 0.5, r + 1.5, d); color = mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0)); }
  gl_FragColor = vec4(color,1.0);
}
`;
