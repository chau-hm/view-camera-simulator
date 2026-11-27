// Explicit command targets; arguments after the target are fixed mode arguments.
export const evidenceCommands = Object.freeze({
  "replay m7e": [
    "./scripts/run-m7e-offline-replay.mjs"
  ],
  "replay m7f": [
    "./scripts/run-m7f-presentation-evidence-replay.mjs"
  ],
  "replay m7g": [
    "./scripts/run-m7g-consolidation.mjs"
  ],
  "report m7g": [
    "./scripts/run-m7g-consolidation.mjs",
    "--diagnostic"
  ],
  "triage m7h": [
    "./scripts/run-m7h-triage.mjs",
    "--inventory"
  ],
  "compare m7h": [
    "./scripts/run-m7h-triage.mjs"
  ],
  "check m7h": [
    "./scripts/run-m7h-triage.mjs",
    "--diagnostic"
  ],
  "check m7i": [
    "./scripts/run-m7i-remediation.mjs",
    "--diagnostic"
  ],
  "check m7j": [
    "./scripts/run-m7j-four-worker-stability.mjs"
  ],
  "run m7k": [
    "./scripts/run-m7k-broad-e2e.mjs"
  ],
  "check m7k": [
    "./scripts/run-m7k-qualification.mjs"
  ],
  "require-qualified m7k": [
    "./scripts/run-m7k-qualification.mjs",
    "--require-qualified"
  ],
  "check m7l": [
    "./scripts/run-m7l-learning-drawer-remediation.mjs"
  ],
  "check m7m": [
    "./scripts/run-m7m-scene-readiness.mjs"
  ],
  "check m7n": [
    "./scripts/run-m7n-renderer-lifecycle.mjs"
  ],
  "capture m7o": [
    "./scripts/run-m7o-canvas-assertion-timing.mjs"
  ],
  "normalize m7o": [
    "./scripts/normalizeM7oCanvasAssertionTimingCapture.mjs"
  ],
  "normalize m7o-matrix": [
    "./scripts/normalizeM7oCanvasAssertionTimingMatrix.mjs"
  ],
  "check m7o": [
    "./scripts/run-m7o-evidence.mjs"
  ],
  "capture m7p": [
    "./scripts/run-m7p-assertion-scheduling.mjs"
  ],
  "normalize m7p": [
    "./scripts/normalizeM7pAssertionSchedulingCapture.mjs"
  ],
  "check m7p": [
    "./scripts/run-m7p-evidence.mjs"
  ],
  "capture m7q": [
    "./scripts/run-m7q-light-peer-trace-ab.mjs"
  ],
  "normalize m7q": [
    "./scripts/normalizeM7qLightPeerTraceAb.mjs"
  ],
  "check m7q": [
    "./scripts/run-m7q-evidence.mjs"
  ],
  "normalize m7r": [
    "./scripts/normalizeM7rBroadE2eCapture.mjs"
  ],
  "check m7r": [
    "./scripts/run-m7r-evidence.mjs"
  ],
  "check m7v": [
    "./scripts/run-m7v-qualification.mjs",
    "validate-policy"
  ],
  "require-approved m7v": [
    "./scripts/run-m7v-qualification.mjs",
    "require-approved"
  ],
  "require-qualified m7v": [
    "./scripts/run-m7v-qualification.mjs",
    "require-qualified"
  ],
  "normalize m7w": [
    "./scripts/normalizeM7wQualificationCapture.mjs"
  ],
  "check m7w": [
    "./scripts/run-m7w-evidence.mjs"
  ],
  "qualify": [
    "./scripts/run-historical-qualification.mjs"
  ],
  "migrate m7e": [
    "--experimental-strip-types",
    "./scripts/migrateM7ePersistedCaptures.mjs"
  ]
});
