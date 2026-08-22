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

/** Full-resolution signed physical CoC intermediate. The red channel stores
 * signed millimetres or the explicit normalized byte-fallback representation.
 * Negative is foreground/near-side; positive is background/far-side. */
export const groundGlassPhysicalCocFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
${sharedIntro}

void main(){
  float depth = texture2D(tDepth, vUv).x;
  float signedCocMm = calculateSignedCoCDiameterMmAtFragment(vUv, depth);
  if(!isFiniteFloat(signedCocMm)) signedCocMm = 0.0;
  gl_FragColor = vec4(encodeSignedPhysicalCoCDiameterMm(signedCocMm), 0.0, 0.0, 1.0);
}
`;

/**
 * Neutral circular aperture gather. CoC is generated independently at full
 * resolution; this pass may render to a scaled target for quality tiers.
 * This is intentionally a single-view color/depth approximation: a background
 * surface fully hidden by a foreground surface cannot be reconstructed here.
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
  float centerSignedCocMm = decodeStoredSignedCoCDiameterMm(storedCoc);
  float centerRadiusPx = cocDiameterMmToGatherRadiusPx(centerSignedCocMm);
  bool nearLayer = gatherLayer > 0.5;

  // A near center surface is already represented by the near layer. Do not
  // let a far gather pull background through its opaque silhouette.
  if(!nearLayer && centerSignedCocMm < -0.00001){
    gl_FragColor = sharpColor;
    return;
  }

  // Far gathering is center-oriented. Near gathering deliberately searches
  // the configured maximum footprint so a defocused foreground sample can
  // scatter beyond its geometric center pixel.
  float gatherRadiusPx = nearLayer ? maximumCoCRadiusPx : centerRadiusPx;
  if(!nearLayer && !(centerRadiusPx > ${zeroCoCThresholdPx.toString()})){
    gl_FragColor = sharpColor;
    return;
  }
  if(!(gatherRadiusPx > ${zeroCoCThresholdPx.toString()})){
    gl_FragColor = nearLayer ? vec4(0.0) : sharpColor;
    return;
  }

  float activeSamples = clamp(floor(sampleCount + 0.5), 1.0, float(${maximumApertureSamples}));
  const float goldenAngle = 2.39996323;
  vec3 accum = vec3(0.0);
  float total = 0.0;

  float centerWeight = nearLayer
    ? calculateNearSampleWeight(centerDepth, centerDepth, centerSignedCocMm, centerSignedCocMm)
    : calculateFarSampleWeight(centerDepth, centerDepth, centerSignedCocMm);
  if(centerWeight > 1e-6){
    accum += sharpColor.rgb * centerWeight;
    total += centerWeight;
  }

  // Uniform-disk samples form a neutral circular aperture. The compile-time
  // ceiling keeps the shader portable while sampleCount remains runtime data.
  for(int i = 0; i < ${maximumApertureSamples}; ++i){
    if(float(i) >= activeSamples) break;
    float sampleIndex = float(i);
    float radial = sqrt((sampleIndex + 0.5) / activeSamples);
    float angle = (sampleIndex + 0.5) * goldenAngle;
    vec2 diskOffset = radial * vec2(cos(angle), sin(angle));
    vec2 offsetUv = diskOffset * gatherRadiusPx / vec2(renderWidth, renderHeight);
    vec2 sampleUv = clamp(uv + offsetUv, vec2(0.0), vec2(1.0));
    float sampleDepth = texture2D(tDepth, sampleUv).x;
    float sampleSignedCocMm = decodeStoredSignedCoCDiameterMm(texture2D(tCoC, sampleUv).r);
    float sampleRadiusPx = cocDiameterMmToGatherRadiusPx(sampleSignedCocMm);
    float depthWeight = nearLayer
      ? calculateNearSampleWeight(centerDepth, sampleDepth, centerSignedCocMm, sampleSignedCocMm)
      : calculateFarSampleWeight(centerDepth, sampleDepth, sampleSignedCocMm);
    float footprintWeight = 1.0;
    if(nearLayer){
      float sampleDistancePx = length(diskOffset) * gatherRadiusPx;
      footprintWeight = sampleRadiusPx > ${zeroCoCThresholdPx.toString()}
        ? 1.0 - smoothstep(sampleRadiusPx, sampleRadiusPx + 1.0, sampleDistancePx)
        : 0.0;
    }
    float weight = depthWeight * footprintWeight;
    if(!(weight > 1e-6)) continue;
    accum += texture2D(tColor, sampleUv).rgb * weight;
    total += weight;
  }

  if(!(total > 1e-6)){
    gl_FragColor = nearLayer ? vec4(0.0) : sharpColor;
    return;
  }
  float coverage = nearLayer
    ? clamp(total / (activeSamples + 1.0), 0.0, 1.0)
    : 1.0;
  gl_FragColor = vec4(accum / total, nearLayer ? coverage : sharpColor.a);
}
`;

/** Final full-resolution display composite, including existing orientation and ring policy. */
export const groundGlassCompositeFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tGather;
uniform sampler2D tNearGather;
uniform float useNearGather;
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
  if(useNearGather > 0.5){
    vec4 nearLayer = texture2D(tNearGather, sampleUv);
    gathered.rgb = mix(gathered.rgb, nearLayer.rgb, clamp(nearLayer.a, 0.0, 1.0));
  }
  gathered.rgb = applyFocusRing(gathered.rgb, screenUv);
  gl_FragColor = gathered;
}
`;
