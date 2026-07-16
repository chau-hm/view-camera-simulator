import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { useAppStore } from "../../state/appStore";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const createOptics = (frontSwingDeg: number, focusDistanceMm: number) =>
  deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...shelfSwingScene.cameraPreset,
      activeSceneId: shelfSwingScene.id,
      frontSwingDeg,
      focusDistanceMm,
    },
    shelfSwingScene,
  );

const StoreBackedViewport = ({
  opticsState,
}: {
  opticsState: ReturnType<typeof deriveOpticsState>;
}) => {
  const geometryView = useAppStore((state) => state.camera.geometryView);
  return (
    <GeometryViewport
      opticsState={opticsState}
      geometryView={geometryView}
      scene={shelfSwingScene}
      riseMm={0}
    />
  );
};

describe("Shelf Swing geometry viewport", () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().setGeometryView("side");
  });

  it("starts in Top view with the physical trace, three labelled targets, and no fake construction", () => {
    useAppStore.getState().setGeometryView("top");
    const optics = createOptics(0, shelfSwingGeometry.middleSubject.focusDetailProbeWorld.z);
    const view = render(<StoreBackedViewport opticsState={optics} />);
    const topSvg = view.container.querySelector('[data-testid="geometry-svg-top"]');
    expect(topSvg).not.toBeNull();
    expect(topSvg?.querySelector('[data-testid="shelf-swing-subject-trace"]')).not.toBeNull();
    expect(topSvg?.querySelector('[data-testid="plane-line-focus"]')).not.toBeNull();
    expect(topSvg?.querySelector('[data-testid="dof-region"]')).not.toBeNull();
    for (const [targetId, label] of [
      ["shelf-front", "Front chart"],
      ["shelf-middle", "Middle chart"],
      ["shelf-back", "Back chart"],
    ]) {
      expect(topSvg?.querySelector(`[data-testid="geometry-target-${targetId}"]`)).not.toBeNull();
      expect(within(topSvg as HTMLElement).getByText(label)).toBeInTheDocument();
    }
    expect(view.getByRole("button", { name: "Fit Construction" })).toBeDisabled();
    expect(view.container.querySelector('[data-testid="scheimpflug-intersection"]')).toBeNull();
  });

  it("shows the trace only in the subject field and restores Top view after construction", async () => {
    useAppStore.getState().setGeometryView("top");
    const optics = createOptics(
      shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg,
      shelfSwingGeometry.shelfSwingCalibration.focusDistanceMm,
    );
    const view = render(<StoreBackedViewport opticsState={optics} />);
    const fitConstruction = view.getByRole("button", { name: "Fit Construction" });
    expect(fitConstruction).toBeEnabled();
    fireEvent.click(fitConstruction);

    const cameraRegion = view.getByTestId("camera-construction-region");
    const subjectRegion = view.getByTestId("subject-field-region");
    expect(within(cameraRegion).queryByTestId("shelf-swing-subject-trace")).toBeNull();
    expect(within(subjectRegion).getByTestId("shelf-swing-subject-trace")).toBeInTheDocument();
    expect(within(cameraRegion).getByTestId("scheimpflug-intersection")).toBeInTheDocument();
    for (const targetId of ["shelf-front", "shelf-middle", "shelf-back"]) {
      expect(within(subjectRegion).getByTestId(`geometry-target-${targetId}`)).toBeInTheDocument();
    }

    fireEvent.click(view.getByRole("button", { name: "Fit Scene" }));
    await waitFor(() => {
      expect(view.container.querySelector("section[data-geometry-fit]")).toHaveAttribute(
        "data-geometry-view",
        "top",
      );
    });
    expect(view.container.querySelector("section[data-geometry-fit]")).toHaveAttribute(
      "data-geometry-fit",
      "scene",
    );
  });
});
