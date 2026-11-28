# A1 — Ground Glass diagnostic qualification

This test-only slice adds evidence comparators and an independent optical reference to the existing production-shader depth-edge fixture. Existing Ground Glass variance assertions remain in place. Further qualification is required before these diagnostics can replace existing signals or support A2, A3 or A6.

## Contract and evidence matrix

| Contract | Status | Evidence and remaining work |
| --- | --- | --- |
| D1 Request and frame integrity | Partial | A test-only tap associates the actual display, request, generation, subject generation and readback with the completed callback. On the same page, an actual 7740 mm frame was rejected against the later 7750 mm request. Synthetic scene, channel and generation controls also passed. |
| D2 Numerical and buffer integrity | Partial | The completion-boundary tap recorded present, finite preparation and nonuniform RGBA8 readback for the current transaction. Synthetic controls reject missing, stale and non-finite preparation, malformed buffers and uniform images. Numerical validation is separate from GPU optical evidence. |
| D3 Pipeline execution | Partial | The completed processed frame observed scene, CoC, far gather, near gather, composite and display. The public Raw RTT bypass observed scene, composite and display. The comparator accepted each under its own contract and rejected bypass under the processed contract. |
| D4 Independent optical response | Partial | The WebGL2 depth-edge fixture runs production CoC and gather shaders and a fixture-only legacy depth-tolerance variant. Independent thin-lens CoC checks, focused and defocused local contrasts, foreground contamination and stopped-down response pass. Fixture-only wrong-CoC, excessive-blur and zero-blur GPU mutations were detected by separate checks; the excessive-blur output still passed the candidate contrast band. Those earlier checks did not establish a shared acceptance gate. |
| D5 Raw/Upright orientation | Partial | The comparator and synthetic asymmetric controls reject one-axis reflections, unrotated mapping and ambiguous symmetric inputs. A current public application WebGL2 capture at seed 284719 measured RGB mean error 0 for the 180-degree mapping, 52.375 for horizontal reflection, 16.393 for vertical reflection and 52.572 for unrotated mapping. A tracked test-only capture now associates each frame with its completed request and accepted renderer generation. Three independent captures reproduced the mapping; wrong-axis and unchanged comparator mutations were rejected. |
| D6 Legitimate content compatibility | Partial | Actual WebGL2 captures at material seeds 284719 and 1 changed rendered pixels under matched recorded optical state, with three identical frames per seed. Visible building-base and building-middle CoC samples matched across seeds. Global raw/final variance was 7561.842/3853.640 versus 6910.311/3469.850. A controlled WebGL2 depth-edge fixture changes an unrelated rendered background strip while protected CoC and contrast measurements remain fixed, and its actual zero-blur GPU fault fails the defocus check. The public seed comparison still lacks a protected local-response witness. |

## Independent optical reference

For focal length f, subject distance D, focus distance F, and f-number N, all lengths in millimetres, the parallel thin-lens image distance is v(D) = fD / (D − f). The signed diameter at the film plane is (f / N) × (v(F) / v(D) − 1). Negative values correspond to foreground defocus and positive values to background defocus. The fixture uses f = 150 mm, front and back planes at 400 and 410 mm, and 16-bit source depth with 8-bit encoded CoC. The fixture derives separate bounds of 0.057035, 0.057188 and 0.066174 mm by propagating half a 16-bit depth code through perspective depth reconstruction and the thin-lens formula, then adding the sign-specific half-code of the RGBA8 CoC encoding. The depth-edge test calculates these bounds from the fixture constants.

The independent expectations for 410 mm at focus 400 mm and f/2.8, 400 mm at focus 390 mm and f/2.8, and 400 mm at focus 410 mm and f/1.4 are approximately +0.784, +0.837 and −1.545 mm. The local WebGL2 fixture observed +0.756, +0.850 and −1.500 mm respectively. In the focused-foreground case the measured candidate foreground edge red increase was 0 bytes and the fixture-only legacy variant was 82 bytes. Fixture-only GPU mutations produced wrong-sign CoC −0.75 mm, excessive-blur contrast 47.12 and zero-blur contrast 59.28, against candidate contrast 55.41 and source contrast 59.28. These are GPU fixture measurements and do not establish public application completion or metrological calibration.

## Ownership and follow-up

The WebGL renderer owns actual pass execution and completed frame callbacks. The render host decides whether a completed frame is current and publishable. Subject generation and optical preparation must be associated with the same observed transaction as the captured pixels. The test-side comparator consumes such evidence and does not generate it. The tracked test-only capture at scripts/ground-glass-a1/capture.mjs instruments the render callback and completion boundary without changing production code. It verifies a reviewed renderer source digest and fails closed on missing or duplicated source anchors. The older A0 tap predicts frame identity before completion and cannot establish that association.

Keep the whole-frame variance checks while replacement signals are independently qualified. Later consumers must use matched optical state, seed, backend and protected reference regions, and must separately test real content changes, fresh completion, pipeline bypass, blur, occlusion and orientation. Application content compatibility and a complete integrated qualification record remain the next bounded slice.

