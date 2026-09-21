import { expect, type Locator } from "@playwright/test";

export const setPublicRangeInput = async (slider: Locator, target: number): Promise<void> => {
  const [minimumText, maximumText, stepText] = await Promise.all([
    slider.getAttribute("min"),
    slider.getAttribute("max"),
    slider.getAttribute("step"),
  ]);
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
    throw new Error(`${target} is not a reachable public value for this range input`);
  }
  await slider.focus();
  await slider.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, target);
  await expect.poll(() => slider.inputValue(), { timeout: 15_000 }).toBe(String(target));
};
