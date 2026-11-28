import { isKnownFiberClockDeprecation } from "./helpers/threeCompatibility";
import { expect, test, type ElementHandle, type Page } from "@playwright/test";
import { getSceneById } from "../../scenes/definitions";

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
  const variation = getSceneById(visit.sceneId)?.sceneVariation;
  await expect(page).toHaveURL((actualRoute) => {
    if (actualRoute.pathname !== expectedRoute.pathname || actualRoute.hash !== expectedRoute.hash) return false;
    const actualParams = new URLSearchParams(actualRoute.search);
    if (variation?.enabled) {
      const seeds = actualParams.getAll("seed");
      const versions = actualParams.getAll("sv");
      if (seeds.length !== 1 || !/^(0|[1-9][0-9]*)$/.test(seeds[0]!) ||
          Number(seeds[0]) > 0xffff_ffff || versions.length !== 1 ||
          versions[0] !== String(variation.schemaVersion)) return false;
      actualParams.delete("seed");
      actualParams.delete("sv");
    }
    return actualParams.toString() === expectedRoute.searchParams.toString();
  });
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
  await page.goto("/simulator/free/architecture-rise?keep=one&seed=123&other=two");
  await expect(page).toHaveURL((url) =>
    url.pathname === "/simulator/free/architecture-rise" &&
    url.searchParams.getAll("seed").join() === "123" &&
    url.searchParams.getAll("sv").join() === "1" &&
    url.searchParams.getAll("keep").join() === "one" &&
    url.searchParams.getAll("other").join() === "two" &&
    [...url.searchParams.keys()].length === 4,
  );
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
  const seenRendererGenerationIds = new Set<string>();
  const visitedSceneIds = new Set<string>();
  let macroBellowsVisit: SceneVisit | null = null;
  let macroBellowsObserverHandle: ElementHandle<Element> | null = null;
  let macroBellowsRttHandle: ElementHandle<Element> | null = null;

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
      window.history.pushState(window.history.state, "", url);
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
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
      await expect(pane).toHaveAttribute("data-mounted-renderer-family", "webgl-renderer");
      await expect(pane).toHaveAttribute("data-actual-execution-api", /^webgl2?$/);
      await expect(pane).toHaveAttribute("data-render-host-lifecycle", "ready");
      await expect(pane).toHaveAttribute("data-frame-result-status", "completed");
      const acceptedRequestId = await pane.getAttribute("data-frame-request-id");
      expect(acceptedRequestId).toBeTruthy();
      await expect(pane).toHaveAttribute("data-last-completed-request-id", acceptedRequestId!);
    }
    await expect(groundGlass).toHaveAttribute("data-rtt-owner-id", /^ground-glass-rtt-owner-/, { timeout: 60_000 });
    await expect(groundGlass).toHaveAttribute("data-rtt-resource-generation", /^[1-9]\d*$/, { timeout: 60_000 });
    const rttOwnerId = await groundGlass.getAttribute("data-rtt-owner-id");
    expect(rttOwnerId).toBeTruthy();
    expect(seenRttOwnerIds.has(rttOwnerId!)).toBe(false);
    seenRttOwnerIds.add(rttOwnerId!);
    const rendererGenerationId = await groundGlass.getAttribute("data-renderer-generation");
    expect(rendererGenerationId).toBeTruthy();
    expect(seenRendererGenerationIds.has(rendererGenerationId!)).toBe(false);
    seenRendererGenerationIds.add(rendererGenerationId!);

    if (visit.sceneId === "macro-bellows-extension") {
      macroBellowsVisit = visit;
      const observerCanvas = sceneCanvas.locator("canvas");
      const rttCanvas = groundGlass.locator("canvas");
      await expect(sceneCanvas).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
      await expect.poll(async () => {
        const value = await observerCanvas.getAttribute("data-macro-watch-cage-angle");
        return value !== null && Number.isFinite(Number(value));
      }, { timeout: 60_000 }).toBe(true);
      await expect.poll(async () => {
        const value = await rttCanvas.getAttribute("data-macro-watch-cage-angle");
        return value !== null && Number.isFinite(Number(value));
      }, { timeout: 60_000 }).toBe(true);
      macroBellowsObserverHandle = await observerCanvas.elementHandle();
      macroBellowsRttHandle = await rttCanvas.elementHandle();
    } else if (["macro-depth-of-field", "macro-oblique-plane", "macro-compound-movements"].includes(visit.sceneId)) {
      await expect(sceneCanvas).toHaveAttribute("data-observer-environment-status", "not-configured");
      await expect(sceneCanvas.locator("canvas")).not.toHaveAttribute("data-macro-watch-cage-angle");
      await expect(groundGlass.locator("canvas")).not.toHaveAttribute("data-macro-watch-cage-angle");
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

  expect([...visitedSceneIds].sort()).toEqual([...discoveredSceneIds].sort());
  expect(macroBellowsVisit, "the public Macro Bellows route should have been visited").not.toBeNull();
  if (macroBellowsObserverHandle) {
    await expect.poll(() => page.evaluate((node) => !node.isConnected, macroBellowsObserverHandle!)).toBe(true);
    await expect.poll(() => page.evaluate(
      (node) => node.getAttribute("data-macro-watch-cage-angle"),
      macroBellowsObserverHandle!,
    )).toBeNull();
  }
  if (macroBellowsRttHandle) {
    await expect.poll(() => page.evaluate((node) => !node.isConnected, macroBellowsRttHandle!)).toBe(true);
    await expect.poll(() => page.evaluate(
      (node) => node.getAttribute("data-macro-watch-cage-angle"),
      macroBellowsRttHandle!,
    )).toBeNull();
  }

  // Re-enter through the public catalog without a document reload; the
  // renderer-owned watch and studio environment must be freshly mounted.
  await openPublicScene(page, macroBellowsVisit!);
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __sceneSwitchDocumentToken?: string }).__sceneSwitchDocumentToken,
  )).toBe(documentToken);
  const reenteredScene = page.getByTestId("scene-canvas");
  const reenteredObserver = reenteredScene.locator("canvas");
  const reenteredRtt = page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]');
  const reenteredRttCanvas = reenteredRtt.locator("canvas");
  await expect(reenteredScene).toHaveAttribute("data-scene-subject-id", "macro-bellows-extension");
  await expect(reenteredRtt).toHaveAttribute("data-rtt-scene-id", "macro-bellows-extension", { timeout: 60_000 });
  await expect(reenteredScene).toHaveAttribute("data-observer-environment-status", "active", { timeout: 60_000 });
  await expect(reenteredRtt).toHaveAttribute("data-rtt-resource-generation", /^[1-9]\d*$/, { timeout: 60_000 });
  const reenteredOwnerId = await reenteredRtt.getAttribute("data-rtt-owner-id");
  const reenteredRendererGenerationId = await reenteredRtt.getAttribute("data-renderer-generation");
  expect(reenteredOwnerId).toBeTruthy();
  expect(reenteredRendererGenerationId).toBeTruthy();
  expect(seenRendererGenerationIds.has(reenteredRendererGenerationId!)).toBe(false);
  await expect.poll(async () => {
    const value = await reenteredObserver.getAttribute("data-macro-watch-cage-angle");
    return value !== null && Number.isFinite(Number(value));
  }, { timeout: 60_000 }).toBe(true);
  await expect.poll(async () => {
    const value = await reenteredRttCanvas.getAttribute("data-macro-watch-cage-angle");
    return value !== null && Number.isFinite(Number(value));
  }, { timeout: 60_000 }).toBe(true);
  const observerPhase = Number(await reenteredObserver.getAttribute("data-macro-watch-cage-angle"));
  const groundGlassPhase = Number(await reenteredRttCanvas.getAttribute("data-macro-watch-cage-angle"));
  expect(Math.abs(observerPhase - groundGlassPhase)).toBeLessThan(0.18);

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
