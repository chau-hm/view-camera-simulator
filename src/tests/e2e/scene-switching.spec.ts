import { expect, test, type Page } from "@playwright/test";

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

test("public scene switching keeps one fresh subject and one RTT renderer", async ({ page }) => {
  test.setTimeout(240_000);
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      if (!isAllowedEnvironmentConsoleMessage(message.text())) {
        consoleProblems.push(message.text());
      }
    }
  });

  await page.goto("/scenes");
  let previousSceneId: string | undefined;
  for (const visit of visits) {
    await openPublicScene(page, visit);
    // Preserve the public navigation path, then enable the renderer's opt-in
    // diagnostic attributes for finite-uniform and content checks.
    await page.goto(`${page.url()}?rttDiagnostics=1`);
    const sceneCanvas = page.getByTestId("scene-canvas");
    const groundGlass = page.getByTestId("ground-glass-rtt");
    await expect(sceneCanvas).toHaveCount(1);
    await expect(sceneCanvas).toHaveAttribute("data-scene-subject-id", visit.sceneId);
    await expect(sceneCanvas.locator("canvas")).toHaveCount(1);
    await expect(groundGlass).toHaveCount(1);
    await expect(groundGlass.locator("canvas")).toHaveCount(1);
    await expect(groundGlass).toHaveAttribute("data-rtt-uniforms-finite", "true", {
      timeout: 60_000,
    });
    await expect(groundGlass).toHaveAttribute("data-rtt-raw-contentful", "true");
    await expect(groundGlass).toHaveAttribute("data-rtt-final-contentful", "true");
    await expect(page.getByTestId("ground-glass-scene")).toHaveCount(0);
    if (previousSceneId) {
      await expect(page.locator(`[data-scene-subject-id='${previousSceneId}']`)).toHaveCount(
        previousSceneId === visit.sceneId ? 1 : 0,
      );
    }
    expect((await groundGlass.locator("canvas").screenshot()).byteLength).toBeGreaterThan(1_000);

    previousSceneId = visit.sceneId;
    await page.getByRole("link", { name: "All Scenes" }).click();
    await expect(page).toHaveURL(/\/scenes$/);
  }

  expect(pageErrors, `Uncaught page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleProblems, `Console errors/warnings: ${consoleProblems.join("\n")}`).toEqual([]);
});
