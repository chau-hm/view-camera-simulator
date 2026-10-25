/**
 * Pure CPU reference for Phase H B1 far reconstruction.
 *
 * This is a research/test oracle, not a renderer implementation. Its center
 * identities come from GPU provenance readbacks; it never manufactures a
 * gather-center identity from nominal coordinates.
 */

export type GroundGlassB1Dimensions = Readonly<{
  widthPx: number;
  heightPx: number;
}>;

export const GROUND_GLASS_B1_SELECTED_PATH = {
  sourceColorFallback: 0,
  farGather: 1,
} as const;

export type GroundGlassB1SelectedPath =
  (typeof GROUND_GLASS_B1_SELECTED_PATH)[keyof typeof GROUND_GLASS_B1_SELECTED_PATH];

/** Stable per-pixel reason codes; `farGatherAccepted` is the no-fallback case. */
export const GROUND_GLASS_B1_FALLBACK_REASON = {
  farGatherAccepted: 0,
  missingOrOutOfBoundsProvenance: 1,
  selectedCenterProvenanceMismatch: 2,
  invalidOrUnresolvedCenter: 3,
  selectedCenterNotFarEligible: 4,
  unusableGatherData: 5,
} as const;

export type GroundGlassB1FallbackReason =
  (typeof GROUND_GLASS_B1_FALLBACK_REASON)[keyof typeof GROUND_GLASS_B1_FALLBACK_REASON];

