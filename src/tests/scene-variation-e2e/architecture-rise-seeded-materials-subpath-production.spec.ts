import { expect, test, type Locator, type Page } from "@playwright/test";

const DEPLOYMENT_BASE = "/view-camera-simulator/";
const SCENE_PATH = `${DEPLOYMENT_BASE}simulator/free/architecture-rise`;
const GUIDED_PATH = `${DEPLOYMENT_BASE}simulator/guided/architecture-rise/rise-01`;
const INITIAL_SEED = 284719;

test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });

const waitForCurrentFrame = async (rtt: Locator) => {
  await expect.poll(async () => {
    const requestId = await rtt.getAttribute("data-frame-request-id");
    const completedRequestId = await rtt.getAttribute("data-last-completed-request-id");
    return Boolean(requestId && requestId === completedRequestId);
  }, { timeout: 90_000 }).toBe(true);
};

const waitForSeededScene = async (page: Page, seed: number) => {
  expect(new URL(page.url()).pathname).toBe(SCENE_PATH);
  const observer = page.getByTestId("scene-canvas");
  const rtt = page.getByTestId("ground-glass-rtt");
  const controls = page.getByTestId("scene-variation-controls");
  const quality = page.getByRole("combobox", { name: "Render quality", exact: true });
  await expect(controls).toHaveAttribute("data-active-seed", String(seed));
  await expect(controls).toHaveAttribute("data-active-schema", "1");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
  await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
  await expect(rtt).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer", { timeout: 90_000 });
  await expect(rtt).toHaveAttribute("data-actual-execution-api", "webgl2");
  await quality.selectOption("standard");
  await expect(quality).toHaveValue("standard");
  await waitForCurrentFrame(rtt);
  return controls;
};

test("production subpath keeps Architecture Rise share, regeneration and history inside its base", async ({ page }) => {
  test.setTimeout(300_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const browserRoute = `${SCENE_PATH}?seed=${INITIAL_SEED}&sv=1&keep=one#pilot`;
  await page.goto(browserRoute);
  const controls = await waitForSeededScene(page, INITIAL_SEED);

  await page.getByRole("button", { name: "Copy share URL", exact: true }).click();
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
  const copied = new URL(copiedUrl);
  expect(copied.pathname).toBe(SCENE_PATH);
  expect(copied.searchParams.getAll("seed")).toEqual([String(INITIAL_SEED)]);
  expect(copied.searchParams.getAll("sv")).toEqual(["1"]);
  expect(copied.searchParams.getAll("keep")).toEqual(["one"]);
  expect(copied.hash).toBe("#pilot");

  await page.goto(copiedUrl);
  await waitForSeededScene(page, INITIAL_SEED);
  expect(page.url()).toBe(copiedUrl);
  await page.getByTestId("scene-variation-controls").getByRole("button", { name: "Regenerate scene", exact: true }).click();
  await expect(controls).not.toHaveAttribute("data-active-seed", String(INITIAL_SEED), { timeout: 90_000 });
  const regeneratedSeed = Number(await controls.getAttribute("data-active-seed"));
  expect(Number.isInteger(regeneratedSeed)).toBe(true);
  await waitForSeededScene(page, regeneratedSeed);

  await page.goBack();
  await waitForSeededScene(page, INITIAL_SEED);
  await page.goForward();
  await waitForSeededScene(page, regeneratedSeed);

  await page.goto(`${GUIDED_PATH}?seed=${INITIAL_SEED}&sv=1`);
  await expect(page.getByTestId("scene-variation-controls")).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe(GUIDED_PATH);
  expect(new URL(page.url()).searchParams.has("seed")).toBe(false);
  expect(new URL(page.url()).searchParams.has("sv")).toBe(false);
});
