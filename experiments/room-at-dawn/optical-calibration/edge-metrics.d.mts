export type RowEdgeSample = Readonly<{
  y: number;
  edgeX: number;
  phase: number;
  width10to90Px: number;
  contrastLuma8: number;
}>;

export type EdgeMeasurement = Readonly<{
  valid: true;
  width10to90Px: number;
  bootstrap95Px: readonly [number, number];
  validRowCount: number;
  clippedFraction: number;
  medianContrastLuma8: number;
  edgePhaseRange: readonly [number, number];
  phaseCoverage: Readonly<{
    binCount: number;
    supportedBinCount: number;
    minimumRowsPerBin: number;
    rowsPerBin: number[];
    envelopePx: number | null;
    adequate: boolean;
  }>;
  phaseSweep: Readonly<{
    method: string;
    sampleCount: number;
    requiredSampleCount: number;
    samples: ReadonlyArray<Readonly<{ offsetPx: number; width10to90Px: number }>>;
    envelopePx: number | null;
    adequate: boolean;
  }>;
  rows: RowEdgeSample[];
  uncertainty: Readonly<{ interpretation: string; bootstrapReplicates: number; seed: number }>;
}>;

export function bootstrapMedianInterval(
  values: number[],
  options?: Readonly<{ replicates?: number; seed?: number }>,
): Readonly<{ valid: false; rejection: string }> | Readonly<{
  valid: true;
  estimate: number;
  lower95: number;
  upper95: number;
  replicateCount: number;
  rowCount: number;
}>;

export function measureVerticalEdgeRows(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options?: Readonly<{
    replicates?: number;
    seed?: number;
    phaseBins?: number;
    minimumRowsPerPhaseBin?: number;
    phaseProbe?: boolean;
  }>,
): EdgeMeasurement | Readonly<{ valid: false; rejection: string; clippedFraction?: number; rows?: RowEdgeSample[] }>;

export function compareEdgeMetrics(
  raw: Readonly<{
    valid: boolean;
    width10to90Px?: number;
    bootstrap95Px?: readonly [number, number];
    phaseSweep?: Readonly<{ adequate: boolean; envelopePx: number | null }>;
  }>,
  processed: Readonly<{
    valid: boolean;
    width10to90Px?: number;
    bootstrap95Px?: readonly [number, number];
    phaseSweep?: Readonly<{ adequate: boolean; envelopePx: number | null }>;
  }>,
  options?: Readonly<{ minimumResolvableDifferencePx?: number }>,
): Readonly<Record<string, unknown> & { status: string }>;

export function firstWebGlNearProposalRadiusPx(maximumRadiusPx: number, sampleCount: number): number;
export function decodePngRgba(pngBytes: Uint8Array): Readonly<{ width: number; height: number; rgba: Uint8Array }>;
export function resizeRgbaBilinear(
  image: Readonly<{ width: number; height: number; rgba: Uint8Array }>,
  outputWidth: number,
  outputHeight: number,
): Readonly<{ width: number; height: number; rgba: Uint8Array }>;
export function cropRgba(
  image: Readonly<{ width: number; height: number; rgba: Uint8Array }>,
  roi: Readonly<{ x: number; y: number; width: number; height: number }>,
): Uint8Array;
