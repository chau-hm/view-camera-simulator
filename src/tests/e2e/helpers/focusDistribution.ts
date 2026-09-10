import { expect, type Locator, type Page } from "@playwright/test";

const focusDistributionPanel = (page: Page) =>
  page.getByTestId("focus-distribution-panel");

const focusDistributionCell = (page: Page, position: string): Locator =>
  focusDistributionPanel(page).getByRole("cell", { name: new RegExp(`^${position}(?: ·|:)`) });

export const readFocusDistributionPercent = async (
  page: Page,
  position: string,
): Promise<number> => {
  const cell = focusDistributionCell(page, position);
  await expect(cell).toBeVisible();
  const label = await cell.getAttribute("aria-label");
  const match = label?.match(/(\d+)%/);
  if (!match) throw new Error(`Focus distribution cell has no percentage: ${label ?? "(missing label)"}`);
  return Number(match[1]);
};

export const readFocusDistributionScores = async (
  page: Page,
  positions: readonly string[],
): Promise<Record<string, number>> =>
  Object.fromEntries(
    await Promise.all(
      positions.map(async (position) => [
        position,
        await readFocusDistributionPercent(page, position),
      ] as const),
    ),
  );
