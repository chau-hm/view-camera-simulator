import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassM7eLosslessJson,
  equalGroundGlassM7eLosslessJsonValue,
  encodeGroundGlassM7eLosslessJson,
  GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC,
  stringifyGroundGlassM7eLosslessJson,
} from "../../render/webgpu/groundGlassM7eLosslessEvidenceJson";

const captureSourceCommitSha = "9382217c7820be87a596124fd78c28239d416653";

describe("M7E lossless numeric evidence JSON", () => {
  it("round-trips special values, finite numbers, nulls, arrays, and exact binary16 bits through JSON", () => {
    const original = {
      nan: Number.NaN,
      positiveInfinity: Number.POSITIVE_INFINITY,
      negativeInfinity: Number.NEGATIVE_INFINITY,
      negativeZero: -0,
      finite: [0, 0.1, 65504, -0.0023],
      absent: null,
      physicalHalfBits: [0x7e00, 0x7c00, 0xfc00, 0xfbff],
    };
    const json = stringifyGroundGlassM7eLosslessJson(original, {
      captureSourceCommitSha,
      valueRecovery: "captured-before-json",
    });
    const encoded = JSON.parse(json) as Record<string, unknown>;
    expect(encoded.codec).toBe(GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC);
    expect(encoded.provenance).toEqual({ captureSourceCommitSha, valueRecovery: "captured-before-json" });
    const decoded = decodeGroundGlassM7eLosslessJson(encoded) as typeof original;
    expect(Number.isNaN(decoded.nan)).toBe(true);
    expect(decoded.positiveInfinity).toBe(Number.POSITIVE_INFINITY);
    expect(decoded.negativeInfinity).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(decoded.negativeZero, -0)).toBe(true);
    expect(decoded.finite).toEqual(original.finite);
    expect(decoded.absent).toBeNull();
    expect(decoded.physicalHalfBits).toEqual(original.physicalHalfBits);
  });

  it("keeps numeric null as null and does not interpret it as NaN", () => {
    const decoded = decodeGroundGlassM7eLosslessJson(encodeGroundGlassM7eLosslessJson({ value: null })) as { value: unknown };
    expect(decoded.value).toBeNull();
  });

  it("compares decoded evidence without collapsing distinct non-finite values or negative zero", () => {
    expect(equalGroundGlassM7eLosslessJsonValue({ values: [Number.NaN, Number.POSITIVE_INFINITY, -0] }, {
      values: [Number.NaN, Number.POSITIVE_INFINITY, -0],
    })).toBe(true);
    expect(equalGroundGlassM7eLosslessJsonValue(Number.NaN, Number.POSITIVE_INFINITY)).toBe(false);
    expect(equalGroundGlassM7eLosslessJsonValue(-0, 0)).toBe(false);
  });

  it.each([
    ["missing envelope", { codec: GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC, payload: null }],
    ["wrong codec revision", { schemaVersion: 1, codec: "m7e-lossless-number-v0", payload: null }],
    ["malformed numeric tag", { schemaVersion: 1, codec: GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC, payload: { $m7eNumber: "NaN", extra: 1 } }],
    ["unknown numeric tag", { schemaVersion: 1, codec: GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC, payload: { $m7eNumber: "quiet-nan" } }],
    ["untagged non-finite JSON input", { schemaVersion: 1, codec: GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC, payload: Number.POSITIVE_INFINITY }],
    ["incomplete provenance", { schemaVersion: 1, codec: GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC, payload: null, provenance: { captureSourceCommitSha } }],
  ])("rejects %s", (_label, input) => {
    expect(() => decodeGroundGlassM7eLosslessJson(input)).toThrow();
  });

  it("rejects ambiguous reserved-key objects and values that JSON cannot represent", () => {
    expect(() => encodeGroundGlassM7eLosslessJson({ $m7eNumber: "NaN" })).toThrow();
    expect(() => encodeGroundGlassM7eLosslessJson({ value: undefined })).toThrow();
  });
});
