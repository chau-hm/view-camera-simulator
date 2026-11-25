import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GroundGlassPilotRecoveryAction,
  GroundGlassPilotRecoveryActionEvidence,
} from "../../render/backend/groundGlassBackendDiagnostics";
import type { GroundGlassWebGpuTestControl } from "../../render/webgpu/groundGlassWebGpuTestSeam";

describe("Ground Glass development recovery browser seam", () => {
  const originalControl = window.__groundGlassWebGpuM3TestControl;

  afterEach(() => {
    window.__groundGlassWebGpuM3TestControl = originalControl;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("routes only the two legal actions and sends unknown runtime values to rejection diagnostics", async () => {
    vi.stubEnv("VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", "true");
    vi.resetModules();
    const { registerGroundGlassPilotRecoveryActionForTest } = await import(
      "../../render/webgpu/groundGlassWebGpuTestSeam"
    );
    const validHandler = vi.fn((action: GroundGlassPilotRecoveryAction): GroundGlassPilotRecoveryActionEvidence => ({
      action,
      status: "authorized",
      pilotSessionId: "pilot-session-1",
      retryEpoch: 2,
      reason: null,
    }));
    const rejectInvalidAction = vi.fn((action: unknown): GroundGlassPilotRecoveryActionEvidence => ({
      action: "invalid",
      invalidAction: typeof action === "string" ? action : typeof action,
      status: "rejected",
      pilotSessionId: "pilot-session-1",
      retryEpoch: 1,
      reason: "invalid-recovery-action",
    }));
    window.__groundGlassWebGpuM3TestControl = {} as GroundGlassWebGpuTestControl;
    const unregister = registerGroundGlassPilotRecoveryActionForTest(
      "default",
      "host-1",
      validHandler,
      () => true,
      rejectInvalidAction,
    );

    try {
      const requestAction = window.__groundGlassWebGpuM3TestControl?.requestGroundGlassPilotRecoveryAction;
      expect(requestAction).toBeTypeOf("function");
      if (!requestAction) throw new Error("Expected the development browser recovery action");

      expect(requestAction("default", "force-retry")).toMatchObject({
        action: "invalid",
        invalidAction: "force-retry",
        status: "rejected",
        retryEpoch: 1,
        reason: "invalid-recovery-action",
      });
      expect(validHandler).not.toHaveBeenCalled();
      expect(rejectInvalidAction).toHaveBeenCalledOnce();

      for (const action of ["explicit-retry", "new-pilot-session"] as const) {
        expect(requestAction("default", action)).toMatchObject({ action, status: "authorized" });
      }
      expect(validHandler).toHaveBeenCalledTimes(2);
      expect(rejectInvalidAction).toHaveBeenCalledOnce();
    } finally {
      unregister();
    }
  });
});
