import { groundGlassSharedGlsl, groundGlassUniformDecls } from "./groundGlassDofShaders";

export const groundGlassVertexShader = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const sharedIntro = `${groundGlassUniformDecls} ${groundGlassSharedGlsl}`;
const zeroCoCThresholdPx = 0.125;
const maximumApertureSamples = 64;

/** Full-resolution physical CoC intermediate. The red channel stores either
 * millimetres or the explicit normalized byte-fallback representation. */
export const groundGlassPhysicalCocFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
${sharedIntro}

void main(){
  float depth = texture2D(tDepth, vUv).x;
  float cocMm = calculateCoCDiameterMmAtFragment(vUv, depth);
  if(!isFiniteFloat(cocMm) || cocMm < 0.0) cocMm = 0.0;
  gl_FragColor = vec4(encodePhysicalCoCDiameterMm(cocMm), 0.0, 0.0, 1.0);
}
`;

/**
 * Neutral circular aperture gather. CoC is generated independently at full
 * resolution; this pass may render to a scaled target for quality tiers.
 */
export const groundGlassApertureGatherFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tCoC;
${sharedIntro}

void main(){
  vec2 uv = vUv;
  vec4 sharpColor = texture2D(tColor, uv);
  if(useRaw > 0.5){
    gl_FragColor = sharpColor;
    return;
  }

  float centerDepth = texture2D(tDepth, uv).x;
  float storedCoc = texture2D(tCoC, uv).r;
  float cocMm = decodeStoredCoCDiameterMm(storedCoc);
  float radiusPx = cocDiameterMmToGatherRadiusPx(cocMm);

  // Preserve the sharp path without paying for aperture samples.
  if(!(radiusPx > ${zeroCoCThresholdPx.toString()})){
    gl_FragColor = sharpColor;
    return;
  }

  float activeSamples = clamp(floor(sampleCount + 0.5), 1.0, float(${maximumApertureSamples}));
  const float goldenAngle = 2.39996323;
  vec3 accum = vec3(0.0);
  float total = 0.0;

  // Uniform-disk samples form a neutral circular aperture. The compile-time
  // ceiling keeps the shader portable while sampleCount remains runtime data.
  for(int i = 0; i < ${maximumApertureSamples}; ++i){
    if(float(i) >= activeSamples) break;
    float sampleIndex = float(i);
    float radial = sqrt((sampleIndex + 0.5) / activeSamples);
    float angle = (sampleIndex + 0.5) * goldenAngle;
    vec2 diskOffset = radial * vec2(cos(angle), sin(angle));
    vec2 offsetUv = diskOffset * radiusPx / vec2(renderWidth, renderHeight);
    vec2 sampleUv = clamp(uv + offsetUv, vec2(0.0), vec2(1.0));
    float sampleDepth = texture2D(tDepth, sampleUv).x;
    float depthWeight = calculateDepthSampleWeight(centerDepth, sampleDepth);
    if(!(depthWeight > 1e-6)) continue;
    accum += texture2D(tColor, sampleUv).rgb * depthWeight;
    total += depthWeight;
  }

  if(!(total > 1e-6)){
    gl_FragColor = sharpColor;
    return;
  }
  gl_FragColor = vec4(accum / total, sharpColor.a);
}
`;

/** Final full-resolution display composite, including existing orientation and ring policy. */
export const groundGlassCompositeFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tGather;
uniform vec2 ringCenter;
uniform float ringRadiusPx;
uniform vec3 ringColor;
uniform float ringOpacity;
uniform float showRing;
uniform float displayUpright;
uniform float renderWidth;
uniform float renderHeight;

vec3 applyFocusRing(vec3 color, vec2 screenUv){
  if(showRing <= 0.5) return color;
  vec2 ringCenterScreen = (displayUpright > 0.5)
    ? vec2(1.0 - ringCenter.x, 1.0 - ringCenter.y)
    : ringCenter;
  vec2 px = screenUv * vec2(renderWidth, renderHeight);
  vec2 centerPx = ringCenterScreen * vec2(renderWidth, renderHeight);
  float distancePx = distance(px, centerPx);
  float ring = smoothstep(ringRadiusPx - 1.5, ringRadiusPx - 0.5, distancePx) -
    smoothstep(ringRadiusPx + 0.5, ringRadiusPx + 1.5, distancePx);
  return mix(color, ringColor, clamp(ring * ringOpacity, 0.0, 1.0));
}

void main(){
  vec2 screenUv = vUv;
  vec2 sampleUv = (displayUpright > 0.5)
    ? vec2(1.0 - screenUv.x, 1.0 - screenUv.y)
    : screenUv;
  vec4 gathered = texture2D(tGather, sampleUv);
  gathered.rgb = applyFocusRing(gathered.rgb, screenUv);
  gl_FragColor = gathered;
}
`;
