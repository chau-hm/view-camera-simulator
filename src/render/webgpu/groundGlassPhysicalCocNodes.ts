import * as THREE from "three";
import {
  abs,
  atan,
  cross,
  dot,
  floor,
  float,
  fract,
  getViewPosition,
  int,
  length,
  max,
  select,
  sqrt,
  texture,
  uniform,
  uniformArray,
  uv,
  vec2,
  vec4,
} from "three/tsl";
import type { Vec3 } from "../../types/optics";
import type { GroundGlassDofRenderState } from "../groundGlassDofRenderState";
import {
  GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16,
  GROUND_GLASS_PHYSICAL_COC_VALIDITY,
} from "./groundGlassPhysicalCocContract";

export type GroundGlassPhysicalCocState = Readonly<{
  dof: GroundGlassDofRenderState;
}>;

export type GroundGlassPhysicalCocProbeUv = Readonly<{
  id: string;
  u: number;
  v: number;
  expectedWorldM?: readonly [number, number, number] | null;
  expectedSurfaceId?: string | null;
  /** Test-seam-only controlled vector evaluated by the same TSL physical kernel. */
  controlledObjectPointMm?: readonly [number, number, number] | null;
  /** Authoritative exact U=f identity for a controlled diagnostic vector only. */
  explicitParallelLimitIdentity?: boolean;
}>;

const toVector = (value: Vec3, scale = 1): THREE.Vector3 =>
  new THREE.Vector3(value.x * scale, value.y * scale, value.z * scale);

/**
 * Build the focused M4 physical data kernel. With no probes, each target pixel
 * samples its matching top-origin scene-depth pixel. A probe list instead
 * creates a bounded one-row diagnostic pass using explicit top-origin UVs.
 *
 * Points and distances in the optics uniforms are millimetres. The reconstructed
 * Three.js world position is metres and is converted exactly once before use.
 */
