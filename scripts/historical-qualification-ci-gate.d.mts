export type HistoricalQualificationGateInput = Readonly<{
  featureRoutingResult?: string;
  featureRoutingDecision?: string;
  featureGateResult?: string;
  historicalResult?: string;
  historicalDecision?: string;
  historicalMode?: string;
  eventName?: string;
  ref?: string;
}>;

export function evaluateHistoricalQualificationGate(input: HistoricalQualificationGateInput): {
  passed: boolean;
  reasons: string[];
};
