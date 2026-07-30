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

  it("keeps character-by-character drafts local and commits on Enter or blur", () => {
    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    render(<CameraMovementCalibrationWorkbench />);
    const focalLength = screen.getByLabelText("Focal length (mm)");

    for (const draft of ["", "1", "12", "120", "120.", "120.5"]) {
      fireEvent.change(focalLength, { target: { value: draft } });
      expect(focalLength).toHaveValue(draft);
      expect(useAppStore.getState().cameraMovementCalibrationSession.revision).toBe(0);
    }

    fireEvent.keyDown(focalLength, { key: "Enter" });
    expect(useAppStore.getState().cameraMovementCalibrationSession.revision).toBe(1);
    expect(useAppStore.getState().camera.focalLengthMm).toBe(120.5);

    const pitch = screen.getByLabelText("Camera body pitch (°)");
    fireEvent.change(pitch, { target: { value: "-" } });
    expect(pitch).toHaveValue("-");
    fireEvent.change(pitch, { target: { value: "-8" } });
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(0);
    fireEvent.blur(pitch);
    expect(useAppStore.getState().camera.cameraBodyPitchDeg).toBe(-8);
  });

  it("preserves rejected drafts, restores on Escape, and resynchronises on reset", () => {
    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "understanding-camera-movements", calibrationEnabled: true });
    render(<CameraMovementCalibrationWorkbench />);
    const focusDistance = screen.getByLabelText("Focus distance (mm)");

    fireEvent.change(focusDistance, { target: { value: "100" } });
    fireEvent.keyDown(focusDistance, { key: "Enter" });
    expect(focusDistance).toHaveValue("100");
    expect(focusDistance).toHaveAttribute("aria-invalid", "true");
    const fieldErrorId = focusDistance.getAttribute("aria-describedby");
    expect(fieldErrorId).toBeTruthy();
    expect(document.getElementById(fieldErrorId!)).toHaveTextContent(/focus distance greater than focal length/i);
    expect(useAppStore.getState().camera.focusDistanceMm).toBe(2000);
    expect(useAppStore.getState().cameraMovementCalibrationSession.revision).toBe(0);

    fireEvent.keyDown(focusDistance, { key: "Escape" });
    expect(focusDistance).toHaveValue("2000");
    expect(focusDistance).not.toHaveAttribute("aria-invalid");
    expect(useAppStore.getState().cameraMovementCalibrationSession.validation.valid).toBe(true);

    fireEvent.change(focusDistance, { target: { value: "3000" } });
    fireEvent.blur(focusDistance);
    expect(focusDistance).toHaveValue("3000");
    fireEvent.change(focusDistance, { target: { value: "-" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset calibration" }));
    expect(focusDistance).toHaveValue("2000");
  });
});
