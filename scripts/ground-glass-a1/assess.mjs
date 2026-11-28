import { evaluatePixelProvenance } from "./pixel-provenance.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { compareGroundGlassOrientations } from "../../src/tests/e2e/helpers/groundGlassA1Orientation.ts";
import { evaluateA1ReferenceOccupancy, evaluateGroundGlassA1Frame } from "../../src/tests/e2e/helpers/groundGlassA1Frame.ts";

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
if (!process.argv[2]) throw new Error("Provide the captured final-historical directory");
const root = pathToFileURL(resolve(process.argv[2]) + "/");
async function load(name) {
  const observed = JSON.parse(await readFile(new URL(name + ".json", root), "utf8"));
  const pixels = await readFile(new URL(name + "-final32.rgba", root));
  for (const target of ["raw", "final"]) {
    const source = await readFile(new URL(name + "-" + target + ".rgba", root));
    const sample = target === "final" ? pixels : await readFile(new URL(name + "-raw32.rgba", root));
    const provenance = observed.pixelProvenance?.[target];
    const provenanceIssues = evaluatePixelProvenance(source, sample, provenance, observed.completion?.frameId);
    if (provenance?.sourceWidth !== (target === "raw" ? observed.width : observed.finalWidth) || provenance?.sourceHeight !== (target === "raw" ? observed.height : observed.finalHeight)) provenanceIssues.push("source-dimension-mismatch");
    if (provenanceIssues.length) throw new Error("Invalid pixel provenance: " + name + " " + provenanceIssues.join(","));
  }
  if (!observed.preparationFinite) throw new Error("Nonfinite or missing captured preparation: " + name);
  const accepted = observed.acceptedUi;
  if (!accepted || accepted["data-frame-request-id"] !== observed.request.requestId ||
      accepted["data-last-completed-request-id"] !== observed.request.requestId) {
    throw new Error("Host did not accept current request: " + name);
  }
  const completion = observed.completion;
  return {
    request: {
      ...observed.request,
      rendererGeneration: accepted["data-renderer-generation"],
      subjectGeneration: observed.expectedSubjectGeneration,
    },
    completed: {
      ...completion.request,
      rendererGeneration: completion.generation.generationId,
      subjectGeneration: observed.subjectGeneration,
      frameId: completion.frameId,
      requiredOperations: completion.requiredOperations,
    },
    capture: {
      requestId: observed.request.requestId,
      rendererGeneration: completion.generation.generationId,
      subjectGeneration: observed.subjectGeneration,
      frameId: completion.frameId,
      width: 32,
      height: 32,
      format: "rgba8",
      pixels,
    },
    preparation: {
      requestId: observed.request.requestId,
      rendererGeneration: observed.completion.generation.generationId,
      subjectGeneration: observed.subjectGeneration,
      frameId: observed.completion.frameId,
      focalLengthMm: observed.preparation.optics.focalLengthMm,
      apertureFNumber: observed.preparation.optics.apertureFNumber,
      imageDistanceMm: observed.preparation.optics.imageDistanceMm,
      filmWidthMm: observed.preparation.film.widthMm,
      filmHeightMm: observed.preparation.film.heightMm,
      renderWidthPx: observed.preparation.render.widthPx,
      renderHeightPx: observed.preparation.render.heightPx,
    },
    executedPasses: observed.passes,
  };
}
const records = await Promise.all(
  ["stress-1", "control-bypass", "control-previous-request", "control-next-request"].map(
    async (name) => JSON.parse(await readFile(new URL(name + ".json", root), "utf8")),
  ),
);
const [processedRecord, bypassRecord, previousRecord, nextRecord] = records;
const generation = processedRecord.completion.generation.generationId;
if (
  records.some((record) => record.completion.generation.generationId !== generation ||
    record.completion.request.requestId !== record.request.requestId ||
    record.subjectGeneration !== processedRecord.subjectGeneration || record.seed !== "284719") ||
  processedRecord.cameraState.focusDistanceMm !== 7750 ||
  bypassRecord.rawDebug !== true || processedRecord.rawDebug !== false ||
  previousRecord.cameraState.focusDistanceMm !== 7740 ||
  nextRecord.cameraState.focusDistanceMm !== 7750 ||
  previousRecord.request.requestId === nextRecord.request.requestId ||
  previousRecord.frameId === nextRecord.frameId
) throw new Error("Captured application records do not establish the matched transition");

