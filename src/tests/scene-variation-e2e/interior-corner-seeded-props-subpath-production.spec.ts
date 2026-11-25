import { expect, test, type Locator, type Page } from "@playwright/test";

const DEPLOYMENT_BASE = "/view-camera-simulator/";
const SCENE_PATH = `${DEPLOYMENT_BASE}simulator/free/interior-corner`;
const INITIAL_SEED = 284719;

const waitForFrame = async (rtt: Locator): Promise<string> => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const waitForSeeded = async (page: Page, seed: number) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const controls = page.getByTestId("scene-variation-controls");
  expect(new URL(page.url()).pathname).toBe(SCENE_PATH);
  await expect(controls).toHaveAttribute("data-active-seed", String(seed));
  await expect(controls).toHaveAttribute("data-active-schema", "2");
  await expect(controls).toContainText(`Seed ${seed} · schema v2`);
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", {
    timeout: 90_000,
  });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "interior-corner");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForFrame(rtt);
  return { scene, rtt, controls };
};

const copyAndCheck = async (page: Page, seed: number): Promise<string> => {
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
  expect(copied.searchParams.getAll("sv")).toEqual(["2"]);
  expect(copied.searchParams.getAll("keep")).toEqual(["one"]);
  expect(copied.hash).toBe("#pilot");
  return copiedUrl;
};

test("subpath v2 share URLs replay, regenerate, and restore history without losing deployment base", async ({
  page,
}, testInfo) => {
  test.setTimeout(360_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  const browserRoute = `${SCENE_PATH}?seed=${INITIAL_SEED}&sv=2&keep=one#pilot`;
  await page.goto(browserRoute);
  const initial = await waitForSeeded(page, INITIAL_SEED);
  const initialImage = await initial.scene.locator("canvas").first().screenshot();
  const initialUrl = await copyAndCheck(page, INITIAL_SEED);

  await page.goto(initialUrl);
  const replay = await waitForSeeded(page, INITIAL_SEED);
  const replayImage = await replay.scene.locator("canvas").first().screenshot();
  expect(replayImage.equals(initialImage)).toBe(true);
  expect(page.url()).toBe(initialUrl);
  const replayCopy = await copyAndCheck(page, INITIAL_SEED);

  await page.reload();
  await waitForSeeded(page, INITIAL_SEED);
  expect(page.url()).toBe(replayCopy);

  await replay.controls.getByRole("button", { name: "Regenerate scene" }).click();
  await expect(replay.controls).not.toHaveAttribute("data-active-seed", String(INITIAL_SEED), {
    timeout: 90_000,
  });
  const regeneratedSeed = Number(await replay.controls.getAttribute("data-active-seed"));
  expect(Number.isInteger(regeneratedSeed) && regeneratedSeed >= 0 && regeneratedSeed <= 0xffff_ffff).toBe(true);
  await waitForSeeded(page, regeneratedSeed);
  const regeneratedUrl = await copyAndCheck(page, regeneratedSeed);

  await page.goBack();
  const restored = await waitForSeeded(page, INITIAL_SEED);
  const restoredUrl = await copyAndCheck(page, INITIAL_SEED);
  expect(restoredUrl).toBe(initialUrl);
  expect(await restored.scene.locator("canvas").first().screenshot()).toEqual(initialImage);

  await page.goForward();
  await waitForSeeded(page, regeneratedSeed);
  expect(page.url()).toBe(regeneratedUrl);
  expect(new URL(page.url()).pathname).toBe(SCENE_PATH);
  expect(new URL(page.url()).searchParams.get("sv")).toBe("2");
  expect(errors).toEqual([]);
  await testInfo.attach("subpath-v2-share-replay.json", {
    body: Buffer.from(JSON.stringify({
      buildBaseUrl: DEPLOYMENT_BASE,
      browserRoute,
      initialUrl,
      replayedSeed: INITIAL_SEED,
      schemaVersion: 2,
      copiedLinkReplay: true,
      reloadPreservedIdentity: true,
      regeneratedSeed,
      regeneratedUrl,
      backRestoredSeed: INITIAL_SEED,
      forwardRestoredSeed: regeneratedSeed,
      basenameOccurrences: 1,
      status: "passed",
    }, null, 2)),
    contentType: "application/json",
  });
});
