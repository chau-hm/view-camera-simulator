import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { useAppStore } from "../../state/appStore";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { getApproximateSvgTextBounds } from "../../components/geometry/labelPlacement";

type ApproximateBounds = ReturnType<typeof getApproximateSvgTextBounds>;

const intersects = (first: ApproximateBounds, second: ApproximateBounds): boolean =>
  first.left < second.right &&
  first.right > second.left &&
  first.top < second.bottom &&
  first.bottom > second.top;

const textBounds = (element: Element): ApproximateBounds =>
  getApproximateSvgTextBounds({
    x: Number(element.getAttribute("x")),
    y: Number(element.getAttribute("y")),
    text: element.textContent ?? "",
    anchor: (element.getAttribute("text-anchor") ?? "start") as "start" | "middle" | "end",
  });

const markerBounds = (element: Element): ApproximateBounds => {
  const left = Number(element.getAttribute("x"));
  const top = Number(element.getAttribute("y"));
  const width = Number(element.getAttribute("width"));
  const height = Number(element.getAttribute("height"));
  return { left, top, right: left + width, bottom: top + height, width, height };
};

const expectDepthPlaneGeometry = (svg: Element, visible: boolean): void => {
  for (const selector of [
    '[data-testid="plane-line-focus"]',
    'line[aria-label="nearDof plane"]',
    'line[aria-label="farDof plane"]',
    '[data-testid="dof-region"]',
  ]) {
    if (visible) expect(svg.querySelector(selector)).not.toBeNull();
    else expect(svg.querySelector(selector)).toBeNull();
  }
};

const expectGuideLabelClearOfMiddleTarget = (svg: Element): void => {
  const guideLabel = svg.querySelector('[data-testid="shelf-swing-subject-trace-label"]');
  const middleGroup = svg.querySelector('[data-testid="geometry-target-shelf-middle"]');
  const middleMarker = middleGroup?.querySelector("rect");
  const middleLabel = Array.from(middleGroup?.querySelectorAll("text") ?? []).find(
    (element) => element.textContent === "Middle chart",
  );
  expect(guideLabel).not.toBeNull();
  expect(middleMarker).not.toBeNull();
  expect(middleLabel).not.toBeUndefined();

  const guideBounds = textBounds(guideLabel!);
  expect(intersects(guideBounds, markerBounds(middleMarker!))).toBe(false);
  expect(intersects(guideBounds, textBounds(middleLabel!))).toBe(false);

  const [, , svgWidth, svgHeight] = (svg.getAttribute("viewBox") ?? "0 0 0 0")
    .split(/\s+/)
    .map(Number);
  expect(guideBounds.left).toBeGreaterThanOrEqual(0);
  expect(guideBounds.top).toBeGreaterThanOrEqual(0);
  expect(guideBounds.right).toBeLessThanOrEqual(svgWidth);
  expect(guideBounds.bottom).toBeLessThanOrEqual(svgHeight);
};

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
    expectDepthPlaneGeometry(topSvg!, true);
    expectGuideLabelClearOfMiddleTarget(topSvg!);
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

  it("hides depth-plane geometry in calibrated Side view while preserving physical context", () => {
    const optics = createOptics(
      shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg,
      shelfSwingGeometry.shelfSwingCalibration.focusDistanceMm,
    );
    const view = render(
      <GeometryViewport
        opticsState={optics}
        geometryView="side"
        scene={shelfSwingScene}
        riseMm={0}
      />,
    );
    const sideSvg = view.container.querySelector('[data-testid="geometry-svg-side"]');
    expect(sideSvg).not.toBeNull();
    expectDepthPlaneGeometry(sideSvg!, false);
    for (const testId of ["physical-film-segment", "physical-lens-segment"]) {
      expect(sideSvg?.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
    }
    for (const targetId of ["shelf-front", "shelf-middle", "shelf-back"]) {
      expect(sideSvg?.querySelector(`[data-testid="geometry-target-${targetId}"]`)).not.toBeNull();
    }
    expect(sideSvg?.querySelector('circle[fill="#dc2626"]')).not.toBeNull();
    expect(view.container.querySelector('[aria-label="Optical depth order"]')).not.toBeNull();
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
    expectGuideLabelClearOfMiddleTarget(
      within(subjectRegion).getByTestId("geometry-svg-top"),
    );
    expectDepthPlaneGeometry(within(subjectRegion).getByTestId("geometry-svg-top"), true);
    expect(within(cameraRegion).getByTestId("scheimpflug-intersection")).toBeInTheDocument();
    expectDepthPlaneGeometry(
      within(cameraRegion).getByTestId("geometry-svg-scheimpflug"),
      true,
    );
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
