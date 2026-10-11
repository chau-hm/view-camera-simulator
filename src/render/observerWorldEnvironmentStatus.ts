export type ObserverWorldEnvironmentStatus =
  | "not-configured"
  | "pending"
  | "active"
  | "unsupported"
  | "failed";

export type ObserverWorldEnvironmentRealizationToken = Readonly<{
  rendererGeneration: number;
  attempt: number;
}>;

/**
 * Owns environment status attribution for one Observer host. Realization
 * attempts are monotonic for the host lifetime, so a replaced environment
 * cannot regain authority by reporting late under the same renderer mount.
 */
export class ObserverWorldEnvironmentStatusOwner {
  private nextAttempt = 0;
  private latestAttempt = 0;
  private activeRealization: ObserverWorldEnvironmentRealizationToken | null = null;

  createRealizationToken(rendererGeneration: number): ObserverWorldEnvironmentRealizationToken {
    this.nextAttempt += 1;
    return Object.freeze({ rendererGeneration, attempt: this.nextAttempt });
  }

  accepts(
    currentRendererGeneration: number,
    rendererGeneration: number,
    realization: ObserverWorldEnvironmentRealizationToken | null,
    status: ObserverWorldEnvironmentStatus,
  ): boolean {
    if (rendererGeneration !== currentRendererGeneration) return false;

    if (status === "not-configured") {
      if (realization !== null) return false;
      this.activeRealization = null;
      return true;
    }

    if (!realization || realization.rendererGeneration !== rendererGeneration) return false;

    if (status === "pending") {
      if (realization.attempt <= this.latestAttempt) return false;
      this.latestAttempt = realization.attempt;
      this.activeRealization = realization;
      return true;
    }

    return this.activeRealization === realization;
  }
}
