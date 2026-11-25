# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fringe-club-dev-integration.spec.ts >> rapid H/N-A selection aborts delayed stale fetches and only the final candidate attaches
- Location: src/tests/e2e/fringe-club-dev-integration.spec.ts:869:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('fringe-load-state')
Expected: "ready"
Received: "loading"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('fringe-load-state')
    2 × locator resolved to <p role="status" data-state="loading" data-candidate-id="stage2h" data-testid="fringe-load-state">Loading selected Fringe Club candidate…</p>
      - unexpected value "loading"

```

```yaml
- status: Loading selected Fringe Club candidate…
```

# Test source

```ts
  808 |       await waitForGroundGlass(page, "stage2n-a", joinProbe.probeId, motionId);
  809 |       await expect(rttMetrics).toHaveAttribute("data-subject-motion-id", motionId);
  810 |       const observer = await readObserverMetrics(page);
  811 |       const groundGlass = await readGroundGlassMetrics(page);
  812 |       expect(observer.candidateId).toBe("stage2n-a");
  813 |       expect(groundGlass.candidateId).toBe("stage2n-a");
  814 |       expect(groundGlass.probeId).toBe(joinProbe.probeId);
  815 |       expect(groundGlass.motionId).toBe(motionId);
  816 |       expect(groundGlass.rootId).not.toBe("");
  817 |       const observerCapture = await page.getByTestId("fringe-app-canvas").screenshot();
  818 |       const groundGlassCapture = await page.getByTestId("fringe-ground-glass-canvas").screenshot();
  819 |       captures.push({ motionId, observer: observerCapture, groundGlass: groundGlassCapture });
  820 |       (measurements.motions as unknown[]).push({
  821 |         probeId: joinProbe.probeId,
  822 |         motionId,
  823 |         observer,
  824 |         groundGlass,
  825 |       });
  826 |     };
  827 |
  828 |     await recordMotion("center");
  829 |     for (const motionId of MOTION_IDS.slice(1)) {
  830 |       const priorKey = await rttMetrics.getAttribute("data-rtt-render-sanity-state");
  831 |       const priorGeneration = Number(
  832 |         await rttMetrics.getAttribute("data-rtt-render-sanity-generation"),
  833 |       );
  834 |       const priorRootId = await rttMetrics.getAttribute("data-subject-root-id");
  835 |       await motionSelect.selectOption(motionId);
  836 |       await waitForGroundGlass(page, "stage2n-a", joinProbe.probeId, motionId);
  837 |       expect(await rttMetrics.getAttribute("data-rtt-render-sanity-state")).not.toBe(priorKey);
  838 |       expect(Number(await rttMetrics.getAttribute("data-rtt-render-sanity-generation")))
  839 |         .toBeGreaterThan(priorGeneration);
  840 |       expect(await rttMetrics.getAttribute("data-subject-root-id")).not.toBe(priorRootId);
  841 |       await recordMotion(motionId);
  842 |     }
  843 |
  844 |     const panel = await composeMotionPanel(
  845 |       page,
  846 |       "DEVELOPMENT_PROBE_ONLY — join motion — " + joinProbe.label,
  847 |       captures,
  848 |     );
  849 |     const panelName = "fringe-club-" + joinProbe.probeId + "-motion-stage-2n-a.png";
  850 |     await test.info().attach(panelName, { body: panel, contentType: "image/png" });
  851 |     if (evidenceDirectory) writeFileSync(resolve(evidenceDirectory, panelName), panel);
  852 |   }
  853 |
  854 |   const measurementsJson = Buffer.from(JSON.stringify(measurements, null, 2));
  855 |   await test.info().attach("fringe-club-stage-2n-b-motion-measurements.json", {
  856 |     body: measurementsJson,
  857 |     contentType: "application/json",
  858 |   });
  859 |   if (evidenceDirectory) {
  860 |     writeFileSync(
  861 |       resolve(evidenceDirectory, "fringe-club-stage-2n-b-motion-measurements.json"),
  862 |       measurementsJson,
  863 |     );
  864 |   }
  865 |   expect(errors.pageErrors).toEqual([]);
  866 |   expect(errors.consoleProblems).toEqual([]);
  867 | });
  868 |
  869 | test("rapid H/N-A selection aborts delayed stale fetches and only the final candidate attaches", async ({ page }) => {
  870 |   test.setTimeout(180_000);
  871 |   const errors = installBrowserErrorCapture(page);
  872 |   const candidateSelect = page.getByTestId("fringe-candidate-select");
  873 |   const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  874 |   const rendererMetrics = page.getByTestId("fringe-renderer-metrics");
  875 |   const delayed = new Set<string>();
  876 |   const releases: Record<string, Array<() => void>> = {
  877 |     stage2h: [],
  878 |     "stage2n-a": [],
  879 |   };
  880 |   const interceptWaiters: Record<string, Array<() => void>> = {
  881 |     stage2h: [],
  882 |     "stage2n-a": [],
  883 |   };
  884 |   await page.route(/(?:preferred-runtime-candidate|stage-2n-a-candidate)\.glb$/, async (route) => {
  885 |     const candidate = route.request().url().includes(N_GLB_NAME) ? "stage2n-a" : "stage2h";
  886 |     if (!delayed.has(candidate)) {
  887 |       await route.continue();
  888 |       return;
  889 |     }
  890 |     interceptWaiters[candidate].shift()?.();
  891 |     await new Promise<void>((resolve) => releases[candidate].push(resolve));
  892 |     try {
  893 |       await route.continue();
  894 |     } catch {
  895 |       // The selected candidate change should abort this stale request.
  896 |     }
  897 |   });
  898 |   const waitForIntercept = (candidate: string) =>
  899 |     new Promise<void>((resolve) => interceptWaiters[candidate].push(resolve));
  900 |   const release = (candidate: string) => {
  901 |     delayed.delete(candidate);
  902 |     releases[candidate].splice(0).forEach((resolve) => resolve());
  903 |   };
  904 |
  905 |   await page.goto("/__dev/fringe-club-rtt?rttDiagnostics=1");
  906 |   await expect(rendererMetrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  907 |   await page.getByRole("button", { name: "Load selected candidate" }).click();
> 908 |   await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
      |                                                       ^ Error: expect(locator).toHaveAttribute(expected) failed
  909 |   await waitForGroundGlass(page, "stage2h", PROBE_IDS[0]);
  910 |
  911 |   delayed.add("stage2n-a");
  912 |   const nRequest = waitForIntercept("stage2n-a");
  913 |   await candidateSelect.selectOption("stage2n-a");
  914 |   await nRequest;
  915 |   delayed.add("stage2h");
  916 |   const hRequest = waitForIntercept("stage2h");
  917 |   await candidateSelect.selectOption("stage2h");
  918 |   await hRequest;
  919 |   release("stage2h");
  920 |   await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  921 |   await waitForGroundGlass(page, "stage2h", PROBE_IDS[0]);
  922 |   release("stage2n-a");
  923 |   await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2h");
  924 |   await expect(rttMetrics).toHaveAttribute("data-subject-candidate-id", "stage2h");
  925 |
  926 |   await candidateSelect.selectOption("stage2n-a");
  927 |   await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  928 |   await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  929 |   delayed.add("stage2h");
  930 |   const secondHRequest = waitForIntercept("stage2h");
  931 |   await candidateSelect.selectOption("stage2h");
  932 |   await secondHRequest;
  933 |   await candidateSelect.selectOption("stage2n-a");
  934 |   release("stage2h");
  935 |   await expect(page.getByTestId("fringe-load-state")).toHaveAttribute("data-state", "ready");
  936 |   await waitForGroundGlass(page, "stage2n-a", PROBE_IDS[0]);
  937 |   await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2n-a");
  938 |   await expect(rendererMetrics).toHaveAttribute("data-source-assets", "1");
  939 |   await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  940 |   await expect(rttMetrics).toHaveAttribute("data-subject-candidate-id", "stage2n-a");
  941 |   await expect(rttMetrics).toHaveAttribute("data-rtt-final-contentful", "true");
  942 |   expect(errors.pageErrors).toEqual([]);
  943 |   expect(errors.consoleProblems).toEqual([]);
  944 | });
  945 |
  946 | test("navigation away aborts a delayed development load without a stale mount", async ({ page }) => {
  947 |   test.setTimeout(90_000);
  948 |   const errors = installBrowserErrorCapture(page);
  949 |   let intercepted = 0;
  950 |   const routeWaiters: Array<() => void> = [];
  951 |   const releaseWaiters: Array<() => void> = [];
  952 |   await page.route("**/preferred-runtime-candidate.glb", async (route) => {
  953 |     intercepted += 1;
  954 |     routeWaiters.shift()?.();
  955 |     await new Promise<void>((resolve) => releaseWaiters.push(resolve));
  956 |     try {
  957 |       await route.continue();
  958 |     } catch {
  959 |       // SPA navigation may already have aborted the candidate request.
  960 |     }
  961 |   });
  962 |
  963 |   await page.goto("/__dev/fringe-club");
  964 |   await expect(page.getByTestId("fringe-renderer-metrics")).toHaveAttribute(
  965 |     "data-baseline-geometries",
  966 |     /^\d+$/,
  967 |   );
  968 |   const requestStarted = new Promise<void>((resolve) => routeWaiters.push(resolve));
  969 |   await page.getByRole("button", { name: "Load selected candidate" }).click();
  970 |   await requestStarted;
  971 |   await page.getByRole("link", { name: "Exit development fixture" }).click();
  972 |   await expect(page).toHaveURL(/\/scenes$/);
  973 |   releaseWaiters.splice(0).forEach((release) => release());
  974 |   await expect.poll(() => intercepted).toBeGreaterThan(0);
  975 |   expect(errors.pageErrors).toEqual([]);
  976 |   expect(errors.consoleProblems).toEqual([]);
  977 |   await expect(page.getByTestId("fringe-app-canvas")).toHaveCount(0);
  978 | });
  979 |
```