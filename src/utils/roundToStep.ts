export const roundToStep = (value: number, step: number): number => {
  if (!Number.isFinite(value)) {
    throw new Error("roundToStep requires a finite value");
  }
  if (!Number.isFinite(step) || step <= 0) {
    throw new Error("roundToStep requires a positive finite step");
  }

  const precision = Math.max(0, Math.ceil(-Math.log10(step)) + 2);
  return Number((Math.round(value / step) * step).toFixed(precision));
};
