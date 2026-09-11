import { expect, type Locator, type Page } from "@playwright/test";

const focusDistributionPanel = (page: Page) =>
  page.getByTestId("focus-distribution-panel");

type FocusDistributionTargetQuery = {
  targetId: string;
};

const focusDistributionTarget = (page: Page, targetId: string): Locator =>
  focusDistributionPanel(page).locator(`[data-focus-target-id="${targetId}"]`);

export const readFocusDistributionPercent = async (
  page: Page,
  { targetId }: FocusDistributionTargetQuery,
): Promise<number> => {
  const target = focusDistributionTarget(page, targetId);
  await expect(target).toHaveCount(1);
  await expect(target).toBeVisible();
  const label = await target.getAttribute("aria-label");
  const match = label?.match(/(\d+)%/);
  if (!match) throw new Error(`Focus distribution cell has no percentage: ${label ?? "(missing label)"}`);
  return Number(match[1]);
};

export const readFocusDistributionScores = async (
  page: Page,
  targetIds: readonly string[],
): Promise<Record<string, number>> =>
  Object.fromEntries(
    await Promise.all(
      targetIds.map(async (targetId) => [
        targetId,
        await readFocusDistributionPercent(page, { targetId }),
      ] as const),
    ),
  );
