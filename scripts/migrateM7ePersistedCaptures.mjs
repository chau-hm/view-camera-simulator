import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { endianness } from "node:os";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { encodeGroundGlassM7eLosslessJson } from "../src/render/webgpu/groundGlassM7eLosslessEvidenceJson.ts";

const ARTIFACT_SOURCE_COMMIT = "478e19f4b473540a575a18e4498e289644f305fe";
const CAPTURE_SOURCE_COMMIT = "9382217c7820be87a596124fd78c28239d416653";
const EVIDENCE_DIR = "docs/architecture/ground-glass-m7e-r187-gather-b1";
const REPORT_FILE = `${EVIDENCE_DIR}/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json`;
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const gitShow = (path) => execFileSync("git", ["show", `${ARTIFACT_SOURCE_COMMIT}:${path}`], { maxBuffer: 32 * 1024 * 1024 });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const parseJson = (bytes, label) => {
  try { return JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new Error(`Cannot parse historical M7E ${label}: ${error.message}`); }
};
const typeInfo = {
  Float32Array: { bytes: 4 },
  Uint8Array: { bytes: 1 },
  Uint16Array: { bytes: 2 },
  Int32Array: { bytes: 4 },
};
if (endianness() !== "LE") throw new Error("M7E capture payload migration requires the little-endian native capture platform");

