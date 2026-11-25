export type GroundGlassCleanupOutcome = "confirmed" | "failed" | "uncertain";

export type GroundGlassCleanupOwner =
  | "scene-subject"
  | "rtt-targets"
  | "post-processing"
  | "profiler"
  | "presentation-lighting"
  | "world-illumination"
  | "world-environment";

type OwnerState = Readonly<{
  status: "not-acquired" | "pending" | GroundGlassCleanupOutcome;
  reason?: string;
}>;

const owners: readonly GroundGlassCleanupOwner[] = [
  "scene-subject",
  "rtt-targets",
  "post-processing",
  "profiler",
  "presentation-lighting",
  "world-illumination",
  "world-environment",
];

/**
 * Collects cleanup evidence from the owners that actually dispose Ground Glass resources.
 * Renderer confirmation is emitted only after the WebGL Canvas retirement boundary also reports.
 */
export class GroundGlassCleanupEvidenceCoordinator {
  private readonly ownerStates = new Map<GroundGlassCleanupOwner, OwnerState>(
    owners.map((owner) => [owner, { status: "not-acquired" }]),
  );
  private rendererRetirement: OwnerState = { status: "pending" };
  private outcomeReported = false;

  private readonly onComplete: (
    outcome: GroundGlassCleanupOutcome,
    reason?: string,
  ) => void;

  constructor(onComplete: (outcome: GroundGlassCleanupOutcome, reason?: string) => void) {
    this.onComplete = onComplete;
  }

  acquired(owner: GroundGlassCleanupOwner): void {
    if (this.outcomeReported) return;
    const previous = this.ownerStates.get(owner);
    if (previous?.status === "failed" || previous?.status === "uncertain") return;
    this.ownerStates.set(owner, { status: "pending" });
  }

  ownerCleanupCompleted(
    owner: GroundGlassCleanupOwner,
    outcome: GroundGlassCleanupOutcome,
    reason?: string,
  ): void {
    if (this.outcomeReported) return;
    const previous = this.ownerStates.get(owner) ?? { status: "not-acquired" as const };
    const status = previous.status === "failed" || previous.status === "uncertain"
      ? previous.status
      : outcome;
    this.ownerStates.set(owner, {
      status,
      reason: previous.reason ?? reason,
    });
  }

  rendererRetired(outcome: GroundGlassCleanupOutcome, reason?: string): void {
    if (this.outcomeReported) return;
    const previous = this.rendererRetirement;
    const status = previous.status === "failed" || previous.status === "uncertain"
      ? previous.status
      : outcome;
    this.rendererRetirement = {
      status,
      reason: previous.reason ?? reason,
    };
    this.completeIfSettled();
  }

  private completeIfSettled(): void {
    if (this.outcomeReported || this.rendererRetirement.status === "pending") return;
    const evidence = [...this.ownerStates.entries()];
    const failed = evidence.find(([, state]) => state.status === "failed");
    const uncertain = evidence.find(([, state]) => state.status === "uncertain");
    const pending = evidence.find(([, state]) => state.status === "pending");

    const outcome: GroundGlassCleanupOutcome = this.rendererRetirement.status === "failed"
      ? "failed"
      : this.rendererRetirement.status === "uncertain" || pending
        ? "uncertain"
        : failed
          ? "failed"
          : uncertain
            ? "uncertain"
            : "confirmed";
    let reason = this.rendererRetirement.reason;
    if (!reason && failed) reason = failed[1].reason ?? `${failed[0]} cleanup failed`;
    if (!reason && uncertain) reason = uncertain[1].reason ?? `${uncertain[0]} cleanup is uncertain`;
    if (!reason && pending) reason = `${pending[0]} cleanup did not report completion before Canvas retirement`;
    if (outcome === "confirmed") reason = undefined;
    this.outcomeReported = true;
    this.onComplete(outcome, reason);
  }
}

type ObservableWebGlRenderer = {
  dispose: () => void;
  forceContextLoss?: () => void;
  getContext: () => { isContextLost?: () => boolean };
  domElement: HTMLCanvasElement;
};

/**
 * Observes the teardown operations owned by @react-three/fiber's Canvas. This does not dispose
 * the renderer; it records its actual dispose/context-loss boundary and waits for context loss.
 */
export const observeGroundGlassCanvasRetirement = (
  renderer: ObservableWebGlRenderer,
  coordinator: GroundGlassCleanupEvidenceCoordinator,
): void => {
  const originalDispose = renderer.dispose;
  const originalForceContextLoss = renderer.forceContextLoss;
  let disposeOutcome: GroundGlassCleanupOutcome = "uncertain";
  let disposeReason: string | undefined = "Canvas renderer dispose has not completed";
  let retirementRequested = false;
  let retirementCallInProgress = false;
  let contextLostBeforeRetirement = false;
  let contextLostDuringRetirement = false;
  let completed = false;

  const finish = (outcome: GroundGlassCleanupOutcome, reason?: string) => {
    if (completed) return;
    completed = true;
    renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
    renderer.dispose = originalDispose;
    if (originalForceContextLoss) renderer.forceContextLoss = originalForceContextLoss;
    coordinator.rendererRetired(outcome, reason);
  };

  const handleContextLost = () => {
    if (!retirementRequested) {
      contextLostBeforeRetirement = true;
      return;
    }
    if (retirementCallInProgress) {
      contextLostDuringRetirement = true;
      return;
    }
    finish(disposeOutcome, disposeReason);
  };
  const handleContextRestored = () => {
    contextLostBeforeRetirement = false;
  };

  renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
  renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored, false);
  renderer.dispose = function observedDispose(this: ObservableWebGlRenderer) {
    try {
      originalDispose.call(this);
      disposeOutcome = "confirmed";
      disposeReason = undefined;
    } catch (error) {
      disposeOutcome = "failed";
      disposeReason = error instanceof Error ? error.message : String(error);
      throw error;
    }
  };

  if (!originalForceContextLoss) {
    const disposeWithUnverifiedContext = renderer.dispose;
    renderer.dispose = function observedDisposeWithoutContextLoss(this: ObservableWebGlRenderer) {
      try {
        disposeWithUnverifiedContext.call(this);
      } catch (error) {
        finish("failed", error instanceof Error ? error.message : String(error));
        throw error;
      }
      finish("uncertain", "Canvas renderer has no forceContextLoss operation");
    };
    return;
  }

  renderer.forceContextLoss = function observedForceContextLoss(this: ObservableWebGlRenderer) {
    retirementRequested = true;
    retirementCallInProgress = true;
    try {
      originalForceContextLoss.call(this);
    } catch (error) {
      const lossFailure = error instanceof Error ? error.message : String(error);
      finish(
        "failed",
        disposeOutcome === "failed"
          ? `${disposeReason}; forceContextLoss: ${lossFailure}`
          : lossFailure,
      );
      throw error;
    } finally {
      retirementCallInProgress = false;
    }
    const context = this.getContext();
    if (contextLostBeforeRetirement || contextLostDuringRetirement || context.isContextLost?.()) {
      finish(disposeOutcome, disposeReason);
    } else if (disposeOutcome === "failed") {
      finish("failed", disposeReason);
    } else {
      // forceContextLoss may dispatch webglcontextlost asynchronously. Keep observing that actual
      // retirement boundary; until the event arrives, cleanup stays pending and replacement stays
      // blocked. A returned method call alone is not completion evidence.
    }
  };
};
