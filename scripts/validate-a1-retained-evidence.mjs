import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "stress-1.json", "stress-1-final32.rgba",
  "control-bypass.json", "control-bypass-final32.rgba",
  "control-previous-request.json", "control-previous-request-final32.rgba",
  "control-next-request.json", "control-next-request-final32.rgba",
  "depth-edge.json",
];
const expectedContracts = {
  D1: { positive: ["current-frame"], negative: ["stale-frame"], missing: ["independently-accepted-generation"] },
  D2: { positive: ["finite-preparation", "nonuniform-buffer"], negative: ["uniform-buffer"], missing: ["typed-preparation", "opaque-content"] },
  D3: { positive: ["processed", "raw-bypass"], negative: ["bypass-as-processed"], missing: ["tracked-producer"] },
  D4: { positive: ["thin-lens-coc", "legacy-depth-rejection"], negative: ["legacy-depth-rejection"], missing: ["wrong-coc-gpu", "excess-blur-gpu", "zero-blur-gpu"] },
  D5: { positive: [], negative: [], missing: ["matched-completed-orientation"] },
  D6: { positive: [], negative: [], missing: ["protected-response", "gpu-negative-control"] },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message) => { throw new Error(message); };
const finite = (value) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finite);
  if (value && typeof value === "object") return Object.values(value).every(finite);
  return value !== null;
};
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const nonuniformRgb = (pixels) => {
  for (let i = 4; i < pixels.length; i += 4) {
    if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) return true;
  }
  return false;
};


/**
 * Validates the integrity of a limited, historical partial result. It cannot
 * establish current GPU behaviour or upgrade any A1 contract to qualified.
 */
export function validateA1RetainedEvidence(root, suppliedRecord) {
  const read = (name) => readFileSync(join(root, name));
  const record = suppliedRecord ?? JSON.parse(read("record.json").toString("utf8"));
  if (record.schemaVersion !== 1 || record.decision !== "PARTIAL" ||
      record.provenance?.sourceCommit !== "1e15f607383a22643712e43394c7bde1cad3a6ec" ||
      record.provenance?.capture !== "test-only WebGL completion-boundary Vite instrumentation" ||
      typeof record.provenance?.limitations !== "string" || !record.provenance.limitations) {
    fail("invalid A1 schema, decision, or provenance");
  }
  if (!Array.isArray(record.contracts) || record.contracts.length !== 6 ||
      !same(Object.keys(record.files ?? {}).sort(), [...requiredFiles].sort())) {
    fail("incomplete A1 contracts or retained files");
  }
  for (const [index, [id, controls]] of Object.entries(expectedContracts).entries()) {
    const actual = record.contracts[index];
    if (actual?.id !== id || actual.status !== "PARTIAL" ||
        !same(actual.positive, controls.positive) || !same(actual.negative, controls.negative) ||
        !same(actual.missing, controls.missing)) {
      fail(`unsupported or contradictory contract: ${id}`);
    }
  }
  for (const name of requiredFiles) {
    const bytes = read(name);
    if (!/^[a-f0-9]{64}$/.test(record.files[name]) || digest(bytes) !== record.files[name]) {
      fail(`retained evidence digest mismatch: ${name}`);
    }
  }

  const processed = ["sceneRender", "cocFootprint", "farGather", "nearGather", "composite", "display"];
  const bypass = ["sceneRender", "composite", "display"];
  const names = ["stress-1", "control-bypass", "control-previous-request", "control-next-request"];
  const observations = names.map((name, index) => {
    const value = JSON.parse(read(`${name}.json`).toString("utf8"));
    const pixels = read(`${name}-final32.rgba`);
    const completed = value.completion;
    const expectedPasses = index === 1 ? bypass : processed;
    if (value.source !== record.provenance.sourceCommit || value.seed !== "284719" ||
        !value.adapter || value.request?.sceneId !== "architecture-foreground" ||
        value.request?.channelId !== "default" || !value.request?.requestId ||
        value.preparationFinite !== true || !value.preparation || !finite(value.preparation) ||
        !Number.isInteger(value.subjectGeneration) || value.subjectGeneration < 1 ||
        completed?.status !== "completed" || completed.requiredOperations !== "all-completed" ||
        !same(value.request, completed.request) || !completed.generation?.generationId ||
        !completed.frameId?.startsWith(`${completed.generation.generationId}:frame:`) ||
        value.frameId !== completed.frameId || value.rawDebug !== (index === 1) ||
        !same(value.passes, expectedPasses) ||
        pixels.length !== 32 * 32 * 4) fail(`invalid observed transaction: ${name}`);
    if (!nonuniformRgb(pixels)) fail(`uniform observed frame: ${name}`);
    if (nonuniformRgb(Buffer.alloc(pixels.length))) fail("uniform-buffer negative control failed");
    return value;
  });
  const [current, raw, prior, next] = observations;
  if (same(raw.passes, processed) || prior.request.requestId === next.request.requestId ||
      prior.frameId === next.frameId ||
      prior.completion.generation.generationId !== next.completion.generation.generationId ||
      prior.subjectGeneration !== next.subjectGeneration ||
      prior.cameraState?.focusDistanceMm !== 7740 || next.cameraState?.focusDistanceMm !== 7750 ||
      current.cameraState?.focusDistanceMm !== 7750) fail("invalid real bypass or stale-frame controls");

  const gpu = JSON.parse(read("depth-edge.json").toString("utf8"));
  if (gpu.backend !== "webgl2" || gpu.scene?.frontDistanceMm !== 400 ||
      gpu.scene?.backDistanceMm !== 410 || !gpu.renderer) fail("invalid GPU fixture provenance");
  const thinLens = (distance, focus, fNumber) => {
    const imageDistance = (subject) => 150 * subject / (subject - 150);
    return 150 / fNumber * (imageDistance(focus) / imageDistance(distance) - 1);
  };
  const references = [
    ["focus-foreground-400-f2_8", "backgroundCoCDiameterMm", 410, 400, 2.8],
    ["focus-near-far-390-f2_8", "foregroundCoCDiameterMm", 400, 390, 2.8],
    ["focus-background-410-f1_4", "foregroundCoCDiameterMm", 400, 410, 1.4],
  ];
  for (const [id, field, distance, focus, fNumber] of references) {
    const observed = gpu.cases?.[id]?.[field];
    if (!Number.isFinite(observed) || Math.abs(observed - thinLens(distance, focus, fNumber)) >= 0.15) {
      fail(`invalid optical reference: ${id}`);
    }
  }
  const edge = gpu.cases?.["focus-foreground-400-f2_8"];
  if (!(edge.candidateEdgeRedIncrease < 1 && edge.legacyEdgeRedIncrease > 20 &&
        edge.legacyEdgeRedIncrease - edge.candidateEdgeRedIncrease > 50)) {
    fail("legacy depth-rejection negative control did not discriminate");
  }
  return { integrity: "PASS", qualification: "PARTIAL", evidenceType: "retained-offline" };
}
