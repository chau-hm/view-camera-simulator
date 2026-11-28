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

const integratedSourcePins = {
  "scripts/ground-glass-a1/capture.mjs":
    "b1ea7fabdea548652cc183ab372a0c9011b22063a4e5b27c6ae3fc9e9715b764",
  "scripts/ground-glass-a1/assess.mjs":
    "8c281f87590b7bb9064b3118c7bedee87cff805aa62c02109bbe77f0e6c4866f",
  "scripts/ground-glass-a1/rtt-tap.txt":
    "f84eff912eb816af8a99ca50ae22d637779a46ccb5f3e0d8bb8ab55fa5bbbf1b",
  "scripts/ground-glass-a1/source-injection.mjs":
    "612f6e218b8ddadfe5bb7a520376c8865ca74b6f79cd5cf766df943ea8917f13",
  "scripts/ground-glass-a1/pixel-provenance.mjs":
    "5b8dc09d3a74c4fbb9feca4e046f329a2074ddc46501e3cba316998010746d78",
  "scripts/ground-glass-a1/capture-optical-evidence.mjs":
    "fd98bf2c5c22adf51b5cc49288cdc488903aea436e6ba5125caf8c0c6d607a38",
  "src/render/GroundGlassRTT.tsx":
    "11486de9d6fd777f694e8f1901ce8b5754db3bf81eeebc248a219335dd39791a",
  "src/render/groundGlassRttResources.ts":
    "bdc2a6f88501974cb87cd2725e9de86f8c0bddd7d251e07e00010fa2f2a2a443",
  "src/render/groundGlassDofShaderSources.ts":
    "43d350050ca820771ae8fcdfd5d814e5dd65bc02b204b5011e82fa177a207aee",
  "src/tests/e2e/helpers/groundGlassA1Frame.ts":
    "9aec4ca325acffee019a9b4da60a6276babb97877233df52633f7a9e0a4b59f3",
  "src/tests/e2e/helpers/groundGlassA1Orientation.ts":
    "960bbd71c936554029adcd319eb8805ab083a1f2973c5541a319cddeb37cdc5c",
  "src/tests/render-quality/groundGlassA1OpticalAcceptance.ts":
    "aea190f37259ab1c174575034459e403b6b0e620f652a51bdc6d4875e8fb9f6f",
  "src/tests/e2e/fixtures/ground-glass-dof-edge-harness.ts":
    "2982255f0110295824c6c0cf4022ce9d45ce7fbb8fb6f760b409920314493b14",
  "playwright.rq3a.config.ts": "9a87bca9b282e28fadcf852fef361639b5093dc20faa444f772a94b053931c0c",
  "vite.config.ts": "51039bbc7ca0eed12089c0ff75246b47f2f3cc5dcccc7876245f3d2841a4d61c",
  "src/render/groundGlassDofShaders.ts":
    "66de0b771946885606f8fe540a40b6e4c06f2ec6eaee5d44b53d17da08dab9e6",
  "src/render/groundGlassShaderBindings.ts":
    "a540af5375c259f065047aefd674efe08015f58f08e1ae29032088586b10a696",
  "src/render/groundGlassDofRenderState.ts":
    "3867f7107987ac33cb38de3d971af4670132d59634e7d949de8108e5775a474c",
  "package.json": "a0dde0590582cf55972d4074c0a2da02a1848feb08bccf0e7538d351f2b4fbbd",
  "package-lock.json": "a65fa1145f80dd969f814db546fe115181e5773d4f83256e9edae82d513af802",
  "playwright.config.ts": "8c7013d00720db89bb2b7a57f1dbcb8647c0c5ea602cbb14880cee69ea04413e",
};

