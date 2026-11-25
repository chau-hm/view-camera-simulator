import { expect, type Page } from "@playwright/test";

export const setRangeDirect = async (page: Page, label: string, target: number) => {
  await page.getByLabel(label).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, target);
};

export const setRangeDirectOnGrid = async (
  page: Page,
  label: string,
  target: number,
): Promise<void> => {
  const slider = page.getByRole("slider", { name: label });
  await expect(slider).toBeEnabled();

  const [minimumText, maximumText, stepText] = await Promise.all([
    slider.getAttribute("min"),
    slider.getAttribute("max"),
    slider.getAttribute("step"),
  ]);
  if (minimumText === null || maximumText === null || stepText === null) {
    throw new Error(`${label} does not expose its public min, max, and step values`);
  }

  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const step = Number(stepText);
  const stepsFromMinimum = (target - minimum) / step;
  if (
    ![minimum, maximum, step, target].every(Number.isFinite) ||
    step <= 0 ||
    target < minimum ||
    target > maximum ||
    Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) >= 1e-8
  ) {
    throw new Error(`${label} target ${target} is not reachable on the public control grid`);
  }

  await setRangeDirect(page, label, target);
  await expect(slider).toHaveValue(String(target));
};
