import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpticalDebugPanel } from "../../components/simulator/OpticalDebugPanel";
import type { GroundGlassProfilingSnapshot } from "../../render/groundGlassProfiling";
import type { GroundGlassRttRuntimeInfo } from "../../render/groundGlassRttDimensions";
import type { SceneGraphCapacityMetrics } from "../../render/sceneCapacityProfiling";
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

const renderPanel = (
  snapshot: GroundGlassProfilingSnapshot | null,
  viewportSubjectCapacity?: SceneGraphCapacityMetrics | null,
) => {
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
      viewportSubjectCapacity={viewportSubjectCapacity}
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
  window.history.replaceState({}, "", "/");
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

describe("scene capacity diagnostic snapshot", () => {
  const capacity: SceneGraphCapacityMetrics = {
    objectCount: 4,
    meshCount: 2,
    instancedMeshCount: 0,
    lightCount: 0,
    lineCount: 0,
    pointsCount: 0,
    uniqueGeometryCount: 1,
    uniqueMaterialCount: 1,
    uniqueTextureCount: 0,
    triangleCount: 24,
    instancedTriangleCount: 0,
    effectiveTriangleCount: 24,
  };

  it("keeps scene-capacity diagnostics absent when the switch is disabled", () => {
    renderPanel(makeSnapshot("disabled"), capacity);

    expect(screen.queryByTestId("scene-capacity-snapshot")).toBeNull();
  });

  it("publishes viewport, RTT, cadence, and Ground Glass data when enabled", () => {
    window.history.replaceState({}, "", "/?sceneCapacityProfiling=1");
    renderPanel(makeSnapshot("enabled"), capacity);

    const snapshot = JSON.parse(
      screen.getByTestId("scene-capacity-snapshot").textContent ?? "null",
    ) as {
      sceneId: string;
      viewportSubject: SceneGraphCapacityMetrics;
      rttSubject: SceneGraphCapacityMetrics | null;
      frameCadence: { count: number };
      groundGlass: { marker: string };
    };
    expect(snapshot.sceneId).toBe(architectureRiseScene.id);
    expect(snapshot.viewportSubject.effectiveTriangleCount).toBe(24);
    expect(snapshot.rttSubject).toBeNull();
    expect(snapshot.frameCadence.count).toBe(1);
    expect(snapshot.groundGlass.marker).toBe("enabled");
  });

  it("updates the scene identity when the diagnostic owner changes scenes", () => {
    window.history.replaceState({}, "", "/?sceneCapacityProfiling=1");
    const view = renderPanel(makeSnapshot("first"), capacity);
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      activeSceneId: "interior-corner",
    };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);

    view.rerender(
      <OpticalDebugPanel
        sceneId="interior-corner"
        mode="free"
        opticsState={opticsState}
        focalLengthMm={camera.focalLengthMm}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        rttRuntimeInfo={
          {
            profilingEnabled: true,
            profilingBackend: "cpu-fallback",
            profilingSnapshot: makeSnapshot("second"),
          } as unknown as GroundGlassRttRuntimeInfo
        }
        viewportSubjectCapacity={capacity}
      />,
    );

    const snapshot = JSON.parse(
      screen.getByTestId("scene-capacity-snapshot").textContent ?? "null",
    ) as { sceneId: string; groundGlass: { marker: string } };
    expect(snapshot.sceneId).toBe("interior-corner");
    expect(snapshot.groundGlass.marker).toBe("second");
  });
});
