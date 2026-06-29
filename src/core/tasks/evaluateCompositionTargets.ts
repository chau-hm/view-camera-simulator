export const evaluateCompositionTargets = (
  coverageByTarget: Record<string, number>,
  targetId: string,
  minimumCoverage: number,
): boolean => (coverageByTarget[targetId] ?? 0) >= minimumCoverage;
