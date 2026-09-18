export const DEFAULT_REFERENCE_F_NUMBER = 11;

type PositiveFiniteNumber = number | null | undefined;

const isPositiveFinite = (value: PositiveFiniteNumber): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export type GroundGlassRelativeIlluminanceInput = Readonly<{
  apertureFNumber: number;
  referenceFNumber?: number;
  focalLengthMm?: PositiveFiniteNumber;
  imageDistanceMm?: PositiveFiniteNumber;
}>;

/**
 * Resolve the relative aperture throughput used by the Ground Glass.
 *
 * Illuminance is proportional to 1 / N² and is normalized to one at the
 * reference f-number. Invalid aperture inputs return the neutral gain so a
 * renderer cannot invent a brightness change from malformed state.
 */
export const resolveGroundGlassApertureIlluminance = ({
  apertureFNumber,
  referenceFNumber = DEFAULT_REFERENCE_F_NUMBER,
}: {
  apertureFNumber: number;
  referenceFNumber?: number;
}): number => {
  if (!isPositiveFinite(apertureFNumber) || !isPositiveFinite(referenceFNumber)) {
    return 1;
  }

  return (referenceFNumber / apertureFNumber) ** 2;
};

/**
 * Resolve the central Ground Glass illuminance loss caused by bellows
 * extension. A missing, non-finite, or non-physical image distance leaves
 * this component neutral; the caller may still apply a valid aperture gain.
 *
 * For the symmetric thin-lens states used by the simulator this is
 * (f / v)², the inverse of the bellows factor (v / f)².
 */
export const resolveGroundGlassBellowsIlluminance = ({
  focalLengthMm,
  imageDistanceMm,
}: {
  focalLengthMm?: PositiveFiniteNumber;
  imageDistanceMm?: PositiveFiniteNumber;
}): number => {
  if (
    !isPositiveFinite(focalLengthMm) ||
    !isPositiveFinite(imageDistanceMm) ||
    imageDistanceMm < focalLengthMm
  ) {
    return 1;
  }

  const gain = (focalLengthMm / imageDistanceMm) ** 2;
  return Number.isFinite(gain) && gain >= 0 ? gain : 1;
};

/**
 * Resolve the combined relative Ground Glass illuminance from aperture and
 * trusted canonical lens/film geometry.
 *
 * `imageDistanceMm` is the actual lens-to-film distance consumed by the
 * physical Ground Glass path. When optics are in a fallback state, callers
 * should omit it so the bellows component remains neutral rather than
 * exposing a fabricated extension loss.
 */
export const resolveGroundGlassRelativeIlluminance = ({
  apertureFNumber,
  referenceFNumber = DEFAULT_REFERENCE_F_NUMBER,
  focalLengthMm,
  imageDistanceMm,
}: GroundGlassRelativeIlluminanceInput): number => {
  if (!isPositiveFinite(apertureFNumber) || !isPositiveFinite(referenceFNumber)) {
    return 1;
  }

  const apertureGain = resolveGroundGlassApertureIlluminance({
    apertureFNumber,
    referenceFNumber,
  });
  const bellowsGain = resolveGroundGlassBellowsIlluminance({
    focalLengthMm,
    imageDistanceMm,
  });
  const gain = apertureGain * bellowsGain;

  return Number.isFinite(gain) && gain >= 0 ? gain : 1;
};
