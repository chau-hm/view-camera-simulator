export const formatPerformanceSample = (value: number | null, unit: string): string =>
  value === null ? "n/a" : `${value.toFixed(1)} ${unit}`;

export const scheduleNextPaintSample = (onSample: (sampleMs: number) => void) => {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return;
  }

  const startedAt = performance.now();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      onSample(Math.max(0, performance.now() - startedAt));
    });
  });
};