## Retained evidence integrity

The compact retained record at [a1-evidence/record.json](a1-evidence/record.json) preserves the previous partial qualification observations. Its offline unit-test validator checks the recorded evidence integrity and controls. It does not run a current browser or GPU and does not establish complete A1 qualification.

## Reproducing the application capture

With Node 24, installed dependencies and Chromium, run the tracked test-only producer and assessor from the repository root. The output directory is local evidence and must be outside tracked paths.

```sh
VITE_BASE_PATH=/ A0_PORT=4399 node scripts/ground-glass-a1/capture.mjs "$PWD" "$PWD/.dream-loop/research/a1-capture" final-historical matched
node --experimental-strip-types scripts/ground-glass-a1/assess.mjs .dream-loop/research/a1-capture/final-historical
```

The capture observes actual render operations and display completion before reading the completion callback, then checks the host's current request and generation. The producer is not imported by the application or the production build. Its reviewed source digest intentionally requires requalification when the renderer source changes.

## Review-fix round 2: current pixel boundary (in progress)

The prior diagnostic textures are refreshed only when the sanity state key changes. Their pixels therefore cannot establish the contents of every subsequent completed frame. The current test-only tap reads the actual source and final targets within the observed render transaction; it does not use those retained textures for qualification. The capture saves the complete bottom-left-origin RGBA8 readback and derives each 32 × 32 sample by selecting the source pixel at the centre of each equally sized sample cell. The assessor checks dimensions, format, source and sample SHA-256 digests, transaction identity and byte-for-byte rederivation. Hashes bind the recorded bytes; they do not independently prove freshness. The tap's placement in the actual renderer transaction and its completed callback provide the separate execution witness. Identical images cannot distinguish two transactions from pixel equality alone.

An exploratory Chromium WebGL capture after integrating main accepted the current processed frame and genuine bypass, rejected bypass as processed, and rejected an actual earlier 7740 mm sample substituted into the 7750 mm current readback despite valid current completion identity. Its Raw/Upright comparison accepted the 180-degree mapping (mean RGB error 0) and rejected horizontal-only, vertical-only and unchanged mappings. These observations were made on a worktree with uncommitted instrumentation changes and are not an exact-head qualification record. The earlier retained partial record remains historical and is not upgraded by this correction. The integrated evidence record, protected application optical response and full shared optical acceptance remain outstanding until independently validated on the final source.

The round 2 depth-edge work uses one fixture-specific evaluator for the unmodified and restored candidates and the actual wrong-CoC, triple-footprint, zero-blur and legacy-depth GPU outputs. For the untilted 150 mm, 400 mm focus, 410 mm subject, f/2.8 fixture, the independent thin-lens reference gives a +0.784 mm CoC diameter and 0.392 mm circle radius, or 1.58 film pixels. The local response estimate applies the declared finite disk samples to the captured source row using nearest-pixel sampling; its output-byte tolerance is 0.51 luminance code divided by source contrast. This is a reference for this fixture's gather approximation, not photographic ground truth. One local GPU run accepted both candidates and rejected the four faults for signed CoC, footprint/excessive blur, insufficient defocus and depth contamination respectively. This single run does not complete integrated D4 qualification or establish repeatability across devices. The existing broad candidate and legacy comparisons remain in place.

## Final-closeout progress (partial)

The controlled background-variation fixture now applies the shared depth-edge optical evaluator to both normal candidates and the varied fixture's actual zero-blur and excessive-footprint outputs. On local WebGL2, both candidates were accepted; zero blur failed `insufficient-defocus`, and the excessive footprint failed `optical-footprint-mismatch` and `excessive-blur`. The earlier fixture assertions remain in place.

After integrating main's Room-at-Dawn change, the test-only instrumentation was reviewed against the new renderer source: its additional HDR behavior is opt-in, and the ordinary capture path retains byte render targets. The injection anchors remained unique. Three separate clean-source Chromium sessions at `bf923e4144b1baac9a53d529fc372655f3e66280` re-established the current/stale, processed/bypass and orientation observations. The earlier source records remain historical, not evidence of the new renderer source.

Public application D6 remains incomplete. An exploratory near-focused front-base region has stable first-hit identities in seeds 284719 and 1, but a gain-normalized response bound and sufficient retained visibility and independent footprint evidence have not been qualified. The source target uses linear filtering, so a nearest-texel preservation claim would be invalid. The current integrated D1–D6 evidence record and validator also remain unimplemented; the earlier partial record is unchanged. Do not treat the fixture result or the exploratory application observations as full A1 qualification.

## Integrated record — historical F1 checkpoint

The separate [version 2 record](a1-evidence/current/record.json) retains three actual completed application observations and the full current-target bytes needed to rederive their compact samples. It also retains actual candidate, restored and fault GPU buffers from the depth-edge fixture. Its validator checks source pins, transactions and sample provenance, recomputes optical measurements from the retained pixels, applies the existing frame, optical and orientation comparators, and checks real stale-frame, stale-pixel and bypass controls. The version 1 record above remains an unchanged historical partial observation.

