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
