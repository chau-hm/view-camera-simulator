import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassM7eCaptureArtifact,
  GROUND_GLASS_M7E_READBACK_FIELDS,
} from "../../../scripts/m7eEvidenceReplayLoader";
import type { GroundGlassM7eRuntimeIdentity } from "../../render/webgpu/groundGlassM7eGatherB1Evidence";

const scenarioId = "q1-control-cap60-half32";
const sourceCommitSha = "a".repeat(40);
const testInvocation = "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 npx playwright test --project=chrome-native-webgpu";
const runtime: GroundGlassM7eRuntimeIdentity = {
  rendererRevision: "r187",
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
  applicationFallback: false,
  browserVersion: "Chrome native WebGPU test fixture",
  operatingSystem: "Darwin arm64",
  nodeVersion: "v24.3.0",
  nativeRequired: true,
};

type Override = Readonly<{ field: string; value: number }>;
const createArtifact = (override?: Override): Readonly<{ manifest: Record<string, unknown>; compressed: Buffer }> => {
  const capture = {
    captureId: "m7e-q1-control-cap60-half32-capture",
    readbackBuffers: null,
    sourceWidthPx: 2,
    sourceHeightPx: 2,
    farGatherWidthPx: 2,
    farGatherHeightPx: 2,
    nearGatherWidthPx: 2,
    nearGatherHeightPx: 2,
  };
  const dataChunks: Buffer[] = [];
  const fields: Array<Record<string, unknown>> = [];
  let offset = 0;
  for (const schema of GROUND_GLASS_M7E_READBACK_FIELDS) {
    const count = schema.length(4, 4);
    const bytesPerElement = schema.type === "Uint8Array" ? 1 : schema.type === "Uint16Array" ? 2 : 4;
    const alignedOffset = Math.ceil(offset / bytesPerElement) * bytesPerElement;
    if (alignedOffset !== offset) {
      dataChunks.push(Buffer.alloc(alignedOffset - offset));
      offset = alignedOffset;
    }
    const Constructors = { Float32Array, Uint8Array, Uint16Array, Int32Array } as const;
    const Constructor = Constructors[schema.type];
    const values = new Constructor(count);
    if (schema.name === "sourceRgba" || schema.name.endsWith("Rgba")) {
      if (values instanceof Float32Array) {
        for (let index = 3; index < values.length; index += 4) values[index] = 1;
      }
    }
    if (schema.name === "depth" && values instanceof Float32Array) values.fill(0.5);
    if (schema.name === "observedGatherCenterSourceUvs" && values instanceof Float32Array) values.fill(0.5);
    if (schema.name === "validity" && values instanceof Uint8Array) values.fill(1);
    if (override?.field === schema.name) values[0] = override.value;
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength);
    dataChunks.push(bytes);
    fields.push({ name: schema.name, offset, byteLength: bytes.byteLength, elementCount: values.length, type: values.constructor.name });
    offset += bytes.byteLength;
  }
  const raw = Buffer.concat(dataChunks);
  const compressed = gzipSync(raw, { level: 9 });
  const manifest = {
    schemaVersion: 1,
    scenarioId,
    sourceCommitSha,
    testInvocation,
    runtime,
    hostFrameResult: {
      status: "completed", accepted: true, requestId: "request-1", sceneId: "architecture-rise", rendererGenerationId: "generation-1",
    },
    capture,
    readbackPayload: {
      schemaVersion: 2,
      encoding: "gzip",
      file: `${scenarioId}.bin.gz`,
      sha256: createHash("sha256").update(compressed).digest("hex"),
      uncompressedByteLength: raw.byteLength,
      fields,
    },
  };
  return { manifest, compressed };
};

const payloadOf = (manifest: Record<string, unknown>): Record<string, unknown> =>
  manifest.readbackPayload as Record<string, unknown>;
const decode = (manifest: Record<string, unknown>, compressed: Uint8Array): unknown =>
  decodeGroundGlassM7eCaptureArtifact(manifest, compressed, scenarioId, sourceCommitSha, runtime, testInvocation);

