import { expect, test } from "@playwright/test";

const profiledScenes = [
  "focus-fundamentals-two-targets",
  "table-tilt",
  "shelf-swing",
  "architecture-foreground",
] as const;

const expectPopulatedProfile = async (
  page: import("@playwright/test").Page,
  sceneId: string,
) => {
  const rtt = page.getByTestId("ground-glass-rtt");
  await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
  await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "true");
  await expect(rtt).toHaveAttribute(
    "data-rtt-profiling-backend",
    /^(gpu-query|cpu-fallback)$/,
  );
  await expect(rtt).toHaveAttribute("data-rtt-profiling-frame-count", /[1-9]\d*/, {
    timeout: 120_000,
  });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 120_000,
  });

  const frameCount = Number(await rtt.getAttribute("data-rtt-profiling-frame-count"));
  const groundGlassCount = Number(
    await rtt.getAttribute("data-rtt-profiling-ground-glass-count"),
  );
  const physicalDofCount = Number(
    await rtt.getAttribute("data-rtt-profiling-physical-dof-count"),
  );
  expect(Number.isFinite(frameCount)).toBe(true);
  expect(Number.isFinite(groundGlassCount)).toBe(true);
  expect(Number.isFinite(physicalDofCount)).toBe(true);
  expect(frameCount).toBeGreaterThan(0);
  expect(groundGlassCount).toBeGreaterThan(0);
  expect(physicalDofCount).toBeGreaterThan(0);
  await expect(page.getByTestId("ground-glass-profiling-snapshot")).not.toContainText(/NaN|Infinity/);
};

test("Ground Glass profiling populates finite snapshots across representative scenes", async ({ page }) => {
  test.setTimeout(240_000);

  for (const sceneId of profiledScenes) {
    await page.goto(`/simulator/free/${sceneId}?dofProfiling=1&rttDiagnostics=1`);
    await expectPopulatedProfile(page, sceneId);
  }
});

test("profiling preserves Raw RTT bypass and can be disabled", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/simulator/free/architecture-foreground?dofProfiling=1&rttDiagnostics=1");

  const rtt = page.getByTestId("ground-glass-rtt");
  await expectPopulatedProfile(page, "architecture-foreground");

  const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  await rawToggle.check();
  await expect(rawToggle).toBeChecked();
  await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "true", {
    timeout: 120_000,
  });
  await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
    timeout: 120_000,
  });

  await rawToggle.uncheck();
  await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "false", {
    timeout: 120_000,
  });
  await expect(rtt).toHaveAttribute("data-rtt-profiling-physical-dof-count", /[1-9]\d*/, {
    timeout: 120_000,
  });

  await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "false");
  await expect(rtt).toHaveAttribute("data-rtt-profiling-backend", "disabled");
  await expect(rtt).not.toHaveAttribute("data-rtt-profiling-frame-count", /.+/);
});