const integratedD6SourcePins = {
  "scripts/ground-glass-a1/capture-d6.mjs":
    "bd4d81c24996a4c03b63213fd116bfcd8bdcd3ce8faa9afc61bba87ede365e6e",
  "scripts/ground-glass-a1/assess-d6.mjs":
    "3dd3841c3eac80430a440e05b3517149a789ae4d49387b2bebda5a06b35753e7",
  "docs/architecture/environment-readiness/a1-d6-reference.md":
    "2906251470c096e4b8c6dbe9ef3826e2094949447781fa1c7bb7ee4eaa992bf0",
  "scripts/ground-glass-a1/capture-optical-varied.mjs":
    "a3a4b8b03ac0dd48494cfc31779d4cd3fd7d1a0380984fd4b8baa68be7f16841",
  "src/scenes/architectureForegroundGeometry.ts":
    "488d114c0721fb9190113433e39c9ffbeda093b4ef70873e869e8dfe2fb9cc73",
  "src/scenes/architectureForegroundMaterialVariation.ts":
    "1f7e68af28b50ef8bd8e685ae23f0e7c2668b4c64b71655c1e2b9d35b5b110da",
  "src/render/ArchitectureForegroundSubjectFactory.tsx":
    "2a3c7726807bfe0dd6156025e84ee710cdc3c067ea07f483f4ce8b6fef6e77cb",
  "src/render/architecture-foreground/Elevations.ts":
    "3f70c78bb2650935c0fed0e58bed04164997a85b995e8c9d93e2ae1ffafa191e",
  "src/render/architecture-foreground/BuildingMaterials.ts":
    "c784c03979755b64cb9738b5580a47de9ecef5e4622d4c9753be996dc5590592",
  "src/core/optics/groundGlassIlluminance.ts":
    "9e07898f935775a75a0337f35cee1cab1a579645f6598ff2e585db518242cec3",
  "src/render/groundGlassCoverage.ts":
    "19b2fa257b8f306174284f74bdccdcdbe8707b951bad185a3cbe6bb5e2571ffb",
};

