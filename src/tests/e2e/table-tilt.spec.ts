import { expect, test } from "@playwright/test";

const tableTiltCard = (page: import("@playwright/test").Page) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Table Tilt" }) });

const setRangeValue = async (
  page: import("@playwright/test").Page,
  label: string,
  target: number,
) => {
  const slider = page.getByLabel(label);
  const current = Number(await slider.inputValue());
  const step = Number((await slider.getAttribute("step")) ?? "1");
  const direction = target >= current ? "ArrowRight" : "ArrowLeft";
  const coarseStep = step * 10;
  const coarsePresses = Math.floor(Math.abs(target - current) / coarseStep);
  for (let index = 0; index < coarsePresses; index += 1) {
    await slider.press(`Shift+${direction}`);
  }
  const afterCoarse = Number(await slider.inputValue());
  const finePresses = Math.round(Math.abs(target - afterCoarse) / step);
  for (let index = 0; index < finePresses; index += 1) {
    await slider.press(direction);
  }
};

test("Table Tilt card exposes free and guided navigation", async ({ page }) => {
  await page.goto("/scenes");
  const card = tableTiltCard(page);
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
    "href",
    "/simulator/free/table-tilt",
  );
  await expect(card.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
    "href",
    "/simulator/guided/table-tilt/tilt-01",
  );

  await card.getByRole("link", { name: "Start Guided Task" }).click();
  await expect(page).toHaveURL(/\/simulator\/guided\/table-tilt\/tilt-01$/);
  await expect(page.getByText("Align tabletop focus with tilt")).toBeVisible();
});

test("Table Tilt Ground Glass uses one RTT surface and no legacy artifacts", async ({ page }) => {
  await page.goto("/simulator/free/table-tilt");
  const viewport = page.getByLabel("GroundGlassViewport");
  await expect(viewport).toBeVisible();
  await expect(viewport.getByTestId("ground-glass-rtt")).toHaveCount(1);
  await expect(viewport.getByTestId("ground-glass-scene")).toHaveCount(0);
  await expect(viewport.getByTestId("ground-glass-focus-ring")).toHaveCount(0);
  await expect(viewport.locator('[data-testid^="ground-glass-target-"]')).toHaveCount(0);

  const focusAssist = page.getByLabel("Focus Assist");
  await expect(focusAssist).not.toBeChecked();
  await focusAssist.check();
  await expect(focusAssist).toBeChecked();
  await expect(viewport.getByTestId("ground-glass-focus-ring")).toHaveCount(0);
});

test("Table Tilt calibrated controls complete the guided task", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/guided/table-tilt/tilt-01");
  await expect(page.getByRole("heading", { name: "Task completed" })).not.toBeVisible();

  await setRangeValue(page, "Tilt", 9);
  await setRangeValue(page, "Focus distance", 6054);
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  await expect(page.getByRole("heading", { name: "Task completed" })).toBeVisible();
  await expect(page.getByText(/Positive front tilt aligned/)).toBeVisible();
});

test("Table Tilt RTT supports zoom, pan, and a mobile smoke viewport", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/simulator/free/table-tilt");
  const viewport = page.getByLabel("GroundGlassViewport");
  const stage = viewport.getByRole("button");
  await expect(viewport.getByTestId("ground-glass-rtt")).toBeVisible();
  await expect(stage).toHaveAttribute("data-zoomed", "false");

  await stage.click({ position: { x: 100, y: 100 } });
  await expect(stage).toHaveAttribute("data-zoomed", "true");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Ground Glass stage bounding box not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(stage).toHaveAttribute("data-zoomed", "true");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel("GroundGlassViewport").getByTestId("ground-glass-rtt")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ground Glass" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});
