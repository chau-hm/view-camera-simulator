import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApertureControl } from "../../components/controls/ApertureControl";
import { useAppStore } from "../../state/appStore";

describe("ApertureControl", () => {
  beforeEach(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "architecture-rise",
      taskId: null,
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
  });

  it("exposes and updates the canonical full-stop sequence through the real select", () => {
    render(<ApertureControl apertureEnabled lockReason="" />);

    const select = screen.getByRole("combobox", { name: "Aperture" });
    expect(Array.from((select as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      "5.6",
      "8",
      "11",
      "16",
      "22",
      "32",
    ]);
    expect(select).toHaveValue("11");

    fireEvent.change(select, { target: { value: "8" } });
    expect(useAppStore.getState().camera.aperture).toBe(8);

    fireEvent.change(select, { target: { value: "16" } });
    expect(useAppStore.getState().camera.aperture).toBe(16);
  });
});
