import { expect, test, type Locator } from "@playwright/test";

const waitForCurrentFrame = async (rtt: Locator) => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 90_000 }).toBe(true);
};

test("production preview resolves seeded Free Practice and keeps lesson Observe canonical", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/simulator/free/interior-corner?seed=284719&sv=1");

  const observer = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 90_000,
  });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForCurrentFrame(rtt);
  await expect(page.getByTestId("scene-variation-controls")).toContainText(
    "Seed 284719 · schema v1",
  );
  const seededUrl = new URL(page.url());
  expect(seededUrl.searchParams.get("seed")).toBe("284719");
  expect(seededUrl.searchParams.get("sv")).toBe("1");

  const observerCapture = await observer.locator("canvas").first().screenshot();
  const groundGlassCapture = await rtt.locator("canvas").first().screenshot();
  await testInfo.attach("interior-corner-production-seeded-observer.png", {
    body: observerCapture,
    contentType: "image/png",
  });
  await testInfo.attach("interior-corner-production-seeded-ground-glass.png", {
    body: groundGlassCapture,
    contentType: "image/png",
  });

  await page.goto("/simulator/free/interior-corner?lesson=1&seed=284719&sv=1");
  await expect(page).toHaveURL(/lesson=1$/);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 90_000,
  });
  await waitForCurrentFrame(rtt);
  await testInfo.attach("interior-corner-production-canonical-lesson-observer.png", {
    body: await observer.locator("canvas").first().screenshot(),
    contentType: "image/png",
  });
  expect(pageErrors).toEqual([]);
});
