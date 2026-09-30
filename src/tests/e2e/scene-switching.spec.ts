import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
import { expect, test, type ElementHandle, type Page } from "@playwright/test";

type SceneVisit = {
  sceneId: string;
  href: string;
  linkIndex: number;
};

const isAllowedEnvironmentConsoleMessage = (message: string) =>
  /GL Driver Message .*GPU stall due to ReadPixels/.test(message);

const discoverPublicSceneVisits = async (page: Page): Promise<SceneVisit[]> => {
  const hrefs = await page
    .locator("article.scene-feature-card a.btn--primary")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));

  expect(hrefs.length, "the public scene listing should expose at least one scene").toBeGreaterThan(0);

  const visits = hrefs.map((href, linkIndex) => {
    expect(href, `public scene link ${linkIndex} must have an href`).toBeTruthy();
    if (!href) throw new Error(`Public scene link ${linkIndex} has no href`);

    const route = new URL(href, page.url());
    const match = route.pathname.match(/^\/simulator\/free\/([^/]+)$/);
    expect(match, `unexpected public scene route: ${href}`).not.toBeNull();
    if (!match) throw new Error(`Unexpected public scene route: ${href}`);

    return {
      sceneId: decodeURIComponent(match[1]),
      href,
      linkIndex,
    };
  });

  const sceneIds = visits.map(({ sceneId }) => sceneId);
  expect(new Set(sceneIds).size, "public scene links must have unique scene IDs").toBe(
    sceneIds.length,
  );

  return visits;
};

const openPublicScene = async (page: Page, visit: SceneVisit) => {
  const link = page.locator("article.scene-feature-card a.btn--primary").nth(visit.linkIndex);
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("href", visit.href);
  await link.click();
  const expectedRoute = new URL(visit.href, page.url());
  await expect(page).toHaveURL(
    (actualRoute) =>
      actualRoute.pathname === expectedRoute.pathname &&
      actualRoute.search === expectedRoute.search,
  );
};

test("public SPA scene switching keeps one current scene and its RTT renderer channels without reloads", async ({ page }) => {
  test.setTimeout(480_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (isKnownFiberClockDeprecation(message)) return;
    if ((message.type() === "error" || message.type() === "warning") && !isAllowedEnvironmentConsoleMessage(message.text())) {
      consoleProblems.push(message.text());
    }
  });

  await page.addInitScript(() => {
    (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken =
      `${Date.now()}-${Math.random()}`;
  });
  await page.goto("/scenes");
  const visits = await discoverPublicSceneVisits(page);
  const discoveredSceneIds = visits.map(({ sceneId }) => sceneId);
  const documentToken = await page.evaluate(
    () => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken,
  );
  expect(documentToken).toBeTruthy();

  let previousSceneCanvas: ElementHandle<Element> | null = null;
  let previousGroundGlasses: ElementHandle<Node>[] = [];
  let previousSanityState: string | null = null;
  let previousSceneId: string | null = null;
  const seenRttOwnerIds = new Set<string>();
  const visitedSceneIds = new Set<string>();

  for (const visit of visits) {
    expect(visitedSceneIds.has(visit.sceneId), `scene ${visit.sceneId} should be visited once`).toBe(false);
    visitedSceneIds.add(visit.sceneId);
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
    await expect(groundGlass).toHaveAttribute("data-rtt-owner-id", /^ground-glass-rtt-owner-/, { timeout: 60_000 });
    await expect(groundGlass).toHaveAttribute("data-rtt-resource-generation", /^[1-9]\d*$/, { timeout: 60_000 });
    const rttOwnerId = await groundGlass.getAttribute("data-rtt-owner-id");
    expect(rttOwnerId).toBeTruthy();
    expect(seenRttOwnerIds.has(rttOwnerId!)).toBe(false);
    seenRttOwnerIds.add(rttOwnerId!);
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

  expect([...visitedSceneIds].sort()).toEqual([...discoveredSceneIds].sort());
  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
