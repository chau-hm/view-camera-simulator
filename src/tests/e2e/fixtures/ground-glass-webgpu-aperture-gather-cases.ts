export const APERTURE_GATHER_CASES = {
  sourceWidthPx: 128,
  sourceHeightPx: 96,
  fullFilmWidthMm: 36,
  fullFilmHeightMm: 24,
  focalLengthMm: 50,
  focusedObjectDistanceMm: 500,
  lensCenterMm: [0, 0, 0] as const,
  lensNormal: [0, 0, 1] as const,
  lensBasisX: [1, 0, 0] as const,
  lensBasisY: [0, 1, 0] as const,
  filmPointMm: [0, 0, -55.55555555555556] as const,
  filmNormal: [0, 0, 1] as const,
  filmBasisX: [1, 0, 0] as const,
  filmBasisY: [0, 1, 0] as const,
  apertureFNumber: 1,
  maxApertureSamples: 64,
  goldenAngleRad: 2.399963229728653,
  depthToleranceFloorMm: 20,
  depthToleranceFraction: 0.015,
} as const;

export type FilmDimensions = Readonly<{ widthMm: number; heightMm: number }>;
export type SourceDimensions = Readonly<{ widthPx: number; heightPx: number }>;
export type PixelAxis = readonly [number, number];
export type PixelEllipse = Readonly<{ major: PixelAxis; minor: PixelAxis; clampScale: number }>;

/** Independent CPU equation reference for the physical-mm to source-pixel map. */
export const mapPhysicalEllipseToSourcePixels = (
  majorRadiusMm: number,
  minorRadiusMm: number,
  orientationRad: number,
  film: FilmDimensions,
  source: SourceDimensions,
): PixelEllipse => {
  if (!Number.isFinite(majorRadiusMm)
      || !Number.isFinite(minorRadiusMm)
      || majorRadiusMm < 0
      || minorRadiusMm < 0
      || !Number.isFinite(orientationRad)
      || !Number.isFinite(film.widthMm)
      || !Number.isFinite(film.heightMm)
      || film.widthMm <= 0
      || film.heightMm <= 0
      || !Number.isInteger(source.widthPx)
      || !Number.isInteger(source.heightPx)
      || source.widthPx <= 0
      || source.heightPx <= 0) {
    throw new RangeError("Physical aperture sampling requires finite non-negative axes and positive film/source dimensions");
  }
  const cosine = Math.cos(orientationRad);
  const sine = Math.sin(orientationRad);
  const major: PixelAxis = [
    cosine * majorRadiusMm * source.widthPx / film.widthMm,
    -sine * majorRadiusMm * source.heightPx / film.heightMm,
  ];
  const minor: PixelAxis = [
    -sine * minorRadiusMm * source.widthPx / film.widthMm,
    -cosine * minorRadiusMm * source.heightPx / film.heightMm,
  ];
  return { major, minor, clampScale: 1 };
};

/** Renderer cap is applied after physical source-pixel mapping. */
export const clampPixelEllipse = (ellipse: PixelEllipse, maximumRadiusPx: number): PixelEllipse => {
  const extent = Math.max(
    Math.hypot(...ellipse.major),
    Math.hypot(...ellipse.minor),
  );
  const clampScale = extent > 0 ? Math.min(1, maximumRadiusPx / extent) : 1;
  return { ...ellipse, clampScale };
};

/** Equal-area golden-angle disk proposal used by the GPU gather pass. */
export const goldenAngleDiskSample = (index: number, sampleCount: number): PixelAxis => {
  if (!Number.isInteger(index) || index < 0 || index >= sampleCount || sampleCount <= 0) {
    throw new RangeError("Aperture sample index is outside the active sample count");
  }
  const radius = Math.sqrt((index + 0.5) / sampleCount);
  const angle = (index + 0.5) * APERTURE_GATHER_CASES.goldenAngleRad;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
};

/** Positive coordinates follow top-origin source pixels: +X right, +Y down. */
export const orientedSampleOffsetPx = (
  disk: PixelAxis,
  ellipse: PixelEllipse,
): PixelAxis => [
  (ellipse.major[0] * disk[0] + ellipse.minor[0] * disk[1]) * ellipse.clampScale,
  (ellipse.major[1] * disk[0] + ellipse.minor[1] * disk[1]) * ellipse.clampScale,
];

export const ellipseMembership = (
  offsetPx: PixelAxis,
  ellipse: PixelEllipse,
): number => {
  const majorX = ellipse.major[0] * ellipse.clampScale;
  const majorY = ellipse.major[1] * ellipse.clampScale;
  const minorX = ellipse.minor[0] * ellipse.clampScale;
  const minorY = ellipse.minor[1] * ellipse.clampScale;
  const determinant = majorX * minorY - majorY * minorX;
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= 1e-9) return 0;
  const localX = (offsetPx[0] * minorY - offsetPx[1] * minorX) / determinant;
  const localY = (-offsetPx[0] * majorY + offsetPx[1] * majorX) / determinant;
  return Math.hypot(localX, localY) <= 1 ? 1 : 0;
};

