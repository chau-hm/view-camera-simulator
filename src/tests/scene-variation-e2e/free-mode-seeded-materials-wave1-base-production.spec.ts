import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SCENES = [
  {
    id: "architecture-foreground",
    guidedTaskId: "architecture-foreground-compound-01",
  },
  { id: "table-tilt", guidedTaskId: "tilt-01" },
] as const;

const appBasePath = (testInfo: TestInfo): string => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright project has no baseURL");
  const pathname = new URL(baseURL).pathname.replace(/\/$/, "");
  return pathname === "/" ? "" : pathname;
};

const appRoute = (testInfo: TestInfo, route: string): string => `${appBasePath(testInfo)}${route}`;

const waitForCompleteFrame = async (page: Page) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect.poll(async () => {
    const request = await rtt.getAttribute("data-frame-request-id");
    const completed = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(request && request === completed);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
};

test("seeded-material routes replay under the configured production base path", async ({ page }, testInfo) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  for (const { id, guidedTaskId } of SCENES) {
    await page.goto(appRoute(testInfo, `/simulator/free/${id}?rttDiagnostics=1`));
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "1", {
      timeout: 90_000,
    });
    const implicitSeed = Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed"));
    expect(Number.isInteger(implicitSeed) && implicitSeed >= 0 && implicitSeed <= 0xffff_ffff).toBe(true);
    let current = new URL(page.url());
    expect(current.pathname).toBe(appRoute(testInfo, `/simulator/free/${id}`));
    expect(current.searchParams.get("seed")).toBe(String(implicitSeed));
    expect(current.searchParams.get("sv")).toBe("1");
    await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-scene-id", id);
    await waitForCompleteFrame(page);

    await page.getByRole("button", { name: "Copy share URL" }).click();
    await expect(page.getByTestId("scene-variation-controls").getByRole("status")).toContainText("Share URL copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());

    await page.goto(appRoute(testInfo, `/simulator/free/${id}?seed=284719&sv=1&rttDiagnostics=1`));
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", "284719", {
      timeout: 90_000,
    });
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-schema", "1");
    await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-scene-id", id);
    await waitForCompleteFrame(page);

    await page.getByRole("button", { name: "Regenerate scene" }).click();
    await expect(page.getByTestId("scene-variation-controls")).not.toHaveAttribute("data-active-seed", "284719", {
      timeout: 90_000,
    });
    const regeneratedSeed = Number(await page.getByTestId("scene-variation-controls").getAttribute("data-active-seed"));
    expect(Number.isInteger(regeneratedSeed) && regeneratedSeed >= 0 && regeneratedSeed <= 0xffff_ffff).toBe(true);
    current = new URL(page.url());
    expect(current.pathname).toBe(appRoute(testInfo, `/simulator/free/${id}`));
    expect(current.searchParams.get("seed")).toBe(String(regeneratedSeed));
    expect(current.searchParams.get("sv")).toBe("1");
    await waitForCompleteFrame(page);
    await page.reload();
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(regeneratedSeed));
    await waitForCompleteFrame(page);
    await page.goBack();
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", "284719");
    await waitForCompleteFrame(page);
    await page.goForward();
    await expect(page.getByTestId("scene-variation-controls")).toHaveAttribute("data-active-seed", String(regeneratedSeed));
    await waitForCompleteFrame(page);

    await page.goto(appRoute(
      testInfo,
      `/simulator/guided/${id}/${guidedTaskId}?seed=284719&sv=1&rttDiagnostics=1`,
    ));
    const scene = page.getByTestId("scene-canvas");
    await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 120_000 });
    await expect(page.getByTestId("ground-glass-rtt")).toHaveAttribute("data-rtt-scene-id", id);
    await waitForCompleteFrame(page);
    expect(new URL(page.url()).pathname).toBe(appRoute(testInfo, `/simulator/guided/${id}/${guidedTaskId}`));
    expect(new URL(page.url()).searchParams.has("seed")).toBe(false);
    expect(new URL(page.url()).searchParams.has("sv")).toBe(false);
    await expect(page.getByRole("button", { name: "Regenerate scene" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy share URL" })).toHaveCount(0);
  }
});
