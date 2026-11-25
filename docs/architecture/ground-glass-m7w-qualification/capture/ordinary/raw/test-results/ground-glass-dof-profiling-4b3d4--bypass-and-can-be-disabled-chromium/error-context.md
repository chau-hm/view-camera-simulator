# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ground-glass-dof-profiling.spec.ts >> profiling preserves Raw RTT bypass and can be disabled
- Location: src/tests/e2e/ground-glass-dof-profiling.spec.ts:211:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByTestId('ground-glass-rtt')
Expected: "architecture-foreground"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('ground-glass-rtt')

```

```yaml
- status
- main:
  - paragraph: Loading simulator workspace…
```

# Test source

```ts
  79  |     (diagnostics.queriesUnavailable > 0 || diagnostics.pendingQueries > 0);
  80  | };
  81  |
  82  | const profileReadiness = (
  83  |   snapshot: ProfileSnapshot,
  84  |   rawDebug: boolean,
  85  | ): ProfileReadiness => {
  86  |   const expectedPasses = rawDebug
  87  |     ? ["sceneRenderMs", "compositeMs"] as const
  88  |     : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;
  89  |   const passWindowsPopulated = expectedPasses.every((pass) =>
  90  |     (snapshot.passes[pass]?.count ?? 0) > 0,
  91  |   );
  92  |
  93  |   if (snapshot.rawDebug !== rawDebug) return "waiting";
  94  |   if (snapshot.profilingBackend === "cpu-fallback") {
  95  |     const groundGlass = snapshot.groundGlassCpuSubmit?.count ?? 0;
  96  |     const physicalDof = snapshot.physicalDofCpuSubmit?.count ?? 0;
  97  |     return groundGlass > 0 && (rawDebug || physicalDof > 0) && passWindowsPopulated
  98  |       ? "ready"
  99  |       : "waiting";
  100 |   }
  101 |   if (snapshot.profilingBackend !== "gpu-query") return "waiting";
  102 |
  103 |   if (snapshot.profilingDiagnostics.gpuQueryState === "active") {
  104 |     const groundGlass = snapshot.groundGlassGpu?.count ?? 0;
  105 |     const physicalDof = snapshot.physicalDofGpu?.count ?? 0;
  106 |     return groundGlass > 0 &&
  107 |       (rawDebug || physicalDof > 0) &&
  108 |       snapshot.profilingDiagnostics.framesCompletedGpu > 0 &&
  109 |       passWindowsPopulated
  110 |       ? "ready"
  111 |       : "waiting";
  112 |   }
  113 |   return hasExplicitGpuDegradedState(snapshot) ? "degraded" : "waiting";
  114 | };
  115 |
  116 | const expectBackendTimingSamples = (
  117 |   snapshot: ProfileSnapshot,
  118 |   rawDebug: boolean,
  119 | ) => {
  120 |   const expectedPasses = rawDebug
  121 |     ? ["sceneRenderMs", "compositeMs"] as const
  122 |     : ["sceneRenderMs", "cocFootprintMs", "farGatherMs", "nearGatherMs", "compositeMs"] as const;
  123 |
  124 |   if (snapshot.profilingBackend === "cpu-fallback") {
  125 |     expect(snapshot.groundGlassCpuSubmit?.count).toBeGreaterThan(0);
  126 |     if (rawDebug) {
  127 |       expect(snapshot.physicalDofCpuSubmit).toBeNull();
  128 |     } else {
  129 |       expect(snapshot.physicalDofCpuSubmit?.count).toBeGreaterThan(0);
  130 |     }
  131 |     expectedPasses.forEach((pass) => {
  132 |       expect(snapshot.passes[pass]?.count).toBeGreaterThan(0);
  133 |     });
  134 |   } else {
  135 |     const state = snapshot.profilingDiagnostics.gpuQueryState;
  136 |     if (state === "active") {
  137 |       expect(snapshot.groundGlassGpu?.count).toBeGreaterThan(0);
  138 |       if (rawDebug) {
  139 |         expect(snapshot.physicalDofGpu).toBeNull();
  140 |       } else {
  141 |         expect(snapshot.physicalDofGpu?.count).toBeGreaterThan(0);
  142 |       }
  143 |       expect(snapshot.profilingDiagnostics.framesCompletedGpu).toBeGreaterThan(0);
  144 |       expectedPasses.forEach((pass) => {
  145 |         expect(snapshot.passes[pass]?.count).toBeGreaterThan(0);
  146 |       });
  147 |     } else {
  148 |       expect(["stalled", "disjoint", "error"]).toContain(state);
  149 |       expect(hasExplicitGpuDegradedState(snapshot)).toBe(true);
  150 |     }
  151 |   }
  152 |   if (rawDebug) {
  153 |     expect(snapshot.passes.cocFootprintMs).toBeNull();
  154 |     expect(snapshot.passes.farGatherMs).toBeNull();
  155 |     expect(snapshot.passes.nearGatherMs).toBeNull();
  156 |     expect(snapshot.physicalDofGpu).toBeNull();
  157 |     expect(snapshot.physicalDofCpuSubmit).toBeNull();
  158 |   }
  159 | };
  160 |
  161 | const waitForProfileContract = async (
  162 |   page: import("@playwright/test").Page,
  163 |   rawDebug: boolean,
  164 | ): Promise<void> => {
  165 |   await expect.poll(
  166 |     async () => {
  167 |       const snapshot = await readProfileSnapshotIfAvailable(page);
  168 |       return snapshot ? profileReadiness(snapshot, rawDebug) : "waiting";
  169 |     },
  170 |     { timeout: 120_000, intervals: [250, 500, 1_000] },
  171 |   ).toMatch(/^(ready|degraded)$/);
  172 | };
  173 |
  174 | const expectPopulatedProfile = async (
  175 |   page: import("@playwright/test").Page,
  176 |   sceneId: string,
  177 | ) => {
  178 |   const rtt = page.getByTestId("ground-glass-rtt");
> 179 |   await expect(rtt).toHaveAttribute("data-rtt-scene-id", sceneId);
      |                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  180 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "true");
  181 |   await expect(rtt).toHaveAttribute(
  182 |     "data-rtt-profiling-backend",
  183 |     /^(gpu-query|cpu-fallback)$/,
  184 |   );
  185 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-frame-count", /[1-9]\d*/, {
  186 |     timeout: 120_000,
  187 |   });
  188 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
  189 |     timeout: 120_000,
  190 |   });
  191 |
  192 |   const frameCount = Number(await rtt.getAttribute("data-rtt-profiling-frame-count"));
  193 |   expect(Number.isFinite(frameCount)).toBe(true);
  194 |   expect(frameCount).toBeGreaterThan(0);
  195 |   await waitForProfileContract(page, false);
  196 |   const snapshot = await readProfileSnapshot(page);
  197 |   expect(snapshot.rawDebug).toBe(false);
  198 |   expectBackendTimingSamples(snapshot, false);
  199 |   await expect(page.getByTestId("ground-glass-profiling-snapshot")).not.toContainText(/NaN|Infinity/);
  200 | };
  201 |
  202 | test("Ground Glass profiling populates finite snapshots across representative scenes", async ({ page }) => {
  203 |   test.setTimeout(240_000);
  204 |
  205 |   for (const sceneId of profiledScenes) {
  206 |     await page.goto(`/simulator/free/${sceneId}?dofProfiling=1&rttDiagnostics=1`);
  207 |     await expectPopulatedProfile(page, sceneId);
  208 |   }
  209 | });
  210 |
  211 | test("profiling preserves Raw RTT bypass and can be disabled", async ({ page }) => {
  212 |   test.setTimeout(180_000);
  213 |   await page.goto("/simulator/free/architecture-foreground?dofProfiling=1&rttDiagnostics=1");
  214 |
  215 |   const rtt = page.getByTestId("ground-glass-rtt");
  216 |   await expectPopulatedProfile(page, "architecture-foreground");
  217 |
  218 |   const rawToggle = page.getByLabel("Raw RTT — bypass DOF");
  219 |   await rawToggle.check();
  220 |   await expect(rawToggle).toBeChecked();
  221 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "true", {
  222 |     timeout: 120_000,
  223 |   });
  224 |   await expect(rtt).toHaveAttribute("data-rtt-final-contentful", "true", {
  225 |     timeout: 120_000,
  226 |   });
  227 |
  228 |   await expect(page.getByTestId("ground-glass-profiling-snapshot")).toContainText(
  229 |     '"rawDebug": true',
  230 |     { timeout: 120_000 },
  231 |   );
  232 |   await waitForProfileContract(page, true);
  233 |   const rawSnapshot = await readProfileSnapshot(page);
  234 |   expectBackendTimingSamples(rawSnapshot, true);
  235 |
  236 |   await rawToggle.uncheck();
  237 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-raw-debug", "false", {
  238 |     timeout: 120_000,
  239 |   });
  240 |   await expect(page.getByTestId("ground-glass-profiling-snapshot")).toContainText(
  241 |     '"rawDebug": false',
  242 |     { timeout: 120_000 },
  243 |   );
  244 |   await waitForProfileContract(page, false);
  245 |   const processedSnapshot = await readProfileSnapshot(page);
  246 |   expectBackendTimingSamples(processedSnapshot, false);
  247 |
  248 |   await page.goto("/simulator/free/architecture-foreground?rttDiagnostics=1");
  249 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-enabled", "false");
  250 |   await expect(rtt).toHaveAttribute("data-rtt-profiling-backend", "disabled");
  251 |   await expect(rtt).not.toHaveAttribute("data-rtt-profiling-frame-count", /.+/);
  252 | });
  253 |
```