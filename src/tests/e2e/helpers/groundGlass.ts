import { expect, type Locator, type Page } from "@playwright/test";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../../core/optics/physicalSharpness";

export type GroundGlassPhysicalScaleReading = {
  displayWidthPx: number;
  sampledFilmWidthMm: number;
  physicalBoundaryRadiusPx: number;
};

/** Confirms diagnostics report the direct physical CoC-to-visible-pixel mapping. */
export const expectGroundGlassPhysicalScale = async (
  rtt: Locator,
): Promise<GroundGlassPhysicalScaleReading> => {
  await expect(rtt).not.toHaveAttribute("data-rtt-display-blur-scale");
  const reading = await rtt.evaluate((element) => ({
    displayWidthPx: Number(element.getAttribute("data-rtt-logical-width")),
    sampledFilmWidthMm: Number(element.getAttribute("data-rtt-sampled-film-width-mm")),
    physicalBoundaryRadiusPx: Number(element.getAttribute("data-rtt-physical-boundary-blur-radius-px")),
  }));
  if (!Object.values(reading).every(Number.isFinite) || reading.displayWidthPx <= 0 || reading.sampledFilmWidthMm <= 0) {
    throw new Error(`Ground Glass physical blur diagnostics are invalid: ${JSON.stringify(reading)}`);
  }
  const expectedRadiusPx =
    ACCEPTABLE_COC_DIAMETER_MM * reading.displayWidthPx / reading.sampledFilmWidthMm / 2;
  expect(reading.physicalBoundaryRadiusPx).toBeCloseTo(expectedRadiusPx, 4);
  return reading;
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
