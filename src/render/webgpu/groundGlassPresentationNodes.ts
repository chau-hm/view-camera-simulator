import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  clamp,
  dot,
  float,
  length,
  max,
  select,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { GroundGlassCoverageRenderState } from "../groundGlassCoverage";
import type { GroundGlassFilmWindow } from "../groundGlassFilmWindow";
import type { GroundGlassNaturalIlluminationRenderState } from "../groundGlassNaturalIllumination";
import type { GroundGlassPreviewMode } from "../groundGlassTargetProjection";
import { resolveGroundGlassRttDisplayTransform } from "../groundGlassRttOrientation";

export type GroundGlassPresentationNodeState = Readonly<{
  previewMode: GroundGlassPreviewMode;
  coverage: GroundGlassCoverageRenderState;
  naturalIllumination: GroundGlassNaturalIlluminationRenderState;
  throughputGain: number;
}>;

const sameFilmWindow = (left: GroundGlassFilmWindow, right: GroundGlassFilmWindow): boolean =>
  left.centerXMm === right.centerXMm &&
  left.centerYMm === right.centerYMm &&
  left.widthMm === right.widthMm &&
  left.heightMm === right.heightMm;

/** One fullscreen node consumes the already-composited Far/Near result exactly once. */
export const createGroundGlassPresentationNode = (
  sourceTexture: THREE.Texture,
  initialState: GroundGlassPresentationNodeState,
) => {
  const initialTransform = resolveGroundGlassRttDisplayTransform(initialState.previewMode);
  const flipX = uniform(initialTransform.flipDisplayX ? 1 : 0);
  const flipY = uniform(initialTransform.flipDisplayY ? 1 : 0);
  const filmCenterMm = uniform(new THREE.Vector2());
  const filmSizeMm = uniform(new THREE.Vector2());
  const throughput = uniform(1);
  const naturalEnabled = uniform(0);
  const naturalImageDistanceMm = uniform(1);
  const naturalOffsetMm = uniform(new THREE.Vector2());
  const coverageMode = uniform(0);
  const coverageRadiusMm = uniform(1);
  const coverageOffsetMm = uniform(new THREE.Vector2());
  const coverageQuadratic = uniform(new THREE.Vector3());
  const coverageLinear = uniform(new THREE.Vector3());
  const coverageAxial = uniform(new THREE.Vector3());
  const coverageEdgeFeatherMm = uniform(0);

  const screenUv = uv();
  // screenUv is bottom-origin. These formulas match the verified WebGPU display node:
  // Raw flips physical X/Y, Upright keeps the sampled physical point unchanged.
  const sourceUv = vec2(
    select(flipX.greaterThan(0.5), screenUv.x.oneMinus(), screenUv.x),
    select(flipY.greaterThan(0.5), screenUv.y, screenUv.y.oneMinus()),
  );
  const filmPointMm = vec2(
    filmCenterMm.x.add(sourceUv.x.sub(0.5).mul(filmSizeMm.x)),
    filmCenterMm.y.add(float(0.5).sub(sourceUv.y).mul(filmSizeMm.y)),
  );
  const imageDistanceSquared = naturalImageDistanceMm.mul(naturalImageDistanceMm);
  const naturalDelta = filmPointMm.sub(naturalOffsetMm);
  const naturalDenominator = imageDistanceSquared.add(dot(naturalDelta, naturalDelta));
  const cosineSquared = imageDistanceSquared.div(max(naturalDenominator, 1e-6));
  const naturalFactor = select(
    naturalEnabled.greaterThan(0.5).and(naturalImageDistanceMm.greaterThan(0)),
    cosineSquared.mul(cosineSquared),
    1,
  );

  const coverageDelta = filmPointMm.sub(coverageOffsetMm);
  const circleDistance = length(coverageDelta);
  const safeFeatherMm = max(coverageEdgeFeatherMm, 1e-6);
  const halfFeatherMm = safeFeatherMm.mul(0.5);
  const circleSoft = float(1).sub(smoothstep(
    max(float(0), coverageRadiusMm.sub(halfFeatherMm)),
    coverageRadiusMm.add(halfFeatherMm),
    circleDistance,
  ));
  const circleHard = select(
    dot(coverageDelta, coverageDelta).lessThanEqual(coverageRadiusMm.mul(coverageRadiusMm)),
    1,
    0,
  );
  const circleFactor = select(coverageEdgeFeatherMm.greaterThan(0), circleSoft, circleHard);

  const x = filmPointMm.x;
  const y = filmPointMm.y;
  const conicValue = coverageQuadratic.x.mul(x.mul(x))
    .add(coverageQuadratic.y.mul(x).mul(y))
    .add(coverageQuadratic.z.mul(y.mul(y)))
    .add(coverageLinear.x.mul(x))
    .add(coverageLinear.y.mul(y))
    .add(coverageLinear.z);
  const conicGradient = vec2(
    coverageQuadratic.x.mul(2).mul(x).add(coverageQuadratic.y.mul(y)).add(coverageLinear.x),
    coverageQuadratic.y.mul(x).add(coverageQuadratic.z.mul(2).mul(y)).add(coverageLinear.y),
  );
  const signedConicDistanceMm = conicValue.div(max(length(conicGradient), 1e-6));
  const conicSoft = float(1).sub(smoothstep(
    halfFeatherMm.mul(-1),
    halfFeatherMm,
    signedConicDistanceMm,
  ));
  const conicHard = select(conicValue.lessThanEqual(0), 1, 0);
  const conicInside = select(coverageEdgeFeatherMm.greaterThan(0), conicSoft, conicHard);
  const conicFactor = select(
    dot(coverageAxial, vec3(x, y, 1)).greaterThan(0),
    conicInside,
    0,
  );
  const selectedCoverageFactor = select(
    coverageMode.greaterThan(0.5).and(coverageMode.lessThan(1.5)),
    circleFactor,
    select(
      coverageMode.greaterThan(1.5),
      conicFactor,
      1,
    ),
  );
  const source = texture(sourceTexture, sourceUv);
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  // The node expression carries the sampled alpha, but the accepted M6
  // presentation contract is opaque: MeshBasicNodeMaterial's opaque path
  // stores alpha one. Normal M5 input is already the completed alpha-one
  // research composite; partial-alpha M6C sources remain a test-only probe.
  material.colorNode = Fn(() => vec4(
    source.rgb.mul(throughput).mul(naturalFactor).mul(clamp(selectedCoverageFactor, 0, 1)),
    source.a,
  ))();

  const update = (state: GroundGlassPresentationNodeState): void => {
    if (!sameFilmWindow(state.coverage.filmWindow, state.naturalIllumination.filmWindow)) {
      throw new Error("M6 coverage and natural illumination must use the same physical film window");
    }
    const transform = resolveGroundGlassRttDisplayTransform(state.previewMode);
    flipX.value = transform.flipDisplayX ? 1 : 0;
    flipY.value = transform.flipDisplayY ? 1 : 0;
    filmCenterMm.value.set(
      state.coverage.filmWindow.centerXMm,
      state.coverage.filmWindow.centerYMm,
    );
    filmSizeMm.value.set(
      state.coverage.filmWindow.widthMm,
      state.coverage.filmWindow.heightMm,
    );
    throughput.value = Number.isFinite(state.throughputGain) && state.throughputGain >= 0
      ? state.throughputGain
      : 1;

    const illumination = state.naturalIllumination.enabled &&
      state.naturalIllumination.geometry?.kind === "parallel-cos4"
      ? state.naturalIllumination.geometry
      : null;
    naturalEnabled.value = illumination ? 1 : 0;
    naturalImageDistanceMm.value = illumination?.imageDistanceMm ?? 1;
    naturalOffsetMm.value.set(
      illumination?.opticalAxisOffsetXMm ?? 0,
      illumination?.opticalAxisOffsetYMm ?? 0,
    );

    const geometry = state.coverage.active ? state.coverage.geometry : null;
    coverageMode.value = geometry?.kind === "parallel-circle" ? 1
      : geometry?.kind === "nonparallel-conic" ? 2 : 0;
    coverageRadiusMm.value = geometry?.kind === "parallel-circle" ? geometry.radiusMm : 1;
    coverageOffsetMm.value.set(
      geometry?.kind === "parallel-circle" ? geometry.opticalAxisOffsetXMm : 0,
      geometry?.kind === "parallel-circle" ? geometry.opticalAxisOffsetYMm : 0,
    );
    coverageQuadratic.value.set(
      geometry?.kind === "nonparallel-conic" ? geometry.quadratic.a : 0,
      geometry?.kind === "nonparallel-conic" ? geometry.quadratic.b : 0,
      geometry?.kind === "nonparallel-conic" ? geometry.quadratic.c : 0,
    );
    coverageLinear.value.set(
      geometry?.kind === "nonparallel-conic" ? geometry.quadratic.d : 0,
      geometry?.kind === "nonparallel-conic" ? geometry.quadratic.e : 0,
      geometry?.kind === "nonparallel-conic" ? geometry.quadratic.f : 0,
    );
    coverageAxial.value.set(
      geometry?.kind === "nonparallel-conic" ? geometry.axial.x : 0,
      geometry?.kind === "nonparallel-conic" ? geometry.axial.y : 0,
      geometry?.kind === "nonparallel-conic" ? geometry.axial.constant : 1,
    );
    coverageEdgeFeatherMm.value = state.coverage.active && Number.isFinite(state.coverage.edgeFeatherMm)
      ? Math.max(0, state.coverage.edgeFeatherMm)
      : 0;
  };

  update(initialState);
  return { material, update };
};
