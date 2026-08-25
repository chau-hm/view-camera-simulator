import { expect, test } from "@playwright/test";

const profiledScenes = [
  "focus-fundamentals-two-targets",
  "table-tilt",
  "shelf-swing",
  "architecture-foreground",
] as const;

type ProfileTiming = { count: number } | null;
type ProfileSnapshot = {
  profilingBackend: "gpu-query" | "cpu-fallback";
  rawDebug: boolean;
  groundGlassGpu: ProfileTiming;
  physicalDofGpu: ProfileTiming;
  groundGlassCpuSubmit: ProfileTiming;
  physicalDofCpuSubmit: ProfileTiming;
  profilingDiagnostics: {
    gpuQueryState: string;
    framesCompletedGpu: number;
    framesAttempted: number;
    framesInvalidated: number;
    queriesBeginFailed: number;
    queriesEndFailed: number;
    queriesUnavailable: number;
    disjointEvents: number;
    queriesDiscardedDisjoint: number;
    pendingQueries: number;
    lastGpuQueryError: string | null;
  };
  passes: Record<
    "sceneRenderMs" | "cocFootprintMs" | "farGatherMs" | "nearGatherMs" | "compositeMs",
    ProfileTiming
  >;
};

const readProfileSnapshot = async (
  page: import("@playwright/test").Page,
): Promise<ProfileSnapshot> => {
  const text = await page.getByTestId("ground-glass-profiling-snapshot").textContent();
  expect(text).not.toBeNull();
  const snapshot = JSON.parse(text ?? "null") as ProfileSnapshot | null;
  expect(snapshot).not.toBeNull();
  return snapshot as ProfileSnapshot;
};

const readProfileSnapshotIfAvailable = async (
  page: import("@playwright/test").Page,
): Promise<ProfileSnapshot | null> => {
  try {
    const text = await page.getByTestId("ground-glass-profiling-snapshot").textContent();
    if (!text || text.trim() === "null") return null;
    return JSON.parse(text) as ProfileSnapshot;
  } catch {
    return null;
  }
};

type ProfileReadiness = "waiting" | "ready" | "degraded";

const hasExplicitGpuDegradedState = (snapshot: ProfileSnapshot): boolean => {
  const diagnostics = snapshot.profilingDiagnostics;
  if (diagnostics.gpuQueryState === "error") {
    return Boolean(
      diagnostics.lastGpuQueryError ||
        diagnostics.queriesBeginFailed > 0 ||
        diagnostics.queriesEndFailed > 0,
    );
  }
  if (diagnostics.gpuQueryState === "disjoint") {
    return diagnostics.disjointEvents > 0 || diagnostics.queriesDiscardedDisjoint > 0;
  }
  // An unavailable first poll is normal for asynchronous queries. Only treat
  // a stalled path as degraded after a bounded warm-up with no completed GPU
  // frame, so a healthy active backend still has to prove its own samples.
  return diagnostics.gpuQueryState === "stalled" &&
    diagnostics.framesAttempted >= 30 &&
    diagnostics.framesCompletedGpu === 0 &&
    (diagnostics.queriesUnavailable > 0 || diagnostics.pendingQueries > 0);
};

const profileReadiness = (
  snapshot: ProfileSnapshot,
  rawDebug: boolean,
): ProfileReadiness => {
  const expectedPasses = rawDebug
    ? ["sceneRenderMs", "compositeMs"] as const
    : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;
  const passWindowsPopulated = expectedPasses.every((pass) =>
    (snapshot.passes[pass]?.count ?? 0) > 0,
  );

  if (snapshot.rawDebug !== rawDebug) return "waiting";
  if (snapshot.profilingBackend === "cpu-fallback") {
    const groundGlass = snapshot.groundGlassCpuSubmit?.count ?? 0;
    const physicalDof = snapshot.physicalDofCpuSubmit?.count ?? 0;
    return groundGlass > 0 && (rawDebug || physicalDof > 0) && passWindowsPopulated
      ? "ready"
      : "waiting";
  }
  if (snapshot.profilingBackend !== "gpu-query") return "waiting";

  if (snapshot.profilingDiagnostics.gpuQueryState === "active") {
    const groundGlass = snapshot.groundGlassGpu?.count ?? 0;
    const physicalDof = snapshot.physicalDofGpu?.count ?? 0;
    return groundGlass > 0 &&
      (rawDebug || physicalDof > 0) &&
      snapshot.profilingDiagnostics.framesCompletedGpu > 0 &&
      passWindowsPopulated
      ? "ready"
      : "waiting";
  }
  return hasExplicitGpuDegradedState(snapshot) ? "degraded" : "waiting";
};

