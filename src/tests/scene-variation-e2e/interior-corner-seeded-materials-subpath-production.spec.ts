import { expect, test, type Locator, type Page } from "@playwright/test";

const DEPLOYMENT_BASE = "/view-camera-simulator/";
const SCENE_PATH = `${DEPLOYMENT_BASE}simulator/free/interior-corner`;
const INITIAL_SEED = 284719;

const waitForCurrentFrame = async (rtt: Locator) => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 90_000 }).toBe(true);
};

const waitForSeededScene = async (page: Page, seed: number) => {
  const observer = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const controls = page.getByTestId("scene-variation-controls");
  expect(new URL(page.url()).pathname).toBe(SCENE_PATH);
  await expect(controls).toHaveAttribute("data-active-seed", String(seed));
  await expect(controls).toHaveAttribute("data-active-schema", "1");
  await expect(controls).toContainText(`Seed ${seed} · schema v1`);
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 90_000,
  });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForCurrentFrame(rtt);
  return { observer, rtt, controls };
};

const copyAndVerifyShareUrl = async (page: Page, seed: number): Promise<string> => {
  const controls = page.getByTestId("scene-variation-controls");
  await page.getByRole("button", { name: "Copy share URL" }).click();
  await expect(controls.getByRole("status")).toContainText("Share URL copied");
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  const copied = new URL(copiedUrl);
  const browser = new URL(page.url());

  expect(copied.origin).toBe(browser.origin);
  expect(copied.href).toBe(browser.href);
  expect(copied.pathname).toBe(SCENE_PATH);
  expect(copied.pathname.split(DEPLOYMENT_BASE).length - 1).toBe(1);
  expect(copied.searchParams.getAll("seed")).toEqual([String(seed)]);
  expect(copied.searchParams.getAll("sv")).toEqual(["1"]);
  expect(copied.searchParams.getAll("keep")).toEqual(["one"]);
  expect(copied.hash).toBe("#pilot");
  return copiedUrl;
};

test("production subpath share URLs preserve basename and replay the active variant", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  const browserRoute = `${SCENE_PATH}?seed=${INITIAL_SEED}&sv=1&keep=one#pilot`;
  await page.goto(browserRoute);
  await waitForSeededScene(page, INITIAL_SEED);
  const initialBrowserUrl = page.url();
  const initialCopiedUrl = await copyAndVerifyShareUrl(page, INITIAL_SEED);

  // Replay the copied absolute URL through the real production preview route.
  await page.goto(initialCopiedUrl);
  const replay = await waitForSeededScene(page, INITIAL_SEED);
  expect(page.url()).toBe(initialCopiedUrl);
  const replayCopiedUrl = await copyAndVerifyShareUrl(page, INITIAL_SEED);

  // Regeneration must keep the deployment base and preserve history semantics.
  await replay.controls.getByRole("button", { name: "Regenerate scene" }).click();
  await expect(replay.controls).not.toHaveAttribute("data-active-seed", String(INITIAL_SEED), {
    timeout: 90_000,
  });
  const regeneratedSeedText = await replay.controls.getAttribute("data-active-seed");
  expect(regeneratedSeedText).toMatch(/^(0|[1-9][0-9]*)$/);
  const regeneratedSeed = Number(regeneratedSeedText);
  await waitForSeededScene(page, regeneratedSeed);
  const regeneratedCopiedUrl = await copyAndVerifyShareUrl(page, regeneratedSeed);

  await page.goBack();
  await waitForSeededScene(page, INITIAL_SEED);
  const restoredCopiedUrl = await copyAndVerifyShareUrl(page, INITIAL_SEED);
  await page.goForward();
  await waitForSeededScene(page, regeneratedSeed);

  await testInfo.attach("subpath-share-url-validation.json", {
    body: Buffer.from(JSON.stringify({
      buildBaseUrl: DEPLOYMENT_BASE,
      browserRoute,
      initialBrowserUrl,
      initialCopiedUrl,
      replay: { url: replayCopiedUrl, seed: INITIAL_SEED, schemaVersion: 1, observerMounted: true, groundGlassFrameCompleted: true },
      regeneratedSeed,
      regeneratedCopiedUrl,
      backRestoredSeed: INITIAL_SEED,
      restoredCopiedUrl,
      forwardRestoredSeed: regeneratedSeed,
      status: "passed",
    }, null, 2)),
    contentType: "application/json",
  });
  expect(pageErrors).toEqual([]);
});
