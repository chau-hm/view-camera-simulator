import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MovementControls } from "../../components/controls/MovementControls";
import { useAppStore } from "../../state/appStore";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";

const enabledProps = {
  riseEnabled: true,
  tiltEnabled: true,
  swingEnabled: true,
  lockReason: "Disabled for this guided task",
};

describe("MovementControls", () => {
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

  it("renders front-standard compact rows and updates the existing movement setters", () => {
    render(<MovementControls {...enabledProps} />);

    expect(screen.getByRole("heading", { name: "Front standard" })).toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(3);

    const rise = screen.getByRole("slider", { name: "Rise" });
    const tilt = screen.getByRole("slider", { name: "Tilt" });
    const swing = screen.getByRole("slider", { name: "Swing" });
    expect(rise).toHaveAttribute("min", String(CAMERA_CONSTANTS.riseMinMm));
    expect(rise).toHaveAttribute("max", String(CAMERA_CONSTANTS.riseMaxMm));
    expect(rise).toHaveAttribute("step", String(CAMERA_CONTROL_STEPS.riseMm));
    expect(tilt).toHaveAttribute("step", String(CAMERA_CONTROL_STEPS.tiltDeg));
    expect(swing).toHaveAttribute("step", String(CAMERA_CONTROL_STEPS.swingDeg));

    fireEvent.change(tilt, { target: { value: "3.2" } });

    expect(useAppStore.getState().camera.frontTiltDeg).toBe(3.2);
    expect(tilt.closest(".compact-range-row")).toHaveAttribute("data-active", "true");
    const value = tilt.closest(".compact-range-row")?.querySelector(".compact-range-row__value");
    expect(value).toHaveTextContent("3.2°");
    expect(value).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps disabled movement rows disabled with one shared lock description", () => {
    render(
      <MovementControls
        {...enabledProps}
        riseEnabled={false}
        swingEnabled={false}
      />,
    );

    const rise = screen.getByRole("slider", { name: "Rise" });
    const tilt = screen.getByRole("slider", { name: "Tilt" });
    const swing = screen.getByRole("slider", { name: "Swing" });
    expect(rise).toBeDisabled();
    expect(tilt).toBeEnabled();
    expect(swing).toBeDisabled();
    expect(screen.getAllByText("Disabled for this guided task")).toHaveLength(1);
    expect(rise).toHaveAttribute("aria-describedby", swing.getAttribute("aria-describedby"));
    expect(rise.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("opens help, closes with Escape, and restores focus to the header trigger", async () => {
    render(<MovementControls {...enabledProps} />);

    const trigger = screen.getByRole("button", { name: "Help" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Movement help" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close help" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog", { name: "Movement help" })).not.toBeInTheDocument();
  });
});
