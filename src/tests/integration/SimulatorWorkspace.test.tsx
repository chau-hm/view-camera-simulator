import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";
import { useAppStore } from "../../state/appStore";

const workspace = (sceneId = "shelf-swing") => (
  <MemoryRouter>
    <SimulatorWorkspace
      mode="guided"
      sceneId={sceneId}
      taskId={sceneId === "shelf-swing" ? "swing-01" : "tilt-01"}
      simulateAssetFailure={false}
    />
  </MemoryRouter>
);

describe("SimulatorWorkspace geometry dialog accessibility", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().resetCamera();
    useAppStore.getState().setActiveTask(null);
  });

  it("focuses Close, closes with Escape, and restores focus to its trigger", async () => {
    render(workspace());
    const trigger = screen.getByRole("button", { name: "Open 2D Geometry" });

    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "2D Geometry" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close 2D Geometry" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2D Geometry" })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes the dialog when the routed scene changes", async () => {
    const { rerender } = render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Open 2D Geometry" }));
    expect(screen.getByRole("dialog", { name: "2D Geometry" })).toBeInTheDocument();

    rerender(workspace("table-tilt"));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2D Geometry" })).not.toBeInTheDocument());
    expect(screen.queryByTestId("geometry-svg-top")).not.toBeInTheDocument();
  });

  it("keeps an open dialog safe and restores Top view when the Shelf task restarts", () => {
    render(workspace());
    fireEvent.click(screen.getByRole("button", { name: "Open 2D Geometry" }));
    fireEvent.click(screen.getByRole("button", { name: "Side" }));
    expect(screen.getByRole("dialog", { name: "2D Geometry" })).toBeInTheDocument();
    expect(screen.getByTestId("geometry-svg-side")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restart task" }));

    expect(screen.getByRole("dialog", { name: "2D Geometry" })).toBeInTheDocument();
    expect(screen.getByTestId("geometry-svg-top")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit Construction" })).toBeDisabled();
  });
});
