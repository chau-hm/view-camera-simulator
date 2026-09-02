import { expect, test, type ElementHandle, type Page } from "@playwright/test";

type SceneVisit = {
  heading: string;
  sceneId: string;
};

const visits: SceneVisit[] = [
  { heading: "Focus Fundamentals — Two Targets", sceneId: "focus-fundamentals-two-targets" },
  { heading: "Architecture Rise", sceneId: "architecture-rise" },
  { heading: "Understanding Camera Movements", sceneId: "understanding-camera-movements" },
  { heading: "Table Tilt", sceneId: "table-tilt" },
  { heading: "Shelf Swing", sceneId: "shelf-swing" },
  { heading: "Mirror Shift", sceneId: "mirror-shift" },
  { heading: "Understanding Camera Movements", sceneId: "understanding-camera-movements" },
  { heading: "Architecture Rise", sceneId: "architecture-rise" },
];

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const openPublicScene = async (page: Page, visit: SceneVisit) => {
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: visit.heading }) });
  await card.getByRole("link", { name: "Open Scene" }).click();
  await expect(page).toHaveURL(new RegExp(`/simulator/free/${visit.sceneId}$`));
};

test("public SPA scene switching keeps one current scene and its RTT renderer channels without reloads", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if ((message.type() === "error" || message.type() === "warning") && !isAllowedEnvironmentConsoleMessage(message.text())) {
      consoleProblems.push(message.text());
    }
  });

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
  let previousGroundGlasses: ElementHandle<Node>[] = [];
  let previousSanityState: string | null = null;
  let previousSceneId: string | null = null;

  for (const visit of visits) {
    await openPublicScene(page, visit);
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
      .toBe(documentToken);

    // Opt-in diagnostics without navigation
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("rttDiagnostics", "1");
      window.history.replaceState(window.history.state, "", url);
    });
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
      .toBe(documentToken);

    const sceneCanvas = page.getByTestId("scene-canvas");
    const groundGlassPanes = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
    const groundGlass = groundGlassPanes;
    await expect(sceneCanvas).toHaveCount(1);
    await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", visit.sceneId);
    await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
    await expect(groundGlassPanes).toHaveCount(1);
    await expect(groundGlassPanes.locator("canvas")).toHaveCount(1);

    // Use dedicated scene-id attribute instead of parsing internal cache key
    for (const pane of await groundGlassPanes.all()) {
      await expect(pane).toHaveAttribute("data-rtt-scene-id", visit.sceneId, { timeout: 60_000 });
      await expect(pane).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 60_000 });
      await expect(pane).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 60_000 });
      await expect(pane).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 60_000 });
      await expect(pane).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 60_000 });
    }
    const sanityState = await groundGlass.getAttribute("data-rtt-sanity-state");
    expect(sanityState).toBeTruthy();
    if (previousSceneId && previousSceneId !== visit.sceneId) {
      expect(sanityState).not.toBe(previousSanityState);
    }
    const priorSceneCanvas = previousSceneCanvas;
    if (priorSceneCanvas) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, priorSceneCanvas)).toBe(true);
    }
    for (const priorPane of previousGroundGlasses) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, priorPane)).toBe(true);
    }
    previousSanityState = sanityState;
    previousSceneId = visit.sceneId;
    previousSceneCanvas = await sceneCanvas.elementHandle();
    previousGroundGlasses = await groundGlassPanes.elementHandles();
    expect(previousSceneCanvas).toBeTruthy();

    await page.getByRole("link", { name: "All Scenes" }).click();
    await expect(page).toHaveURL(/\/scenes$/);
    await expect
      .poll(() => page.evaluate(() => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken))
      .toBe(documentToken);
    const detachedSceneCanvas = previousSceneCanvas;
    if (detachedSceneCanvas) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, detachedSceneCanvas)).toBe(true);
    }
    for (const detachedPane of previousGroundGlasses) {
      await expect.poll(() => page.evaluate((node) => !node.isConnected, detachedPane)).toBe(true);
    }
  }

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
