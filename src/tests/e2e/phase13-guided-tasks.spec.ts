import { expect, type Locator, type Page, test } from "@playwright/test";

const completedHeading = (page: Page): Locator => page.getByRole("heading", { name: "Task completed" });

const setRangeValue = async (page: Page, label: string, value: number): Promise<void> => {
  const slider = page.getByLabel(label);
  await slider.focus();
  const current = Number(await slider.inputValue());
  const step = Number((await slider.getAttribute("step")) ?? "1");
  const delta = value - current;
  const presses = Math.max(0, Math.round(Math.abs(delta) / step));
  const key = delta >= 0 ? "ArrowRight" : "ArrowLeft";
  for (let i = 0; i < presses; i += 1) {
    await slider.press(key);
  }
};

const setAperture = async (page: Page, value: "5.6" | "11" | "22" | "32"): Promise<void> => {
  await page.getByRole("combobox", { name: "Aperture" }).selectOption(value);
};

test("TST-E2E-002: user can enter guided mode from home page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("guided-entry").click();
  await expect(page).toHaveURL(/\/simulator\/guided\/architecture-rise\/task-rise-basics$/);
});

test("TST-E2E-003: rise task starts in failed state", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/task-rise-basics");
  await expect(completedHeading(page)).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Feedback", exact: true })).toBeVisible();
  await expect(page.getByText(/^Score:/)).toBeVisible();
});

test("TST-E2E-004: rise task can be completed with valid rise", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/task-rise-basics");
  await setRangeValue(page, "Rise", 12);
  await expect(completedHeading(page)).toBeVisible();
});

test("TST-E2E-005: tilt task cannot complete when aperture is f/32", async ({ page }) => {
  await page.goto("/simulator/guided/table-tilt/task-tilt-basics");
  await setAperture(page, "32");
  await setRangeValue(page, "Tilt", 3.5);
  await setRangeValue(page, "Focus distance", 3510);

  await expect(completedHeading(page)).not.toBeVisible();
  await expect(page.getByText("Aperture is not allowed for this task")).toBeVisible();
});

test("TST-E2E-006: tilt task can be completed with valid settings", async ({ page }) => {
  await page.goto("/simulator/guided/table-tilt/task-tilt-basics");
  await setAperture(page, "22");
  await setRangeValue(page, "Tilt", 3.5);
  await setRangeValue(page, "Focus distance", 3510);
  await expect(completedHeading(page)).toBeVisible();
});

test("TST-E2E-007: swing task starts in failed state at zero swing", async ({ page }) => {
  await page.goto("/simulator/guided/shelf-swing/task-swing-basics");
  await expect(completedHeading(page)).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Feedback", exact: true })).toBeVisible();
  await expect(page.getByText(/^Score:/)).toBeVisible();
});

test("TST-E2E-008: swing task can be completed with valid settings", async ({ page }) => {
  await page.goto("/simulator/guided/shelf-swing/task-swing-basics");
  await setAperture(page, "5.6");
  await setRangeValue(page, "Swing", 3.5);
  await setRangeValue(page, "Focus distance", 3590);
  await expect(completedHeading(page)).toBeVisible();
});

test("TST-E2E-009: restart task resets to initial guided state", async ({ page }) => {
  await page.goto("/simulator/guided/table-tilt/task-tilt-basics");
  await setAperture(page, "22");
  await setRangeValue(page, "Tilt", 3.5);
  await setRangeValue(page, "Focus distance", 3510);
  await expect(completedHeading(page)).toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();

  await expect(completedHeading(page)).not.toBeVisible();
  await expect(page.getByLabel("Tilt")).toHaveValue("0");
  await expect(page.getByLabel("Focus distance")).toHaveValue("2400");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
});

test("TST-E2E-010: free mode allows switching all scenes", async ({ page }) => {
  await page.goto("/simulator/free/architecture-rise");
  const sceneSelect = page.getByRole("combobox", { name: "Scene" });
  const focusSlider = page.getByLabel("Focus distance");

  await expect(sceneSelect).toHaveValue("architecture-rise");
  await expect(focusSlider).toHaveAttribute("max", "13200");

  await sceneSelect.selectOption("table-tilt");
  await expect(sceneSelect).toHaveValue("table-tilt");
  await expect(focusSlider).toHaveAttribute("max", "4200");
  await expect(page.getByText("Loaded assets: 2 required, 1 lazy for current scene, 2 preload for next scene.")).toBeVisible();

  await sceneSelect.selectOption("shelf-swing");
  await expect(sceneSelect).toHaveValue("shelf-swing");
  await expect(focusSlider).toHaveAttribute("max", "6200");
  await expect(page.getByText("Loaded assets: 2 required, 1 lazy for current scene, 0 preload for next scene.")).toBeVisible();
});

test("TST-E2E-011: shows webgl fallback when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "getContext");
    if (!descriptor || !descriptor.configurable) return;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => null,
    });
  });

  await page.goto("/simulator/guided/architecture-rise/task-rise-basics");
  await expect(page.getByText("WebGL is unavailable in this browser. Please use a WebGL-capable browser on desktop.")).toBeVisible();
  await expect(page.getByTestId("scene-front-y-mm")).toBeVisible();
});