/** WebGL-compatible renderer approximation; not part of canonical optics. */
export const depthToleranceMm = (centerDistanceMm: number): number =>
  Math.max(
    APERTURE_GATHER_CASES.depthToleranceFloorMm,
    centerDistanceMm * APERTURE_GATHER_CASES.depthToleranceFraction,
  );

export const farDepthSampleWeight = (input: {
  centerDistanceMm: number;
  sampleDistanceMm: number;
  sampleSignedCocMm: number;
  sampleValid: boolean;
}): number => {
  const tolerance = depthToleranceMm(input.centerDistanceMm);
  return input.sampleValid
    && input.sampleSignedCocMm >= -0.00001
    && input.sampleDistanceMm >= input.centerDistanceMm - tolerance
    ? 1
    : 0;
};

export const nearDepthSampleWeight = (input: {
  centerDistanceMm: number;
  sampleDistanceMm: number;
  centerSignedCocMm: number;
  sampleSignedCocMm: number;
  sampleValid: boolean;
}): number => {
  const tolerance = depthToleranceMm(input.centerDistanceMm);
  if (!input.sampleValid || input.sampleSignedCocMm >= -0.00001) return 0;
  if (input.centerSignedCocMm < -0.00001
      && input.sampleDistanceMm > input.centerDistanceMm + tolerance) return 0;
  return 1;
};

/** Sparse near-proposal coverage estimate used by the research near layer. */
export const estimateNearCoverage = (input: {
  acceptedWeight: number;
  footprintAreaRatio: number;
  sampleCount: number;
  centerForeground: boolean;
}): number => {
  if (input.centerForeground) return 1;
  if (input.sampleCount <= 0 || input.acceptedWeight <= 0) return 0;
  const areaFloor = 1 / input.sampleCount;
  const compensation = Math.min(
    input.sampleCount,
    1 / Math.max(input.footprintAreaRatio, areaFloor),
  );
  const mass = input.acceptedWeight * compensation;
  return Math.min(1, Math.max(0, 1 - Math.exp(-mass / input.sampleCount)));
};

export type GatherReferencePatch = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
  colors: readonly (readonly [number, number, number])[];
  physical: readonly (readonly [number, number, number, number])[];
  validity: readonly number[];
  worldAndDepth: readonly (readonly [number, number, number, number])[];
}>;

export type GatherReferenceProbe = Readonly<{
  layer: "far" | "near";
  x: number;
  y: number;
  source: SourceDimensions;
  film: FilmDimensions;
  sampleCount: number;
  maximumCoCRadiusPx: number;
  cameraZMm: number;
  patch: GatherReferencePatch;
  actualRgba: readonly [number, number, number, number];
}>;

const patchIndexAt = (patch: GatherReferencePatch, x: number, y: number): number => {
  const localX = x - patch.left;
  const localY = y - patch.top;
  if (localX < 0 || localY < 0 || localX >= patch.width || localY >= patch.height) {
    throw new RangeError(`CPU gather reference sample (${x}, ${y}) is outside its captured input patch`);
  }
  return localY * patch.width + localX;
};

/**
 * CPU reference for one fixed full-resolution output pixel. Its inputs are
 * native GPU readbacks, while all sampling positions, weights, and layer
 * accumulation are independently calculated here.
 */
