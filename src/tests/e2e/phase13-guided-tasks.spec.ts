import { expect, type Locator, type Page, test } from "@playwright/test";

const completedHeading = (page: Page): Locator =>
  page.getByRole("heading", { name: "Task completed" });

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

test("TST-E2E-002: user can open Architecture Rise from the Scenes page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the Simulator" }).click();
  await expect(page).toHaveURL(/\/scenes$/);

  const architectureCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });
  await expect(architectureCard).toBeVisible();
  await architectureCard.getByRole("link", { name: "Open Scene" }).click();

  await expect(page).toHaveURL(/\/simulator\/free\/architecture-rise$/);
  await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  await expect(page.getByLabel("Camera Controls")).toBeVisible();
});

test("TST-E2E-003: rise task starts in failed state", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await expect(completedHeading(page)).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
  await expect(page.getByText(/^Score:/)).toBeVisible();
});

test("TST-E2E-004: rise task can be completed with valid rise", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await setRangeValue(page, "Rise", 12);
  await expect(completedHeading(page)).toBeVisible();
});

test("TST-E2E-005: restart resets Architecture Rise guided task", async ({ page }) => {
  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await setRangeValue(page, "Rise", 12);
  await expect(completedHeading(page)).toBeVisible();

  await page.getByRole("button", { name: "Restart task" }).click();

  await expect(completedHeading(page)).not.toBeVisible();
  await expect(page.getByLabel("Rise")).toHaveValue("0");
  // Confirm tilt and swing remain at 0
  await expect(page.getByLabel("Tilt")).toHaveValue("0");
  await expect(page.getByLabel("Swing")).toHaveValue("0");
  // Aperture default for tasks
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
});

test("TST-E2E-006: free mode can return to All Scenes and open Focus Fundamentals", async ({ page }) => {
  await page.goto("/simulator/free/architecture-rise");
  await expect(page.getByRole("heading", { name: "3D Scene" })).toBeVisible();

  await page.getByRole("link", { name: "All Scenes" }).click();
  await expect(page).toHaveURL(/\/scenes$/);

  const focusCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Focus Fundamentals — Two Targets" }) });
  await expect(focusCard).toBeVisible();
  await focusCard.getByRole("link", { name: "Open Scene" }).click();

  await expect(page).toHaveURL(/\/simulator\/free\/focus-fundamentals-two-targets$/);
  await expect(page.getByLabel("Focus distance")).toBeVisible();
});

test("TST-E2E-007: shows webgl fallback when WebGL is unavailable", async ({ page }) => {
  // Deterministic interception that preserves non-WebGL contexts
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") {
        return null;
      }
      // @ts-expect-error - forward to original (typing not important in test harness)
      return original.call(this, contextId, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/simulator/guided/architecture-rise/rise-01");
  await expect(
    page.getByText(
      "WebGL is unavailable in this browser. Please use a WebGL-capable browser on desktop.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Camera Controls")).toBeVisible();
});
