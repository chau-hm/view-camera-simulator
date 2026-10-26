import * as THREE from "three";
import {
  GROUND_GLASS_B1_FALLBACK_REASON,
  GROUND_GLASS_B1_MAX_FINITE_HALF,
} from "./groundGlassB1Reference";
import {
  Loop,
  abs,
  clamp,
  cos,
  dot,
  exp,
  floor,
  float,
  Fn,
  getViewPosition,
  int,
  length,
  max,
  min,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

type TslNodeValue = NonNullable<Parameters<typeof texture>[1]>;

const GOLDEN_ANGLE_RAD = 2.399963229728653;
const MAX_APERTURE_SAMPLES = 64;
const FAR_SIGN_EPSILON = 0.00001;

export type GroundGlassApertureGatherState = Readonly<{
  sourceWidthPx: number;
  sourceHeightPx: number;
  sampledFilmWidthMm: number;
  sampledFilmHeightMm: number;
  maximumRadiusPx: number;
  sampleCount: 16 | 32 | 64;
  inverseProjection: THREE.Matrix4;
}>;

/**
 * Build the M5 far and near gather shader nodes. The owner supplies existing
 * M3/M4 textures and owns every resulting render target/material/geometry.
 * Physical CoC remains in full-resolution source-pixel coordinates; the cap is
 * applied to the mapped ellipse only and never writes back into M4 storage.
 */
export const createGroundGlassApertureGatherNodes = (input: Readonly<{
  sourceColorTexture: THREE.Texture;
  sceneDepthTexture: THREE.DepthTexture;
  physicalTexture: THREE.Texture;
  validityTexture: THREE.Texture;
  state: GroundGlassApertureGatherState;
}>) => {
  const sourceWidthPx = uniform(input.state.sourceWidthPx);
  const sourceHeightPx = uniform(input.state.sourceHeightPx);
  const sampledFilmWidthMm = uniform(input.state.sampledFilmWidthMm);
  const sampledFilmHeightMm = uniform(input.state.sampledFilmHeightMm);
  const maximumRadiusPx = uniform(input.state.maximumRadiusPx);
  const sampleCount = uniform(input.state.sampleCount);
  const projectionInverse = uniform(input.state.inverseProjection.clone());
  const textureUvTop = vec2(uv().x, uv().y.oneMinus());
  const sourceSize = vec2(sourceWidthPx, sourceHeightPx);

  const nearestSourcePixel = (sourceUv: TslNodeValue) => {
    const boundedUv = clamp(sourceUv as ReturnType<typeof vec2>, vec2(0), vec2(1));
    return clamp(floor(boundedUv.mul(sourceSize)), vec2(0), sourceSize.sub(1));
  };
  const nearestSourceTexelCenter = (sourceUv: TslNodeValue) =>
    nearestSourcePixel(sourceUv).add(0.5).div(sourceSize);
  const physicalAt = (sourceUv: TslNodeValue) =>
    texture(input.physicalTexture, nearestSourceTexelCenter(sourceUv));
  const depthAt = (sourceUv: TslNodeValue) =>
    texture(input.sceneDepthTexture, nearestSourceTexelCenter(sourceUv)).r;
  const validityAt = (sourceUv: TslNodeValue) => {
    const code = texture(input.validityTexture, nearestSourceTexelCenter(sourceUv)).r;
    return code.greaterThan(0.5 / 255).and(code.lessThan(1.5 / 255));
  };
  const sourceColorAt = (sourceUv: TslNodeValue) => {
    // M3 keeps its existing linear-filter Raw texture. Address exact source
    // texel centers here to retain Phase F's nearest-color sampling semantics.
    const texelCenterUv = nearestSourceTexelCenter(sourceUv);
    return texture(input.sourceColorTexture, texelCenterUv).rgb;
  };
  const viewDistanceMmAt = (sourceUv: TslNodeValue, depth: TslNodeValue) =>
    abs(getViewPosition(sourceUv, depth, projectionInverse).z).mul(1000);
  const depthToleranceMmAt = (distanceMm: TslNodeValue) =>
    max(20, (distanceMm as ReturnType<typeof float>).mul(0.015));

  const axesToSourcePixels = (physical: ReturnType<typeof physicalAt>) => {
    const angle = physical.a.mul(Math.PI);
    const safeFilmWidthMm = max(sampledFilmWidthMm, 1e-6);
    const safeFilmHeightMm = max(sampledFilmHeightMm, 1e-6);
    const major = vec2(
      cos(angle).mul(physical.g).mul(sourceWidthPx).div(safeFilmWidthMm),
      sin(angle).mul(-1).mul(physical.g).mul(sourceHeightPx).div(safeFilmHeightMm),
    );
    const minor = vec2(
      sin(angle).mul(-1).mul(physical.b).mul(sourceWidthPx).div(safeFilmWidthMm),
      cos(angle).mul(-1).mul(physical.b).mul(sourceHeightPx).div(safeFilmHeightMm),
    );
    const gramA = dot(major, major);
    const gramB = dot(minor, minor);
    const gramC = dot(major, minor);
    const traceHalf = gramA.add(gramB).mul(0.5);
    const discriminant = length(vec2(gramA.sub(gramB).mul(0.5), gramC));
    const uncappedMaximumRadiusPx = sqrt(max(0, traceHalf.add(discriminant)));
    const scale = select(
      uncappedMaximumRadiusPx.greaterThan(0),
      min(1, max(0, maximumRadiusPx).div(max(uncappedMaximumRadiusPx, 1e-12))),
      1,
    );
    return {
      major,
      minor,
      uncappedMaximumRadiusPx,
      scale,
      cappedMaximumRadiusPx: uncappedMaximumRadiusPx.mul(scale),
    };
  };

  const ellipseMembershipWeight = (
    offsetPx: TslNodeValue,
    major: TslNodeValue,
    minor: TslNodeValue,
    scale: TslNodeValue,
  ) => {
    const offsetVector = offsetPx as ReturnType<typeof vec2>;
    const majorVector = major as ReturnType<typeof vec2>;
    const minorVector = minor as ReturnType<typeof vec2>;
    const scalar = scale as ReturnType<typeof float>;
    const majorScaled = majorVector.mul(scalar);
    const minorScaled = minorVector.mul(scalar);
    const determinant = majorScaled.x.mul(minorScaled.y).sub(majorScaled.y.mul(minorScaled.x));
    const safeDeterminant = select(abs(determinant).greaterThan(1e-6), determinant, 1);
    const localX = offsetVector.x.mul(minorScaled.y).sub(offsetVector.y.mul(minorScaled.x)).div(safeDeterminant);
    const localY = offsetVector.y.mul(majorScaled.x).sub(offsetVector.x.mul(majorScaled.y)).div(safeDeterminant);
    const radius = length(vec2(localX, localY));
    const edge = float(1).sub(smoothstep(1, 1.02, radius));
    return select(abs(determinant).greaterThan(1e-6), edge, 0);
  };

  const farOutput = Fn(() => {
    const sourceUv = textureUvTop;
    const centerColor = sourceColorAt(sourceUv);
    const centerPhysical = physicalAt(sourceUv);
    const centerFar = validityAt(sourceUv).and(centerPhysical.r.greaterThan(FAR_SIGN_EPSILON));
    const centerDistanceMm = viewDistanceMmAt(sourceUv, depthAt(sourceUv));
    const axes = axesToSourcePixels(centerPhysical);
    const scaledMajor = axes.major.mul(axes.scale);
    const scaledMinor = axes.minor.mul(axes.scale);
    const accumulated = vec3(0).toVar();
    const weightSum = float(0).toVar();
    const centerWeight = select(centerFar, 1, 0);
    accumulated.assign(centerColor.mul(centerWeight));
    weightSum.assign(centerWeight);
    const activeSamples = max(sampleCount, 1);

    Loop({ start: int(0), end: int(MAX_APERTURE_SAMPLES) }, ({ i }) => {
      const index = float(i);
      const radial = sqrt(index.add(0.5).div(activeSamples));
      const angle = index.add(0.5).mul(GOLDEN_ANGLE_RAD);
      const disk = radial.mul(vec2(cos(angle), sin(angle)));
      const offsetPx = scaledMajor.mul(disk.x).add(scaledMinor.mul(disk.y));
      const sampleUv = clamp(
        sourceUv.add(vec2(offsetPx.x.div(sourceWidthPx), offsetPx.y.div(sourceHeightPx))),
        vec2(0),
        vec2(1),
      );
      const samplePhysical = physicalAt(sampleUv);
      const sampleDepth = depthAt(sampleUv);
      const sampleDistanceMm = viewDistanceMmAt(sampleUv, sampleDepth);
      const accepted = centerFar
        .and(validityAt(sampleUv))
        .and(sampleDepth.lessThan(1))
        .and(samplePhysical.r.greaterThanEqual(-FAR_SIGN_EPSILON))
        .and(sampleDistanceMm.greaterThanEqual(centerDistanceMm.sub(depthToleranceMmAt(centerDistanceMm))))
        .and(index.lessThan(sampleCount));
      const weight = select(accepted, 1, 0);
      accumulated.addAssign(sourceColorAt(sampleUv).mul(weight));
      weightSum.addAssign(weight);
    });

    const gathered = select(
      weightSum.greaterThan(1e-6),
      accumulated.div(max(weightSum, 1e-6)),
      centerColor,
    );
    return vec4(gathered, 1);
  })();

  const nearOutput = Fn(() => {
    const sourceUv = textureUvTop;
    const centerColor = sourceColorAt(sourceUv);
    const centerPhysical = physicalAt(sourceUv);
    const centerNear = validityAt(sourceUv).and(centerPhysical.r.lessThan(-FAR_SIGN_EPSILON));
    const centerDepth = depthAt(sourceUv);
    const centerDistanceMm = viewDistanceMmAt(sourceUv, centerDepth);
    const activeSamples = max(sampleCount, 1);
    const accumulated = vec3(0).toVar();
    const weightSum = float(0).toVar();
    const coverageMass = float(0).toVar();
    const centerWeight = select(centerNear, 1, 0);
    accumulated.assign(centerColor.mul(centerWeight));
    weightSum.assign(centerWeight);

    Loop({ start: int(0), end: int(MAX_APERTURE_SAMPLES) }, ({ i }) => {
      const index = float(i);
      const radial = sqrt(index.add(0.5).div(activeSamples));
      const angle = index.add(0.5).mul(GOLDEN_ANGLE_RAD);
      const disk = radial.mul(vec2(cos(angle), sin(angle)));
      const proposalOffsetPx = disk.mul(maximumRadiusPx);
      const sampleUv = clamp(
        sourceUv.add(vec2(proposalOffsetPx.x.div(sourceWidthPx), proposalOffsetPx.y.div(sourceHeightPx))),
        vec2(0),
        vec2(1),
      );
      const samplePhysical = physicalAt(sampleUv);
      const sampleDepth = depthAt(sampleUv);
      const sampleDistanceMm = viewDistanceMmAt(sampleUv, sampleDepth);
      const sampleAxes = axesToSourcePixels(samplePhysical);
      const membership = ellipseMembershipWeight(
        proposalOffsetPx,
        sampleAxes.major,
        sampleAxes.minor,
        sampleAxes.scale,
      );
      const behindNearCenter = centerNear.not().or(
        sampleDistanceMm.lessThanEqual(centerDistanceMm.add(depthToleranceMmAt(centerDistanceMm))),
      );
      const accepted = validityAt(sampleUv)
        .and(sampleDepth.lessThan(1))
        .and(samplePhysical.r.lessThan(-FAR_SIGN_EPSILON))
        .and(membership.greaterThan(0))
        .and(behindNearCenter)
        .and(index.lessThan(sampleCount));
      const weight = select(accepted, membership, 0);
      accumulated.addAssign(sourceColorAt(sampleUv).mul(weight));
      weightSum.addAssign(weight);
      const area = abs(
        sampleAxes.major.x.mul(sampleAxes.minor.y)
          .sub(sampleAxes.major.y.mul(sampleAxes.minor.x)),
      ).mul(sampleAxes.scale.mul(sampleAxes.scale));
      const areaRatio = clamp(area.div(max(maximumRadiusPx.mul(maximumRadiusPx), 1e-6)), 0, 1);
      const areaFloor = float(1).div(activeSamples);
      const compensation = min(activeSamples, float(1).div(max(areaRatio, areaFloor)));
      coverageMass.addAssign(weight.mul(compensation));
    });

    const nearColor = select(
      weightSum.greaterThan(1e-6),
      accumulated.div(max(weightSum, 1e-6)),
      vec3(0),
    );
    const estimatedCoverage = float(1).sub(exp(coverageMass.div(activeSamples).mul(-1)));
    const coverage = select(centerNear, 1, clamp(estimatedCoverage, 0, 1));
    return vec4(nearColor, coverage);
  })();

  /**
   * Construct an opt-in M5R diagnostic graph that mirrors the real Near
   * proposal gates and coverage math. The default Near output above remains
   * the only output used by M5. Callers render these nodes only for an explicit
   * development test capture and compare the final-alpha channel to nearOutput.
   */
  const createM5rNearDiagnosticOutputs = () => {
    const evaluate = () => {
      const sourceUv = textureUvTop;
      const centerPhysical = physicalAt(sourceUv);
      const centerNear = validityAt(sourceUv).and(centerPhysical.r.lessThan(-FAR_SIGN_EPSILON));
      const centerDepth = depthAt(sourceUv);
      const centerDistanceMm = viewDistanceMmAt(sourceUv, centerDepth);
      const activeSamples = max(sampleCount, 1);
      const weightSum = float(0).toVar();
      const coverageMass = float(0).toVar();
      const evaluatedCount = float(0).toVar();
      const acceptedCount = float(0).toVar();
      const nonzeroMembershipCount = float(0).toVar();
      const acceptedAreaRatioSum = float(0).toVar();
      const maximumAcceptedCompensation = float(0).toVar();
      const centerWeight = select(centerNear, 1, 0);
      weightSum.assign(centerWeight);

      Loop({ start: int(0), end: int(MAX_APERTURE_SAMPLES) }, ({ i }) => {
        const index = float(i);
        const active = index.lessThan(sampleCount);
        const radial = sqrt(index.add(0.5).div(activeSamples));
        const angle = index.add(0.5).mul(GOLDEN_ANGLE_RAD);
        const disk = radial.mul(vec2(cos(angle), sin(angle)));
        const proposalOffsetPx = disk.mul(maximumRadiusPx);
        const sampleUv = clamp(
          sourceUv.add(vec2(proposalOffsetPx.x.div(sourceWidthPx), proposalOffsetPx.y.div(sourceHeightPx))),
          vec2(0),
          vec2(1),
        );
        const samplePhysical = physicalAt(sampleUv);
        const sampleDepth = depthAt(sampleUv);
        const sampleDistanceMm = viewDistanceMmAt(sampleUv, sampleDepth);
        const sampleAxes = axesToSourcePixels(samplePhysical);
        const membership = ellipseMembershipWeight(
          proposalOffsetPx,
          sampleAxes.major,
          sampleAxes.minor,
          sampleAxes.scale,
        );
        const behindNearCenter = centerNear.not().or(
          sampleDistanceMm.lessThanEqual(centerDistanceMm.add(depthToleranceMmAt(centerDistanceMm))),
        );
        const accepted = validityAt(sampleUv)
          .and(sampleDepth.lessThan(1))
          .and(samplePhysical.r.lessThan(-FAR_SIGN_EPSILON))
          .and(membership.greaterThan(0))
          .and(behindNearCenter)
          .and(active);
        const membershipPresent = membership.greaterThan(0).and(active);
        const weight = select(accepted, membership, 0);
        const area = abs(
          sampleAxes.major.x.mul(sampleAxes.minor.y)
            .sub(sampleAxes.major.y.mul(sampleAxes.minor.x)),
        ).mul(sampleAxes.scale.mul(sampleAxes.scale));
        const areaRatio = clamp(area.div(max(maximumRadiusPx.mul(maximumRadiusPx), 1e-6)), 0, 1);
        const areaFloor = float(1).div(activeSamples);
        const compensation = min(activeSamples, float(1).div(max(areaRatio, areaFloor)));

        evaluatedCount.addAssign(select(active, 1, 0));
        acceptedCount.addAssign(select(accepted, 1, 0));
        nonzeroMembershipCount.addAssign(select(membershipPresent, 1, 0));
        weightSum.addAssign(weight);
        coverageMass.addAssign(weight.mul(compensation));
        acceptedAreaRatioSum.addAssign(select(accepted, areaRatio, 0));
        maximumAcceptedCompensation.assign(max(
          maximumAcceptedCompensation,
          select(accepted, compensation, 0),
        ));
      });

      const estimatedCoverage = float(1).sub(exp(coverageMass.div(activeSamples).mul(-1)));
      const finalCoverage = select(centerNear, 1, clamp(estimatedCoverage, 0, 1));
      const meanAreaRatio = select(
        acceptedCount.greaterThan(0),
        acceptedAreaRatioSum.div(max(acceptedCount, 1)),
        0,
      );
      return {
        centerNear: select(centerNear, 1, 0),
        evaluatedCount,
        acceptedCount,
        nonzeroMembershipCount,
        weightSum,
        coverageMass,
        estimatedCoverage,
        finalCoverage,
        meanAreaRatio,
        maximumAcceptedCompensation,
      };
    };

    return {
      proposalCounts: Fn(() => {
        const values = evaluate();
        return vec4(values.centerNear, values.evaluatedCount, values.acceptedCount, values.nonzeroMembershipCount);
      })(),
      coverage: Fn(() => {
        const values = evaluate();
        return vec4(values.weightSum, values.coverageMass, values.estimatedCoverage, values.finalCoverage);
      })(),
      acceptedFootprint: Fn(() => {
        const values = evaluate();
        return vec4(values.meanAreaRatio, values.maximumAcceptedCompensation, sampleCount, 1);
      })(),
    };
  };

  const update = (state: GroundGlassApertureGatherState): void => {
    sourceWidthPx.value = state.sourceWidthPx;
    sourceHeightPx.value = state.sourceHeightPx;
    sampledFilmWidthMm.value = state.sampledFilmWidthMm;
    sampledFilmHeightMm.value = state.sampledFilmHeightMm;
    maximumRadiusPx.value = state.maximumRadiusPx;
    sampleCount.value = state.sampleCount;
    projectionInverse.value.copy(state.inverseProjection);
  };

  return {
    farOutput,
    nearOutput,
    createM5rNearDiagnosticOutputs,
    update,
    uniforms: {
      sourceWidthPx,
      sourceHeightPx,
      sampledFilmWidthMm,
      sampledFilmHeightMm,
      maximumRadiusPx,
      sampleCount,
      projectionInverse,
    },
  };
};

export const createGroundGlassSourceIdentityNode = (
  initialWidthPx: number,
  initialHeightPx: number,
) => {
  const widthPx = uniform(initialWidthPx);
  const heightPx = uniform(initialHeightPx);
  const topUv = vec2(uv().x, uv().y.oneMinus());
  return {
    outputNode: Fn(() => vec4(
      floor(topUv.x.mul(widthPx)),
      floor(topUv.y.mul(heightPx)),
      0,
      1,
    ))(),
    update(width: number, height: number) {
      widthPx.value = width;
      heightPx.value = height;
    },
  };
};

export const createGroundGlassGatherIdentityNode = (
  initialWidthPx: number,
  initialHeightPx: number,
) => {
  const widthPx = uniform(initialWidthPx);
  const heightPx = uniform(initialHeightPx);
  const topUv = vec2(uv().x, uv().y.oneMinus());
  return {
    outputNode: Fn(() => vec4(
      floor(topUv.x.mul(widthPx)),
      floor(topUv.y.mul(heightPx)),
      0,
      1,
    ))(),
    update(width: number, height: number) {
      widthPx.value = width;
      heightPx.value = height;
    },
  };
};

export const createGroundGlassGatherCenterProvenanceNode = (
  sourceIdentityTexture: THREE.Texture,
  initialSourceWidthPx: number,
  initialSourceHeightPx: number,
) => {
  const sourceWidthPx = uniform(initialSourceWidthPx);
  const sourceHeightPx = uniform(initialSourceHeightPx);
  const sourceSize = vec2(sourceWidthPx, sourceHeightPx);
  const topUv = vec2(uv().x, uv().y.oneMinus());
  return {
    outputNode: Fn(() => {
      const sourcePixel = clamp(floor(topUv.mul(sourceSize)), vec2(0), sourceSize.sub(1));
      const sourceTexelCenterUv = sourcePixel.add(0.5).div(sourceSize);
      const sourceIdentity = texture(sourceIdentityTexture, sourceTexelCenterUv);
      return vec4(sourceIdentity.rg, topUv.x, topUv.y);
    })(),
    update(sourceWidth: number, sourceHeight: number) {
      sourceWidthPx.value = sourceWidth;
      sourceHeightPx.value = sourceHeight;
    },
  };
};

export const createGroundGlassDepthReadbackNode = (
  sceneDepthTexture: THREE.DepthTexture,
) => {
  const topUv = vec2(uv().x, uv().y.oneMinus());
  return Fn(() => vec4(texture(sceneDepthTexture, topUv).r, 0, 0, 1))();
};

export const createGroundGlassSelectedGatherProvenanceNode = (input: Readonly<{
  gatherIdentityTexture: THREE.Texture;
  gatherCenterProvenanceTexture: THREE.Texture;
}>) => {
  const topUv = vec2(uv().x, uv().y.oneMinus());
  return Fn(() => {
    const selectedGather = texture(input.gatherIdentityTexture, topUv);
    const selectedCenter = texture(input.gatherCenterProvenanceTexture, topUv);
    return vec4(selectedGather.rg, selectedCenter.rg);
  })();
};

export const createGroundGlassB1ReconstructionNodes = (input: Readonly<{
  sourceColorTexture: THREE.Texture;
  gatherFarTexture: THREE.Texture;
  physicalTexture: THREE.Texture;
  validityTexture: THREE.Texture;
  gatherCenterProvenanceTexture: THREE.Texture;
  selectedProvenanceTexture: THREE.Texture;
  sourceWidthPx: number;
  sourceHeightPx: number;
  gatherWidthPx: number;
  gatherHeightPx: number;
}>) => {
  const sourceWidth = uniform(input.sourceWidthPx);
  const sourceHeight = uniform(input.sourceHeightPx);
  const gatherWidth = uniform(input.gatherWidthPx);
  const gatherHeight = uniform(input.gatherHeightPx);
  const textureUvTop = vec2(uv().x, uv().y.oneMinus());

  const resolveDecision = () => {
    const selected = texture(input.selectedProvenanceTexture, textureUvTop);
    const selectedGatherX = floor(selected.r.add(0.5));
    const selectedGatherY = floor(selected.g.add(0.5));
    const selectedCenterX = floor(selected.b.add(0.5));
    const selectedCenterY = floor(selected.a.add(0.5));
    const observedCenterId = texture(
      input.gatherCenterProvenanceTexture,
      vec2(
        selectedGatherX.add(0.5).div(gatherWidth),
        // Provenance IDs use top-origin target texel coordinates. Unlike the
        // fullscreen output UV, this direct texel lookup must not flip Y.
        selectedGatherY.add(0.5).div(gatherHeight),
      ),
    );
    const selectedGatherInBounds = selectedGatherX.greaterThanEqual(0)
      .and(selectedGatherX.lessThan(gatherWidth))
      .and(selectedGatherY.greaterThanEqual(0))
      .and(selectedGatherY.lessThan(gatherHeight));
    const selectedCenterInBounds = selectedCenterX.greaterThanEqual(0)
      .and(selectedCenterX.lessThan(sourceWidth))
      .and(selectedCenterY.greaterThanEqual(0))
      .and(selectedCenterY.lessThan(sourceHeight));
    const selectedCenterMatches = observedCenterId.r.equal(selectedCenterX)
      .and(observedCenterId.g.equal(selectedCenterY));
    const centerUv = vec2(
      selectedCenterX.add(0.5).div(sourceWidth),
      selectedCenterY.add(0.5).div(sourceHeight),
    );
    const centerValidity = texture(input.validityTexture, centerUv).r;
    const centerSignedCocMm = texture(input.physicalTexture, centerUv).r;
    const centerValidityIsValid = centerValidity.greaterThan(0.5 / 255)
      .and(centerValidity.lessThan(1.5 / 255));
    const centerPhysicalIsFinite = abs(centerSignedCocMm).lessThanEqual(GROUND_GLASS_B1_MAX_FINITE_HALF);
    const centerPhysicalIsValid = centerValidityIsValid.and(centerPhysicalIsFinite);
    const centerFarEligible = centerPhysicalIsValid.and(centerSignedCocMm.greaterThan(FAR_SIGN_EPSILON));
    const gatherColor = texture(input.gatherFarTexture, textureUvTop);
    const gatherDataIsFinite = abs(gatherColor.r).lessThanEqual(GROUND_GLASS_B1_MAX_FINITE_HALF)
      .and(abs(gatherColor.g).lessThanEqual(GROUND_GLASS_B1_MAX_FINITE_HALF))
      .and(abs(gatherColor.b).lessThanEqual(GROUND_GLASS_B1_MAX_FINITE_HALF))
      .and(abs(gatherColor.a).lessThanEqual(GROUND_GLASS_B1_MAX_FINITE_HALF));

    // The nested selects match the CPU oracle's explicit failure precedence.
    let reasonCode = select(
      gatherDataIsFinite,
      GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted,
      GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData,
    );
    reasonCode = select(
      centerFarEligible,
      reasonCode,
      GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible,
    );
    reasonCode = select(
      centerPhysicalIsValid,
      reasonCode,
      GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter,
    );
    reasonCode = select(
      selectedCenterMatches,
      reasonCode,
      GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch,
    );
    reasonCode = select(
      selectedCenterInBounds,
      reasonCode,
      GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance,
    );
    reasonCode = select(
      selectedGatherInBounds,
      reasonCode,
      GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance,
    );
    return {
      eligible: reasonCode.equal(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted),
      reasonCode,
      gatherColor,
    };
  };

  const farOutput = Fn(() => {
    const decision = resolveDecision();
    const sourcePixel = clamp(
      floor(textureUvTop.mul(vec2(sourceWidth, sourceHeight))),
      vec2(0),
      vec2(sourceWidth.sub(1), sourceHeight.sub(1)),
    );
    const sourceUv = sourcePixel.add(0.5).div(vec2(sourceWidth, sourceHeight));
    const sourceColor = texture(input.sourceColorTexture, sourceUv).rgb;
    return vec4(select(decision.eligible, decision.gatherColor.rgb, sourceColor), 1);
  })();

  const decisionOutput = Fn(() => {
    const decision = resolveDecision();
    return vec4(
      select(decision.eligible, 1 / 255, 0),
      float(decision.reasonCode).div(255),
      select(decision.eligible, 1 / 255, 0),
      1,
    );
  })();

  const update = (sizes: Readonly<{
    sourceWidthPx: number;
    sourceHeightPx: number;
    gatherWidthPx: number;
    gatherHeightPx: number;
  }>): void => {
    sourceWidth.value = sizes.sourceWidthPx;
    sourceHeight.value = sizes.sourceHeightPx;
    gatherWidth.value = sizes.gatherWidthPx;
    gatherHeight.value = sizes.gatherHeightPx;
  };

  return { farOutput, decisionOutput, update };
};

export const createGroundGlassResearchCompositeNode = (input: Readonly<{
  farTexture: THREE.Texture;
  nearTexture: THREE.Texture;
}>) => {
  const textureUvTop = vec2(uv().x, uv().y.oneMinus());
  return Fn(() => {
    const far = texture(input.farTexture, textureUvTop).rgb;
    const near = texture(input.nearTexture, textureUvTop);
    const coverage = clamp(near.a, 0, 1);
    return vec4(far.mul(float(1).sub(coverage)).add(near.rgb.mul(coverage)), 1);
  })();
};
