export type RQ1CaptureRunIdentity = Readonly<{
  captureRunId: string;
  sourceCommit: string;
}>;

export type RQ1NativePreflight = Readonly<{
  schemaVersion: string;
  captureRunId: string;
  sourceCommit: string;
  browserProject: string;
  browserVersion: string;
  browserLaunched: boolean;
  localPageLoaded: boolean;
  secureContext: boolean;
  navigatorGpuPresent: boolean | null;
  adapterAvailable: boolean | null;
  probeStatus: string;
  status: string;
  [key: string]: unknown;
}>;

export type RQ1NativeCaptureClassification = Readonly<{
  status: "captured" | "blocked" | "invalid";
  reasonClass: "environment-unavailable" | "native-capture-failure" | "unknown-failure" | null;
}>;

export function classifyNativePreflight(
  preflight: RQ1NativePreflight | null,
  captureRun: RQ1CaptureRunIdentity | null,
): "available" | "environment-unavailable" | "invalid";

export function classifyNativeCaptureOutcome(input: Readonly<{
  preflight: RQ1NativePreflight | null;
  captureRun: RQ1CaptureRunIdentity | null;
  processExitCode: number | null;
  processSignal: string | null;
  captureAttempted: boolean;
  expectedCaptureIds: string[];
  currentCaptureIds: string[];
  nativeArtifactsPresent: boolean;
}>): RQ1NativeCaptureClassification;

export function nativeCaptureStatusErrors(
  status: Record<string, any> | null,
  captureRun: RQ1CaptureRunIdentity | null,
  expectedCaptureIds: string[],
  currentCaptureIds: string[],
  nativeArtifactsPresent: boolean,
): string[];
