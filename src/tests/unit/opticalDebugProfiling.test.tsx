import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpticalDebugPanel } from "../../components/simulator/OpticalDebugPanel";
import type { GroundGlassProfilingSnapshot } from "../../render/groundGlassProfiling";
import type { GroundGlassRttRuntimeInfo } from "../../render/groundGlassRttDimensions";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const makeSnapshot = (marker: string): GroundGlassProfilingSnapshot => ({
  marker,
  frame: { count: 1 },
  profilingBackend: "cpu-fallback",
  timingUnit: "cpu-submit-ms",
  rawDebug: false,
  profilingDiagnostics: {
    gpuQueryState: "unavailable",
    framesAccepted: 1,
    framesRejectedCapacity: 0,
    queriesCompleted: 1,
    pendingQueries: 0,
    queryPoolSize: 24,
    framesCompletedGpu: 0,
    lastGpuQueryError: null,
  },
} as unknown as GroundGlassProfilingSnapshot);

const renderPanel = (snapshot: GroundGlassProfilingSnapshot | null) => {
  const camera = {
    ...DEFAULT_CAMERA_STATE,
    activeSceneId: architectureRiseScene.id,
  };
  const opticsState = deriveOpticsState(camera, architectureRiseScene);
  return render(
    <OpticalDebugPanel
      sceneId={architectureRiseScene.id}
      mode="free"
      opticsState={opticsState}
      focalLengthMm={camera.focalLengthMm}
      focusDistanceMm={camera.focusDistanceMm}
      aperture={camera.aperture}
      rttRuntimeInfo={
        {
          profilingEnabled: true,
          profilingBackend: "cpu-fallback",
          profilingSnapshot: snapshot,
        } as unknown as GroundGlassRttRuntimeInfo
      }
    />,
  );
};

const mockClipboard = (writeText: ReturnType<typeof vi.fn>) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Ground Glass profiling snapshot copy", () => {
  it("shows an enabled Copy snapshot button for a live snapshot", () => {
    renderPanel(makeSnapshot("live"));

    const button = screen.getByTestId("ground-glass-profiling-copy");
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Copy snapshot");
  });

  it("disables copying when the profiling snapshot is absent", () => {
    renderPanel(null);

    expect(screen.getByTestId("ground-glass-profiling-copy")).toBeDisabled();
  });

  it("copies the current pretty-printed snapshot and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    const initialSnapshot = makeSnapshot("old");
    const currentSnapshot = makeSnapshot("current");
    const view = renderPanel(initialSnapshot);
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      activeSceneId: architectureRiseScene.id,
    };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);

    view.rerender(
      <OpticalDebugPanel
        sceneId={architectureRiseScene.id}
        mode="free"
        opticsState={opticsState}
        focalLengthMm={camera.focalLengthMm}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        rttRuntimeInfo={
          {
            profilingEnabled: true,
            profilingBackend: "cpu-fallback",
            profilingSnapshot: currentSnapshot,
          } as unknown as GroundGlassRttRuntimeInfo
        }
      />,
    );

    fireEvent.click(screen.getByTestId("ground-glass-profiling-copy"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(currentSnapshot, null, 2));
      expect(screen.getByTestId("ground-glass-profiling-copy")).toHaveTextContent("Copied");
    });
  });

  it("reports a rejected clipboard write as Copy failed", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    mockClipboard(writeText);
    renderPanel(makeSnapshot("live"));

    fireEvent.click(screen.getByTestId("ground-glass-profiling-copy"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("ground-glass-profiling-copy")).toHaveTextContent("Copy failed");
    });
  });
});