const repackCapture = (scenarioId) => {
  const manifestPath = `${EVIDENCE_DIR}/captures/${scenarioId}.json`;
  const manifest = parseJson(gitShow(manifestPath), `${scenarioId} manifest`);
  if (manifest.schemaVersion !== 1 || manifest.scenarioId !== scenarioId || !isRecord(manifest.readbackPayload)) {
    throw new TypeError(`Historical ${scenarioId} manifest identity is invalid`);
  }
  const payload = manifest.readbackPayload;
  if (payload.encoding !== "gzip" || payload.file !== `${scenarioId}.bin.gz` || !Array.isArray(payload.fields)) {
    throw new TypeError(`Historical ${scenarioId} payload metadata is invalid`);
  }
  const compressed = gitShow(`${EVIDENCE_DIR}/captures/${payload.file}`);
  const previousPayloadSha256 = sha256(compressed);
  if (previousPayloadSha256 !== payload.sha256) throw new Error(`Historical ${scenarioId} payload SHA-256 mismatch`);
  const raw = gunzipSync(compressed, { maxOutputLength: 64 * 1024 * 1024 });
  const repackedFields = [];
  const chunks = [];
  let oldCursor = 0;
  let cursor = 0;
  for (const field of payload.fields) {
    const type = typeInfo[field.type];
    if (!isRecord(field) || typeof field.name !== "string" || !type || field.offset !== oldCursor
        || !Number.isSafeInteger(field.byteLength) || field.byteLength < 0 || field.byteLength % type.bytes !== 0) {
      throw new TypeError(`Historical ${scenarioId} field schema is invalid`);
    }
    const end = field.offset + field.byteLength;
    if (end > raw.byteLength) throw new RangeError(`Historical ${scenarioId}.${field.name} exceeds its binary payload`);
    const alignedOffset = Math.ceil(cursor / type.bytes) * type.bytes;
    if (alignedOffset > cursor) {
      chunks.push(Buffer.alloc(alignedOffset - cursor));
      cursor = alignedOffset;
    }
    const bytes = raw.subarray(field.offset, end);
    chunks.push(bytes);
    repackedFields.push({
      name: field.name,
      offset: cursor,
      byteLength: bytes.byteLength,
      elementCount: bytes.byteLength / type.bytes,
      type: field.type,
    });
    cursor += bytes.byteLength;
    oldCursor = end;
  }
  if (oldCursor !== raw.byteLength) throw new Error(`Historical ${scenarioId} payload contains unclaimed bytes`);
  const alignedRaw = Buffer.concat(chunks);
  if (alignedRaw.byteLength !== cursor) throw new Error(`Repacked ${scenarioId} byte count is inconsistent`);
  const repacked = gzipSync(alignedRaw, { level: 9 });
  manifest.readbackPayload = {
    schemaVersion: 2,
    encoding: "gzip",
    file: payload.file,
    sha256: sha256(repacked),
    previousPayloadSha256,
    uncompressedByteLength: alignedRaw.byteLength,
    fields: repackedFields,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(resolve(EVIDENCE_DIR, "captures", payload.file), repacked);
  writeFileSync(resolve(EVIDENCE_DIR, "captures", `${scenarioId}.json`), manifestBytes);
  return { scenarioId, sha256: sha256(repacked), manifestSha256: sha256(manifestBytes) };
};

const halfToNumber = (bits) => {
  const sign = (bits & 0x8000) ? -1 : 1;
  const exponent = (bits >>> 10) & 0x1f;
  const fraction = bits & 0x3ff;
  if (exponent === 0x1f) return fraction === 0 ? sign * Number.POSITIVE_INFINITY : Number.NaN;
  if (exponent === 0) return sign * (fraction / 1024) * (2 ** -14);
  return sign * (1 + fraction / 1024) * (2 ** (exponent - 15));
};

const restoreHalfReadback = (stored, bits, label) => {
  if (!Array.isArray(stored) || !Array.isArray(bits) || stored.length !== bits.length) {
    throw new TypeError(`${label} half-float readback and bit arrays do not match`);
  }
  return bits.map((bitPattern, index) => {
    if (!Number.isInteger(bitPattern) || bitPattern < 0 || bitPattern > 0xffff) throw new RangeError(`${label}[${index}] half-float bits are invalid`);
    const decoded = halfToNumber(bitPattern);
    const value = stored[index];
    if (value === null) {
      if (Number.isFinite(decoded)) throw new Error(`${label}[${index}] lost a finite value in historical JSON`);
      return decoded;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || !Object.is(value, decoded)) {
      throw new Error(`${label}[${index}] does not match its persisted binary16 bits`);
    }
    return decoded;
  });
};

const restoreBoundaryProbe = (value) => {
  if (!isRecord(value) || value.rendererRevision !== "r187" || !Array.isArray(value.cases)) {
    throw new TypeError("Historical M7E B1 probe runtime or case inventory is malformed");
  }
  const physicalValues = new Map([
    ["physical-nan", Number.NaN],
    ["physical-positive-infinity", Number.POSITIVE_INFINITY],
    ["physical-negative-infinity", Number.NEGATIVE_INFINITY],
  ]);
  const farValues = new Map([
    ["far-gather-nan-channel-fails-closed", [0, Number.NaN]],
    ["far-gather-infinity-channel-fails-closed", [1, Number.POSITIVE_INFINITY]],
  ]);
  for (const item of value.cases) {
    if (!isRecord(item) || typeof item.id !== "string") throw new TypeError("Historical M7E B1 case is malformed");
    if (item.inputSignedCocMm === null) {
      if (!physicalValues.has(item.id)) throw new Error(`Cannot recover non-finite signed CoC for ${item.id}`);
      item.inputSignedCocMm = physicalValues.get(item.id);
    }
    if (Array.isArray(item.inputFarRgba)) {
      for (let index = 0; index < item.inputFarRgba.length; index += 1) {
        if (item.inputFarRgba[index] !== null) continue;
        const recovered = farValues.get(item.id);
        if (!recovered || recovered[0] !== index) throw new Error(`Cannot recover non-finite Far input ${item.id}[${index}]`);
        item.inputFarRgba[index] = recovered[1];
      }
    }
    item.storedPhysicalRgba = restoreHalfReadback(item.storedPhysicalRgba, item.storedPhysicalHalfBits, `${item.id}.storedPhysicalRgba`);
    item.storedGatherRgba = restoreHalfReadback(item.storedGatherRgba, item.storedGatherHalfBits, `${item.id}.storedGatherRgba`);
    item.gpuB1Rgba = restoreHalfReadback(item.gpuB1Rgba, item.gpuB1HalfBits, `${item.id}.gpuB1Rgba`);
  }
  return value;
};

const sourceReport = parseJson(gitShow(REPORT_FILE), "report");
if (sourceReport.sourceCommitSha !== CAPTURE_SOURCE_COMMIT || sourceReport.evaluatorRevision !== "m7e-r187-gather-b1-evaluator-v1") {
  throw new Error("Historical M7E report does not match the declared original source and evaluator revision");
}
if (!Array.isArray(sourceReport.supportingArtifacts) || sourceReport.supportingArtifacts.length !== 12) {
  throw new TypeError("Historical M7E report does not contain its exact twelve capture artifacts");
}
const migratedCaptures = sourceReport.supportingArtifacts.map(({ scenarioId }) => repackCapture(scenarioId));
const probe = restoreBoundaryProbe(parseJson(gitShow(`${EVIDENCE_DIR}/b1-boundary-probe.json`), "standalone B1 probe"));
const losslessProbe = encodeGroundGlassM7eLosslessJson(probe, {
  captureSourceCommitSha: CAPTURE_SOURCE_COMMIT,
  valueRecovery: "controlled-case-and-half-bits",
});
writeFileSync(resolve(EVIDENCE_DIR, "b1-boundary-probe.json"), `${JSON.stringify(losslessProbe, null, 2)}\n`);

const report = sourceReport;
report.evaluatorRevision = "m7e-r187-gather-b1-evaluator-v2";
report.inventory.evaluatorRevision = report.evaluatorRevision;
report.inventory.b1BoundaryProbe = null;
report.b1BoundaryProbe.readback = losslessProbe;
report.supportingArtifacts = migratedCaptures.map((capture, index) => ({
  ...sourceReport.supportingArtifacts[index],
  sha256: capture.sha256,
  manifestSha256: capture.manifestSha256,
}));
report.artifactRepack = {
  sourceCaptureCommitSha: CAPTURE_SOURCE_COMMIT,
  originalArtifactCommitSha: ARTIFACT_SOURCE_COMMIT,
  originalEvaluatorRevision: "m7e-r187-gather-b1-evaluator-v1",
  evaluatorRevision: report.evaluatorRevision,
  numericRecovery: "controlled-case-and-half-bits",
  nativeCaptureRerun: false,
  claim: "Lossless repack of persisted native readbacks; typed-array bytes were copied without numerical conversion, and non-finite B1 values were recovered only from the controlled case contract and persisted binary16 bit patterns.",
  captureCount: migratedCaptures.length,
  previousPayloadSha256: Object.fromEntries(migratedCaptures.map((capture) => [capture.scenarioId,
    parseJson(readFileSync(resolve(EVIDENCE_DIR, "captures", `${capture.scenarioId}.json`)), `${capture.scenarioId} migrated manifest`).readbackPayload.previousPayloadSha256])),
};
writeFileSync(resolve(REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ sourceCaptureCommitSha: CAPTURE_SOURCE_COMMIT, originalArtifactCommitSha: ARTIFACT_SOURCE_COMMIT, evaluatorRevision: report.evaluatorRevision, migratedCaptures }, null, 2));
