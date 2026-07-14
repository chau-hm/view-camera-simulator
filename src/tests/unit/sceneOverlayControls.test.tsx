import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneOverlayControls } from "../../components/simulator/SceneOverlayControls";

const baseProps = {
  showFocusPlane: true,
  showDofRegion: true,
  showLegends: false,
  showOpticalGeometry: false,
  onToggleFocusPlane: vi.fn(),
  onToggleDofRegion: vi.fn(),
  onToggleLegends: vi.fn(),
  onToggleOpticalGeometry: vi.fn(),
};

describe("SceneOverlayControls", () => {
  afterEach(cleanup);
  it("exposes the explicit Scheimpflug construction action when configured", () => {
    const onToggle = vi.fn();
    const { getByRole } = render(
      <SceneOverlayControls
        {...baseProps}
        showScheimpflugConstruction={false}
        onToggleScheimpflugConstruction={onToggle}
      />,
    );
    const button = getByRole("button", { name: "Show Scheimpflug construction" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("does not leave a hidden construction control for other scenes", () => {
    const { queryByRole } = render(<SceneOverlayControls {...baseProps} />);
    expect(queryByRole("button", { name: /Scheimpflug construction/ })).toBeNull();
  });

  it("keeps an invalid requested construction enabled so it can be turned off", () => {
    const onToggle = vi.fn();
    const { getByRole } = render(
      <SceneOverlayControls
        {...baseProps}
        showScheimpflugConstruction
        scheimpflugConstructionAvailable={false}
        onToggleScheimpflugConstruction={onToggle}
      />,
    );
    const button = getByRole("button", { name: "Hide Scheimpflug construction" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
