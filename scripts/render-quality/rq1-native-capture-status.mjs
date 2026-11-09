const ENVIRONMENT_BLOCKERS = new Set([
  "webgpu-api-absent",
  "adapter-unavailable",
]);

export function classifyNativePreflight(preflight, captureRun) {
  if (
    !preflight ||
    preflight.schemaVersion !== "rq1-native-preflight-v1" ||
    preflight.captureRunId !== captureRun?.captureRunId ||
    preflight.sourceCommit !== captureRun?.sourceCommit ||
    preflight.browserProject !== "chrome-native-webgpu" ||
    typeof preflight.browserVersion !== "string" ||
    preflight.browserVersion.length === 0 ||
    preflight.browserLaunched !== true ||
    preflight.localPageLoaded !== true ||
    preflight.secureContext !== true
  ) {
    return "invalid";
  }

  if (
    preflight.status === "available" &&
    preflight.probeStatus === "adapter-available" &&
    preflight.navigatorGpuPresent === true &&
    preflight.adapterAvailable === true
  ) {
    return "available";
  }

  if (
    preflight.status === "environment-unavailable" &&
    ENVIRONMENT_BLOCKERS.has(preflight.probeStatus) &&
    ((preflight.probeStatus === "webgpu-api-absent" &&
      preflight.navigatorGpuPresent === false &&
      preflight.adapterAvailable === null) ||
      (preflight.probeStatus === "adapter-unavailable" &&
        preflight.navigatorGpuPresent === true &&
        preflight.adapterAvailable === false))
  ) {
    return "environment-unavailable";
  }

  return "invalid";
}

export function classifyNativeCaptureOutcome({
  preflight,
  captureRun,
  processExitCode,
  processSignal,
  captureAttempted,
  expectedCaptureIds,
  currentCaptureIds,
  nativeArtifactsPresent,
}) {
  const preflightStatus = classifyNativePreflight(preflight, captureRun);
  const hasSuccessfulProcess = processExitCode === 0 && processSignal === null;
  const hasExactCaptureInventory = sameOrderedIds(currentCaptureIds, expectedCaptureIds);

  if (
    preflightStatus === "environment-unavailable" &&
    hasSuccessfulProcess &&
    captureAttempted === false &&
    currentCaptureIds.length === 0 &&
    nativeArtifactsPresent === false
  ) {
    return { status: "blocked", reasonClass: "environment-unavailable" };
  }

  if (
    preflightStatus === "available" &&
    hasSuccessfulProcess &&
    captureAttempted === true &&
    hasExactCaptureInventory
  ) {
    return { status: "captured", reasonClass: null };
  }

  return {
    status: "invalid",
    reasonClass: preflightStatus === "available" ? "native-capture-failure" : "unknown-failure",
  };
}

export function nativeCaptureStatusErrors(status, captureRun, expectedCaptureIds, currentCaptureIds, nativeArtifactsPresent) {
  const errors = [];
  if (!status || status.schemaVersion !== "rq1-native-status-v1") {
    return ["native status schema is missing or unsupported"];
  }
  if (status.captureRunId !== captureRun?.captureRunId || status.sourceCommit !== captureRun?.sourceCommit) {
    errors.push("native status provenance does not match the current capture run");
  }
  const preflightStatus = classifyNativePreflight(status.preflight, captureRun);
  const attempt = status.nativeTest ?? {};
  if (status.exitCode !== attempt.exitCode || (status.signal ?? null) !== (attempt.signal ?? null)) {
    errors.push("native process exit fields contradict the structured native test record");
  }
  const classified = classifyNativeCaptureOutcome({
    preflight: status.preflight,
    captureRun,
    processExitCode: attempt.exitCode,
    processSignal: attempt.signal,
    captureAttempted: attempt.captureAttempted,
    expectedCaptureIds,
    currentCaptureIds,
    nativeArtifactsPresent,
  });

  if (status.status !== classified.status || status.reasonClass !== classified.reasonClass) {
    errors.push("native status classification is inconsistent with the structured preflight, process, and capture inventory");
  }
  if (status.status === "invalid") errors.push("native capture is invalid");
  if (status.status !== "captured" && status.status !== "blocked" && status.status !== "invalid") {
    errors.push("native status must be captured, blocked, or invalid");
  }
  if (status.preflight?.status !== "available" && status.status === "captured") {
    errors.push("captured native status has no successful browser/GPU preflight");
  }

  const expectedCaptured = status.status === "captured" ? expectedCaptureIds : [];
  const expectedMissing = status.status === "blocked" ? expectedCaptureIds : [];
  if (!sameOrderedIds(status.capturedCaptureIds, expectedCaptured)) {
    errors.push("native capturedCaptureIds do not match the exact current-run capture inventory");
  }
  if (!sameOrderedIds(status.missingCaptureIds, expectedMissing)) {
    errors.push("native missingCaptureIds do not match the required current-run identities");
  }

  if (status.status === "blocked") {
    if (preflightStatus !== "environment-unavailable") {
      errors.push("blocked native status lacks supported environment-unavailability evidence");
    }
    if (attempt.captureAttempted !== false || attempt.exitCode !== 0 || attempt.signal !== null) {
      errors.push("blocked native status has a failed process or attempted native capture");
    }
    if (currentCaptureIds.length !== 0 || nativeArtifactsPresent) {
      errors.push("blocked native status contains partial current-run native artifacts");
    }
  }

  if (status.status === "captured") {
    if (attempt.captureAttempted !== true || attempt.exitCode !== 0 || attempt.signal !== null) {
      errors.push("captured native status lacks a successful native capture process");
    }
  }
  const expectedBlocker = status.status === "blocked"
    ? `Native prerequisite unavailable: ${status.preflight?.probeStatus}.`
    : null;
  if (status.blocker !== expectedBlocker) errors.push("native blocker text contradicts its structured classification");

  return errors;
}

function sameOrderedIds(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((captureId, index) => captureId === expected[index]);
}