export const groundGlassB1FallbackReasonName = (
  reason: GroundGlassB1FallbackReason,
): string => {
  switch (reason) {
    case GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted: return "far-gather-accepted";
    case GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance:
      return "missing-or-out-of-bounds-provenance";
    case GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch:
      return "selected-center-provenance-mismatch";
    case GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter:
      return "invalid-or-unresolved-center";
    case GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible:
      return "selected-center-not-far-eligible";
    case GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData: return "unusable-gather-data";
    default: return assertNever(reason);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Ground Glass B1 reason: ${String(value)}`);
};

export type GroundGlassB1ReferenceInput = Readonly<{
  source: GroundGlassB1Dimensions;
  gather: GroundGlassB1Dimensions;
  /** Full-resolution scene color readback, four values per source pixel. */
  sourceRgba: Float32Array;
  /** Native far-gather target readback, four values per gather pixel. */
  gatherFarRgba: Float32Array;
  /** Full-resolution M4 physical texture readback, RGBA per source pixel. */
  physicalRgba: Float32Array;
  /** Full-resolution M4 validity texture readback, one code per source pixel. */
  validity: Uint8Array;
  /** Native selected gather IDs, [x,y] for each full-resolution source pixel. */
  observedSelectedGatherIds: ArrayLike<number>;
  /** Native selected-center source IDs, [x,y] for each source pixel. */
  observedSelectedCenterSourceIds: ArrayLike<number>;
  /** Native gather-center source IDs, [x,y] for each gather pixel. */
  observedGatherCenterSourceIds: ArrayLike<number>;
}>;

export type GroundGlassB1ReferenceResult = Readonly<{
  /** Reconstructed far layer; rejected pixels copy full-resolution source RGBA. */
  farRgba: Float32Array;
  /** Independently derived expected gather IDs, [x,y] for every source pixel. */
  expectedGatherIds: Int32Array;
  /** Exact CPU nominal-mapping conformance, separate from B1 eligibility/output. */
  nominalMappingMatches: Uint8Array;
  /** Valid observed GPU gather IDs, [x,y]; invalid identities are -1. */
  selectedGatherIds: Int32Array;
  /** Valid observed GPU center-source IDs, [x,y]; invalid identities are -1. */
  selectedCenterSourceIds: Int32Array;
  eligible: Uint8Array;
  selectedPath: Uint8Array;
  fallbackReason: Uint8Array;
  counts: Readonly<{
    nominalMappingMismatch: number;
    farGatherSelected: number;
    sourceColorFallback: number;
    missingOrOutOfBoundsProvenance: number;
    selectedCenterProvenanceMismatch: number;
    invalidOrUnresolvedCenter: number;
    selectedCenterNotFarEligible: number;
    unusableGatherData: number;
  }>;
}>;

const dimensionsAreValid = (dimensions: GroundGlassB1Dimensions): boolean =>
  Number.isSafeInteger(dimensions.widthPx)
  && Number.isSafeInteger(dimensions.heightPx)
  && dimensions.widthPx > 0
  && dimensions.heightPx > 0;

const isSourcePixel = (x: number, y: number, dimensions: GroundGlassB1Dimensions): boolean =>
  Number.isInteger(x) && Number.isInteger(y)
  && x >= 0 && y >= 0
  && x < dimensions.widthPx && y < dimensions.heightPx;

const isUsableRgba = (values: ArrayLike<number>, offset: number): boolean =>
  Number.isFinite(values[offset])
  && Number.isFinite(values[offset + 1])
  && Number.isFinite(values[offset + 2])
  && Number.isFinite(values[offset + 3]);

/**
 * Independently maps source pixel centers to gather texels using top-origin
 * normalized nearest-sampling intervals. This is an exact conformance metric;
 * the GPU-observed mapping and center provenance remain authoritative for B1.
 */
const expectedGatherPixel = (
  sourceX: number,
  sourceY: number,
  source: GroundGlassB1Dimensions,
  gather: GroundGlassB1Dimensions,
): readonly [number, number] => [
  Math.min(gather.widthPx - 1, Math.floor(((sourceX + 0.5) / source.widthPx) * gather.widthPx)),
  Math.min(gather.heightPx - 1, Math.floor(((sourceY + 0.5) / source.heightPx) * gather.heightPx)),
];

const idAt = (ids: ArrayLike<number>, offset: number): readonly [number, number] =>
  [ids[offset] ?? Number.NaN, ids[offset + 1] ?? Number.NaN];

/**
 * Reconstructs Phase H B1 from native readbacks.
 *
 * Fallback precedence is deliberate: missing/out-of-bounds selected gather or
 * center provenance; disagreement between the source-selected and
 * gather-center provenance passes; invalid/unresolved center; non-far center;
 * unusable far sample; accepted far sample. Nominal source-to-gather mapping
 * disagreement is reported separately and does not override the actual GPU
 * selected ID or provenance. All fallback cases copy the destination's own
 * source RGBA exactly.
 */
export const reconstructGroundGlassB1Reference = (
  input: GroundGlassB1ReferenceInput,
): GroundGlassB1ReferenceResult => {
  if (!dimensionsAreValid(input.source) || !dimensionsAreValid(input.gather)) {
    throw new RangeError("Ground Glass B1 reference requires positive safe-integer dimensions");
  }
  const sourcePixelCount = input.source.widthPx * input.source.heightPx;
  const gatherPixelCount = input.gather.widthPx * input.gather.heightPx;
  if (!Number.isSafeInteger(sourcePixelCount) || !Number.isSafeInteger(gatherPixelCount)) {
    throw new RangeError("Ground Glass B1 reference dimensions exceed safe array indexing");
  }
  if (input.sourceRgba.length !== sourcePixelCount * 4
      || input.physicalRgba.length !== sourcePixelCount * 4
      || input.validity.length !== sourcePixelCount
      || input.gatherFarRgba.length !== gatherPixelCount * 4
      || input.observedSelectedGatherIds.length !== sourcePixelCount * 2
      || input.observedSelectedCenterSourceIds.length !== sourcePixelCount * 2
      || input.observedGatherCenterSourceIds.length !== gatherPixelCount * 2) {
    throw new RangeError("Ground Glass B1 reference buffers do not match source/gather dimensions");
  }
  for (let offset = 0; offset < input.sourceRgba.length; offset += 1) {
    if (!Number.isFinite(input.sourceRgba[offset])) {
      throw new RangeError("Ground Glass B1 source-color fallback data must be finite");
    }
  }

  const farRgba = new Float32Array(sourcePixelCount * 4);
  const expectedGatherIds = new Int32Array(sourcePixelCount * 2);
  const nominalMappingMatches = new Uint8Array(sourcePixelCount);
  const selectedGatherIds = new Int32Array(sourcePixelCount * 2).fill(-1);
  const selectedCenterSourceIds = new Int32Array(sourcePixelCount * 2).fill(-1);
  const eligible = new Uint8Array(sourcePixelCount);
  const selectedPath = new Uint8Array(sourcePixelCount);
  const fallbackReason = new Uint8Array(sourcePixelCount);
  const counts = {
    nominalMappingMismatch: 0,
    farGatherSelected: 0,
    sourceColorFallback: 0,
    missingOrOutOfBoundsProvenance: 0,
    selectedCenterProvenanceMismatch: 0,
    invalidOrUnresolvedCenter: 0,
    selectedCenterNotFarEligible: 0,
    unusableGatherData: 0,
  };

  for (let sourceY = 0; sourceY < input.source.heightPx; sourceY += 1) {
    for (let sourceX = 0; sourceX < input.source.widthPx; sourceX += 1) {
      const sourceIndex = sourceY * input.source.widthPx + sourceX;
      const sourceOffset = sourceIndex * 4;
      const idOffset = sourceIndex * 2;
      const [expectedX, expectedY] = expectedGatherPixel(sourceX, sourceY, input.source, input.gather);
      expectedGatherIds[idOffset] = expectedX;
      expectedGatherIds[idOffset + 1] = expectedY;

      const [observedGatherX, observedGatherY] = idAt(input.observedSelectedGatherIds, idOffset);
      if (isSourcePixel(observedGatherX, observedGatherY, input.gather)) {
        selectedGatherIds[idOffset] = observedGatherX;
        selectedGatherIds[idOffset + 1] = observedGatherY;
      }
      const nominalMappingMatchesThisPixel = isSourcePixel(observedGatherX, observedGatherY, input.gather)
        && observedGatherX === expectedX
        && observedGatherY === expectedY;
      nominalMappingMatches[sourceIndex] = nominalMappingMatchesThisPixel ? 1 : 0;
      if (!nominalMappingMatchesThisPixel) counts.nominalMappingMismatch += 1;
      let reason: GroundGlassB1FallbackReason;
      if (!isSourcePixel(observedGatherX, observedGatherY, input.gather)) {
        reason = GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance;
      } else {
        const selectedCenterOffset = idOffset;
        const gatherCenterOffset = (observedGatherY * input.gather.widthPx + observedGatherX) * 2;
        const [selectedCenterX, selectedCenterY] = idAt(
          input.observedSelectedCenterSourceIds,
          selectedCenterOffset,
        );
        const [gatherCenterX, gatherCenterY] = idAt(
          input.observedGatherCenterSourceIds,
          gatherCenterOffset,
        );
        const selectedCenterInBounds = isSourcePixel(selectedCenterX, selectedCenterY, input.source);
        const gatherCenterInBounds = isSourcePixel(gatherCenterX, gatherCenterY, input.source);
        if (selectedCenterInBounds) {
          selectedCenterSourceIds[idOffset] = selectedCenterX;
          selectedCenterSourceIds[idOffset + 1] = selectedCenterY;
        }
        if (!selectedCenterInBounds || !gatherCenterInBounds) {
          reason = GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance;
        } else if (selectedCenterX !== gatherCenterX || selectedCenterY !== gatherCenterY) {
          reason = GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch;
        } else {
          const centerIndex = selectedCenterY * input.source.widthPx + selectedCenterX;
          const centerOffset = centerIndex * 4;
          const centerValidity = input.validity[centerIndex];
          const centerSignedCocMm = input.physicalRgba[centerOffset];
          if (centerValidity !== 1 || !Number.isFinite(centerSignedCocMm)) {
            reason = GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter;
          } else if (!(centerSignedCocMm > 0.00001)) {
            reason = GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible;
          } else {
            const gatherOffset = (observedGatherY * input.gather.widthPx + observedGatherX) * 4;
            if (!isUsableRgba(input.gatherFarRgba, gatherOffset)) {
              reason = GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData;
            } else {
              reason = GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted;
              eligible[sourceIndex] = 1;
              selectedPath[sourceIndex] = GROUND_GLASS_B1_SELECTED_PATH.farGather;
              farRgba.set(input.gatherFarRgba.subarray(gatherOffset, gatherOffset + 4), sourceOffset);
            }
          }
        }
      }

      fallbackReason[sourceIndex] = reason;
      if (reason === GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted) {
        counts.farGatherSelected += 1;
      } else {
        counts.sourceColorFallback += 1;
        selectedPath[sourceIndex] = GROUND_GLASS_B1_SELECTED_PATH.sourceColorFallback;
        farRgba.set(input.sourceRgba.subarray(sourceOffset, sourceOffset + 4), sourceOffset);
        switch (reason) {
          case GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance:
            counts.missingOrOutOfBoundsProvenance += 1;
            break;
          case GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch:
            counts.selectedCenterProvenanceMismatch += 1;
            break;
          case GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter:
            counts.invalidOrUnresolvedCenter += 1;
            break;
          case GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible:
            counts.selectedCenterNotFarEligible += 1;
            break;
          case GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData:
            counts.unusableGatherData += 1;
            break;
          default:
            return assertNever(reason);
        }
      }
    }
  }

  return {
    farRgba,
    expectedGatherIds,
    nominalMappingMatches,
    selectedGatherIds,
    selectedCenterSourceIds,
    eligible,
    selectedPath,
    fallbackReason,
    counts,
  };
};

/** Research comparison only; near alpha is coverage and is never modified. */
export const compositeGroundGlassB1ResearchReference = (
  farRgba: Float32Array,
  source: GroundGlassB1Dimensions,
  nearRgba: Float32Array,
  gather: GroundGlassB1Dimensions,
): Float32Array => {
  if (!dimensionsAreValid(source) || !dimensionsAreValid(gather)
      || farRgba.length !== source.widthPx * source.heightPx * 4
      || nearRgba.length !== gather.widthPx * gather.heightPx * 4) {
    throw new RangeError("Ground Glass B1 research composite buffers must match their source and gather dimensions");
  }
  const composite = new Float32Array(farRgba.length);
  for (let y = 0; y < source.heightPx; y += 1) {
    for (let x = 0; x < source.widthPx; x += 1) {
      const sourceOffset = (y * source.widthPx + x) * 4;
      // The adapter's near texture uses NearestFilter when the full-resolution
      // research composite samples it at each source pixel center.
      const nearX = Math.min(gather.widthPx - 1,
        Math.floor(((x + 0.5) / source.widthPx) * gather.widthPx));
      const nearY = Math.min(gather.heightPx - 1,
        Math.floor(((y + 0.5) / source.heightPx) * gather.heightPx));
      const nearOffset = (nearY * gather.widthPx + nearX) * 4;
      const alpha = nearRgba[nearOffset + 3];
      if (![farRgba[sourceOffset], farRgba[sourceOffset + 1], farRgba[sourceOffset + 2], alpha,
        nearRgba[nearOffset], nearRgba[nearOffset + 1], nearRgba[nearOffset + 2]].every(Number.isFinite)) {
        throw new RangeError("Ground Glass B1 research composite inputs must be finite");
      }
      const coverage = Math.min(1, Math.max(0, alpha));
      for (let channel = 0; channel < 3; channel += 1) {
        composite[sourceOffset + channel] = farRgba[sourceOffset + channel]! * (1 - coverage)
          + nearRgba[nearOffset + channel]! * coverage;
      }
      composite[sourceOffset + 3] = 1;
    }
  }
  return composite;
};
