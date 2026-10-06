import * as THREE from "three";

/**
 * A renderer-local radiance input that keeps its own apparent focus positions.
 * `radiance` is already weighted linear-light radiance; contributors are added
 * after their independent focus processing. This type intentionally belongs to
 * the Ground Glass renderer and must not cross scene/domain APIs.
 */
export type GroundGlassRadianceContribution = Readonly<{
  id: string;
  /**
   * Values are linear-light radiance with any producer weight already applied.
   * RGB must be zero wherever the matching apparent-position sample is invalid.
   */
  radianceSemantics: "preweighted-linear-radiance";
  radiance: THREE.Texture;
  /** RGBA world-position samples in renderer metres; alpha below 0.5 is invalid. */
  apparentWorldPosition: THREE.Texture;
  /**
   * Optional opaque visibility input for this contribution's existing gather
   * policy. It is never compared against another contribution's depth and is
   * not the source of its physical focus position.
   */
  gatherVisibilityDepth?: THREE.Texture;
}>;

export type ResolvedGroundGlassRadianceContributions = Readonly<{
  contributions: readonly GroundGlassRadianceContribution[];
  omittedOptionalIds: readonly string[];
}>;

const textureDimensions = (texture: THREE.Texture): readonly [number, number] | null => {
  if (!texture || texture.isTexture !== true) return null;
  const image = texture.image as { width?: unknown; height?: unknown } | undefined;
  const width = image?.width;
  const height = image?.height;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) return null;
  return [width, height];
};

const hasMatchingContributionDimensions = (
  contribution: GroundGlassRadianceContribution,
): boolean => {
  const worldPositionType = contribution.apparentWorldPosition?.type;
  if (
    contribution.apparentWorldPosition?.format !== THREE.RGBAFormat ||
    (worldPositionType !== THREE.FloatType && worldPositionType !== THREE.HalfFloatType)
  ) return false;
  const radianceDimensions = textureDimensions(contribution.radiance);
  const positionDimensions = textureDimensions(contribution.apparentWorldPosition);
  if (
    !radianceDimensions ||
    !positionDimensions ||
    radianceDimensions[0] !== positionDimensions[0] ||
    radianceDimensions[1] !== positionDimensions[1]
  ) return false;
  if (!contribution.gatherVisibilityDepth) return true;
  const depthDimensions = textureDimensions(contribution.gatherVisibilityDepth);
  return Boolean(
    depthDimensions &&
    ((depthDimensions[0] === radianceDimensions[0] &&
      depthDimensions[1] === radianceDimensions[1]) ||
      (depthDimensions[0] === 1 && depthDimensions[1] === 1)),
  );
};

/**
 * Resolve renderer-local inputs before allocating per-contribution passes.
 * The direct source is mandatory and invalid direct data is an error. Invalid
 * optional inputs are omitted, leaving the ordinary direct-only result. No
 * dimensions, targets, materials, or renderer objects are manufactured here.
 */
export const resolveGroundGlassRadianceContributions = (
  direct: GroundGlassRadianceContribution,
  optional: readonly GroundGlassRadianceContribution[] = [],
): ResolvedGroundGlassRadianceContributions => {
  if (
    !direct.id ||
    direct.radianceSemantics !== "preweighted-linear-radiance" ||
    !hasMatchingContributionDimensions(direct)
  ) {
    throw new Error("Ground Glass direct radiance contribution is invalid");
  }

  const contributions: GroundGlassRadianceContribution[] = [direct];
  const omittedOptionalIds: string[] = [];
  const seenIds = new Set([direct.id]);
  for (const contribution of optional) {
    if (
      !contribution.id ||
      contribution.radianceSemantics !== "preweighted-linear-radiance" ||
      seenIds.has(contribution.id) ||
      !hasMatchingContributionDimensions(contribution)
    ) {
      omittedOptionalIds.push(contribution.id || "<missing-id>");
      continue;
    }
    seenIds.add(contribution.id);
    contributions.push(contribution);
  }

  return { contributions, omittedOptionalIds };
};
