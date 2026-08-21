import { expect, test } from "@playwright/test";
import { setRangeDirect } from "./helpers/rangeInput";
import { setStepRangeInput } from "./helpers/stepRangeInput";

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const numericAttribute = async (
  locator: import("@playwright/test").Locator,
  name: string,
) => Number(await locator.getAttribute(name));

const expectFiniteFocusDiagnostics = async (
  page: import("@playwright/test").Page,
) => {
  for (const id of [
    "foreground-near",
    "foreground-middle",
    "building-base",
    "building-middle",
  ]) {
    const value = Number(
      await page
        .getByRole("progressbar", { name: `${id} sharpness` })
        .getAttribute("aria-valuenow"),
    );
    expect(Number.isFinite(value), `${id} sharpness must be finite`).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  }
  await expect(page.locator("body")).not.toContainText(/NaN%|(?:^|\D)[+-]?Infinity(?:%|\D|$)/);
};

test("Architecture + Foreground DOF regression stays finite across Raw RTT toggles", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      (message.type() === "error" || message.type() === "warning") &&
      !isAllowedEnvironmentConsoleMessage(message.text())
    ) {
      consoleProblems.push(message.text());
    }
  });

  await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  await page.getByLabel("Focus assist").check();
  await setStepRangeInput(page, "Rise", 20);
  await setStepRangeInput(page, "Tilt", 6.6);
  await setRangeDirect(page, "Focus distance", 7750);
  await expect(page.getByLabel("Focus distance")).toHaveValue("7750");
  await page.getByRole("combobox", { name: "Aperture" }).selectOption("11");

  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "architecture-foreground");
  await expect(rtt).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
  await expectFiniteFocusDiagnostics(page);

  const rawVariance = await numericAttribute(rtt, "data-rtt-raw-variance");
  const processedVariance = await numericAttribute(rtt, "data-rtt-final-variance");
  expect(Number.isFinite(rawVariance)).toBe(true);
  expect(Number.isFinite(processedVariance)).toBe(true);
  expect(rawVariance).toBeGreaterThan(4);
  expect(processedVariance).toBeGreaterThan(4);
  expect(processedVariance).toBeGreaterThan(rawVariance * 0.5);

  const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  for (const rawEnabled of [true, false, true, false]) {
    if (rawEnabled) {
      await rawToggle.check();
    } else {
      await rawToggle.uncheck();
    }
    await expect(rawToggle).toBeChecked({ checked: rawEnabled });
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
    await expectFiniteFocusDiagnostics(page);
    const currentVariance = await numericAttribute(rtt, "data-rtt-final-variance");
    expect(Number.isFinite(currentVariance)).toBe(true);
    expect(currentVariance).toBeGreaterThan(4);
  }

  await expect(page.getByLabel("Rise")).toHaveValue("20");
  await expect(page.getByLabel("Tilt")).toHaveValue("6.6");
  await expect(page.getByLabel("Focus distance")).toHaveValue("7750");
  await expect(page.getByRole("combobox", { name: "Aperture" })).toHaveValue("11");
  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});

test("Architecture + Foreground DOF remains finite through a transition sequence", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  await page.getByLabel("Focus assist").check();
  const rtt = page.getByTestId("ground-glass-rtt");
  const checkpoints = [
    { tilt: 2, focus: 6830, aperture: "11" },
    { tilt: 6, focus: 6830, aperture: "11" },
    { tilt: 6.6, focus: 7750, aperture: "11" },
    { tilt: 6.6, focus: 7750, aperture: "22" },
    { tilt: 6.6, focus: 7750, aperture: "11" },
    { tilt: 2, focus: 6830, aperture: "11" },
  ];

  await setStepRangeInput(page, "Rise", 20);
  for (const checkpoint of checkpoints) {
    await setStepRangeInput(page, "Tilt", checkpoint.tilt);
    await setRangeDirect(page, "Focus distance", checkpoint.focus);
    await expect(page.getByLabel("Focus distance")).toHaveValue(String(checkpoint.focus));
    await page.getByRole("combobox", { name: "Aperture" }).selectOption(checkpoint.aperture);
    await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
    await expectFiniteFocusDiagnostics(page);
    expect(Number.isFinite(await numericAttribute(rtt, "data-rtt-final-variance"))).toBe(true);
  }
});
