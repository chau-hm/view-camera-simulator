export interface CaptureRun {
  captureRunId: string;
  sourceCommit: string;
}

export interface CaptureMetadata {
  captureRunId?: string;
  captureRunSourceCommit?: string;
  sourceCommit?: string;
}

export interface CaptureSpec {
  captureId: string;
  path: string;
}

export function captureBelongsToRun(
  metadata: CaptureMetadata | null | undefined,
  captureRun: CaptureRun | null | undefined,
): boolean;

export function currentRunCaptureIds(
  expectedCaptureIds: string[],
  metadataById: Record<string, CaptureMetadata | undefined>,
  captureRun: CaptureRun,
): string[];

export function findCurrentCaptureIds(
  captureSpecs: CaptureSpec[],
  outputDirectory: string,
  captureRun: CaptureRun,
): Promise<string[]>;
