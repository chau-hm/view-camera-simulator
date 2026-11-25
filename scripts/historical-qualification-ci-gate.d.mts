export type HistoricalQualificationGateInput = Readonly<{
  featureRoutingResult?: string;
  featureRoutingDecision?: string;
  featureGateResult?: string;
  historicalResult?: string;
  historicalDecision?: string;
}>;

export function evaluateHistoricalQualificationGate(input: HistoricalQualificationGateInput): {
  passed: boolean;
  reasons: string[];
};
