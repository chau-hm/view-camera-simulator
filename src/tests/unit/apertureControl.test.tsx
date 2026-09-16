import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("exposes and updates the canonical full-stop sequence through real radio options", () => {
    render(<ApertureControl apertureEnabled lockReason="" />);

    const group = screen.getByRole("radiogroup", { name: "Aperture" });
    const options = within(group).getAllByRole("radio");
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "5.6",
      "8",
      "11",
      "16",
      "22",
      "32",
    ]);
    expect(within(group).getByRole("radio", { name: "f/11" })).toBeChecked();

    fireEvent.click(within(group).getByRole("radio", { name: "f/8" }));
    expect(useAppStore.getState().camera.aperture).toBe(8);

    fireEvent.click(within(group).getByRole("radio", { name: "f/16" }));
    expect(useAppStore.getState().camera.aperture).toBe(16);
  });

  it("keeps every aperture option disabled with one shared lock description", () => {
    render(<ApertureControl apertureEnabled={false} lockReason="Aperture is fixed for this lesson" />);

    const group = screen.getByRole("radiogroup", { name: "Aperture" });
    const options = within(group).getAllByRole("radio");
    expect(group).toBeDisabled();
    expect(group).toHaveAttribute("aria-disabled", "true");
    expect(options.every((option) => option.hasAttribute("disabled"))).toBe(true);
    expect(screen.getAllByText("Aperture is fixed for this lesson")).toHaveLength(1);
    const describedBy = options.map((option) => option.getAttribute("aria-describedby"));
    expect(describedBy.every((value) => value === describedBy[0])).toBe(true);
    expect(describedBy[0]).toBeTruthy();
  });
});
