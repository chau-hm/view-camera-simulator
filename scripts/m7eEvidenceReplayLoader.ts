import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { endianness } from "node:os";
import { basename, join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS,
  type GroundGlassM7eCaptureEnvelope,
  type GroundGlassM7eRuntimeIdentity,
} from "../src/render/webgpu/groundGlassM7eGatherB1Evidence";
import type { GroundGlassApertureGatherCaptureReadback } from "../src/render/webgpu/groundGlassWebGpuTestSeam";

const MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_PIXEL_COUNT = 1_000_000;

type ReadbackFieldName =
  | "sourceRgba" | "physicalRgba" | "validity" | "depth" | "farGatherRgba" | "farCpuReferenceRgba"
  | "nearRgba" | "nearBeforeB1Rgba" | "nearAfterB1Rgba" | "nearCpuReferenceRgba"
  | "nearCpuCenterIsNear" | "nearCpuEvaluatedProposalCount" | "nearCpuAcceptedProposalCount"
  | "nearCpuNonzeroMembershipCount" | "nearCpuWeightSum" | "nearCpuCoverageMass" | "nearCpuEstimatedCoverage"
  | "nearCpuAcceptedAreaRatioMean" | "nearCpuAcceptedCompensationMaximum" | "b1FarRgba" | "researchCompositeRgba"
  | "observedSelectedGatherIds" | "observedSelectedCenterSourceIds" | "observedGatherCenterSourceIds"
  | "observedGatherCenterSourceUvs" | "b1Decision";
type ReadbackFieldType = "Float32Array" | "Uint8Array" | "Uint16Array" | "Int32Array";
type ReadbackFieldSchema = Readonly<{ name: ReadbackFieldName; type: ReadbackFieldType; length: (source: number, gather: number) => number }>;

export const GROUND_GLASS_M7E_READBACK_FIELDS: readonly ReadbackFieldSchema[] = [
  { name: "sourceRgba", type: "Float32Array", length: (source) => source * 4 },
  { name: "physicalRgba", type: "Float32Array", length: (source) => source * 4 },
  { name: "validity", type: "Uint8Array", length: (source) => source },
  { name: "depth", type: "Float32Array", length: (source) => source },
  { name: "farGatherRgba", type: "Float32Array", length: (_source, gather) => gather * 4 },
  { name: "farCpuReferenceRgba", type: "Float32Array", length: (_source, gather) => gather * 4 },
  { name: "nearRgba", type: "Float32Array", length: (_source, gather) => gather * 4 },
  { name: "nearBeforeB1Rgba", type: "Float32Array", length: (_source, gather) => gather * 4 },
  { name: "nearAfterB1Rgba", type: "Float32Array", length: (_source, gather) => gather * 4 },
  { name: "nearCpuReferenceRgba", type: "Float32Array", length: (_source, gather) => gather * 4 },
  { name: "nearCpuCenterIsNear", type: "Uint8Array", length: (_source, gather) => gather },
  { name: "nearCpuEvaluatedProposalCount", type: "Uint16Array", length: (_source, gather) => gather },
  { name: "nearCpuAcceptedProposalCount", type: "Uint16Array", length: (_source, gather) => gather },
  { name: "nearCpuNonzeroMembershipCount", type: "Uint16Array", length: (_source, gather) => gather },
  { name: "nearCpuWeightSum", type: "Float32Array", length: (_source, gather) => gather },
  { name: "nearCpuCoverageMass", type: "Float32Array", length: (_source, gather) => gather },
  { name: "nearCpuEstimatedCoverage", type: "Float32Array", length: (_source, gather) => gather },
  { name: "nearCpuAcceptedAreaRatioMean", type: "Float32Array", length: (_source, gather) => gather },
  { name: "nearCpuAcceptedCompensationMaximum", type: "Float32Array", length: (_source, gather) => gather },
  { name: "b1FarRgba", type: "Float32Array", length: (source) => source * 4 },
  { name: "researchCompositeRgba", type: "Float32Array", length: (source) => source * 4 },
  { name: "observedSelectedGatherIds", type: "Int32Array", length: (source) => source * 2 },
  { name: "observedSelectedCenterSourceIds", type: "Int32Array", length: (source) => source * 2 },
  { name: "observedGatherCenterSourceIds", type: "Int32Array", length: (_source, gather) => gather * 2 },
  { name: "observedGatherCenterSourceUvs", type: "Float32Array", length: (_source, gather) => gather * 2 },
  { name: "b1Decision", type: "Uint8Array", length: (source) => source * 4 },
];

