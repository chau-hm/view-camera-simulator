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

/** Full-resolution signed physical CoC + local affine footprint intermediate.
 * R stores signed CoC; G/B store major/minor semi-axes; A stores orientation
 * modulo pi. Half-float uses physical mm for R/G/B, while byte fallback uses
 * the explicit normalized storage contract. */
export const groundGlassPhysicalCocFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDepth;
${sharedIntro}

void main(){
  float depth = texture2D(tDepth, vUv).x;
  vec3 worldPos = reconstructWorldPosition(vUv, depth, inverseProjectionMatrix, cameraMatrixWorld);
  GroundGlassPhysicalBlurFootprint footprint =
    calculatePhysicalBlurFootprintFromWorldPosition(worldPos);
  if(footprint.valid < 0.5){
    gl_FragColor = vec4(encodeSignedPhysicalCoCDiameterMm(0.0), 0.0, 0.0, 0.0);
    return;
  }
  gl_FragColor = vec4(
    encodeSignedPhysicalCoCDiameterMm(footprint.signedCocMm),
    encodeGroundGlassFootprintRadiusMm(footprint.majorRadiusMm),
    encodeGroundGlassFootprintRadiusMm(footprint.minorRadiusMm),
    encodeGroundGlassFootprintOrientation(footprint.orientationRad)
  );
}
`;

/**
 * Local-affine oriented aperture gather. CoC and footprint data are generated
 * independently at full resolution; this pass may render to a scaled target
 * for quality tiers. This is intentionally a single-view color/depth
 * approximation: a background surface fully hidden by a foreground surface
 * cannot be reconstructed here.
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
  vec4 centerFootprint = texture2D(tCoC, uv);
  float centerSignedCocMm = decodeStoredSignedCoCDiameterMm(centerFootprint.r);
  float centerMajorRadiusMm = decodeStoredGroundGlassFootprintRadiusMm(centerFootprint.g);
  float centerMinorRadiusMm = decodeStoredGroundGlassFootprintRadiusMm(centerFootprint.b);
  float centerOrientation = centerFootprint.a;
  vec2 centerMajorAxisPx = footprintMajorAxisPx(centerMajorRadiusMm, centerOrientation);
  vec2 centerMinorAxisPx = footprintMinorAxisPx(centerMinorRadiusMm, centerOrientation);
  float centerClampScale = footprintClampScale(centerMajorAxisPx, centerMinorAxisPx);
  float centerExtentPx = max(length(centerMajorAxisPx), length(centerMinorAxisPx)) * centerClampScale;
  float centerScalarRadiusPx = cocDiameterMmToGatherRadiusPx(centerSignedCocMm);
  if(centerExtentPx <= 0.125 && centerScalarRadiusPx > 0.125){
    // A tiny byte-quantized ellipse can retain signed CoC classification but
    // lose its axis channels. Keep a conservative circular fallback only for
    // that storage edge case; valid physical ellipses use their own axes.
    centerMajorAxisPx = vec2(centerScalarRadiusPx, 0.0);
    centerMinorAxisPx = vec2(0.0, centerScalarRadiusPx);
    centerClampScale = 1.0;
    centerExtentPx = centerScalarRadiusPx;
  }
  bool nearLayer = gatherLayer > 0.5;

  // A near center surface is already represented by the near layer. Do not
  // let a far gather pull background through its opaque silhouette.
  if(!nearLayer && centerSignedCocMm < -0.00001){
    gl_FragColor = sharpColor;
    return;
  }

  // Far gathering follows the center surface's local ellipse. Near gathering
  // deliberately searches a conservative disk so a foreground sample can
  // scatter beyond its geometric center pixel; membership is then tested
  // against that sampled foreground object's own ellipse.
  float gatherRadiusPx = nearLayer ? maximumCoCRadiusPx : centerExtentPx;
  if(!nearLayer && !(centerExtentPx > ${zeroCoCThresholdPx.toString()})){
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
  float coverageMass = 0.0;
  bool centerForeground = false;

  float centerWeight = nearLayer
    ? calculateNearSampleWeight(centerDepth, centerDepth, centerSignedCocMm, centerSignedCocMm)
    : calculateFarSampleWeight(centerDepth, centerDepth, centerSignedCocMm);
  if(centerWeight > 1e-6){
    accum += sharpColor.rgb * centerWeight;
    total += centerWeight;
    if(nearLayer) centerForeground = true;
  }

  // Uniform-disk samples are proposal points. Far samples are transformed by
  // the center ellipse; near samples retain the circular proposal disk and
  // apply each sampled foreground ellipse as a visibility footprint.
  for(int i = 0; i < 64; ++i){
    if(float(i) >= activeSamples) break;
    float sampleIndex = float(i);
    float radial = sqrt((sampleIndex + 0.5) / activeSamples);
    float angle = (sampleIndex + 0.5) * goldenAngle;
    vec2 diskOffset = radial * vec2(cos(angle), sin(angle));
    vec2 offsetPx = nearLayer
      ? diskOffset * gatherRadiusPx
      : orientedFootprintOffsetPx(
          diskOffset,
          centerMajorAxisPx,
          centerMinorAxisPx,
          centerClampScale
        );
    vec2 offsetUv = offsetPx / vec2(renderWidth, renderHeight);
    vec2 sampleUv = clamp(uv + offsetUv, vec2(0.0), vec2(1.0));
    float sampleDepth = texture2D(tDepth, sampleUv).x;
    vec4 sampleFootprint = texture2D(tCoC, sampleUv);
    float sampleSignedCocMm = decodeStoredSignedCoCDiameterMm(sampleFootprint.r);
    float depthWeight = nearLayer
      ? calculateNearSampleWeight(centerDepth, sampleDepth, centerSignedCocMm, sampleSignedCocMm)
      : calculateFarSampleWeight(centerDepth, sampleDepth, sampleSignedCocMm);
    float footprintWeight = 1.0;
    vec2 sampleMajorAxisPx = vec2(0.0);
    vec2 sampleMinorAxisPx = vec2(0.0);
    float sampleClampScale = 0.0;
    if(nearLayer){
      float sampleMajorRadiusMm = decodeStoredGroundGlassFootprintRadiusMm(sampleFootprint.g);
      float sampleMinorRadiusMm = decodeStoredGroundGlassFootprintRadiusMm(sampleFootprint.b);
      float sampleOrientation = sampleFootprint.a;
      sampleMajorAxisPx = footprintMajorAxisPx(sampleMajorRadiusMm, sampleOrientation);
      sampleMinorAxisPx = footprintMinorAxisPx(sampleMinorRadiusMm, sampleOrientation);
      sampleClampScale = footprintClampScale(sampleMajorAxisPx, sampleMinorAxisPx);
      footprintWeight = ellipseFootprintWeight(
        offsetPx,
        sampleMajorAxisPx,
        sampleMinorAxisPx,
        sampleClampScale
      );
    }
    float weight = depthWeight * footprintWeight;
    if(!(weight > 1e-6)) continue;
    accum += texture2D(tColor, sampleUv).rgb * weight;
    total += weight;
    if(nearLayer){
      // Samples are proposed over the maximum search disk, so coverage is
      // compensated by each foreground ellipse's area ratio. The
      // sample-count-derived floor/cap limits sparse-proposal noise without a
      // visual fudge multiplier.
      vec2 acceptedMajorAxisPx = sampleMajorAxisPx * sampleClampScale;
      vec2 acceptedMinorAxisPx = sampleMinorAxisPx * sampleClampScale;
      float footprintAreaPx = abs(
        acceptedMajorAxisPx.x * acceptedMinorAxisPx.y -
        acceptedMajorAxisPx.y * acceptedMinorAxisPx.x
      );
      float footprintAreaRatio = clamp(
        footprintAreaPx / max(gatherRadiusPx * gatherRadiusPx, 1e-6),
        0.0,
        1.0
      );
      float minimumResolvableAreaRatio = 1.0 / activeSamples;
      float proposalCompensation = min(
        activeSamples,
        1.0 / max(footprintAreaRatio, minimumResolvableAreaRatio)
      );
      coverageMass += weight * proposalCompensation;
    }
  }

  if(!(total > 1e-6)){
    gl_FragColor = nearLayer ? vec4(0.0) : sharpColor;
    return;
  }
  float coverage = nearLayer
    ? (centerForeground
      ? 1.0
      : clamp(1.0 - exp(-coverageMass / activeSamples), 0.0, 1.0))
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
