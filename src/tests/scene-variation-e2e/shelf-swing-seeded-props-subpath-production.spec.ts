import { expect, test, type Locator, type Page } from "@playwright/test";
import { setRangeDirectOnGrid } from "../e2e/helpers/rangeInput";
import { controlSolution } from "../../scenes/shelfSwingGeometry";

const DEPLOYMENT_BASE = "/view-camera-simulator/";
const SCENE_PATH = `${DEPLOYMENT_BASE}simulator/free/shelf-swing`;
const FIXED_SEED = 284719;

const waitForFrame = async (rtt: Locator, previousRequestId?: string | null): Promise<string> => {
  if (previousRequestId !== undefined) {
    await expect.poll(() => rtt.getAttribute("data-frame-request-id"), { timeout: 120_000 })
      .not.toBe(previousRequestId);
  }
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    return Boolean(requestId && requestId === await rtt.getAttribute("data-last-completed-request-id"));
  }, { timeout: 120_000 }).toBe(true);
  await expect(rtt).toHaveAttribute("data-frame-result-status", "completed");
  return (await rtt.getAttribute("data-frame-request-id")) ?? "";
};

const waitForSeeded = async (page: Page, seed: number) => {
  const scene = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const controls = page.getByTestId("scene-variation-controls");
  await expect(new URL(page.url()).pathname).toBe(SCENE_PATH);
  await expect(controls).toHaveAttribute("data-active-seed", String(seed));
  await expect(controls).toHaveAttribute("data-active-schema", "1");
  await expect(controls).toContainText(`Seed ${seed} · schema v1`);
  await expect(scene).toHaveAttribute("data-scene-subject-id", "shelf-swing");
  await expect(scene).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(scene).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(scene).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", "shelf-swing");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await waitForFrame(rtt);
  return { scene, rtt, controls };
};

const setCanonicalControls = async (page: Page, rtt: Locator): Promise<void> => {
  await page.getByLabel("Render quality").selectOption("standard");
  await setRangeDirectOnGrid(page, "Focus distance", controlSolution.focusDistanceMm);
  await setRangeDirectOnGrid(page, "Swing", controlSolution.frontSwingDeg);
  await page.getByRole("radiogroup", { name: "Aperture" }).getByRole("radio", { name: "f/11" }).check();
  await waitForFrame(rtt);
};

const getOverlayGroup = async (page: Page): Promise<Locator> => {
  const inlineGroup = page.getByTestId("scene-overlay-inline");
  if (await inlineGroup.count() === 1) {
    await expect(inlineGroup).toBeVisible();
    return inlineGroup;
  }
  const collapsedGroup = page.getByTestId("scene-overlay-collapsed");
  if (await collapsedGroup.count() === 0) {
    await page.getByRole("button", { name: /View overlays/i }).click();
  }
  await expect(collapsedGroup).toBeVisible();
  return collapsedGroup;
};

const clearObserverOverlays = async (page: Page, scene: Locator): Promise<void> => {
  const trigger = page.getByRole("button", { name: /View overlays/i });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const group = await getOverlayGroup(page);
    const active = group.locator('button[aria-pressed="true"]');
    if (await active.count() === 0) break;
    await active.first().click();
  }
  const group = await getOverlayGroup(page);
  await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-optical-geometry-visible", "false");
  await expect(scene).toHaveAttribute("data-focus-overlay-visible", "false");
  await expect(scene).toHaveAttribute("data-dof-overlay-visible", "false");
  if (await trigger.count() === 1 && await trigger.getAttribute("aria-expanded") === "true") {
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  }
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
  expect(copied.searchParams.getAll("sv")).toEqual(["1"]);
  expect(copied.searchParams.getAll("keep")).toEqual(["one"]);
  expect(copied.hash).toBe("#pilot");
  return copiedUrl;
};

test("Shelf Swing v1 share URLs replay, regenerate, and restore history under subpath deployment", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const fixedUrl = `${SCENE_PATH}?seed=${FIXED_SEED}&sv=1&keep=one#pilot`;
  await page.goto(fixedUrl);
  const first = await waitForSeeded(page, FIXED_SEED);
  await clearObserverOverlays(page, first.scene);
  await setCanonicalControls(page, first.rtt);
  await clearObserverOverlays(page, first.scene);
  const copiedFixedUrl = await copyAndCheck(page, FIXED_SEED);
  expect(copiedFixedUrl).toBe(page.url());

  await page.goto(copiedFixedUrl);
  const replay = await waitForSeeded(page, FIXED_SEED);
  await clearObserverOverlays(page, replay.scene);
  await setCanonicalControls(page, replay.rtt);
  await clearObserverOverlays(page, replay.scene);
  await expect(replay.controls).toHaveAttribute("data-active-seed", String(FIXED_SEED));
  await expect(replay.controls).toHaveAttribute("data-active-schema", "1");
  expect(page.url()).toBe(copiedFixedUrl);

  await page.getByRole("button", { name: "Regenerate scene" }).click();
  await expect(replay.controls).not.toHaveAttribute("data-active-seed", String(FIXED_SEED), { timeout: 90_000 });
  const regeneratedSeed = Number(await replay.controls.getAttribute("data-active-seed"));
  expect(Number.isInteger(regeneratedSeed) && regeneratedSeed >= 0 && regeneratedSeed <= 0xffff_ffff).toBe(true);
  await waitForSeeded(page, regeneratedSeed);
  const regeneratedUrl = await copyAndCheck(page, regeneratedSeed);
  expect(new URL(regeneratedUrl).searchParams.get("keep")).toBe("one");
  expect(new URL(regeneratedUrl).hash).toBe("#pilot");

  await page.goBack();
  const restored = await waitForSeeded(page, FIXED_SEED);
  expect(await copyAndCheck(page, FIXED_SEED)).toBe(copiedFixedUrl);
  await expect(restored.controls).toHaveAttribute("data-active-schema", "1");

  await page.goForward();
  await waitForSeeded(page, regeneratedSeed);
  expect(page.url()).toBe(regeneratedUrl);
  const path = new URL(page.url()).pathname;
  expect(path).toBe(SCENE_PATH);
  expect(path.split(DEPLOYMENT_BASE).length - 1).toBe(1);
  expect(pageErrors).toEqual([]);

  await testInfo.attach("shelf-swing-subpath-replay.json", {
    body: Buffer.from(JSON.stringify({
      buildBaseUrl: DEPLOYMENT_BASE,
      fixedUrl,
      copiedFixedUrl,
      sameSeedRouteReplay: true,
      regeneratedSeed,
      regeneratedUrl,
      backRestoredSeed: FIXED_SEED,
      forwardRestoredSeed: regeneratedSeed,
      basenameOccurrences: 1,
      pageErrors,
      status: "passed",
    }, null, 2)),
    contentType: "application/json",
  });
});
