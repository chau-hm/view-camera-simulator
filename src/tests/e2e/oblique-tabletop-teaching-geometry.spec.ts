import { expect, test } from "@playwright/test";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const readPlaneLine = async (
  page: import("@playwright/test").Page,
  view: "side" | "top",
  plane: "focus" | "lens",
) => {
  const line = page
    .getByTestId(`geometry-svg-${view}`)
    .getByTestId("geometry-construction-current")
    .locator(`line[data-testid="plane-line-${plane}"]`);
  return line.evaluate((element) =>
    ["x1", "y1", "x2", "y2"].map((attribute) => Number(element.getAttribute(attribute))),
  );
};

test("Oblique Tabletop exposes live Side, Top, and 3D compound teaching geometry", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/oblique-tabletop");

  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scene-subject-id",
    "oblique-tabletop",
  );
  await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute(
    "data-rtt-camera-ok",
    "true",
    { timeout: 60_000 },
  );

  await page.getByRole("button", { name: "Expand 2D Geometry" }).click();
  const geometry = page.locator("section.geometry-viewport");
  await expect(geometry).toHaveAttribute("data-geometry-view", "side");
  await expect(page.getByTestId("geometry-svg-side")).toHaveAttribute(
    "data-teaching-geometry",
    "oblique-tabletop",
  );
  await expect(
    page.getByTestId("geometry-construction-current").getByTestId("oblique-tabletop-near-far-plane"),
  ).toBeVisible();
  await expect(page.getByTestId("oblique-tabletop-teaching-feedback")).toContainText(
    "disagree in more than one direction",
  );

  const neutralSideFocusLine = await readPlaneLine(page, "side", "focus");
  await setStepRangeInput(page, "Tilt", -8);
  await expect.poll(() => readPlaneLine(page, "side", "focus")).not.toEqual(neutralSideFocusLine);
  await expect(page.getByTestId("oblique-tabletop-teaching-feedback")).toContainText(
    "Near-to-far alignment improves",
  );

  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect(geometry).toHaveAttribute("data-geometry-view", "top");
  await expect(page.getByTestId("geometry-svg-top")).toHaveAttribute(
    "data-teaching-focus-plane-source",
    "DerivedOpticsState.focusPlane",
  );
  await expect(
    page.getByTestId("geometry-construction-current").getByTestId("oblique-tabletop-left-right-plane"),
  ).toBeVisible();
  // At the exact PR10B public Tilt state the focus plane can be parallel to
  // this top section, so the live lens-plane trace is the stable Swing cue.
  const tiltOnlyTopLensLine = await readPlaneLine(page, "top", "lens");
  await setStepRangeInput(page, "Swing", -1.7);
  await expect.poll(() => readPlaneLine(page, "top", "lens")).not.toEqual(tiltOnlyTopLensLine);
  await expect(page.getByTestId("oblique-tabletop-teaching-feedback")).toContainText(
    "orienting one three-dimensional plane",
  );

  await page.getByRole("button", { name: "Restore 2D Geometry" }).click();
  await expect(page.getByTestId("scene-canvas")).toBeVisible();
  await setStepRangeInput(page, "Tilt", -8);
  await setStepRangeInput(page, "Swing", -1.7);
  await page.getByRole("button", { name: "View overlays" }).click();
  await page.getByRole("button", { name: "Show Scheimpflug construction" }).click();
  await expect(page.getByRole("button", { name: "Hide Scheimpflug construction" })).toBeVisible();
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute(
    "data-scheimpflug-construction",
    "true",
  );

  const documentToken = await page.evaluate(() => {
    const token = `${Date.now()}-${Math.random()}`;
    (window as Window & { __obliqueTeachingDocumentToken?: string }).__obliqueTeachingDocumentToken = token;
    return token;
  });
  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Oblique Tabletop" }) }).getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(/\/simulator\/free\/oblique-tabletop$/);
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __obliqueTeachingDocumentToken?: string }).__obliqueTeachingDocumentToken))
    .toBe(documentToken);
  await expect(page.getByTestId("ground-glass-rtt")).toBeVisible();
});
