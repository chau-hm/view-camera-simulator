/** Stable identity for a reusable simulator lens definition. */
export type LensId = string;

/**
 * Optical coverage semantics owned by a lens definition.
 *
 * `fullCoverageAngleDeg` is the complete included angle. The corresponding
 * half-angle is derived by the coverage model rather than stored ambiguously.
 */
export type LensCoverageSpec = Readonly<
  | {
      kind: "unbounded-ideal";
    }
  | {
      kind: "angular";
      fullCoverageAngleDeg: number;
    }
>;

/** Small, extensible lens identity/specification boundary. */
export type LensDefinition = Readonly<{
  id: LensId;
  /** Focal length in millimetres. */
  focalLengthMm: number;
  coverage: LensCoverageSpec;
}>;

/** Coverage derived on a plane perpendicular to the optical axis. */
export type DerivedLensCoverage = Readonly<
  | {
      kind: "unbounded-ideal";
      imageCircleRadiusMm: null;
      imageCircleDiameterMm: null;
    }
  | {
      kind: "angular";
      /** Complete included coverage angle in degrees. */
      fullCoverageAngleDeg: number;
      /** Derived half-angle in degrees. */
      halfCoverageAngleDeg: number;
      /** Lens-to-image-plane distance in millimetres. */
      imageDistanceMm: number;
      imageCircleRadiusMm: number;
      imageCircleDiameterMm: number;
    }
>;