export const createGroundGlassPhysicalCocNodes = (input: Readonly<{
  depthTexture: THREE.DepthTexture;
  state: GroundGlassPhysicalCocState;
  probes?: readonly GroundGlassPhysicalCocProbeUv[];
}>) => {
  const projectionInverse = uniform(new THREE.Matrix4());
  const cameraWorld = uniform(new THREE.Matrix4());
  const lensCenterMm = uniform(new THREE.Vector3());
  const lensNormalInput = uniform(new THREE.Vector3());
  const lensBasisXInput = uniform(new THREE.Vector3());
  const lensBasisYInput = uniform(new THREE.Vector3());
  const filmPointMm = uniform(new THREE.Vector3());
  const filmNormalInput = uniform(new THREE.Vector3());
  const filmBasisXInput = uniform(new THREE.Vector3());
  const filmBasisYInput = uniform(new THREE.Vector3());
  const focalLengthMm = uniform(1);
  const apertureFNumber = uniform(1);

  const probeCount = input.probes?.length ?? 0;
  if (probeCount === 0 && input.probes !== undefined) {
    throw new Error("Physical CoC diagnostic probes must not be empty");
  }
  const probeUs = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.u), "float")
    : null;
  const probeVs = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.v), "float")
    : null;
  const controlledFlags = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.controlledObjectPointMm ? 1 : 0), "float")
    : null;
  const controlledX = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.controlledObjectPointMm?.[0] ?? 0), "float")
    : null;
  const controlledY = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.controlledObjectPointMm?.[1] ?? 0), "float")
    : null;
  const controlledZ = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.controlledObjectPointMm?.[2] ?? 0), "float")
    : null;
  const parallelLimitFlags = probeCount > 0
    ? uniformArray<"float">(input.probes!.map((probe) => probe.explicitParallelLimitIdentity ? 1 : 0), "float")
    : null;
  const probeIndex = probeCount > 0 ? int(floor(uv().x.mul(probeCount))) : null;
  const sourceUv = probeCount > 0
    ? vec2(probeUs!.element(probeIndex!), probeVs!.element(probeIndex!))
    : vec2(uv().x, uv().y.oneMinus());
  const sampledDepth = texture(input.depthTexture, sourceUv).r;
  const viewPosition = getViewPosition(sourceUv, sampledDepth, projectionInverse);
  const worldPositionM = cameraWorld.mul(vec4(viewPosition, 1)).xyz;
  const reconstructedObjectPointMm = worldPositionM.mul(1000);
  const usesControlledObjectPoint = probeCount > 0
    ? controlledFlags!.element(probeIndex!).greaterThan(0.5)
    : float(0).greaterThan(0.5);
  const controlledPointMm = probeCount > 0
    ? vec4(
        controlledX!.element(probeIndex!),
        controlledY!.element(probeIndex!),
        controlledZ!.element(probeIndex!),
        0,
      ).xyz
    : vec4(0, 0, 0, 0).xyz;
  const objectPointMm = select(usesControlledObjectPoint, controlledPointMm, reconstructedObjectPointMm);
  const explicitParallelLimitIdentity = probeCount > 0
    ? parallelLimitFlags!.element(probeIndex!).greaterThan(0.5).and(usesControlledObjectPoint)
    : float(0).greaterThan(0.5);

  const makeBasis = (normalInput: typeof lensNormalInput, primaryInput: typeof lensBasisXInput, secondaryInput: typeof lensBasisYInput) => {
    const normalLength = length(normalInput);
    const normal = normalInput.div(max(normalLength, 1e-7));
    const projectedPrimary = primaryInput.sub(normal.mul(dot(primaryInput, normal)));
    const projectedSecondary = secondaryInput.sub(normal.mul(dot(secondaryInput, normal)));
    const primaryLength = length(projectedPrimary);
    const projected = select(primaryLength.greaterThan(1e-7), projectedPrimary, projectedSecondary);
    const projectedLength = length(projected);
    const x = projected.div(max(projectedLength, 1e-7));
    const yUnnormalized = cross(normal, x);
    const yLength = length(yUnnormalized);
    const yCandidate = yUnnormalized.div(max(yLength, 1e-7));
    const y = select(dot(yCandidate, secondaryInput).lessThan(0), yCandidate.mul(-1), yCandidate);
    const valid = normalLength.greaterThan(1e-7)
      .and(projectedLength.greaterThan(1e-7))
      .and(yLength.greaterThan(1e-7));
    return { normal, x, y, valid };
  };

  const lens = makeBasis(lensNormalInput, lensBasisXInput, lensBasisYInput);
  const film = makeBasis(filmNormalInput, filmBasisXInput, filmBasisYInput);
  const objectDelta = objectPointMm.sub(lensCenterMm);
  const objectDistanceMm = dot(objectDelta, lens.normal);
  const lateralOffsetMm = objectDelta.sub(lens.normal.mul(objectDistanceMm));
  const imageDenominator = objectDistanceMm.sub(focalLengthMm);
  // Preserve every representable finite U-f. Only a controlled diagnostic may
  // supply authority for the exact parallel-image limit; scene depth cannot.
  const finiteImage = abs(imageDenominator).greaterThan(0);
  const parallelImageLimit = imageDenominator.equal(0).and(explicitParallelLimitIdentity);
  const focalBranchResolved = finiteImage.or(parallelImageLimit);
  const safeObjectDistance = select(abs(objectDistanceMm).greaterThan(1e-7), objectDistanceMm, 1);
  const safeImageDenominator = select(finiteImage, imageDenominator, 1);
  const idealImageDistanceMm = focalLengthMm.mul(objectDistanceMm).div(safeImageDenominator);
  const finiteImagePoint = lensCenterMm
    .sub(lens.normal.mul(idealImageDistanceMm))
    .sub(lateralOffsetMm.mul(idealImageDistanceMm.div(safeObjectDistance)));
  const finiteDirectionInput = select(
    idealImageDistanceMm.lessThan(0),
    lensCenterMm.sub(finiteImagePoint),
    finiteImagePoint.sub(lensCenterMm),
  );
  const parallelDirectionInput = lens.normal.mul(-1).sub(lateralOffsetMm.div(safeObjectDistance));
  const imageDirectionInput = select(finiteImage, finiteDirectionInput, parallelDirectionInput);
  const imageDirection = imageDirectionInput.div(max(length(imageDirectionInput), 1e-7));
  const imagePoint = select(finiteImage, finiteImagePoint, lensCenterMm);
  const filmDenominator = dot(imageDirection, film.normal);
  const safeFilmDenominator = select(abs(filmDenominator).greaterThan(1e-7), filmDenominator, 1);
  const centerDistance = dot(filmPointMm.sub(lensCenterMm), film.normal).div(safeFilmDenominator);
  const filmDelta = filmPointMm.sub(lensCenterMm);
  const apertureRadiusMm = focalLengthMm.div(apertureFNumber.mul(2));
  const apertureX = lens.x.mul(apertureRadiusMm);
  const apertureY = lens.y.mul(apertureRadiusMm);
  const imageVector = imagePoint.sub(lensCenterMm);
  const finiteFilmDenominator = dot(imageVector, film.normal);
  const safeFiniteFilmDenominator = select(
    abs(finiteFilmDenominator).greaterThan(1e-7),
    finiteFilmDenominator,
    1,
  );
  const rayParameter = dot(filmDelta, film.normal).div(safeFiniteFilmDenominator);
  const mapFiniteOffset = (apertureOffset: typeof apertureX) => apertureOffset
    .sub(imageVector.mul(dot(apertureOffset, film.normal).div(safeFiniteFilmDenominator)))
    .mul(float(1).sub(rayParameter));
  const mapParallelOffset = (apertureOffset: typeof apertureX) => apertureOffset
    .sub(imageDirection.mul(dot(apertureOffset, film.normal).div(safeFilmDenominator)));
  const mappedX = select(finiteImage, mapFiniteOffset(apertureX), mapParallelOffset(apertureX));
  const mappedY = select(finiteImage, mapFiniteOffset(apertureY), mapParallelOffset(apertureY));
  const matrix00 = dot(mappedX, film.x);
  const matrix10 = dot(mappedX, film.y);
  const matrix01 = dot(mappedY, film.x);
  const matrix11 = dot(mappedY, film.y);
  const covariance00 = matrix00.mul(matrix00).add(matrix01.mul(matrix01));
  const covariance01 = matrix00.mul(matrix10).add(matrix01.mul(matrix11));
  const covariance11 = matrix10.mul(matrix10).add(matrix11.mul(matrix11));
  const traceHalf = covariance00.add(covariance11).mul(0.5);
  const discriminant = length(vec2(covariance00.sub(covariance11).mul(0.5), covariance01));
  const majorEigenvalue = traceHalf.add(discriminant);
  const minorEigenvalue = traceHalf.sub(discriminant);
  const axesValid = majorEigenvalue.greaterThanEqual(0)
    .and(minorEigenvalue.greaterThanEqual(0))
    .and(majorEigenvalue.greaterThanEqual(minorEigenvalue));
  const majorRadiusMm = sqrt(max(0, majorEigenvalue));
  const minorRadiusMm = sqrt(max(0, minorEigenvalue));
  const orientationVector = vec2(covariance01.mul(2), covariance00.sub(covariance11));
  const orientationVectorDefined = length(orientationVector).greaterThan(1e-12);
  const orientationPrincipalAngleRad = atan(
    select(orientationVectorDefined, orientationVector.x, 0),
    select(orientationVectorDefined, orientationVector.y, 1),
  ).mul(0.5);
  const orientationDefined = majorRadiusMm.sub(minorRadiusMm).greaterThan(1e-7)
    .and(orientationVectorDefined);
  const orientationUnwrappedAngleRad = select(orientationDefined, orientationPrincipalAngleRad, 0);
  const orientationNormalized = select(
    orientationDefined,
    fract(orientationUnwrappedAngleRad.div(Math.PI)),
    0,
  );
  const imagePlaneDeltaMm = dot(imagePoint.sub(filmPointMm), film.normal);
  const finiteSide = select(
    abs(imagePlaneDeltaMm).greaterThan(1e-7),
    select(imagePlaneDeltaMm.lessThan(0), -1, 1),
    0,
  );
  const signedSide = select(parallelImageLimit, -1, finiteSide);
  const signedCoCDiameterMm = signedSide.mul(2).mul(sqrt(max(0, majorRadiusMm.mul(minorRadiusMm))));

  // Depth is WebGPU's [0,1] value; exact clear depth is the sole no-depth
  // sentinel. Near-far-clip values remain eligible for reconstruction.
  const depthValid = sampledDepth.lessThan(1).or(usesControlledObjectPoint);
  const geometryBaseValid = lens.valid
    .and(film.valid)
    .and(objectDistanceMm.greaterThan(1e-7))
    .and(focalLengthMm.greaterThan(0))
    .and(apertureFNumber.greaterThan(0))
    .and(length(imageDirectionInput).greaterThan(1e-7))
    .and(centerDistance.greaterThan(1e-14))
    .and(abs(filmDenominator).greaterThan(1e-7));
  const branchDenominatorValid = select(
    finiteImage,
    abs(finiteFilmDenominator).greaterThan(1e-7),
    abs(filmDenominator).greaterThan(1e-7),
  );
  const geometryValid = geometryBaseValid
    .and(focalBranchResolved)
    .and(branchDenominatorValid)
    .and(axesValid);
  const physicalValid = depthValid.and(geometryValid);
  const storageRepresentable = abs(signedCoCDiameterMm).lessThanEqual(GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16)
    .and(majorRadiusMm.lessThanEqual(GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16))
    .and(minorRadiusMm.lessThanEqual(GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16))
    .and(orientationNormalized.greaterThanEqual(0))
    .and(orientationNormalized.lessThanEqual(1));
  const storeValid = physicalValid.and(storageRepresentable);
  const rawFootprint = vec4(
    select(physicalValid, signedCoCDiameterMm, 0),
    select(physicalValid, majorRadiusMm, 0),
    select(physicalValid, minorRadiusMm, 0),
    select(physicalValid, orientationNormalized, 0),
  );
  const storedFootprint = vec4(
    select(storeValid, signedCoCDiameterMm, 0),
    select(storeValid, majorRadiusMm, 0),
    select(storeValid, minorRadiusMm, 0),
    select(storeValid, orientationNormalized, 0),
  );
  const validityCode = select(
    depthValid,
    select(
      geometryBaseValid,
      select(
        focalBranchResolved,
        select(
          branchDenominatorValid.and(axesValid),
          select(
            storageRepresentable,
            GROUND_GLASS_PHYSICAL_COC_VALIDITY.valid,
            GROUND_GLASS_PHYSICAL_COC_VALIDITY.outsideBinary16Range,
          ),
          GROUND_GLASS_PHYSICAL_COC_VALIDITY.invalidGeometry,
        ),
        GROUND_GLASS_PHYSICAL_COC_VALIDITY.unresolvedFocalBoundary,
      ),
      GROUND_GLASS_PHYSICAL_COC_VALIDITY.invalidGeometry,
    ),
    GROUND_GLASS_PHYSICAL_COC_VALIDITY.noDepth,
  );
  const branchCode = select(
    finiteImage,
    select(imageDenominator.lessThan(0), 1, 3),
    select(parallelImageLimit, 2, 0),
  );
  const focalDiagnostics = vec4(
    objectDistanceMm,
    imageDenominator,
    branchCode,
    select(usesControlledObjectPoint, 1, 0),
  );

  const setState = (state: GroundGlassPhysicalCocState): void => {
    const dof = state.dof;
    projectionInverse.value.fromArray([...dof.camera.inverseProjectionMatrixElements]);
    cameraWorld.value.fromArray([...dof.camera.worldMatrixElements]);
    lensCenterMm.value.copy(toVector(dof.lens.centerWorldM, 1000));
    lensNormalInput.value.copy(toVector(dof.lens.planeNormal));
    lensBasisXInput.value.copy(toVector(dof.lens.planeBasisX));
    lensBasisYInput.value.copy(toVector(dof.lens.planeBasisY));
    filmPointMm.value.copy(toVector(dof.film.planePointWorldM, 1000));
    filmNormalInput.value.copy(toVector(dof.film.planeNormal));
    filmBasisXInput.value.copy(toVector(dof.film.planeBasisX));
    filmBasisYInput.value.copy(toVector(dof.film.planeBasisY));
    focalLengthMm.value = dof.optics.focalLengthMm;
    apertureFNumber.value = dof.optics.apertureFNumber;
  };
  setState(input.state);

  return {
    sourceUv,
    sampledDepth,
    worldPositionM,
    kernelObjectPositionM: objectPointMm.div(1000),
    rawFootprint,
    storedFootprint,
    validityCode,
    focalDiagnostics,
    usesControlledObjectPoint,
    setState,
  };
};

/** Samples completed physical/validity targets at bounded top-origin UVs. */
export const createGroundGlassPhysicalCocProbeSampleNodes = (input: Readonly<{
  physicalTexture: THREE.Texture;
  validityTexture: THREE.Texture;
  probes: readonly GroundGlassPhysicalCocProbeUv[];
}>) => {
  if (input.probes.length === 0) throw new Error("Physical CoC probe sampling requires at least one probe");
  const probeUs = uniformArray<"float">(input.probes.map((probe) => probe.u), "float");
  const probeVs = uniformArray<"float">(input.probes.map((probe) => probe.v), "float");
  const index = int(floor(uv().x.mul(input.probes.length)));
  const sourceUv = vec2(probeUs.element(index), probeVs.element(index));
  const storedFootprint = texture(input.physicalTexture, sourceUv);
  const validityCode = texture(input.validityTexture, sourceUv).r.mul(255);
  return { sourceUv, storedFootprint, validityCode };
};
