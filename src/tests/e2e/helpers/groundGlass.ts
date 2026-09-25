import { expect, type Locator, type Page } from "@playwright/test";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../../core/optics/physicalSharpness";
import { CAMERA_CONSTANTS } from "../../../utils/constants";
import { GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX } from "../../../render/groundGlassBlurCalibration";

export type GroundGlassBlurCalibrationReading = {
  displayWidthPx: number;
  displayBlurScale: number;
  acceptableBoundaryRadiusPx: number;
};

export const expectGroundGlassBlurCalibration = async (
  rtt: Locator,
): Promise<GroundGlassBlurCalibrationReading> => {
  const reading = await rtt.evaluate((element) => ({
    displayWidthPx: Number(element.getAttribute("data-rtt-logical-width")),
    displayBlurScale: Number(element.getAttribute("data-rtt-display-blur-scale")),
  }));
  if (
    !Number.isFinite(reading.displayWidthPx) || reading.displayWidthPx <= 0 ||
    !Number.isFinite(reading.displayBlurScale) || reading.displayBlurScale <= 0
  ) {
    throw new Error(`Ground Glass blur diagnostics are invalid: ${JSON.stringify(reading)}`);
  }

  // Calibration intentionally uses complete film width and visible preview
  // width, not RTT texture size or a cropped Focus Loupe inspection window.
  const acceptableBoundaryRadiusPx =
    ((ACCEPTABLE_COC_DIAMETER_MM * reading.displayWidthPx) / CAMERA_CONSTANTS.filmWidthMm / 2) *
    reading.displayBlurScale;
  expect(acceptableBoundaryRadiusPx).toBeCloseTo(
    GROUND_GLASS_TARGET_BOUNDARY_BLUR_RADIUS_PX,
    2,
  );
  return { ...reading, acceptableBoundaryRadiusPx };
};

export type StageTransform = {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
};

export type ElementBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Resolve and read the transformed layer afresh on every call so React remounts
// cannot leave tests inspecting a detached element.
export const readStageTransform = async (locator: Locator): Promise<StageTransform> => {
  await expect(locator).toHaveCount(1);
  await expect(locator).toBeVisible();
  return locator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    const matrix =
      !transform || transform === "none"
        ? new DOMMatrixReadOnly()
        : new DOMMatrixReadOnly(transform);
    const result = {
      translateX: matrix.m41,
      translateY: matrix.m42,
      scaleX: matrix.a,
      scaleY: matrix.d,
    };
    if (!Object.values(result).every(Number.isFinite)) {
      throw new Error(`Ground Glass transform contains non-finite values: ${transform}`);
    }
    return result;
  });
};

export const readFreshElementBounds = async (locator: Locator): Promise<ElementBounds> => {
  await expect(locator).toHaveCount(1);
  await expect(locator).toBeVisible();
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const bounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    if (!Object.values(bounds).every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
      throw new Error(`Element has invalid bounds: ${JSON.stringify(bounds)}`);
    }
    return bounds;
  });
};

export const clickStageAt = async (
  page: Page,
  stage: Locator,
  xRatio: number,
  yRatio: number,
): Promise<ElementBounds> => {
  const bounds = await readFreshElementBounds(stage);
  await page.mouse.click(
    bounds.x + bounds.width * xRatio,
    bounds.y + bounds.height * yRatio,
  );
  return bounds;
};
