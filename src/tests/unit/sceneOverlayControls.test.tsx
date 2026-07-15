import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneOverlayControls } from "../../components/simulator/SceneOverlayControls";
import {
  getSceneOverlayPresentation,
  SCENE_OVERLAY_INLINE_MIN_WIDTH_PX,
} from "../../components/simulator/sceneOverlayResponsive";

const createBaseProps = () => ({
  sceneId: "table-tilt",
  showFocusPlane: true,
  showDofRegion: true,
  showLegends: false,
  showOpticalGeometry: false,
  onToggleFocusPlane: vi.fn(),
  onToggleDofRegion: vi.fn(),
  onToggleLegends: vi.fn(),
  onToggleOpticalGeometry: vi.fn(),
});

describe("SceneOverlayControls", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("selects collapsed and inline modes at the container breakpoint", () => {
    expect(getSceneOverlayPresentation(SCENE_OVERLAY_INLINE_MIN_WIDTH_PX - 1)).toBe("collapsed");
    expect(getSceneOverlayPresentation(SCENE_OVERLAY_INLINE_MIN_WIDTH_PX)).toBe("inline");
  });

  it("opens the constrained menu, keeps choices active, and closes with Escape", () => {
    const props = createBaseProps();
    const view = render(<SceneOverlayControls {...props} />);
    const trigger = view.getByRole("button", { name: "View overlays" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const legends = view.getByRole("button", { name: "Show Legends" });
    fireEvent.click(legends);
    expect(props.onToggleLegends).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the constrained menu on outside pointer interaction and scene change", () => {
    const props = createBaseProps();
    const view = render(<SceneOverlayControls {...props} />);
    const trigger = view.getByRole("button", { name: "View overlays" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    view.rerender(<SceneOverlayControls {...props} sceneId="shelf-swing" />);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders a single-row inline toolbar when the measured container is wide", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 720,
      bottom: 100,
      width: 720,
      height: 100,
      toJSON: () => ({}),
    });
    const view = render(<SceneOverlayControls {...createBaseProps()} />);
    expect(view.getByTestId("scene-overlay-inline")).toHaveClass("scene-overlay-controls--inline");
    expect(view.queryByRole("button", { name: "View overlays" })).toBeNull();
    expect(view.getByRole("button", { name: "Hide Focus plane" })).toBeInTheDocument();
  });

  it("uses current construction validity while preserving an enabled Hide action", () => {
    const onToggle = vi.fn();
    const props = createBaseProps();
    const view = render(
      <SceneOverlayControls
        {...props}
        showScheimpflugConstruction={false}
        scheimpflugConstructionAvailable={false}
        onToggleScheimpflugConstruction={onToggle}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "View overlays" }));
    expect(view.getByRole("button", { name: "Show Scheimpflug construction" })).toBeDisabled();
    view.rerender(
      <SceneOverlayControls
        {...props}
        showScheimpflugConstruction
        scheimpflugConstructionAvailable={false}
        onToggleScheimpflugConstruction={onToggle}
      />,
    );
    const hide = view.getByRole("button", { name: "Hide Scheimpflug construction" });
    expect(hide).toBeEnabled();
    fireEvent.click(hide);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("does not expose Scheimpflug construction for unsupported scenes", () => {
    const view = render(<SceneOverlayControls {...createBaseProps()} sceneId="architecture-rise" />);
    fireEvent.click(view.getByRole("button", { name: "View overlays" }));
    expect(view.queryByRole("button", { name: /Scheimpflug construction/ })).toBeNull();
  });
});
