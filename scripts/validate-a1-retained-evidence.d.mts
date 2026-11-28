export function validateA1RetainedEvidence(root: string, suppliedRecord?: unknown): {
  integrity: "PASS";
  qualification: "PARTIAL";
  evidenceType: "retained-offline";
};
export function validateA1IntegratedEvidence(root: string, suppliedRecord?: unknown): Promise<{
  integrity: "PASS";
  qualification: "PARTIAL" | "QUALIFIED";
  evidenceType: "retained-offline";
  contracts: Record<"D1" | "D2" | "D3" | "D4" | "D5" | "D6", "QUALIFIED" | "PARTIAL">;
}>;
