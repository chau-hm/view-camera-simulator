import {
  comparePixelRegions,
  type DecodedPng,
  type ImageDifferenceSummary,
  type PixelRegion,
} from "./observerBackendBenchmark";

export type CaptureStorageRole =
  | Readonly<{ kind: "canonical" }>
  | Readonly<{ kind: "repeat"; captureId: string }>;

export type RepeatCaptureEvidence = Readonly<{
  captureId: string;
  rendererVariant: string;
  rendererFamily: string;
  executionBackend: string;
  rendererAlpha: string;
  toneMapping: string;
  outputColorSpace: string;
  initializationAttempts: number;
  applicationFallback: string;
  initializationFailure: string;
  background: string;
  overlay: string;
  view: string;
  viewport: Readonly<{ width: number; height: number }>;
  devicePixelRatio: number;
  canvas: Readonly<{ width: number; height: number }>;
  decoded: DecodedPng;
}>;

export const getCaptureStorageKey = (
  canonicalKey: string,
  role: CaptureStorageRole,
): string => {
  if (role.kind === "canonical") return canonicalKey;
  if (!role.captureId.trim()) throw new Error("Repeat capture id must not be empty");
  return `${canonicalKey}/repeat/${encodeURIComponent(role.captureId)}`;
};

export const storeCaptureWithoutReplacement = <T>(
  captures: Map<string, T>,
  key: string,
  capture: T,
): void => {
  if (captures.has(key)) throw new Error(`Capture key already exists: ${key}`);
  captures.set(key, capture);
};

const requirePositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
};

const validateCapture = (capture: RepeatCaptureEvidence, label: string): void => {
  requirePositiveInteger(capture.viewport.width, `${label} viewport width`);
  requirePositiveInteger(capture.viewport.height, `${label} viewport height`);
  requirePositiveInteger(capture.canvas.width, `${label} canvas width`);
  requirePositiveInteger(capture.canvas.height, `${label} canvas height`);
  requirePositiveInteger(capture.decoded.width, `${label} image width`);
  requirePositiveInteger(capture.decoded.height, `${label} image height`);
  if (capture.decoded.channels !== 3 && capture.decoded.channels !== 4) {
    throw new Error(`${label} image has an unsupported channel layout`);
  }
  const expectedBytes = capture.decoded.width * capture.decoded.height * capture.decoded.channels;
  if (capture.decoded.pixels.byteLength !== expectedBytes) {
    throw new Error(`${label} image pixel buffer has an invalid length`);
  }
  if (!Number.isFinite(capture.devicePixelRatio) || capture.devicePixelRatio <= 0) {
    throw new Error(`${label} device pixel ratio must be positive`);
  }
}

const requireSame = (first: unknown, second: unknown, label: string): void => {
  if (first !== second) throw new Error(`Repeat capture ${label} changed`);
};

export const compareRepeatCaptureEvidence = (
  original: RepeatCaptureEvidence | null | undefined,
  repeated: RepeatCaptureEvidence | null | undefined,
  region: PixelRegion,
  changedChannelThreshold = 8,
): ImageDifferenceSummary => {
  if (!original) throw new Error("Original repeat capture evidence is missing");
  if (!repeated) throw new Error("Repeated capture evidence is missing");
  if (original.captureId === repeated.captureId || original.decoded.pixels === repeated.decoded.pixels) {
    throw new Error("Repeat consistency requires two independently captured pixel buffers");
  }

  validateCapture(original, "Original");
  validateCapture(repeated, "Repeated");
  requireSame(original.rendererVariant, repeated.rendererVariant, "renderer variant");
  requireSame(original.rendererFamily, repeated.rendererFamily, "renderer family");
  requireSame(original.executionBackend, repeated.executionBackend, "execution backend");
  requireSame(original.rendererAlpha, repeated.rendererAlpha, "renderer alpha mode");
  requireSame(original.toneMapping, repeated.toneMapping, "tone mapping");
  requireSame(original.outputColorSpace, repeated.outputColorSpace, "output color space");
  requireSame(original.initializationAttempts, repeated.initializationAttempts, "initialization attempts");
  requireSame(original.applicationFallback, repeated.applicationFallback, "application fallback");
  requireSame(original.initializationFailure, repeated.initializationFailure, "initialization failure");
  requireSame(original.background, repeated.background, "background");
  requireSame(original.overlay, repeated.overlay, "overlay selection");
  requireSame(original.view, repeated.view, "camera view");
  requireSame(original.viewport.width, repeated.viewport.width, "viewport width");
  requireSame(original.viewport.height, repeated.viewport.height, "viewport height");
  requireSame(original.devicePixelRatio, repeated.devicePixelRatio, "device pixel ratio");
  requireSame(original.canvas.width, repeated.canvas.width, "canvas width");
  requireSame(original.canvas.height, repeated.canvas.height, "canvas height");

  const boundsAreValid = [region.left, region.top, region.right, region.bottom].every(Number.isInteger) &&
    region.left >= 0 && region.top >= 0 &&
    region.right <= original.decoded.width && region.bottom <= original.decoded.height &&
    region.left < region.right && region.top < region.bottom;
  if (!boundsAreValid) throw new Error("Repeat capture comparison region is empty or outside the image");

  return comparePixelRegions(original.decoded, repeated.decoded, region, changedChannelThreshold);
};
