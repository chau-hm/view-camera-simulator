import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CameraMovementCalibrationWorkbench } from "../../components/simulator/CameraMovementCalibrationWorkbench";
import { useAppStore } from "../../state/appStore";

afterEach(() => { cleanup(); useAppStore.getState().resetCamera(); });

describe("camera calibration workbench", () => {
  it("exposes labelled fields and disables standard movements at high anchor", () => {
    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    render(<CameraMovementCalibrationWorkbench />);
    expect(screen.getByLabelText("Columns")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Viewpoint anchor"), { target: { value: "high" } });
    expect(screen.getByLabelText("Front rise (mm)")).toBeDisabled();
    expect(screen.getByLabelText("Camera body pitch (°)")).not.toBeDisabled();
  });

  it("reports clipboard success and failure", async () => {
    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CameraMovementCalibrationWorkbench />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Effective Calibration JSON" }));
    expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("denied"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Diagnostics JSON" }));
    expect(await screen.findByText("Clipboard copy failed")).toBeInTheDocument();
  });
});
