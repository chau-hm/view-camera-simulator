# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fringe-club-dev-integration.spec.ts >> Stage 2H and Stage 2N-A render through all VCS modes and candidate/probe diagnostics remain current
- Location: src/tests/e2e/fringe-club-dev-integration.spec.ts:382:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('fringe-renderer-metrics')
Expected: "1"
Received: "0"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByTestId('fringe-renderer-metrics')
    2 × locator resolved to <div data-calls="" data-lines="" data-points="" data-textures="" data-triangles="" data-geometries="" data-parse-ms="35.5" data-fringe-meshes="" data-webgl-version="" data-three-version="" data-owner-leases="1" data-anisotropy-max="" data-source-assets="1" data-renderer-vendor="" data-renderer-device="" data-image-backings="7" data-observer-root-id="" data-instance-leases="0" data-source-textures="7" data-stage2h-requests="2" data-baseline-textures="2" data-source-materials="15" data-source-geometr…>…</div>
      - unexpected value "0"

```

```yaml
- paragraph: Observer renderer is off in this mode.
- paragraph: Source lifecycle — active source owners 1, Observer/RTT instance leases 0; source geometries 32, material templates 15, textures 7, ImageBitmap backings 7.
- paragraph: "stage2h loads: requests 2, completed 1, cancelled 1, stale parsed results disposed 0; fetch 49.8 ms, parse 35.5 ms, total 86.2 ms. These are observations, not FPS or GPU-memory claims."
- paragraph: Requested anisotropy 4×; applied 4× (Observer renderer maximum —×).
```

# Test source

```ts
  370 | 
  371 |   await page.getByRole("link", { name: "Exit development fixture" }).click();
  372 |   await expect(page).toHaveURL(/\/scenes$/);
  373 |   await expect
  374 |     .poll(() => page.evaluate(() => (window as Window & { __fringeStage2nDocument?: string }).__fringeStage2nDocument))
  375 |     .toBe(documentToken);
  376 |   expect(candidateRequests.some((url) => url.includes(H_GLB_NAME))).toBe(true);
  377 |   expect(candidateRequests.some((url) => url.includes(N_GLB_NAME))).toBe(false);
  378 |   expect(errors.pageErrors).toEqual([]);
  379 |   expect(errors.consoleProblems).toEqual([]);
  380 | });
  381 | 
  382 | test("Stage 2H and Stage 2N-A render through all VCS modes and candidate/probe diagnostics remain current", async ({ page }) => {
  383 |   test.setTimeout(1_200_000);
  384 |   const errors = installBrowserErrorCapture(page);
  385 |   const candidateRequests: string[] = [];
  386 |   const evidenceDirectory = process.env.VCS_FRINGE_STAGE2NB_EVIDENCE_DIR;
  387 |   if (evidenceDirectory) mkdirSync(evidenceDirectory, { recursive: true });
  388 |   page.on("request", (request) => {
  389 |     if (request.url().includes(H_GLB_NAME) || request.url().includes(N_GLB_NAME)) {
  390 |       candidateRequests.push(request.url());
  391 |     }
  392 |   });
  393 | 
  394 |   await page.goto("/__dev/fringe-club-rtt?sceneCapacityProfiling=1&rttDiagnostics=1");
  395 |   const candidateSelect = page.getByTestId("fringe-candidate-select");
  396 |   const modeSelect = page.getByTestId("fringe-renderer-mode-select");
  397 |   const probeSelect = page.getByTestId("fringe-probe-select");
  398 |   const rendererMetrics = page.getByTestId("fringe-renderer-metrics");
  399 |   const rttMetrics = page.getByTestId("fringe-rtt-metrics");
  400 |   await expect(candidateSelect).toHaveValue("stage2h");
  401 |   await expect(modeSelect).toHaveValue("both");
  402 |   await expect(rendererMetrics).toHaveAttribute("data-baseline-geometries", /^\d+$/);
  403 |   const initialHLoadStartedAt = Date.now();
  404 |   await page.getByRole("button", { name: "Load selected candidate" }).click();
  405 |   await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
  406 |     "data-state",
  407 |     "ready",
  408 |     { timeout: 90_000 },
  409 |   );
  410 |   await waitForGroundGlass(page, "stage2h", PROBE_IDS[0]);
  411 |   const firstHObserverAndRttContentMs = Date.now() - initialHLoadStartedAt;
  412 |   await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "stage2h");
  413 |   await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  414 |   const hSourceId = await rttMetrics.getAttribute("data-source-id");
  415 |   const hObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  416 |   const hRttRootId = await rttMetrics.getAttribute("data-subject-root-id");
  417 |   expect(hSourceId).toMatch(/^fringe-club-source-/);
  418 |   expect(hObserverRootId).not.toBe(hRttRootId);
  419 |   await expect(rttMetrics).toHaveAttribute("data-subject-source-id", hSourceId!);
  420 |   await expect(rttMetrics).toHaveAttribute("data-rtt-renderer-geometries", /^\d+$/);
  421 |   await expect(rttMetrics).toHaveAttribute("data-rtt-renderer-textures", /^\d+$/);
  422 | 
  423 |   const measurements: Record<string, unknown> = {
  424 |     environment: await page.evaluate(() => ({
  425 |       userAgent: navigator.userAgent,
  426 |       devicePixelRatio: window.devicePixelRatio,
  427 |       viewport: { width: window.innerWidth, height: window.innerHeight },
  428 |     })),
  429 |     browserVersion: page.context().browser()?.version() ?? "unknown",
  430 |     fixedProbeOptics: await page.locator("body").innerText().then((text) =>
  431 |       text.split("Fixed Ground Glass reference:")[1]?.split("\n")[0] ?? "not found",
  432 |     ),
  433 |     sixModes: {},
  434 |     firstAttach: { stage2hObserverAndRttContentMs: firstHObserverAndRttContentMs },
  435 |     candidateSwitches: [] as unknown[],
  436 |     probeIdentity: [] as unknown[],
  437 |     textureCountIsNotMemory: true,
  438 |   };
  439 |   const modeEvidence = async (candidate: "stage2h" | "stage2n-a", mode: string) => {
  440 |     if (mode !== "ground-glass") {
  441 |       const priorObserverSample = await rendererMetrics.getAttribute("data-observer-sampled-at-ms");
  442 |       await expect
  443 |         .poll(() => rendererMetrics.getAttribute("data-observer-sampled-at-ms"), { timeout: 15_000 })
  444 |         .not.toBe(priorObserverSample);
  445 |     }
  446 |     if (mode !== "observer") {
  447 |       const priorRttSample = await rttMetrics.getAttribute("data-rtt-sampled-at-ms");
  448 |       await expect
  449 |         .poll(() => rttMetrics.getAttribute("data-rtt-sampled-at-ms"), { timeout: 15_000 })
  450 |         .not.toBe(priorRttSample);
  451 |     }
  452 |     const observer = await readObserverMetrics(page);
  453 |     const groundGlass = await readGroundGlassMetrics(page);
  454 |     return {
  455 |       candidate,
  456 |       mode,
  457 |       warmSteadyStateSample: true,
  458 |       sampledAtMs: { observer: observer.sampledAtMs, groundGlass: groundGlass.sampledAtMs },
  459 |       observer,
  460 |       groundGlass,
  461 |     };
  462 |   };
  463 |   const setMode = async (mode: "observer" | "ground-glass" | "both") => {
  464 |     await modeSelect.selectOption(mode);
  465 |     if (mode === "observer") {
  466 |       await expect(rttMetrics).toHaveAttribute("data-rtt-render-sanity-identity", "");
  467 |       await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "1");
  468 |     } else if (mode === "ground-glass") {
  469 |       await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", "");
> 470 |       await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "1");
      |                                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  471 |       await waitForGroundGlass(page, await candidateSelect.inputValue() as "stage2h" | "stage2n-a", await probeSelect.inputValue());
  472 |     } else {
  473 |       await waitForGroundGlass(page, await candidateSelect.inputValue() as "stage2h" | "stage2n-a", await probeSelect.inputValue());
  474 |       await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", await candidateSelect.inputValue());
  475 |       await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  476 |     }
  477 |   };
  478 |   const captureCandidateProbeSet = async (
  479 |     candidate: "stage2h" | "stage2n-a",
  480 |     panels: Record<string, Record<string, Record<string, Buffer>>>,
  481 |   ) => {
  482 |     for (const probeId of PROBE_IDS) {
  483 |       await probeSelect.selectOption(probeId);
  484 |       await waitForGroundGlass(page, candidate, probeId);
  485 |       await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", candidate);
  486 |       const observer = await readObserverMetrics(page);
  487 |       const groundGlass = await readGroundGlassMetrics(page);
  488 |       expect(observer.rootId).not.toBe("");
  489 |       expect(groundGlass.rootId).not.toBe("");
  490 |       expect(groundGlass.candidateId).toBe(candidate);
  491 |       expect(groundGlass.probeId).toBe(probeId);
  492 |       expect(groundGlass.motionId).toBe("center");
  493 |       (measurements.probeIdentity as unknown[]).push({
  494 |         candidate,
  495 |         probeId,
  496 |         motionId: groundGlass.motionId,
  497 |         observerRootId: observer.rootId,
  498 |         groundGlassRootId: groundGlass.rootId,
  499 |         renderSanityGeneration: groundGlass.generation,
  500 |         renderSanityKey: groundGlass.sanityKey,
  501 |         observer,
  502 |         groundGlass,
  503 |       });
  504 |       const observerCapture = await page.getByTestId("fringe-app-canvas").screenshot();
  505 |       const groundGlassCapture = await page.getByTestId("fringe-ground-glass-canvas").screenshot();
  506 |       if (evidenceDirectory) {
  507 |         const probeEvidenceDirectory = resolve(evidenceDirectory, candidate, probeId);
  508 |         mkdirSync(probeEvidenceDirectory, { recursive: true });
  509 |         writeFileSync(resolve(probeEvidenceDirectory, "observer.png"), observerCapture);
  510 |         writeFileSync(resolve(probeEvidenceDirectory, "ground-glass.png"), groundGlassCapture);
  511 |       }
  512 |       panels[candidate] ??= {};
  513 |       panels[candidate][probeId] = {
  514 |         observer: observerCapture,
  515 |         groundGlass: groundGlassCapture,
  516 |       };
  517 |     }
  518 |   };
  519 | 
  520 |   const imagePanels: Record<string, Record<string, Record<string, Buffer>>> = {};
  521 |   await captureCandidateProbeSet("stage2h", imagePanels);
  522 |   (measurements.sixModes as Record<string, unknown>)["stage2h-both"] =
  523 |     await modeEvidence("stage2h", "both");
  524 | 
  525 |   await setMode("observer");
  526 |   (measurements.sixModes as Record<string, unknown>)["stage2h-observer"] =
  527 |     await modeEvidence("stage2h", "observer");
  528 |   await setMode("ground-glass");
  529 |   (measurements.sixModes as Record<string, unknown>)["stage2h-ground-glass"] =
  530 |     await modeEvidence("stage2h", "ground-glass");
  531 |   await setMode("both");
  532 | 
  533 |   const switchCandidate = async (candidate: "stage2h" | "stage2n-a") => {
  534 |     const switchStartedAt = Date.now();
  535 |     const priorSourceId = await rttMetrics.getAttribute("data-source-id");
  536 |     const priorObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  537 |     await candidateSelect.selectOption(candidate);
  538 |     await expect(rttMetrics).toHaveAttribute("data-rtt-render-sanity-identity", "");
  539 |     await expect(page.getByTestId("fringe-load-state")).toHaveAttribute(
  540 |       "data-state",
  541 |       "ready",
  542 |       { timeout: 90_000 },
  543 |     );
  544 |     await waitForGroundGlass(page, candidate, await probeSelect.inputValue());
  545 |     await expect(rendererMetrics).toHaveAttribute("data-observer-candidate-id", candidate);
  546 |     await expect(rendererMetrics).toHaveAttribute("data-source-assets", "1");
  547 |     await expect(rendererMetrics).toHaveAttribute("data-instance-leases", "2");
  548 |     const nextSourceId = await rttMetrics.getAttribute("data-source-id");
  549 |     const nextObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  550 |     expect(nextSourceId).not.toBe(priorSourceId);
  551 |     expect(nextObserverRootId).not.toBe(priorObserverRootId);
  552 |     (measurements.candidateSwitches as unknown[]).push({
  553 |       candidate,
  554 |       selectionToContentReadyMs: Date.now() - switchStartedAt,
  555 |       previousSourceId: priorSourceId,
  556 |       sourceId: nextSourceId,
  557 |       previousObserverRootId: priorObserverRootId,
  558 |       observerRootId: nextObserverRootId,
  559 |       groundGlass: await readGroundGlassMetrics(page),
  560 |       lifecycle: await readObserverMetrics(page),
  561 |     });
  562 |   };
  563 | 
  564 |   await switchCandidate("stage2n-a");
  565 |   const nSourceId = await rttMetrics.getAttribute("data-source-id");
  566 |   const nObserverRootId = await rendererMetrics.getAttribute("data-observer-root-id");
  567 |   await captureCandidateProbeSet("stage2n-a", imagePanels);
  568 |   (measurements.sixModes as Record<string, unknown>)["stage2n-a-both"] =
  569 |     await modeEvidence("stage2n-a", "both");
  570 | 
```