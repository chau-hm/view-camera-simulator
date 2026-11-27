import { CAGE_REVOLUTION_SECONDS } from "./assets/tourbillon-watch/watch.mjs";

const TWO_PI = Math.PI * 2;
const revolutionDurationMs = CAGE_REVOLUTION_SECONDS * 1000;
let activeResetGeneration: number | null = null;
let epochMs: number | null = null;

const monotonicNow = (): number => performance.now();

/** Sample the shared phase by absolute elapsed time, never accumulated deltas. */
export const macroWatchCageAngleAt = (
  nowMs: number,
  startMs: number,
): number => {
  const elapsedMs = ((nowMs - startMs) % revolutionDurationMs + revolutionDurationMs) %
    revolutionDurationMs;
  return -(elapsedMs / revolutionDurationMs) * TWO_PI;
};

/** Pure query-policy check for reproducible development captures. */
export const shouldFreezeMacroWatchCageForCapture = (
  search: string,
  isDevelopmentBuild: boolean,
): boolean => isDevelopmentBuild &&
  new URLSearchParams(search).get("macroWatchCage") === "static";

/**
 * Both renderer instances sample this one reset-generation timeline. The
 * first frame of a newer generation establishes phase zero; stale frames from
 * a renderer still committing the previous React update cannot reset it.
 */
export const getMacroWatchCageAngle = (
  resetGeneration: number,
  nowMs = monotonicNow(),
  freezeAtCanonicalPhase = false,
): number => {
  if (activeResetGeneration === null || resetGeneration > activeResetGeneration) {
    activeResetGeneration = resetGeneration;
    epochMs = nowMs;
  }
  return freezeAtCanonicalPhase || epochMs === null
    ? 0
    : macroWatchCageAngleAt(nowMs, epochMs);
};
