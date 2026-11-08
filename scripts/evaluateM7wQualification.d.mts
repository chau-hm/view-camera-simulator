export declare const M7W_EVALUATOR_REVISION: "m7w-webgl-qualification-evaluator-v1";
export declare const M7W_EXECUTION_SOURCE_SHA: "17a4ccb9f4ae08069defaa9a1eac9938833412ae";
export declare const M7W_REPRESENTATIVE_IDENTITIES: string[];
export declare function flattenM7wPlaywrightReport(report: Record<string, unknown>): Array<Record<string, unknown>>;
export declare function measureM7wConcurrency(rows: Array<Record<string, unknown>>): {
  actualWorkerSlots: number[];
  actualWorkers: number;
  actualWorkerIndexes: number[];
  unverifiableExecutionIntervals: number;
  peakConcurrency: number;
  fourWayOverlapMs: number;
};
export declare function summarizeM7wCapture(report: Record<string, unknown>, rows: Array<Record<string, unknown>>): Record<string, unknown>;
export declare function sameM7wStringSet(actual: string[], expected: string[]): boolean;
export declare function verifyM7wDigest(bytes: Uint8Array, expectedDigest: string): boolean;
export declare function deriveM7wFailureSurface(row: Record<string, unknown>): string;
export declare function evaluateM7wEvidence(input: Record<string, unknown>): { passed: boolean; issues: string[] };
