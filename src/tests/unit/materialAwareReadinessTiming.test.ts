import { describe, expect, it } from "vitest";
import {
  advanceMaterialAwareReadinessTiming,
  startMaterialAwareReadinessTiming,
} from "../../render/backend/materialAwareReadinessTiming";

const advance = (
  timing: ReturnType<typeof startMaterialAwareReadinessTiming>,
  ready: boolean,
  now: number,
  timeoutMs = 12_000,
  rendererGeneration = 4,
) => advanceMaterialAwareReadinessTiming(
  timing,
  rendererGeneration,
  ready,
  now,
  timeoutMs,
);

describe("material-aware output readiness timing", () => {
  it("keeps initial readiness pending before its deadline and times out at the deadline", () => {
    const initial = startMaterialAwareReadinessTiming(4, 0);
    const beforeDeadline = advance(initial, false, 11_999);

    expect(beforeDeadline.timedOut).toBe(false);
    expect(beforeDeadline.timing.phase).toBe("initial-pending");
    expect(beforeDeadline.timing.initialReadinessWaitMs).toBeNull();

    const atDeadline = advance(beforeDeadline.timing, false, 12_000);
    expect(atDeadline).toMatchObject({
      timedOut: true,
      timeoutPhase: "initial",
      timing: { phase: "initial-pending" },
    });
  });

  it("records the first activation duration once", () => {
    const initial = startMaterialAwareReadinessTiming(4, 0);
    const activated = advance(initial, true, 300);

    expect(activated).toMatchObject({
      timedOut: false,
      timing: {
        phase: "active",
        initialReadinessWaitMs: 300,
        recoveryStartedAt: null,
      },
    });

    const stillActive = advance(activated.timing, true, 25_000);
    expect(stillActive.timing.initialReadinessWaitMs).toBe(300);
    expect(stillActive.timing.phase).toBe("active");
  });

  it("starts a fresh recovery window after a long active period and clears it on recovery", () => {
    const initiallyActive = advance(
      startMaterialAwareReadinessTiming(4, 0),
      true,
      300,
    ).timing;

    const recoveryStarted = advance(initiallyActive, false, 25_000);
    expect(recoveryStarted).toMatchObject({
      timedOut: false,
      timing: {
        phase: "recovery-pending",
        recoveryStartedAt: 25_000,
        initialReadinessWaitMs: 300,
      },
    });

    const stillPending = advance(recoveryStarted.timing, false, 25_016);
    expect(stillPending.timedOut).toBe(false);

    const recovered = advance(stillPending.timing, true, 25_033);
    expect(recovered).toMatchObject({
      timedOut: false,
      timing: {
        phase: "active",
        recoveryStartedAt: null,
        initialReadinessWaitMs: 300,
      },
    });
  });

  it("does not restart a persistent recovery deadline on each pending frame", () => {
    const active = advance(startMaterialAwareReadinessTiming(4, 0), true, 300).timing;
    const recovery = advance(active, false, 25_000).timing;

    const atFiveSeconds = advance(recovery, false, 30_000);
    const oneMillisecondBeforeDeadline = advance(atFiveSeconds.timing, false, 36_999);
    const atDeadline = advance(oneMillisecondBeforeDeadline.timing, false, 37_000);

    expect(atFiveSeconds.timing.recoveryStartedAt).toBe(25_000);
    expect(oneMillisecondBeforeDeadline.timedOut).toBe(false);
    expect(atDeadline).toMatchObject({
      timedOut: true,
      timeoutPhase: "recovery",
      timing: { recoveryStartedAt: 25_000 },
    });
  });

  it("gives independent recovery episodes fresh deadlines without changing initial readiness", () => {
    const initiallyActive = advance(startMaterialAwareReadinessTiming(4, 0), true, 300).timing;
    const firstRecovery = advance(initiallyActive, false, 25_000).timing;
    const firstActive = advance(firstRecovery, true, 25_033).timing;
    const secondRecovery = advance(firstActive, false, 80_000).timing;

    expect(secondRecovery).toMatchObject({
      phase: "recovery-pending",
      recoveryStartedAt: 80_000,
      initialReadinessWaitMs: 300,
    });

    const secondRecovered = advance(secondRecovery, true, 80_080);
    expect(secondRecovered.timing.initialReadinessWaitMs).toBe(300);
    expect(secondRecovered.timing.recoveryStartedAt).toBeNull();
  });

  it("isolates a new renderer generation from the old generation's recovery deadline", () => {
    const active = advance(startMaterialAwareReadinessTiming(4, 0), true, 300).timing;
    const oldRecovery = advance(active, false, 25_000).timing;

    const nextGeneration = advance(oldRecovery, false, 25_001, 12_000, 5);
    expect(nextGeneration).toMatchObject({
      timedOut: false,
      timing: {
        rendererGeneration: 5,
        phase: "initial-pending",
        initialStartedAt: 25_001,
        recoveryStartedAt: null,
        initialReadinessWaitMs: null,
      },
    });

    const nextGenerationReady = advance(nextGeneration.timing, true, 25_301, 12_000, 5);
    expect(nextGenerationReady.timing.initialReadinessWaitMs).toBe(300);
  });

  it("preserves Architecture Rise's disabled readiness timeout", () => {
    const active = advance(startMaterialAwareReadinessTiming(4, 0), true, 300, 0).timing;
    const recovery = advance(active, false, 25_000, 0);
    const longPending = advance(recovery.timing, false, 250_000, 0);

    expect(recovery.timedOut).toBe(false);
    expect(longPending.timedOut).toBe(false);
    expect(longPending.timing.recoveryStartedAt).toBe(25_000);
  });
});
