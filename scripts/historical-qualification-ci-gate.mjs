const acceptedDecisions = new Set(["QUALIFIED", "NOT_APPLICABLE"]);
const suppressedPushDecisions = new Set(["covered-by-pr", "no-commit"]);

export function evaluateHistoricalQualificationGate(input) {
  const reasons = [];
  if (input.featureRoutingResult === "success" && suppressedPushDecisions.has(input.featureRoutingDecision)) {
    reasons.push("redundant-feature-push-ci-should-have-been-suppressed");
  }
  if (input.featureGateResult !== "success") reasons.push(`feature-push-gate-${input.featureGateResult || "missing"}`);
  if (input.historicalResult !== "success") reasons.push(`historical-qualification-${input.historicalResult || "missing"}`);
  if (!acceptedDecisions.has(input.historicalDecision)) reasons.push(`historical-decision-${input.historicalDecision || "missing"}`);
  return { passed: reasons.length === 0, reasons };
}

if (process.argv[1] && process.argv[1].endsWith("historical-qualification-ci-gate.mjs")) {
  const result = evaluateHistoricalQualificationGate({
    featureRoutingResult: process.env.FEATURE_ROUTING_RESULT,
    featureRoutingDecision: process.env.FEATURE_ROUTING_DECISION,
    featureGateResult: process.env.FEATURE_GATE_RESULT,
    historicalResult: process.env.HISTORICAL_RESULT,
    historicalDecision: process.env.HISTORICAL_DECISION,
  });
  if (result.passed) {
    process.stdout.write("Feature-push routing and historical qualification are merge-safe.\n");
  } else {
    for (const reason of result.reasons) process.stderr.write(`${reason}\n`);
    process.exitCode = 1;
  }
}