const current = await load("stress-1");
const bypass = await load("control-bypass");
const previous = await load("control-previous-request");
const next = await load("control-next-request");
const stale = { ...previous, request: next.request };
const rawRecord = JSON.parse(await readFile(new URL("control-physical-orientation.json", root), "utf8"));
const uprightRecord = nextRecord;
const rawFrame = await load("control-physical-orientation");
if (evaluateGroundGlassA1Frame(rawFrame, "processed").length ||
    rawRecord.previewMode !== "raw" || uprightRecord.previewMode !== "upright" ||
    rawRecord.rawDebug || uprightRecord.rawDebug ||
    rawRecord.seed !== uprightRecord.seed ||
    rawRecord.completion.generation.generationId !== uprightRecord.completion.generation.generationId ||
    rawRecord.subjectGeneration !== uprightRecord.subjectGeneration ||
    rawRecord.width !== uprightRecord.width || rawRecord.height !== uprightRecord.height ||
    rawRecord.finalWidth !== uprightRecord.finalWidth || rawRecord.finalHeight !== uprightRecord.finalHeight ||
    rawRecord.nearM !== uprightRecord.nearM || rawRecord.farM !== uprightRecord.farM ||
    rawRecord.renderQuality !== uprightRecord.renderQuality ||
    rawRecord.acceptedUi["data-policy-selected-backend"] !== uprightRecord.acceptedUi["data-policy-selected-backend"] ||
    rawRecord.adapter !== uprightRecord.adapter ||
    JSON.stringify(rawRecord.projection) !== JSON.stringify(uprightRecord.projection) ||
    JSON.stringify(Object.fromEntries(Object.entries(rawRecord.cameraState).filter(([key]) => key !== "groundGlassAssistEnabled"))) !==
      JSON.stringify(Object.fromEntries(Object.entries(uprightRecord.cameraState).filter(([key]) => key !== "groundGlassAssistEnabled")))) {
  throw new Error("Orientation frames do not share the required optical and rendering state");
}
const rawPixels = await readFile(new URL("control-physical-orientation-final32.rgba", root));
const uprightPixels = await readFile(new URL("control-next-request-final32.rgba", root));
const orientation = compareGroundGlassOrientations(rawPixels, uprightPixels, 32, 32, 2, 5);
const reflect = (pixels, flipX, flipY) => {
  const output = Buffer.alloc(pixels.length);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const source = (y * 32 + x) * 4;
      const target = ((flipY ? 31 - y : y) * 32 + (flipX ? 31 - x : x)) * 4;
      pixels.copy(output, target, source, source + 4);
    }
  }
  return output;
};
const orientationFaults = {
  horizontal: compareGroundGlassOrientations(rawPixels, reflect(rawPixels, true, false), 32, 32, 2, 5),
  vertical: compareGroundGlassOrientations(rawPixels, reflect(rawPixels, false, true), 32, 32, 2, 5),
  unchanged: compareGroundGlassOrientations(rawPixels, rawPixels, 32, 32, 2, 5),
};
const currentSource = await readFile(new URL("control-next-request-final.rgba", root));
const previousPixels = await readFile(new URL("control-previous-request-final32.rgba", root));
const stalePixelIssues = evaluatePixelProvenance(currentSource, previousPixels, nextRecord.pixelProvenance.final, nextRecord.completion.frameId);
const results = {
  stalePixelIssues,
  orientation,
  orientationFaults,
  referenceOccupancy: evaluateA1ReferenceOccupancy(uprightPixels),
  source: "test-only Vite tap in a real Chromium WebGL application frame",
  current: evaluateGroundGlassA1Frame(current, "processed"),
  bypass: evaluateGroundGlassA1Frame(bypass, "bypass"),
  bypassAsProcessed: evaluateGroundGlassA1Frame(bypass, "processed"),
  previousFrameOfferedToNewRequest: evaluateGroundGlassA1Frame(stale, "processed"),
  next: evaluateGroundGlassA1Frame(next, "processed"),
};
await writeFile(new URL("./assessment.json", root), JSON.stringify(results, null, 2) + "\n");
console.log(JSON.stringify(results));
if (!stalePixelIssues.includes("pixel-provenance-mismatch") || !results.referenceOccupancy || !orientation.accepted || Object.values(orientationFaults).some((fault) => fault.accepted) || results.current.length || results.bypass.length || results.next.length ||
  !results.bypassAsProcessed.includes("unexpected-pass-execution") ||
  !results.previousFrameOfferedToNewRequest.includes("incomplete-current-frame")) process.exitCode = 1;