// Schema v2 is a separate, current qualification record. Its decisions are derived
// from actual retained bytes; the v1 historical validator above remains intact.
export async function validateA1IntegratedEvidence(root, suppliedRecord) {
  const { gunzipSync } = await import("node:zlib");
  const { evaluatePixelProvenance } = await import("./ground-glass-a1/pixel-provenance.mjs");
  const { evaluateGroundGlassA1Frame, evaluateA1ReferenceOccupancy } =
    await import("../src/tests/e2e/helpers/groundGlassA1Frame.ts");
  const { compareGroundGlassOrientations } =
    await import("../src/tests/e2e/helpers/groundGlassA1Orientation.ts");
  const { evaluateGroundGlassA1OpticalResponse } =
    await import("../src/tests/render-quality/groundGlassA1OpticalAcceptance.ts");
  const read = (name) => readFileSync(join(root, name));
  const record = suppliedRecord ?? JSON.parse(read("record.json").toString("utf8"));
  const names = [
    "stress-1",
    "control-bypass",
    "control-previous-request",
    "control-next-request",
    "control-physical-orientation",
  ];
  const full = record.decision === "QUALIFIED";
  const expectedContracts = {
    D1: "QUALIFIED",
    D2: "QUALIFIED",
    D3: "QUALIFIED",
    D4: "QUALIFIED",
    D5: "QUALIFIED",
    D6: full ? "QUALIFIED" : "PARTIAL",
  };
  if (
    record.schemaVersion !== 2 ||
    record.evidenceType !== "retained-offline" ||
    !Array.isArray(record.limitations) ||
    record.limitations.length < 2 ||
    record.captureCommit !== "bf923e4144b1baac9a53d529fc372655f3e66280" ||
    record.opticalSourceCommit !== "d4f638e5e6c955f7bd234513985c5c10abb8911b" ||
    !["PARTIAL", "QUALIFIED"].includes(record.decision) ||
    !same(record.contracts, expectedContracts)
  )
    fail("invalid integrated schema, provenance or decision");
  const sourceRoot = process.cwd();
  const pins = record.sourcePins;
  if (!same(pins, integratedSourcePins)) fail("integrated producer identity mismatch");
  for (const [path, sha] of Object.entries(integratedSourcePins))
    if (digest(readFileSync(join(sourceRoot, path))) !== sha)
      fail(`integrated source mismatch: ${path}`);
  const files = record.files;
  if (!files || typeof files !== "object" || !files["frames.json"] || !files["optical.json"])
    fail("missing integrated inventory");
  for (const [path, sha] of Object.entries(files)) {
    if (
      !/^(?:record-f1\.json|frames\.json|optical(?:-varied)?\.json|d6\/captures\.json\.gz|d6\/blobs\/[a-f0-9]{64}\.bin\.gz|blobs\/[a-f0-9]{64}\.rgba\.gz|optical(?:-varied)?\/(?:source|output-(?:candidate|wrongCoc|excessiveBlur|zeroBlur|legacy|restored)|coc-(?:candidate|wrongCoc|excessiveBlur|zeroBlur|legacy|restored))\.rgba\.gz)$/.test(
        path,
      ) ||
      !/^[a-f0-9]{64}$/.test(sha) ||
      digest(read(path)) !== sha
    )
      fail(`integrated digest mismatch: ${path}`);
  }
  const used = new Set(["frames.json", "optical.json"]);
  const sessions = JSON.parse(read("frames.json").toString("utf8"));
  if (!Array.isArray(sessions) || sessions.length !== 3) fail("missing independent observations");
  const frameIds = new Set(),
    generationIds = new Set();
  for (const session of sessions) {
    if (!same(Object.keys(session).sort(), [...names].sort())) fail("invalid frame inventory");
    const frames = {};
    for (const name of names) {
      const { observation: o, readbacks } = session[name];
      if (
        o.source !== record.captureCommit ||
        o.trackedSourceClean !== true ||
        o.seed !== "284719" ||
        o.completion?.status !== "completed" ||
        o.preparationFinite !== true ||
        o.rawDebug !== (name === "control-bypass") ||
        o.acceptedUi?.["data-frame-request-id"] !== o.request?.requestId ||
        o.acceptedUi?.["data-last-completed-request-id"] !== o.request?.requestId ||
        o.acceptedUi?.["data-renderer-generation"] !== o.completion?.generation?.generationId ||
        o.expectedSubjectGeneration !== o.subjectGeneration ||
        !o.adapter ||
        o.diagnostics?.profile == null
      )
        fail(`invalid completed observation: ${name}`);
      const decoded = {};
      for (const target of ["raw", "final"]) {
        const item = readbacks?.[target],
          path = item?.blob;
        if (!files[path] || !/^[a-f0-9]+$/.test(item.sample) || item.sample.length !== 8192)
          fail(`missing readback: ${name}`);
        used.add(path);
        const source = gunzipSync(read(path));
        const sample = Buffer.from(item.sample, "hex");
        const provenance = o.pixelProvenance?.[target];
        if (
          provenance?.sourceWidth !== (target === "raw" ? o.width : o.finalWidth) ||
          provenance?.sourceHeight !== (target === "raw" ? o.height : o.finalHeight) ||
          evaluatePixelProvenance(source, sample, provenance, o.completion.frameId).length
        )
          fail(`pixel provenance mismatch: ${name}`);
        decoded[target] = { source, sample };
      }
      const c = o.completion,
        p = o.preparation;
      const frame = {
        request: {
          ...o.request,
          rendererGeneration: o.acceptedUi["data-renderer-generation"],
          subjectGeneration: o.expectedSubjectGeneration,
        },
        completed: {
          ...c.request,
          rendererGeneration: c.generation.generationId,
          subjectGeneration: o.subjectGeneration,
          frameId: c.frameId,
          requiredOperations: c.requiredOperations,
        },
        capture: {
          requestId: o.request.requestId,
          rendererGeneration: c.generation.generationId,
          subjectGeneration: o.subjectGeneration,
          frameId: c.frameId,
          width: 32,
          height: 32,
          format: "rgba8",
          pixels: decoded.final.sample,
        },
        preparation: p && {
          requestId: o.request.requestId,
          rendererGeneration: c.generation.generationId,
          subjectGeneration: o.subjectGeneration,
          frameId: c.frameId,
          focalLengthMm: p.optics?.focalLengthMm,
          apertureFNumber: p.optics?.apertureFNumber,
          imageDistanceMm: p.optics?.imageDistanceMm,
          filmWidthMm: p.film?.widthMm,
          filmHeightMm: p.film?.heightMm,
          renderWidthPx: p.render?.widthPx,
          renderHeightPx: p.render?.heightPx,
        },
        executedPasses: o.passes,
      };
      const mode = name === "control-bypass" ? "bypass" : "processed";
      if (
        evaluateGroundGlassA1Frame(frame, mode).length ||
        evaluateGroundGlassA1Frame(
          { ...frame, capture: { ...frame.capture, pixels: decoded.raw.sample } },
          mode,
        ).length
      )
        fail(`invalid frame contract: ${name}`);
      if (name === "stress-1") {
        const altered = (patch) => evaluateGroundGlassA1Frame({ ...frame, ...patch }, "processed");
        const uniform = Buffer.alloc(32 * 32 * 4, 255),
          transparent = Buffer.from(frame.capture.pixels);
        for (let i = 3; i < transparent.length; i += 4) transparent[i] = 0;
        if (
          !altered({ preparation: null }).includes("invalid-current-preparation") ||
          !altered({ preparation: { ...frame.preparation, focalLengthMm: NaN } }).includes(
            "invalid-current-preparation",
          ) ||
          !altered({
            preparation: { ...frame.preparation, requestId: "earlier-request" },
          }).includes("invalid-current-preparation") ||
          !altered({ capture: { ...frame.capture, pixels: uniform } }).includes("uniform-buffer") ||
          !altered({ capture: { ...frame.capture, pixels: transparent } }).includes(
            "unexpected-alpha",
          ) ||
          !altered({ capture: { ...frame.capture, pixels: Buffer.alloc(1) } }).includes(
            "invalid-buffer",
          )
        )
          fail("synthetic preparation or buffer controls failed");
      }
      frames[name] = { o, frame, decoded };
    }
    const current = frames["stress-1"],
      bypass = frames["control-bypass"],
      previous = frames["control-previous-request"],
      next = frames["control-next-request"],
      raw = frames["control-physical-orientation"];
    if (
      !evaluateA1ReferenceOccupancy(current.decoded.final.sample) ||
      current.o.cameraState?.focusDistanceMm !== 7750 ||
      previous.o.cameraState?.focusDistanceMm !== 7740 ||
      next.o.cameraState?.focusDistanceMm !== 7750 ||
      previous.o.request.requestId === next.o.request.requestId ||
      previous.o.frameId === next.o.frameId ||
      !evaluateGroundGlassA1Frame(
        { ...previous.frame, request: next.frame.request },
        "processed",
      ).includes("incomplete-current-frame") ||
      !evaluatePixelProvenance(
        next.decoded.final.source,
        previous.decoded.final.sample,
        next.o.pixelProvenance.final,
        next.o.frameId,
      ).includes("pixel-provenance-mismatch") ||
      !evaluateGroundGlassA1Frame(bypass.frame, "processed").includes("unexpected-pass-execution")
    )
      fail("current, stale or bypass control failed");
    if (
      raw.o.previewMode !== "raw" ||
      next.o.previewMode !== "upright" ||
      raw.o.rawDebug ||
      next.o.rawDebug ||
      raw.o.adapter !== next.o.adapter ||
      raw.o.subjectGeneration !== next.o.subjectGeneration ||
      raw.o.completion.generation.generationId !== next.o.completion.generation.generationId ||
      raw.o.finalWidth !== next.o.finalWidth ||
      raw.o.finalHeight !== next.o.finalHeight ||
      raw.o.acceptedUi["data-policy-selected-backend"] !==
        next.o.acceptedUi["data-policy-selected-backend"] ||
      raw.o.nearM !== next.o.nearM ||
      raw.o.farM !== next.o.farM ||
      raw.o.width !== next.o.width ||
      raw.o.height !== next.o.height ||
      raw.o.renderQuality !== next.o.renderQuality ||
      !same(raw.o.projection, next.o.projection) ||
      !same(
        Object.fromEntries(
          Object.entries(raw.o.cameraState).filter(([k]) => k !== "groundGlassAssistEnabled"),
        ),
        Object.fromEntries(
          Object.entries(next.o.cameraState).filter(([k]) => k !== "groundGlassAssistEnabled"),
        ),
      )
    )
      fail("orientation state mismatch");
    const a = raw.decoded.final.sample,
      b = next.decoded.final.sample;
    const reflect = (bytes, fx, fy) => {
      const out = Buffer.alloc(bytes.length);
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++) {
          const i = (y * 32 + x) * 4,
            j = ((fy ? 31 - y : y) * 32 + (fx ? 31 - x : x)) * 4;
          bytes.copy(out, j, i, i + 4);
        }
      return out;
    };
    if (
      !compareGroundGlassOrientations(a, b, 32, 32, 2, 5).accepted ||
      [
        [true, false],
        [false, true],
        [false, false],
      ].some(([x, y]) => compareGroundGlassOrientations(a, reflect(a, x, y), 32, 32, 2, 5).accepted)
    )
      fail("orientation control mismatch");
    if (
      frameIds.has(next.o.frameId) ||
      generationIds.has(next.o.completion.generation.generationId)
    )
      fail("duplicate repeatability observation");
    frameIds.add(next.o.frameId);
    generationIds.add(next.o.completion.generation.generationId);
  }
  const validateOptical = (proofName, prefix, producer, commit, variation) => {
    const optical = JSON.parse(read(proofName).toString("utf8"));
    if (
      optical.captureCommit !== commit ||
      optical.trackedRelevantSourceClean !== true ||
      optical.backend !== "webgl2" ||
      !optical.renderer ||
      optical.variation !== variation ||
      optical.fixtureSha256 !==
        integratedSourcePins["src/tests/e2e/fixtures/ground-glass-dof-edge-harness.ts"] ||
      optical.producerSha256 !== producer ||
      optical.scene?.frontDistanceMm !== 400 ||
      optical.scene?.backDistanceMm !== 410
    )
      fail("invalid optical provenance");
    const variants = ["candidate", "wrongCoc", "excessiveBlur", "zeroBlur", "legacy", "restored"];
    const opticalFiles = [
      "source",
      ...variants.map((v) => "output-" + v),
      ...variants.map((v) => "coc-" + v),
    ];
    if (
      !same(Object.keys(optical.files ?? {}).sort(), opticalFiles.map((v) => v + ".rgba.gz").sort())
    )
      fail("missing optical readbacks");
    const pixels = {};
    for (const name of opticalFiles) {
      const rel = `${prefix}/${name}.rgba.gz`;
      used.add(rel);
      if (!files[rel]) fail("missing optical buffer");
      const compressed = read(rel),
        data = gunzipSync(compressed),
        identity = optical.files[name + ".rgba.gz"];
      if (
        data.length !== 512 * 384 * 4 ||
        digest(data) !== identity.bytesSha256 ||
        digest(compressed) !== identity.gzipSha256
      )
        fail("invalid optical buffer");
      pixels[name] = data;
    }
    const contrast = (p, x0, x1, y0, y1) => {
      let sum = 0,
        sq = 0,
        n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = 4 * (y * 512 + x),
            v = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
          sum += v;
          sq += v * v;
          n++;
        }
      return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
    };
    const source = pixels.source;
    const row = Array.from({ length: 512 }, (_, x) => {
      const i = 4 * (192 * 512 + x);
      return 0.2126 * source[i] + 0.7152 * source[i + 1] + 0.0722 * source[i + 2];
    });
    if (!same(row, optical.opticalSourceLuminanceRow)) fail("optical source row mismatch");
    const decisions = {};
    for (const v of variants) {
      const output = pixels["output-" + v],
        coc = pixels["coc-" + v],
        i = 4 * (192 * 512 + 232),
        code = coc[i],
        cocMm = (code < 128 ? (code - 128) / 128 : (code - 128) / 127) * 12,
        radius = (Math.max(coc[i + 1], coc[i + 2]) / 255) * 6;
      let edge = 0;
      for (let y = 144; y < 240; y++) {
        const n = 4 * (y * 512 + 255);
        edge += Math.max(0, output[n] - source[n]);
      }
      const measured = {
        signedCoCDiameterMm: cocMm,
        majorRadiusMm: radius,
        majorRadiusPx: (radius * 512) / 127,
        sourceDefocusedContrast: contrast(source, 84, 212, 150, 234),
        processedDefocusedContrast: contrast(output, 84, 212, 150, 234),
        sourceFocusedContrast: contrast(source, 300, 420, 150, 234),
        processedFocusedContrast: contrast(output, 300, 420, 150, 234),
        edgeRedIncrease: edge / 96,
      };
      const stored = optical.opticalMeasurements?.[v];
      if (
        !stored ||
        Object.entries(measured).some(
          ([k, val]) => !Number.isFinite(stored[k]) || Math.abs(stored[k] - val) > 1e-8,
        )
      )
        fail(`optical measurement contradicts pixels: ${v}`);
      decisions[v] = evaluateGroundGlassA1OpticalResponse(measured, row);
    }
    if (
      !decisions.candidate.accepted ||
      !decisions.restored.accepted ||
      !decisions.wrongCoc.failureReasons.includes("signed-coc-mismatch") ||
      !decisions.excessiveBlur.failureReasons.includes("optical-footprint-mismatch") ||
      !decisions.zeroBlur.failureReasons.includes("insufficient-defocus") ||
      !decisions.legacy.failureReasons.includes("depth-rejection-contamination")
    )
      fail("optical acceptance controls failed");
    return { optical, source, decisions };
  };
  const baselineOptical = validateOptical(
    "optical.json",
    "optical",
    integratedSourcePins["scripts/ground-glass-a1/capture-optical-evidence.mjs"],
    record.opticalSourceCommit,
    undefined,
  );
  if (full) {
    const { evaluateD6Pair } = await import("./ground-glass-a1/assess-d6.mjs");
    if (
      record.d6CaptureCommit !== "65298474952505c5e0d5f1e4950cb004a425f2f0" ||
      record.variedOpticalSourceCommit !== "359b07effb7a282deecc1273106468cb5dec9fb1" ||
      !same(record.d6SourcePins, integratedD6SourcePins)
    )
      fail("invalid D6 source identity");
    for (const [path, sha] of Object.entries(integratedD6SourcePins))
      if (digest(readFileSync(join(sourceRoot, path))) !== sha) fail(`D6 source mismatch: ${path}`);
    if (!files["record-f1.json"] || !files["optical-varied.json"] || !files["d6/captures.json.gz"])
      fail("missing D6 evidence");
    used.add("record-f1.json");
    used.add("optical-varied.json");
    used.add("d6/captures.json.gz");
    const oldRecord = JSON.parse(read("record-f1.json").toString("utf8"));
    if (
      oldRecord.decision !== "PARTIAL" ||
      oldRecord.contracts?.D6 !== "PARTIAL" ||
      (await validateA1IntegratedEvidence(root, oldRecord)).qualification !== "PARTIAL"
    )
      fail("invalid F1 historical checkpoint");
    const varied = validateOptical(
      "optical-varied.json",
      "optical-varied",
      integratedD6SourcePins["scripts/ground-glass-a1/capture-optical-varied.mjs"],
      record.variedOpticalSourceCommit,
      "test-only rendered background top strip",
    );
    if (
      baselineOptical.optical.renderer !== varied.optical.renderer ||
      !same(baselineOptical.optical.scene, varied.optical.scene) ||
      baselineOptical.source.equals(varied.source) ||
      !same(
        baselineOptical.optical.opticalSourceLuminanceRow,
        varied.optical.opticalSourceLuminanceRow,
      )
    )
      fail("controlled GPU content variation mismatch");
    const pairs = JSON.parse(gunzipSync(read("d6/captures.json.gz")).toString("utf8"));
    if (!Array.isArray(pairs) || pairs.length !== 3) fail("missing D6 repeatability evidence");
    const ids = new Set(),
      generations = new Set();
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) fail("invalid D6 pair");
      const captures = pair.map((entry) => {
        const o = entry.record,
          refs = entry.readbacks;
        if (
          o?.source !== record.d6CaptureCommit ||
          !same(Object.keys(refs ?? {}).sort(), [
            "coc",
            "depth",
            "final",
            "final32",
            "raw",
            "raw32",
          ]) ||
          o.producerDigests?.["capture-d6.mjs"] !==
            integratedD6SourcePins["scripts/ground-glass-a1/capture-d6.mjs"] ||
          o.producerDigests?.["source-injection.mjs"] !==
            integratedSourcePins["scripts/ground-glass-a1/source-injection.mjs"] ||
          o.producerDigests?.["rtt-tap.txt"] !==
            integratedSourcePins["scripts/ground-glass-a1/rtt-tap.txt"] ||
          o.producerDigests?.["pixel-provenance.mjs"] !==
            integratedSourcePins["scripts/ground-glass-a1/pixel-provenance.mjs"]
        )
          fail("invalid D6 producer provenance");
        const bytes = {};
        for (const [key, path] of Object.entries(refs)) {
          if (!files[path]) fail("missing D6 readback");
          used.add(path);
          const data = gunzipSync(read(path));
          if (!path.endsWith(`${digest(data)}.bin.gz`)) fail("D6 source digest mismatch");
          bytes[key] = data;
        }
        if (ids.has(o.frameId) || generations.has(o.completion?.generation?.generationId))
          fail("duplicate D6 observation");
        ids.add(o.frameId);
        generations.add(o.completion?.generation?.generationId);
        return { record: o, ...bytes };
      });
      evaluateD6Pair(captures[0], captures[1]);
      for (const capture of captures) {
        const o = capture.record,
          bytes = capture.depth,
          d = o.diagnostics;
        const v = (150 * 9500) / (9500 - 150);
        if (
          d?.groundGlassNaturalIlluminationEnabled !== true ||
          Math.abs(d.groundGlassNaturalIlluminationImageDistanceMm - v) > 1e-6 ||
          d.groundGlassNaturalIlluminationOffsetXMm !== 0 ||
          d.groundGlassNaturalIlluminationOffsetYMm !== 0 ||
          d.groundGlassCoverageEnabled !== true ||
          d.groundGlassCoverageOffsetXMm !== 0 ||
          d.groundGlassCoverageOffsetYMm !== 0
        )
          fail("D6 illumination or coverage mismatch");
        if (bytes.length !== 80 * 64 * 4) fail("invalid D6 depth buffer");
        for (let row = 24; row <= 26; row++)
          for (let col = 38; col <= 40; col++) {
            const hit = o.grid?.[row * 80 + col],
              i = 4 * ((63 - row) * 80 + col);
            if (!hit || !Number.isFinite(hit[1]) || hit[1] < 9.4 || hit[1] > 9.7)
              fail("invalid D6 depth witness");
            const observed = (bytes[i] * 256 + bytes[i + 1]) / 65535,
              expected =
                o.farM / (o.farM - o.nearM) - (o.farM * o.nearM) / ((o.farM - o.nearM) * hit[1]);
            if (Math.abs(observed - expected) > 1.5 / 65535)
              fail("D6 GPU depth contradicts first-hit evidence");
          }
      }
    }
  }
  if (!same([...used].sort(), Object.keys(files).sort()))
    fail("unexpected integrated evidence inventory");
  return {
    integrity: "PASS",
    qualification: full ? "QUALIFIED" : "PARTIAL",
    evidenceType: "retained-offline",
    contracts: expectedContracts,
  };
}