describe("M7E offline capture artifact replay", () => {
  it("rehydrates every declared field as its explicit typed array", () => {
    const artifact = createArtifact();
    const decoded = decode(artifact.manifest, artifact.compressed) as {
      capture: { readbackBuffers: Record<string, ArrayBufferView> };
    };
    expect(Object.keys(decoded.capture.readbackBuffers)).toEqual(GROUND_GLASS_M7E_READBACK_FIELDS.map(({ name }) => name));
    expect(decoded.capture.readbackBuffers.sourceRgba).toBeInstanceOf(Float32Array);
    expect(decoded.capture.readbackBuffers.validity).toBeInstanceOf(Uint8Array);
    expect(decoded.capture.readbackBuffers.nearCpuAcceptedProposalCount).toBeInstanceOf(Uint16Array);
    expect(decoded.capture.readbackBuffers.observedSelectedGatherIds).toBeInstanceOf(Int32Array);
    expect((decoded.capture.readbackBuffers.b1Decision as Uint8Array).length).toBe(16);
  });

  it.each([
    ["missing field", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      payload.fields = (payload.fields as unknown[]).slice(0, -1);
      return manifest;
    }],
    ["duplicate field", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[1] = { ...fields[1], name: fields[0]?.name };
      payload.fields = fields;
      return manifest;
    }],
    ["unknown field", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[0] = { ...fields[0], name: "unexpectedBuffer" };
      payload.fields = fields;
      return manifest;
    }],
    ["unsupported type", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[0] = { ...fields[0], type: "Float64Array" };
      payload.fields = fields;
      return manifest;
    }],
    ["misaligned offset", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[3] = { ...fields[3], offset: Number(fields[3]?.offset) + 1 };
      payload.fields = fields;
      return manifest;
    }],
    ["overlapping field", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[1] = { ...fields[1], offset: fields[0]?.offset };
      payload.fields = fields;
      return manifest;
    }],
    ["incorrect element count", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[0] = { ...fields[0], elementCount: 1 };
      payload.fields = fields;
      return manifest;
    }],
    ["incorrect typed-array byte length", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields[0] = { ...fields[0], byteLength: 4 };
      payload.fields = fields;
      return manifest;
    }],
    ["out-of-bounds field", (manifest: Record<string, unknown>) => {
      const payload = payloadOf(manifest);
      const fields = [...payload.fields as Record<string, unknown>[]];
      fields.at(-1)!.offset = 99_999_999;
      payload.fields = fields;
      return manifest;
    }],
    ["dimension and element-count disagreement", (manifest: Record<string, unknown>) => {
      const capture = manifest.capture as Record<string, unknown>;
      capture.sourceWidthPx = 3;
      return manifest;
    }],
    ["unsafe payload path", (manifest: Record<string, unknown>) => {
      payloadOf(manifest).file = "../escape.bin.gz";
      return manifest;
    }],
    ["wrong scenario identity", (manifest: Record<string, unknown>) => ({ ...manifest, scenarioId: "other-scenario" })],
    ["wrong source commit", (manifest: Record<string, unknown>) => ({ ...manifest, sourceCommitSha: "short" })],
    ["non-native runtime", (manifest: Record<string, unknown>) => ({
      ...manifest, runtime: { ...runtime, actualExecutionApi: "webgl2", internalFallback: "webgl2" },
    })],
    ["wrong native invocation", (manifest: Record<string, unknown>) => ({ ...manifest, testInvocation: "playwright chromium" })],
    ["oversized uncompressed length", (manifest: Record<string, unknown>) => {
      payloadOf(manifest).uncompressedByteLength = 100 * 1024 * 1024;
      return manifest;
    }],
  ])("rejects %s manifest mutations", (_label, mutate) => {
    const artifact = createArtifact();
    expect(() => decode(mutate(structuredClone(artifact.manifest)), artifact.compressed)).toThrow();
  });

  it("rejects a payload whose bytes changed without updating the SHA-256", () => {
    const artifact = createArtifact();
    const changed = Buffer.from(artifact.compressed);
    changed[changed.length - 1] ^= 1;
    expect(() => decode(artifact.manifest, changed)).toThrow(/SHA-256/);
  });

  it.each(["truncated gzip", "corrupt gzip"]) ("rejects %s even when the manifest SHA matches the changed bytes", (mutation) => {
    const artifact = createArtifact();
    const changed = mutation === "truncated gzip"
      ? artifact.compressed.subarray(0, artifact.compressed.length - 8)
      : Buffer.from(artifact.compressed).fill(0xff, 0, 12);
    const manifest = structuredClone(artifact.manifest);
    payloadOf(manifest).sha256 = createHash("sha256").update(changed).digest("hex");
    expect(() => decode(manifest, changed)).toThrow(/gzip/);
  });

  it("rejects decompressed-length tampering and trailing unclaimed bytes", () => {
    const artifact = createArtifact();
    const wrongLength = structuredClone(artifact.manifest);
    payloadOf(wrongLength).uncompressedByteLength = Number(payloadOf(wrongLength).uncompressedByteLength) + 1;
    expect(() => decode(wrongLength, artifact.compressed)).toThrow(/byte length/);
    const rawWithTail = Buffer.concat([Buffer.alloc(4 * 1024), Buffer.from([1])]);
    const tail = gzipSync(rawWithTail);
    const withTail = structuredClone(artifact.manifest);
    const payload = payloadOf(withTail);
    payload.sha256 = createHash("sha256").update(tail).digest("hex");
    payload.uncompressedByteLength = rawWithTail.byteLength;
    expect(() => decode(withTail, tail)).toThrow(/unclaimed|field/);
  });

  it.each([
    ["non-finite source value", { field: "sourceRgba", value: Number.NaN }],
    ["out-of-range source color", { field: "sourceRgba", value: 1.2 }],
    ["out-of-range depth", { field: "depth", value: 1.2 }],
    ["invalid validity code", { field: "validity", value: 5 }],
    ["out-of-range center UV", { field: "observedGatherCenterSourceUvs", value: 1.2 }],
  ])("rejects %s data even when its compressed hash is valid", (_label, override) => {
    const artifact = createArtifact(override);
    expect(() => decode(artifact.manifest, artifact.compressed)).toThrow();
  });
});
