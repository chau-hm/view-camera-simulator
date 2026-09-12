import { describe, expect, it } from "vitest";
import { createMeasurementNavigationGuard } from "../helpers/sceneCapacityBenchmarkNavigation";

describe("scene capacity benchmark navigation guard", () => {
  it("rejects a main-frame navigation during an active measurement", () => {
    const guard = createMeasurementNavigationGuard("interior-corner", {
      rawDebug: false,
      inspectionWindowActive: true,
    });

    guard.observeNavigation({
      isMainFrame: true,
      url: "http://127.0.0.1:4174/simulator/free/interior-corner",
    });

    expect(() => guard.assertStable()).toThrow(
      "Scene capacity benchmark navigated during an active measurement: " +
        "scene=interior-corner rawDebug=false inspectionWindowActive=true " +
        "url=http://127.0.0.1:4174/simulator/free/interior-corner",
    );
  });

  it("ignores subframe navigation", () => {
    const guard = createMeasurementNavigationGuard("focus-fundamentals-two-targets", {
      rawDebug: false,
      inspectionWindowActive: false,
    });

    guard.observeNavigation({
      isMainFrame: false,
      url: "http://127.0.0.1:4174/embedded-diagnostic-frame",
    });

    expect(() => guard.assertStable()).not.toThrow();
  });
});