const expectBackendTimingSamples = (
  snapshot: ProfileSnapshot,
  rawDebug: boolean,
) => {
  const expectedPasses = rawDebug
    ? ["sceneRenderMs", "compositeMs"] as const
    : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;

  if (snapshot.profilingBackend === "cpu-fallback") {
    expect(snapshot.groundGlassCpuSubmit?.count).toBeGreaterThan(0);
    if (rawDebug) {
      expect(snapshot.physicalDofCpuSubmit).toBeNull();
    } else {
      expect(snapshot.physicalDofCpuSubmit?.count).toBeGreaterThan(0);
    }
    expectedPasses.forEach((pass) => {
      expect(snapshot.passes[pass]?.count).toBeGreaterThan(0);
    });
  } else {
    const state = snapshot.profilingDiagnostics.gpuQueryState;
    if (state === "active") {
      expect(snapshot.groundGlassGpu?.count).toBeGreaterThan(0);
      if (rawDebug) {
        expect(snapshot.physicalDofGpu).toBeNull();
      } else {
        expect(snapshot.physicalDofGpu?.count).toBeGreaterThan(0);
      }
      expect(snapshot.profilingDiagnostics.framesCompletedGpu).toBeGreaterThan(0);
      expectedPasses.forEach((pass) => {
        expect(snapshot.passes[pass]?.count).toBeGreaterThan(0);
      });
    } else {
      expect(["stalled", "disjoint", "error"]).toContain(state);
      expect(hasExplicitGpuDegradedState(snapshot)).toBe(true);
    }
  }
  if (rawDebug) {
    expect(snapshot.passes.cocFootprintMs).toBeNull();
    expect(snapshot.passes.farGatherMs).toBeNull();
    expect(snapshot.passes.nearGatherMs).toBeNull();
    expect(snapshot.physicalDofGpu).toBeNull();
    expect(snapshot.physicalDofCpuSubmit).toBeNull();
  }
};

const waitForProfileContract = async (
  page: import("@playwright/test").Page,
  rawDebug: boolean,
): Promise<void> => {
  await expect.poll(
    async () => {
      const snapshot = await readProfileSnapshotIfAvailable(page);
      return snapshot ? profileReadiness(snapshot, rawDebug) : "waiting";
    },
    { timeout: 120_000, intervals: [250, 500, 1_000] },
  ).toMatch(/^(ready|degraded)$/);
};

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
  expect(Number.isFinite(frameCount)).toBe(true);
  expect(frameCount).toBeGreaterThan(0);
  await waitForProfileContract(page, false);
  const snapshot = await readProfileSnapshot(page);
  expect(snapshot.rawDebug).toBe(false);
  expectBackendTimingSamples(snapshot, false);
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

  await expect(page.getByTestId("ground-glass-profiling-snapshot")).toContainText(
    '"rawDebug": true',
    { timeout: 120_000 },
  );
  await waitForProfileContract(page, true);
  const rawSnapshot = await readProfileSnapshot(page);
  expectBackendTimingSamples(rawSnapshot, true);

  await rawToggle.uncheck();
  await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "false", {
    timeout: 120_000,
  });
  await expect(page.getByTestId("ground-glass-profiling-snapshot")).toContainText(
    '"rawDebug": false',
    { timeout: 120_000 },
  );
  await waitForProfileContract(page, false);
  const processedSnapshot = await readProfileSnapshot(page);
  expectBackendTimingSamples(processedSnapshot, false);

  await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "false");
  await expect(rtt).toHaveAttribute("data-rtt-profiling-backend", "disabled");
  await expect(rtt).not.toHaveAttribute("data-rtt-profiling-frame-count", /.+/);
});
