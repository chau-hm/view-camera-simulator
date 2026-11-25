/**
 * Versioned JSON encoding for numeric M7E evidence that includes non-finite
 * values. JSON null remains null; it is never used as a numeric sentinel.
 */
export const GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC = "m7e-lossless-number-v1" as const;

type SpecialNumberTag = Readonly<{
  $m7eNumber: "NaN" | "+Infinity" | "-Infinity" | "-0";
}>;
interface EncodedJsonObject {
  readonly [key: string]: EncodedJsonValue;
}
type EncodedJsonValue = null | boolean | string | number | SpecialNumberTag
  | readonly EncodedJsonValue[] | EncodedJsonObject;

export type GroundGlassM7eLosslessJsonEnvelope = Readonly<{
  schemaVersion: 1;
  codec: typeof GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC;
  payload: EncodedJsonValue;
  provenance?: Readonly<{
    captureSourceCommitSha: string;
    valueRecovery: "captured-before-json" | "controlled-case-and-half-bits";
  }>;
}>;

const encodeValue = (value: unknown, path: string): EncodedJsonValue => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return { $m7eNumber: "NaN" };
    if (value === Number.POSITIVE_INFINITY) return { $m7eNumber: "+Infinity" };
    if (value === Number.NEGATIVE_INFINITY) return { $m7eNumber: "-Infinity" };
    if (Object.is(value, -0)) return { $m7eNumber: "-0" };
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => encodeValue(item, `${path}[${index}]`));
  if (typeof value !== "object" || value === undefined) {
    throw new TypeError(`M7E evidence JSON cannot encode ${typeof value} at ${path}`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`M7E evidence JSON requires plain objects at ${path}`);
  }
  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "$m7eNumber")) {
    throw new TypeError(`M7E evidence JSON reserves the $m7eNumber key at ${path}`);
  }
  const encoded: Record<string, EncodedJsonValue> = {};
  for (const key of Object.keys(record).sort()) encoded[key] = encodeValue(record[key], `${path}.${key}`);
  return encoded;
};

/** Encode plain evidence objects with deterministic keys and lossless numbers. */
export const encodeGroundGlassM7eLosslessJson = (
  value: unknown,
  provenance?: GroundGlassM7eLosslessJsonEnvelope["provenance"],
): GroundGlassM7eLosslessJsonEnvelope => ({
  schemaVersion: 1,
  codec: GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC,
  payload: encodeValue(value, "$"),
  ...(provenance ? { provenance } : {}),
});

/** Compare JSON-shaped evidence without collapsing NaN, infinities, or -0. */
export const equalGroundGlassM7eLosslessJsonValue = (left: unknown, right: unknown): boolean =>
  JSON.stringify(encodeValue(left, "$")) === JSON.stringify(encodeValue(right, "$"));

const decodeValue = (value: unknown, path: string): unknown => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`M7E lossless JSON contains an untagged non-finite number at ${path}`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => decodeValue(item, `${path}[${index}]`));
  if (typeof value !== "object") throw new TypeError(`M7E lossless JSON has an invalid value at ${path}`);
  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "$m7eNumber")) {
    if (Object.keys(record).length !== 1) throw new TypeError(`Malformed M7E numeric tag at ${path}`);
    switch (record.$m7eNumber) {
      case "NaN": return Number.NaN;
      case "+Infinity": return Number.POSITIVE_INFINITY;
      case "-Infinity": return Number.NEGATIVE_INFINITY;
      case "-0": return -0;
      default: throw new TypeError(`Unknown M7E numeric tag at ${path}`);
    }
  }
  const decoded: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) decoded[key] = decodeValue(item, `${path}.${key}`);
  return decoded;
};

/** Decode only the explicit versioned envelope; null is retained as null. */
export const decodeGroundGlassM7eLosslessJson = (value: unknown): unknown => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("M7E lossless JSON envelope must be an object");
  }
  const envelope = value as Record<string, unknown>;
  if (envelope.schemaVersion !== 1 || envelope.codec !== GROUND_GLASS_M7E_LOSSLESS_JSON_CODEC
      || ![3, 4].includes(Object.keys(envelope).length) || !Object.prototype.hasOwnProperty.call(envelope, "payload")
      || Object.keys(envelope).some((key) => !["schemaVersion", "codec", "payload", "provenance"].includes(key))) {
    throw new TypeError("M7E lossless JSON envelope has an unsupported schema or codec");
  }
  if (envelope.provenance !== undefined) {
    const provenance = envelope.provenance as Record<string, unknown> | null;
    if (!provenance || Object.keys(provenance).length !== 2
        || typeof provenance.captureSourceCommitSha !== "string"
        || !/^[0-9a-f]{40}$/i.test(provenance.captureSourceCommitSha)
        || !["captured-before-json", "controlled-case-and-half-bits"].includes(String(provenance.valueRecovery))) {
      throw new TypeError("M7E lossless JSON provenance is incomplete or unsupported");
    }
  }
  return decodeValue(envelope.payload, "$.payload");
};

export const stringifyGroundGlassM7eLosslessJson = (
  value: unknown,
  provenance?: GroundGlassM7eLosslessJsonEnvelope["provenance"],
): string => JSON.stringify(encodeGroundGlassM7eLosslessJson(value, provenance), null, 2);
