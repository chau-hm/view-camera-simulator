# M7W — Ordinary WebGL and Renderer-Serial Qualification Execution

## Decision

**W2 — Complete execution, failures classified.** The current M7V-derived Ordinary WebGL and Renderer-Serial identities were fully executed at the pinned M7V merge source. The Ordinary WebGL mandatory projection is not qualified because 84 required identities produced unexpected results. The Renderer-Serial capture passed all four required tests locally. M7V's authenticated strict lane evidence remains incomplete; neither local capture is represented as a trusted hosted qualification artifact.

This report records execution evidence and an actionable next cohort. It does not claim Broad E2E qualification, an M7 application fix, or any renderer authorization change.

## Source, environment, and execution policy

Execution source: M7V merge 17a4ccb9f4ae08069defaa9a1eac9938833412ae.

Environment: Node v24.3.0, npm 11.12.0, Playwright 1.61.1, Playwright Chromium 149.0.7827.55, Three.js 0.187.0 (revision 187), macOS darwin arm64 (27.0.0). Browser probe reported WebGL 2 and ANGLE/SwiftShader. Hardware acceleration was not established; the observed browser renderer was software SwiftShader.

The Ordinary project ran with the application-default WebGL route, all listed WebGPU build flags set to false, native runtime flags unset, four configured workers, zero retries, and unchanged per-test timeouts. CI=1 disabled server reuse. The three captures used distinct strict ports 4179, 4180, and 4181.

| Capture | Selection | Workers | Started (UTC) | Duration | Runner result |
|---|---|---:|---|---:|---|
| Ordinary Chromium | Full 276-test chromium project; 201 mandatory identities projected from it | 4 | 2026-11-08 12:31:53 | 2,825,933 ms | Exit 1 because tests failed |
| Renderer-Serial | Exact four-test chromium-renderer-serial project with no-deps | 1 | 2026-11-08 13:19:58 | 246,968 ms | Exit 0 |
| Bounded single-worker reproduction | Four preselected identities from the full-run failures | 1 | 2026-11-08 13:29:14 | 199,516 ms | Exit 0 |

The full Ordinary capture used the actual Chromium reporter output. Recomputed intervals show four observed worker slots and a longest continuous four-test overlap of 97,599 ms; this is execution overlap evidence, not proof of a common cause.

## Inventory and result reconciliation

The Ordinary selection is derived from the M7V current-inventory reconciliation, not a filename filter. The full Chromium project was run once so all 75 non-Ordinary identities remain visible as skips.

| Metric | M7R historical, comparable inventory | M7W current execution |
|---|---:|---:|
| Standard discovered | 278 | 280 |
| Ordinary project discovered | 274 | 276 |
| Ordinary mandatory identities | 199 | 201 |
| Ordinary mandatory passed | 114 | 117 |
| Ordinary mandatory unexpected | 85 | 84 |
| Ordinary conditional skips | 75 | 75 |
| Renderer-Serial passed | 4 | 4 |
| Renderer-Serial unexpected | 0 | 0 |
| Retries | 0 | 0 |
| Incomplete results | 0 | 0 |

For the 199 identities with M7R history, 116 pass and 83 are unexpected in M7W. M7U added two Ordinary tests: one passed and one failed. The M7W full standard result is 280 discovered: 121 passed, 84 unexpected, and 75 skipped. The 75 skips remain assigned to their M7V conditional lanes (73 native-required and two research/development); none is counted as an Ordinary pass.

All 276 Chromium identities and all four Renderer-Serial identities match the M7V project inventories exactly. No identity is missing, duplicated, or represented by a retry. All 201 Ordinary mandatory identities have a result.

## Failure classifications and bounded reproduction

Every one of the 84 current Ordinary mandatory unexpected outcomes has an exact identity, status, worker, duration, failure location, error excerpt, historical M7R status, and reproduction disposition in the machine-readable report. They are classified unclassified with root-cause confidence none. Failure signature describes the observed assertion or timeout; it is not a diagnosis.

The largest exact repeated assertion surface is eight failures at the shared learningOverlay.ts open-position toHaveCSS assertion. One additional test timed out at that helper and is listed separately. The eight failures span Architecture + Foreground, Interior Corner, Mirror Shift, Oblique Architecture, Phase 13, and viewport Learning Drawer tests. Their repeated location makes this a bounded candidate cohort, not proof of an application defect.

Four identities selected before reproduction failed or timed out in the four-worker run. Each passed once in the separate single-worker subset:

1. Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only.
2. Architecture Rise focus control stays within scene depth and preserves thin-lens extension.
3. Interior Corner completes the public Compose → Swing → Refine → Aperture lesson.
4. Interior Corner free mode exposes reachable Rise composition feedback.

These runs used a different workload. They establish only that those failures were not reproduced in this bounded one-worker subset; they do not establish a fix, a concurrency cause, or that all other failures are reproducible.

## Lane decisions

### Ordinary WebGL

**Not-qualified; execution complete.** The full Chromium project produced 117 passes, 52 failures, 32 timeouts, 75 expected conditional skips, zero retries, and zero incomplete results. Within the 201 mandatory projection, 117 passed and 84 were unexpected, with no mandatory skips.

### Renderer-Serial

**Locally passed; strict M7V qualification evidence incomplete.** All four identities passed with one worker, zero retries, and no skips. This is not promoted to a formally qualified M7V lane because M7V requires an authenticated artifact from .github/workflows/m7v-lane-qualification.yml, which is absent from the accepted M7V source.