const TYPE_INFO: Readonly<Record<ReadbackFieldType, Readonly<{ bytes: number; Constructor: new (buffer: ArrayBuffer, byteOffset?: number, length?: number) => ArrayBufferView }>>> = {
  Float32Array: { bytes: 4, Constructor: Float32Array },
  Uint8Array: { bytes: 1, Constructor: Uint8Array },
  Uint16Array: { bytes: 2, Constructor: Uint16Array },
  Int32Array: { bytes: 4, Constructor: Int32Array },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isSafePositiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const isFullSha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
const align = (value: number, multiple: number): number => Math.ceil(value / multiple) * multiple;

const finiteArray = (values: ArrayLike<number>): boolean => {
  for (let index = 0; index < values.length; index += 1) if (!Number.isFinite(values[index])) return false;
  return true;
};

const decodePayloadFields = (
  fieldsValue: unknown,
  capture: Record<string, unknown>,
  scenarioId: string,
  payloadValue: unknown,
  compressedValue: Uint8Array,
): GroundGlassApertureGatherCaptureReadback["readbackBuffers"] => {
  if (!isRecord(payloadValue)) throw new TypeError("Capture readback payload metadata must be an object");
  const payload = payloadValue;
  if (payload.schemaVersion !== 2 || payload.encoding !== "gzip") {
    throw new TypeError("Capture payload must use the aligned M7E readback schema v2 gzip encoding");
  }
  if (typeof payload.file !== "string" || !/^[a-z0-9-]+\.bin\.gz$/.test(payload.file)) {
    throw new TypeError("Capture payload filename contains an unsupported path or name");
  }
  if (payload.file !== `${scenarioId}.bin.gz`) {
    throw new TypeError("Capture payload filename does not match its capture identity");
  }
  if (compressedValue.byteLength > MAX_COMPRESSED_BYTES) throw new RangeError("Compressed capture payload exceeds the replay size limit");
  if (!isFullSha(payload.sha256)) throw new TypeError("Capture payload SHA-256 is malformed");
  const actualSha = createHash("sha256").update(compressedValue).digest("hex");
  if (actualSha !== payload.sha256) throw new Error("Capture payload SHA-256 does not match the persisted artifact");
  if (!isSafePositiveInteger(payload.uncompressedByteLength) || payload.uncompressedByteLength > MAX_UNCOMPRESSED_BYTES) {
    throw new RangeError("Capture payload uncompressed byte length is missing or exceeds the replay size limit");
  }

  const sourceWidth = capture.sourceWidthPx;
  const sourceHeight = capture.sourceHeightPx;
  const gatherWidth = capture.farGatherWidthPx;
  const gatherHeight = capture.farGatherHeightPx;
  const nearWidth = capture.nearGatherWidthPx;
  const nearHeight = capture.nearGatherHeightPx;
  if (![sourceWidth, sourceHeight, gatherWidth, gatherHeight, nearWidth, nearHeight].every(isSafePositiveInteger)) {
    throw new TypeError("Capture source and gather dimensions must be positive safe integers");
  }
  if (gatherWidth !== nearWidth || gatherHeight !== nearHeight) throw new TypeError("Far and Near gather dimensions must match");
  const sourcePixels = (sourceWidth as number) * (sourceHeight as number);
  const gatherPixels = (gatherWidth as number) * (gatherHeight as number);
  if (!Number.isSafeInteger(sourcePixels) || !Number.isSafeInteger(gatherPixels)
      || sourcePixels > MAX_PIXEL_COUNT || gatherPixels > MAX_PIXEL_COUNT) {
    throw new RangeError("Capture dimensions exceed the bounded replay pixel count");
  }

  let raw: Buffer;
  try {
    const decoded = gunzipSync(compressedValue, { maxOutputLength: MAX_UNCOMPRESSED_BYTES, info: true }) as unknown as {
      buffer: Uint8Array;
      engine: { bytesWritten: number };
    };
    raw = Buffer.from(decoded.buffer);
    if (decoded.engine.bytesWritten !== compressedValue.byteLength) throw new Error("Gzip stream contains trailing or unconsumed bytes");
  } catch (error) {
    throw new Error(`Capture gzip payload is invalid: ${error instanceof Error ? error.message : "unknown gzip error"}`);
  }
  if (raw.byteLength !== payload.uncompressedByteLength) throw new Error("Capture decompressed byte length does not match its manifest");

  if (!Array.isArray(fieldsValue) || fieldsValue.length !== GROUND_GLASS_M7E_READBACK_FIELDS.length) {
    throw new TypeError("Capture manifest does not contain the complete M7E typed-array field inventory");
  }
  const buffers: Record<string, ArrayBufferView> = Object.create(null) as Record<string, ArrayBufferView>;
  let cursor = 0;
  for (const [index, schema] of GROUND_GLASS_M7E_READBACK_FIELDS.entries()) {
    const field = fieldsValue[index];
    if (!isRecord(field)) throw new TypeError(`Capture field ${index} is malformed`);
    const typeInfo = TYPE_INFO[schema.type];
    const expectedCount = schema.length(sourcePixels, gatherPixels);
    const expectedByteLength = expectedCount * typeInfo.bytes;
    if (field.name !== schema.name || field.type !== schema.type) {
      throw new TypeError(`Capture field ${index} is missing, duplicated, unexpected, or has an unsupported typed-array type`);
    }
    if (!Number.isSafeInteger(field.offset) || (field.offset as number) < 0
        || !Number.isSafeInteger(field.byteLength) || (field.byteLength as number) <= 0
        || !Number.isSafeInteger(field.elementCount) || (field.elementCount as number) <= 0) {
      throw new TypeError(`Capture field ${schema.name} has invalid offsets or element metadata`);
    }
    const expectedOffset = align(cursor, typeInfo.bytes);
    if (field.offset !== expectedOffset || (field.offset as number) % typeInfo.bytes !== 0) {
      throw new RangeError(`Capture field ${schema.name} is overlapping, misaligned, or out of order`);
    }
    if ((field.elementCount as number) !== expectedCount || field.byteLength !== expectedByteLength) {
      throw new RangeError(`Capture field ${schema.name} has an incorrect element count or byte length`);
    }
    const end = (field.offset as number) + expectedByteLength;
    if (!Number.isSafeInteger(end) || end > raw.byteLength) throw new RangeError(`Capture field ${schema.name} exceeds the decompressed payload bounds`);
    for (let padding = cursor; padding < expectedOffset; padding += 1) {
      if (raw[padding] !== 0) throw new Error(`Capture field ${schema.name} has non-zero alignment padding`);
    }
    const bytes = Uint8Array.from(raw.subarray(expectedOffset, end));
    buffers[schema.name] = new typeInfo.Constructor(bytes.buffer, 0, expectedCount);
    cursor = end;
  }
  if (cursor !== raw.byteLength) throw new Error("Capture payload has unclaimed or trailing bytes");

  for (const [name, values] of Object.entries(buffers)) {
    if (values instanceof Float32Array && !finiteArray(values)) throw new TypeError(`Capture readback ${name} contains non-finite values`);
  }
  const typed = buffers as unknown as NonNullable<GroundGlassApertureGatherCaptureReadback["readbackBuffers"]>;
  for (const [index, code] of typed.validity.entries()) {
    if (code > 4) throw new RangeError(`M4 validity code ${code} at source pixel ${index} is unsupported`);
  }
  for (const [index, color] of typed.sourceRgba.entries()) {
    if (color < 0 || color > 1) throw new RangeError(`Source color channel ${index} is outside normalized [0,1]`);
  }
  for (const [index, value] of typed.depth.entries()) {
    if (value < 0 || value > 1) throw new RangeError(`Depth sample ${index} is outside normalized [0,1]`);
  }
  for (const [index, uv] of typed.observedGatherCenterSourceUvs.entries()) {
    if (uv < 0 || uv > 1) throw new RangeError(`Gather-center UV ${index} is outside [0,1]`);
  }
  return typed;
};

export const decodeGroundGlassM7eCaptureArtifact = (
  manifestValue: unknown,
  compressedPayload: Uint8Array,
  expectedScenarioId: string,
  expectedSourceCommitSha?: string,
  expectedRuntime?: GroundGlassM7eRuntimeIdentity,
  expectedTestInvocation?: string,
): GroundGlassM7eCaptureEnvelope => {
  if (!GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.includes(expectedScenarioId as typeof GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS[number])) {
    throw new TypeError("Capture scenario is not in the predeclared twelve-case M7E inventory");
  }
  if (!isRecord(manifestValue) || manifestValue.schemaVersion !== 1 || manifestValue.scenarioId !== expectedScenarioId) {
    throw new TypeError("Capture manifest schema or scenario identity is invalid");
  }
  const manifest = manifestValue;
  if (typeof manifest.sourceCommitSha !== "string" || !/^[0-9a-f]{40}$/i.test(manifest.sourceCommitSha)
      || (expectedSourceCommitSha !== undefined && manifest.sourceCommitSha !== expectedSourceCommitSha)) {
    throw new TypeError("Capture manifest source commit provenance is missing or inconsistent");
  }
  if (typeof manifest.testInvocation !== "string" || !manifest.testInvocation.includes("chrome-native-webgpu")
      || !manifest.testInvocation.includes("GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1")
      || (expectedTestInvocation !== undefined && manifest.testInvocation !== expectedTestInvocation)) {
    throw new TypeError("Capture manifest does not identify the native-required Playwright invocation");
  }
  if (!isRecord(manifest.runtime) || !isRecord(manifest.capture) || !isRecord(manifest.hostFrameResult)) {
    throw new TypeError("Capture manifest runtime, capture, or host frame identity is missing");
  }
  if (!isRecord(manifest.readbackPayload)) throw new TypeError("Capture manifest readback payload metadata is missing");
  const runtime = manifest.runtime as unknown as GroundGlassM7eRuntimeIdentity;
  if (expectedRuntime && JSON.stringify(runtime) !== JSON.stringify(expectedRuntime)) {
    throw new TypeError("Capture runtime provenance differs from the report runtime identity");
  }
  if (runtime.rendererRevision !== "r187" || runtime.rendererFamily !== "webgpu-renderer"
      || runtime.actualExecutionApi !== "webgpu" || runtime.internalFallback !== "none"
      || runtime.applicationFallback !== false || runtime.nativeRequired !== true) {
    throw new TypeError("Capture runtime is not native WebGPU on Three.js r187");
  }
  if (manifest.capture.readbackBuffers !== null) throw new TypeError("Capture manifest must keep bulk readbacks in the external binary payload");
  const readbackBuffers = decodePayloadFields(
    manifest.readbackPayload.fields,
    manifest.capture,
    expectedScenarioId,
    manifest.readbackPayload,
    compressedPayload,
  );
  const capture = { ...manifest.capture, readbackBuffers } as unknown as GroundGlassApertureGatherCaptureReadback;
  const hostFrameResult = manifest.hostFrameResult as GroundGlassM7eCaptureEnvelope["hostFrameResult"];
  return {
    scenarioId: expectedScenarioId,
    capture,
    runtime,
    sourceCommitSha: manifest.sourceCommitSha,
    testInvocation: manifest.testInvocation,
    supportingArtifact: `captures/${expectedScenarioId}.json;captures/${expectedScenarioId}.bin.gz`,
    hostFrameResult,
  };
};

export const readGroundGlassM7eCaptureArtifact = (
  capturesDirectory: string,
  scenarioId: string,
  expectedSourceCommitSha: string,
  expectedRuntime: GroundGlassM7eRuntimeIdentity,
  expectedTestInvocation: string,
): Readonly<{ envelope: GroundGlassM7eCaptureEnvelope; manifestBytes: Buffer; compressedPayload: Buffer }> => {
  if (basename(capturesDirectory) !== "captures") throw new TypeError("M7E evidence artifacts must be read from the fixed captures directory");
  const manifestPath = join(capturesDirectory, `${scenarioId}.json`);
  const manifestBytes = readFileSync(manifestPath);
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8")) as unknown;
  } catch (error) {
    throw new SyntaxError(`Capture manifest JSON is malformed: ${error instanceof Error ? error.message : "parse error"}`);
  }
  if (!isRecord(manifest) || !isRecord(manifest.readbackPayload) || manifest.readbackPayload.file !== `${scenarioId}.bin.gz`) {
    throw new TypeError("Capture manifest payload path is not the expected in-directory artifact name");
  }
  const payloadPath = join(capturesDirectory, `${scenarioId}.bin.gz`);
  const compressedPayload = readFileSync(payloadPath);
  const envelope = decodeGroundGlassM7eCaptureArtifact(
    manifest,
    compressedPayload,
    scenarioId,
    expectedSourceCommitSha,
    expectedRuntime,
    expectedTestInvocation,
  );
  return { envelope, manifestBytes, compressedPayload };
};

export const assertM7eArtifactSha256 = (bytes: Uint8Array, declaredSha256: unknown, fieldName: string): void => {
  if (!isFullSha(declaredSha256) || createHash("sha256").update(bytes).digest("hex") !== declaredSha256) {
    throw new Error(`${fieldName} SHA-256 does not match its persisted artifact`);
  }
};

export const assertM7eReplayPlatform = (): void => {
  if (endianness() !== "LE") throw new Error("M7E readback replay requires a little-endian host for native typed-array representation");
};
