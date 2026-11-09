import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export function captureBelongsToRun(metadata, captureRun) {
  return Boolean(
    metadata &&
    captureRun &&
    metadata.captureRunId === captureRun.captureRunId &&
    metadata.captureRunSourceCommit === captureRun.sourceCommit,
  );
}

export function currentRunCaptureIds(expectedCaptureIds, metadataById, captureRun) {
  return expectedCaptureIds.filter((captureId) =>
    captureBelongsToRun(metadataById[captureId], captureRun),
  );
}

export async function findCurrentCaptureIds(captureSpecs, outputDirectory, captureRun) {
  const metadataById = {};
  for (const capture of captureSpecs) {
    try {
      const metadata = JSON.parse(await readFile(
        resolve(outputDirectory, "captures", `${capture.captureId}.json`),
        "utf8",
      ));
      await readFile(resolve(outputDirectory, capture.path));
      metadataById[capture.captureId] = metadata;
    } catch {
      // Missing paths and stale sidecars are excluded from the current run inventory.
    }
  }
  return currentRunCaptureIds(captureSpecs.map((capture) => capture.captureId), metadataById, captureRun);
}
