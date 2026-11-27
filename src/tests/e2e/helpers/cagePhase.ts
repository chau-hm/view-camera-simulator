/** Circular phase error for a clockwise, one-revolution-per-minute cage. */
export function cagePhaseError(before: number, after: number, elapsedMs: number): number {
  const expected = before - elapsedMs * 2 * Math.PI / 60_000;
  return Math.abs(Math.atan2(Math.sin(after - expected), Math.cos(after - expected)));
}
