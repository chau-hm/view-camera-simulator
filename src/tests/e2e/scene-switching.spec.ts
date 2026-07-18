import { expect, test, type ElementHandle, type Page } from "@playwright/test";

type SceneVisit = {
  heading: string;
  sceneId: string;
};

const visits: SceneVisit[] = [
  { heading: "Focus Fundamentals — Two Targets", sceneId: "focus-fundamentals-two-targets" },
  { heading: "Architecture Rise", sceneId: "architecture-rise" },
  { heading: "Table Tilt", sceneId: "table-tilt" },
  { heading: "Shelf Swing", sceneId: "shelf-swing" },
  { heading: "Architecture Rise", sceneId: "architecture-rise" },
  { heading: "Shelf Swing", sceneId: "shelf-swing" },
];

// Chromium may emit this driver-only performance diagnostic around RTT readback.
const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const openPublicScene = async (page: Page, visit: SceneVisit) => {
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: visit.heading }) });
  await card.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(new RegExp(`/simulator/free/${visit.sceneId}$`));
};

test("public SPA scene switching keeps one current scene and one RTT renderer without reloads", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if ((message.type() === "error" || message.type() === "warning") && !isAllowedEnvironmentConsoleMessage(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  // This runs before the one initial document load. SPA links below must keep it.
  await page.addInitScript(() => {
    (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken =
      `${Date.now()}-${Math.random()}`;
  });
  await page.goto("/scenes");
  const documentToken = await page.evaluate(
    () => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken,
  );
  expect(documentToken).toBeTruthy();

  let previousSceneCanvas: ElementHandle<Element> | null = null;
  let previousGroundGlass: ElementHandle<Element> | null = null;
  let previousSanityState: string | null = null;
  let previousSceneId: string | null = null;

  for (const visit of visits) {
    await openPublicScene(page, visit);
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
      .toBe(documentToken);

    // Opt-in diagnostics without navigation: this must be a history mutation in the same document.
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("rttDiagnostics", "1");
      window.history.replaceState(window.history.state, "", url);
    });
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
      .toBe(documentToken);

    const sceneCanvas = page.getByTestId("scene-canvas");
    const groundGlass = page.getByTestId("ground-glass-rtt");
    await expect(sceneCanvas).toHaveCount(1);
    await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", visit.sceneId);
    await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
    await expect(groundGlass).toHaveCount(1);
    await expect(groundGlass.locator("canvas")).toHaveCount(1);
    await expect(groundGlass).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
    await expect(groundGlass).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
    await expect(groundGlass).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
    await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
    await expect(groundGlass).toHaveAttribute("data-rtt-sanity-state", new RegExp(`(^|:)${visit.sceneId}(:|$)`), { timeout: 60_000 });
    await expect(page.getByTestId("ground-glass-scene")).toHaveCount(0);

    const sanityState = await groundGlass.getAttribute("data-rtt-sanity-state");
    expect(sanityState).toBeTruthy();
    if (previousSceneId && previousSceneId !== visit.sceneId) {
      expect(sanityState).not.toBe(previousSanityState);
    }
    const priorSceneCanvas = previousSceneCanvas;
    const priorGroundGlass = previousGroundGlass;
    if (priorSceneCanvas) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, priorSceneCanvas)).toBe(true);
    }
    if (priorGroundGlass) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, priorGroundGlass)).toBe(true);
    }
    previousSanityState = sanityState;
    previousSceneId = visit.sceneId;
    previousSceneCanvas = await sceneCanvas.elementHandle();
    previousGroundGlass = await groundGlass.elementHandle();
    expect(previousSceneCanvas).toBeTruthy();
    expect(previousGroundGlass).toBeTruthy();

    await page.getByRole("link", { name: "All Scenes" }).click();
    await expect(page).toHaveURL(/\/scenes$/);
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
      .toBe(documentToken);
    const detachedSceneCanvas = previousSceneCanvas;
    const detachedGroundGlass = previousGroundGlass;
    if (detachedSceneCanvas) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, detachedSceneCanvas)).toBe(true);
    }
    if (detachedGroundGlass) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, detachedGroundGlass)).toBe(true);
    }
  }

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
