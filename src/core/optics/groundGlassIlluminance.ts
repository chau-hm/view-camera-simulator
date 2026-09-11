const DEFAULT_REFERENCE_F_NUMBER = 11;

/**
 * Resolve relative Ground Glass illuminance for a lens aperture.
 *
 * The result is normalized to one at the reference f-number and models only
 * the relative aperture throughput: illuminance is proportional to 1 / N².
 */
export const resolveGroundGlassRelativeIlluminance = (
  apertureFNumber: number,
  referenceFNumber = DEFAULT_REFERENCE_F_NUMBER,
): number => {
  if (!Number.isFinite(apertureFNumber) || apertureFNumber <= 0) {
    throw new Error("Invalid apertureFNumber");
  }
  if (!Number.isFinite(referenceFNumber) || referenceFNumber <= 0) {
    throw new Error("Invalid referenceFNumber");
  }

  return (referenceFNumber / apertureFNumber) ** 2;
};
