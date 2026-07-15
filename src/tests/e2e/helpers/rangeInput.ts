import type { Page } from "@playwright/test";

export const setRangeDirect = async (page: Page, label: string, target: number) => {
  await page.getByLabel(label).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Range input value setter unavailable");
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, target);
};
