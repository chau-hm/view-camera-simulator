import { expect, type Page } from "@playwright/test";

const isAlignedToStep = (value: number, min: number, step: number): boolean => {
  const stepsFromMinimum = (value - min) / step;
  return Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) < 1e-8;
};

export const setStepRangeInput = async (
  page: Page,
  label: string,
  target: number,
  maximumKeypresses = 1_000,
): Promise<void> => {
  const slider = page.getByLabel(label);
  const [minimumText, maximumText, stepText, currentText] = await Promise.all([
    slider.getAttribute("min"),
    slider.getAttribute("max"),
    slider.getAttribute("step"),
    slider.inputValue(),
  ]);
  const minimum = Number(minimumText);
  const maximum = Number(maximumText);
  const step = Number(stepText);
  const current = Number(currentText);

  if (![minimum, maximum, step, current, target].every(Number.isFinite) || step <= 0) {
    throw new Error(`${label} does not expose a finite min, max, step, current value, and target`);
  }
  if (target < minimum || target > maximum) {
    throw new Error(`${label} target ${target} is outside ${minimum}–${maximum}`);
  }
  if (!isAlignedToStep(target, minimum, step)) {
    throw new Error(`${label} target ${target} is not aligned to its ${step} step`);
  }

  const exactPresses = Math.abs(target - current) / step;
  const presses = Math.round(exactPresses);
  if (Math.abs(exactPresses - presses) >= 1e-8) {
    throw new Error(`${label} cannot reach ${target} from ${current} using its ${step} step`);
  }
  await slider.focus();
  const key = target >= current ? "ArrowRight" : "ArrowLeft";
  const coarsePresses = Math.floor(presses / 10);
  const finePresses = presses % 10;
  const totalKeypresses = coarsePresses + finePresses;
  if (totalKeypresses > maximumKeypresses) {
    throw new Error(
      `${label} requires ${totalKeypresses} keypresses, exceeding the ${maximumKeypresses} limit`,
    );
  }
  for (let index = 0; index < coarsePresses; index += 1) {
    await slider.press(`Shift+${key}`);
  }
  for (let index = 0; index < finePresses; index += 1) {
    await slider.press(key);
  }
  await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(target, 8);
};
