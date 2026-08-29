import { fireEvent, render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SingleMovementControl } from "../../components/controls/SingleMovementControl";
import { useAppStore } from "../../state/appStore";

afterEach(cleanup);

describe("SingleMovementControl", () => {
  beforeEach(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  it("updates frontSwingDeg through the public setter path", () => {
    const view = render(<SingleMovementControl movement="frontSwingDeg" />);
    const slider = view.getByRole("slider", { name: "Front Swing" });

    fireEvent.change(slider, { target: { value: "5" } });

    expect(useAppStore.getState().camera.frontSwingDeg).toBe(5);
  });
});