export const referenceGatherProbe = (probe: GatherReferenceProbe): {
  rgba: [number, number, number, number];
  maxRgbError: number;
  alphaError: number;
} => {
  const { source, film, sampleCount, maximumCoCRadiusPx, cameraZMm, patch } = probe;
  if (probe.x < 0 || probe.y < 0 || probe.x >= source.widthPx || probe.y >= source.heightPx) {
    throw new RangeError("CPU gather reference output pixel is outside the source dimensions");
  }
  const pixelAtUv = (u: number, v: number) => {
    const clampedU = Math.min(1, Math.max(0, u));
    const clampedV = Math.min(1, Math.max(0, v));
    return [
      Math.min(source.widthPx - 1, Math.floor(clampedU * source.widthPx)),
      Math.min(source.heightPx - 1, Math.floor(clampedV * source.heightPx)),
    ] as const;
  };
  const read = (x: number, y: number) => {
    const index = patchIndexAt(patch, x, y);
    return {
      color: patch.colors[index]!,
      physical: patch.physical[index]!,
      valid: patch.validity[index] === 1,
      world: patch.worldAndDepth[index]!,
    };
  };
  const center = read(probe.x, probe.y);
  const centerDistance = Math.abs(center.world[2] - cameraZMm);
  const centerNear = center.valid && center.physical[0] < -0.00001;
  const centerFar = center.valid && center.physical[0] > 0.00001;
  const accumulated = [0, 0, 0];
  let weightAccum = 0;
  let coverageMass = 0;
  const activeSamples = Math.max(sampleCount, 1);
  const footprintWeight = (offset: PixelAxis, ellipse: PixelEllipse): number => {
    const major = ellipse.major.map((value) => value * ellipse.clampScale) as [number, number];
    const minor = ellipse.minor.map((value) => value * ellipse.clampScale) as [number, number];
    const determinant = major[0] * minor[1] - major[1] * minor[0];
    if (Math.abs(determinant) <= 1e-6) return 0;
    const localX = (offset[0] * minor[1] - offset[1] * minor[0]) / determinant;
    const localY = (offset[1] * major[0] - offset[0] * major[1]) / determinant;
    const radius = Math.hypot(localX, localY);
    const t = Math.min(1, Math.max(0, (radius - 1) / 0.02));
    const smooth = t * t * (3 - 2 * t);
    return 1 - smooth;
  };

  if (probe.layer === "far") {
    if (centerFar) {
      for (let channel = 0; channel < 3; channel += 1) accumulated[channel] = center.color[channel]!;
      weightAccum = 1;
    }
    const centerEllipse = clampPixelEllipse(
      mapPhysicalEllipseToSourcePixels(
        center.physical[1], center.physical[2], center.physical[3] * Math.PI, film, source,
      ),
      maximumCoCRadiusPx,
    );
    for (let index = 0; index < sampleCount; index += 1) {
      const disk = goldenAngleDiskSample(index, activeSamples);
      const offset = orientedSampleOffsetPx(disk, centerEllipse);
      const [sampleX, sampleY] = pixelAtUv(
        (probe.x + 0.5 + offset[0]) / source.widthPx,
        (probe.y + 0.5 + offset[1]) / source.heightPx,
      );
      const sample = read(sampleX, sampleY);
      const sampleDistance = Math.abs(sample.world[2] - cameraZMm);
      const accepted = centerFar
        && sample.valid
        && sample.world[3] < 1
        && sample.physical[0] >= -0.00001
        && sampleDistance >= centerDistance - depthToleranceMm(centerDistance);
      if (accepted) {
        for (let channel = 0; channel < 3; channel += 1) accumulated[channel] += sample.color[channel]!;
        weightAccum += 1;
      }
    }
    const color = weightAccum > 1e-6
      ? accumulated.map((value) => value / weightAccum) as [number, number, number]
      : [...center.color] as [number, number, number];
    const rgba: [number, number, number, number] = [...color, 1];
    return {
      rgba,
      maxRgbError: Math.max(...color.map((value, channel) => Math.abs(value - probe.actualRgba[channel]!))),
      alphaError: Math.abs(1 - probe.actualRgba[3]),
    };
  }

  if (centerNear) {
    for (let channel = 0; channel < 3; channel += 1) accumulated[channel] = center.color[channel]!;
    weightAccum = 1;
  }
  for (let index = 0; index < sampleCount; index += 1) {
    const disk = goldenAngleDiskSample(index, activeSamples);
    const offset: PixelAxis = [disk[0] * maximumCoCRadiusPx, disk[1] * maximumCoCRadiusPx];
    const [sampleX, sampleY] = pixelAtUv(
      (probe.x + 0.5 + offset[0]) / source.widthPx,
      (probe.y + 0.5 + offset[1]) / source.heightPx,
    );
    const sample = read(sampleX, sampleY);
    const sampleDistance = Math.abs(sample.world[2] - cameraZMm);
    const sampleEllipse = clampPixelEllipse(
      mapPhysicalEllipseToSourcePixels(
        sample.physical[1], sample.physical[2], sample.physical[3] * Math.PI, film, source,
      ),
      maximumCoCRadiusPx,
    );
    const member = footprintWeight(offset, sampleEllipse);
    const behindNearCenter = !centerNear
      || sampleDistance <= centerDistance + depthToleranceMm(centerDistance);
    const accepted = sample.valid
      && sample.world[3] < 1
      && sample.physical[0] < -0.00001
      && member > 0
      && behindNearCenter;
    const weight = accepted ? member : 0;
    if (weight > 0) {
      for (let channel = 0; channel < 3; channel += 1) accumulated[channel] += sample.color[channel]! * weight;
      weightAccum += weight;
      const major = sampleEllipse.major.map((value) => value * sampleEllipse.clampScale) as [number, number];
      const minor = sampleEllipse.minor.map((value) => value * sampleEllipse.clampScale) as [number, number];
      const area = Math.abs(major[0] * minor[1] - major[1] * minor[0]);
      const areaRatio = Math.min(1, Math.max(0, area / Math.max(maximumCoCRadiusPx * maximumCoCRadiusPx, 1e-6)));
      const areaFloor = 1 / activeSamples;
      const compensation = Math.min(activeSamples, 1 / Math.max(areaRatio, areaFloor));
      coverageMass += weight * compensation;
    }
  }
  const color = weightAccum > 1e-6
    ? accumulated.map((value) => value / weightAccum) as [number, number, number]
    : [0, 0, 0] as [number, number, number];
  const alpha = centerNear
    ? 1
    : Math.min(1, Math.max(0, 1 - Math.exp(-coverageMass / activeSamples)));
  const rgba: [number, number, number, number] = [...color, alpha];
  return {
    rgba,
    maxRgbError: Math.max(...color.map((value, channel) => Math.abs(value - probe.actualRgba[channel]!))),
    alphaError: Math.abs(alpha - probe.actualRgba[3]),
  };
};