| Contract | Current retained result | Evidence boundary |
| --- | --- | --- |
| D1 | QUALIFIED | Three application sessions; current transactions accepted, actual prior transactions and prior sampled pixels rejected. |
| D2 | QUALIFIED | Typed preparation and current opaque, nonuniform buffers; synthetic missing, stale, nonfinite, malformed, uniform and transparent controls. |
| D3 | QUALIFIED | Observed processed and Raw RTT bypass pass sequences; bypass rejected as processed. |
| D4 | QUALIFIED | Actual fixture source, output and CoC buffers; candidate and restored output accepted and four GPU faults rejected by the shared evaluator. |
| D5 | QUALIFIED | Three matched completed Raw/Upright pairs; 180-degree mapping accepted and wrong mappings rejected. |
| D6 | PARTIAL | Controlled fixture compatibility exists; protected application optical response remains unqualified. |

At the F1 checkpoint the derived overall decision was **PARTIAL**. This is integrity and qualification of the recorded observations; the offline validator does not run a browser or prove current GPU behavior. The application captures were made at `bf923e4144b1baac9a53d529fc372655f3e66280`; the new optical readbacks were captured against relevant clean fixture source at `d4f638e5e6c955f7bd234513985c5c10abb8911b` using the separately identified test-only producer. Source pins are checked against the capture-relevant renderer, fixture, evaluators, producers and configuration; the evidence commit is intentionally distinct from capture identity. The optical fixture was recaptured once for the retained raw buffers; the three independently completed application sessions supply the repeated frame observations.

From the repository root with Node 24:

```sh
node --experimental-strip-types --input-type=module -e 'import {validateA1IntegratedEvidence} from "./scripts/validate-a1-retained-evidence.mjs"; console.log(await validateA1IntegratedEvidence("docs/architecture/environment-readiness/a1-evidence/current"))'
npm run test -- --run src/tests/unit/a1IntegratedEvidence.test.ts src/tests/unit/a1RetainedEvidence.test.ts src/tests/unit/historicalEvidenceRouting.test.ts
```

## Current integrated D1–D6 record

The [current version 2 record](a1-evidence/current/record.json) now derives **QUALIFIED** for the recorded A1 diagnostic contracts. Its retained predecessor [F1 checkpoint](a1-evidence/current/record-f1.json) remains PARTIAL. The original version 1 record remains historically partial and unchanged. The offline validator rederives the evidence; it does not execute the current browser or GPU, establish native WebGPU qualification, or certify general photographic accuracy.

| Contract | Recorded result | Evidence and validator |
| --- | --- | --- |
| D1 | QUALIFIED | Three actual application transactions, source/final readbacks and sample rederivation; actual earlier transaction and earlier-pixel substitution rejected. |
| D2 | QUALIFIED | Typed preparation and opaque nonuniform source/final buffers; synthetic missing, stale, nonfinite, malformed, transparent and blank controls rejected. |
| D3 | QUALIFIED | Actual processed and genuine bypass pass sequences accepted under their own contracts; bypass rejected as processed. |
| D4 | QUALIFIED | Retained actual source, CoC and output GPU buffers: the shared evaluator accepts candidate/restored and rejects wrong CoC, excessive footprint, zero blur and legacy depth rejection. |
| D5 | QUALIFIED | Three matched completed Raw/Upright pairs: 180-degree mapping accepted; horizontal-only, vertical-only and unchanged mappings rejected. |
| D6 | QUALIFIED | Controlled background GPU variation passes the shared gate and its real faults fail. Three actual matched public seed pairs pass the separate [parallel-plane protected-edge contract](a1-d6-reference.md); a captured-data detail-loss mutation fails. |

The D1–D5 application captures use the original stress state and source `bf923e4144b1baac9a53d529fc372655f3e66280`. D6 uses the separate neutral state at f/11 and 9500 mm focus, captured at `65298474952505c5e0d5f1e4950cb004a425f2f0`. The protected feature is a deliberate façade/window-trim edge; every ROI pixel and its 48-pixel gather halo has retained first-hit/depth evidence, and the GPU depth and CoC are checked against independent thin-lens and depth-quantization bounds. The capture records actual material identities and uses each seed's own source pixels. Source and processed local contrast ratios after gain normalization were approximately 1.00217 and 1.00234 for seeds 284719 and 1, respectively; the comparator-level 11×11 detail-loss mutation failed for both. That mutation is not an application GPU fault. Actual GPU fault detection is supplied separately by the controlled fixture.

The source pins distinguish capture-time source, a separately identified test-only fixture producer, and the later evidence commit. The validator checks the capture-relevant renderer, fixture, producer, evaluator, application reference and configuration bytes; repeatability requires distinct completed frame and renderer-generation identities rather than distinct pixel hashes. Future consumers A2, A3 and A6 must rerun appropriate runtime/browser qualification for their own source and configuration and must not generalize this one neutral reference to tilted scenes. Legacy variance assertions remain in place.