M7V v2 also requires a renderer runtime row for every ordinary required identity, including non-rendering tests and explicit compatibility/fallback controls. The repository does not currently collect truthful per-test runtime evidence for every such identity. M7W does not fabricate these rows or weaken M7V's contract. For example, retained diagnostics show default WebGL2 on a WebGL control and a controlled WebGPU-to-WebGL2 fallback on a pilot compatibility test; neither is native WebGPU evidence.

The new M7W evidence check is an offline integrity gate over retained artifacts. It does not execute the long lanes and does not change M7V's not-run status or strict qualification requirements.

## Evidence integrity verification

`npm run evidence:check:m7w` passes against the committed M7V policy/inventory, source-pinned analysis implementation, public redacted Playwright exports, and referenced attachment artifacts. The focused M7W mutation suite now passes 24 tests, including production-CLI controls for contradictory mandatory outcomes and worker-identity summaries.

## M7W Review-Fix Round 1 — Worker-process identity preservation

The first report derived distinct worker-process IDs from intervals, but interval construction retained only `parallelIndex` after validating `workerIndex`. The summary therefore serialized an undefined worker identity as `[null]`. Evaluator v2 now carries the validated `workerIndex` into every interval. The normalizer regenerated only the derived report from the existing retained public Playwright exports; capture outcomes, execution timestamps, retry counts, raw-source digests, public-export digests, and attachment bytes remain unchanged.

The corrected Ordinary summary derives 87 worker-process identities (`0–86`) across the run and four parallel slots (`0–3`). `actualWorkers` continues to mean observed parallel slots, not distinct worker processes. Peak concurrency remains four and the longest continuous four-way overlap remains 97,599 ms. Renderer-Serial and the representative single-worker capture both derive worker process `[0]`, slot `[0]`, and peak concurrency one. Tests cover worker replacement, serial execution, invalid worker metadata, real retained reporter consistency, and a production-CLI summary mutation that exits nonzero.

The separate M7V, M7R, M7Q, and M7K evidence checks also pass without modifying their historical reports or qualification decisions. M7V policy validation still reports the Ordinary WebGL and Renderer-Serial formal lanes as `not-run`; M7W's locally captured results do not satisfy the absent authenticated lane-artifact workflow/runtime-evidence contract.

## Squash-safe source provenance

The report pins evaluator v2 and its analysis implementation to `32a919a68f52e3fa4bb1c2d0c63eae2af8cb660c`; the M7V execution source remains `17a4ccb9f4ae08069defaa9a1eac9938833412ae`. Pages CI fetches the exact analysis commit first and uses the existing strict fetch helper with retained-ref fallback `refs/pull/321/head`. The workflow verifies the evaluator, normalizer, and evidence CLI tree entries before running the M7W gate. The CLI then checks the exact source-file content digests.

A synthetic post-squash test used a no-shared-object bare remote and a shallow clone at a synthetic squash snapshot containing the M7W tree. Before retrieval, `git cat-file -e 32a919a68f52e3fa4bb1c2d0c63eae2af8cb660c^{commit}` and the pinned evaluator tree-entry check both exited 128. The evidence checker exited 1 with unavailable execution/analysis source diagnostics. The helper then recovered the source through its exact-SHA path; a fresh shallow clone also recovered it through the forced `refs/pull/321/head` fallback. Each path verified all three pinned analysis tree entries, after which `npm run evidence:check:m7w` passed. The retained public reporters and normalized outcomes were unchanged.

## Recommended next remediation cohort

Prioritize a bounded review of the eight learningOverlay.ts open-position assertion identities. Start with exact reproduction on the immutable M7V source and preserve the closed/peek and materially translated drawer negative controls. If baseline evidence supports a helper-contract correction, compare the same identities on a candidate while preserving meaningful geometry and Task/Feedback assertions. Do not infer a product defect from this M7W report, and route the separate helper timeout and other assertion surfaces independently.

Stop after matched evidence answers whether that shared assertion surface has one justified correction. Do not reopen the general M7N–M7Q scheduling investigation or broaden the next PR to the full 84 failures.

## Artifact integrity and limitations

The machine-readable report contains all 276 Ordinary, four Renderer-Serial, and four single-worker result rows, plus the 84 failure classifications and M7R transitions. Each public Playwright JSON export has its own SHA-256. The unredacted source JSON was hashed before redaction and preserved outside the repository; it is not part of the committed bundle. The report keeps both hashes and states that distinction explicitly. Absolute worktree, user, Node installation, and cache paths were redacted. Test outcomes, timestamps, identities, errors, retries, worker data, and attachment references were retained. Referenced public attachments are retained with individual digests. Trailing horizontal whitespace was removed from Playwright `error-context.md` exports only; no assertion text, outcome, timing, identity, worker data, screenshot bytes, or other attachment content changed.

M7V policy integrity and the M7R/M7Q/M7K evidence checks remain independent. M7W does not edit their historical reports or evidence.

Preserved boundaries:

    M7V Ordinary WebGL and Renderer-Serial formal lane state: not-run
    M7W Ordinary WebGL local execution: complete, not-qualified
    M7W Renderer-Serial local execution: 4/4 passed, formal evidence incomplete
    Broad E2E: not-qualified
    M7: partially-qualified
    M8 entry: denied
    Spontaneous/external GPU device loss: blocked
    Production Ground Glass: WebGL-only
    Production WebGPU: disabled
