export type MaterialAwareReadinessPhase =
  | "initial-pending"
  | "active"
  | "recovery-pending";

export type MaterialAwareReadinessTiming = Readonly<{
  rendererGeneration: number;
  phase: MaterialAwareReadinessPhase;
  initialStartedAt: number;
  recoveryStartedAt: number | null;
  initialReadinessWaitMs: number | null;
}>;

export type MaterialAwareReadinessTimingResult = Readonly<{
  timing: MaterialAwareReadinessTiming;
  timedOut: boolean;
  timeoutPhase: "initial" | "recovery" | null;
}>;

export const startMaterialAwareReadinessTiming = (
  rendererGeneration: number,
  now: number,
): MaterialAwareReadinessTiming => ({
  rendererGeneration,
  phase: "initial-pending",
  initialStartedAt: now,
  recoveryStartedAt: null,
  initialReadinessWaitMs: null,
});

/**
 * Tracks initial activation separately from later recovery intervals.
 * A generation change starts a fresh initial window; active time is never
 * counted against a later recovery deadline.
 */
export const advanceMaterialAwareReadinessTiming = (
  current: MaterialAwareReadinessTiming,
  rendererGeneration: number,
  ready: boolean,
  now: number,
  timeoutMs: number,
): MaterialAwareReadinessTimingResult => {
  const timing = current.rendererGeneration === rendererGeneration
    ? current
    : startMaterialAwareReadinessTiming(rendererGeneration, now);

  if (ready) {
    const initialActivation = timing.phase === "initial-pending";
    return {
      timing: {
        ...timing,
        phase: "active",
        recoveryStartedAt: null,
        initialReadinessWaitMs: initialActivation
          ? Math.max(0, now - timing.initialStartedAt)
          : timing.initialReadinessWaitMs,
      },
      timedOut: false,
      timeoutPhase: null,
    };
  }

  if (timing.phase === "active") {
    return {
      timing: {
        ...timing,
        phase: "recovery-pending",
        recoveryStartedAt: now,
      },
      timedOut: false,
      timeoutPhase: null,
    };
  }

  const timeoutPhase = timing.phase === "initial-pending" ? "initial" : "recovery";
  const startedAt = timing.phase === "initial-pending"
    ? timing.initialStartedAt
    : timing.recoveryStartedAt;
  const timedOut = timeoutMs > 0 &&
    startedAt !== null &&
    now - startedAt >= timeoutMs;

  return {
    timing,
    timedOut,
    timeoutPhase: timedOut ? timeoutPhase : null,
  };
};
