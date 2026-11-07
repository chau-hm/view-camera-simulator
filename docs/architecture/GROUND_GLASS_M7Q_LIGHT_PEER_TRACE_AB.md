# M7Q — Matched Light-Peer Trace A/B Verification

## Finding

M7Q followed the predeclared four-pair, eight-invocation schedule. The Architecture Rise Canvas-count target failed in **all four Q-off attempts and all four Q-on attempts**. All three light peers passed in every invocation. Every attempt had zero retries, four distinct Playwright worker indexes, and a non-empty interval when all four selected tests—including the target—were active.

The target failure reproduced with CDP tracing disabled while the M7P browser-side lifecycle, Long Task, heartbeat, DOM, and public-evaluation observers remained enabled. **CDP tracing is therefore not required to reproduce the failure under this tested configuration.** M7Q selects decision Path B and closes the M7N–M7Q scheduling-diagnosis sequence. It does not identify renderer-specific or GPU causation.

## Experimental controls and provenance

The only intended arm variable was `M7P_TRACE_ENABLED`:

| Control | Q-off | Q-on |
|---|---|---|
| M7P browser-side diagnostics | Enabled | Enabled |
| CDP session | Created | Created |
| Chromium trace collection | Disabled | Enabled |
| Configured workers / retries | 4 / 0 | 4 / 0 |
| Assertion | Existing `toHaveCount(1)`, 5,000 ms | Same |
| Renderer backend | Application-default WebGL | Same |

The M7P helper creates a CDP session in both arms; the off arm does not request trace categories or start tracing. Each invocation used a new strict-port Vite server. The runner confirmed the chosen port was free before launch and closed before proceeding. Arms ran sequentially, with no overlap between invocations.

The four selected identities were:

1. `architecture-rise-focus-range.spec.ts` — Architecture Rise focus control stays within scene depth and preserves thin-lens extension.
2. `home.spec.ts` — concept learning sections keep their responsive grids without overflow.
3. `simulator-header.spec.ts` — keeps the active lesson context between the brand and desktop actions.
4. `smoke.spec.ts` — smoke: app boots at home.

The capture runner source is pinned to `cde9e31fb299bf436e9dd5afd6509e3409e6add1`. The evaluator and normalizer are pinned separately in the machine report. The normalized summary has SHA-256 `3554ecf749e82033efea72ef5b0f37578df7afa50d964062f1d121a78195152a`.

The required Pages CI gate retrieves the exact capture-runner and analysis-tooling commits with `scripts/fetch-m7k-execution-source.mjs`, falling back to the retained `refs/pull/315/head` history if an exact-SHA fetch is unavailable. It verifies each declared source tree entry before running `npm run evidence:check:m7q`. The M7Q integrity step is unconditional in the CI job, including production-branch pushes; deployment still depends on successful CI.

Environment: Node `v24.3.0`, Playwright `1.61.1`, bundled headless Chromium `149.0.7827.55` (revision 1228), Darwin `27.0.0`, arm64, Apple M4 Pro with 14 logical CPUs. Both arms used the ordinary Chromium project and the same application-default WebGL build.

## Eight-attempt results

The first connected Canvas value is the browser-page monotonic sample from the M7P lifecycle observer. The deadline is the corrected forward uncertainty interval derived from the public assertion-entry evaluation bracket; it is not an exact DOM insertion or matcher-retry timestamp.

| Pair | Run order | Arm | Target | First connected Canvas / deadline interval (ms) | Assertion elapsed (ms) | Four-test overlap (ms) | Capture |
|---|---|---|---|---:|---:|---:|---|
| 1 | off → on | Q-off | failed | 1482.500 / [5790.137, 5820.008] | 5012.944 | 1073 | valid |
| 1 | off → on | Q-on | failed | 1126.300 / [5620.534, 5641.783] | 5013.905 | 705 | valid |
| 2 | on → off | Q-on | failed | 1191.800 / [5614.163, 5638.230] | 5010.004 | 728 | valid |
| 2 | on → off | Q-off | failed | 1222.000 / [5642.026, 5661.457] | 5015.005 | 752 | valid |
| 3 | on → off | Q-on | failed | 1174.100 / [5633.932, 5660.882] | 5020.610 | 676 | valid |
| 3 | on → off | Q-off | failed | 1224.900 / [5635.125, 5655.915] | 5009.802 | 759 | valid |
| 4 | off → on | Q-off | failed | 1301.100 / [5702.531, 5723.585] | 5010.790 | 835 | valid |
| 4 | off → on | Q-on | failed | 1207.500 / [5633.740, 5654.868] | 5022.929 | 806 | valid |

All eight Canvas samples precede the **entire** deadline interval. The three peer tests passed in every row. Each actual intersection spans four distinct workers and includes the Architecture Rise target; the configured worker count is not used as a substitute for that interval calculation.

## Timing comparison

Values below describe these four pairs and are not statistical-significance claims.

| Shared metric | Q-off | Q-on |
|---|---:|---:|
| Assertion entry to settlement, mean (range) | 5012.135 ms (5009.802–5015.005) | 5016.862 ms (5010.004–5022.929) |
| Largest browser Long Task in assertion window, mean (range) | 4543.250 ms (4427–4736) | 4422.500 ms (4244–4576) |
| Largest browser heartbeat gap (range) | 5236.5–5537.4 ms | 5044.8–5350.6 ms |
| Largest Node heartbeat interval (range) | 55.266–71.351 ms | 56.211–63.794 ms |
| Four-test common overlap (range) | 752–1073 ms | 676–806 ms |
| Failure-catch public `page.evaluate` response latency (range) | 864.026–1304.641 ms | 654.544–1039.204 ms |

Browser Long Task and heartbeat gaps were present in both arms. Node heartbeat intervals stayed near its 50 ms sampling cadence. After the assertion settled, the public failure-catch evaluation took 0.65–1.30 seconds to return. This sequence shows browser-side service delay in the measured interval, but the public API cannot distinguish time queued before execution from execution time or response delivery time.

The four Q-on traces completed without reported loss or collector overflow. All four identify the target `CrRendererMain` thread. Each trace includes a generic `RunTask`/`ThreadControllerImpl::RunTask` interval that, after accounting for the observed trace/page anchor range, definitely spans the full browser deadline uncertainty interval. The longest selected task is 4.244–4.577 seconds. Q-off intentionally has no Chromium trace events; no equivalent trace data is imputed for that arm.

The mean assertion elapsed time differs by about 4.7 ms between arms, while both arms fail on every target attempt. Browser Long Task measurements and failure-catch evaluation latencies vary in both directions. With four matched pairs, this cannot establish a tracing overhead estimate or isolate a trace-side mechanism. The result establishes only that toggling trace collection did not change the observed target outcome in this run.

## Raw evidence and an initial runner annotation correction

The retained evidence bundle contains eight original Playwright JSON reports, eight original M7P capture JSON files, and four Chromium traces compressed with gzip. Decompressing each trace reproduces the original bytes; the original raw SHA-256, size, and retained gzip SHA-256 are recorded in `capture/final/normalized-captures.json`. The offline evaluator checks the digests, parses the Playwright outcomes and worker intervals again, and rederives trace thread/task intervals from the decompressed traces.

The initial runner summary marked each capture's preliminary `captureValid` flag false. This was an annotation defect: the M7P capture identity contains the spec prefix before the test title, and trace-off correctly has no trace clock-sync brackets. Neither condition meant missing browser capture data. The original raw records were preserved. Normalization revalidated the exact test identities, public evaluation anchors, M7P page observers, mode-specific trace completeness, four-worker overlap, target/assertion outcome agreement, and server cleanup; all eight are valid. No raw Playwright report, M7P capture, or trace was rewritten.

The committed source pins and historical M7O/M7P report/normalized-capture digests are in the machine-readable report. M7O and M7P historical artifacts remain unchanged.

| Trace capture | Raw bytes | Raw SHA-256 | Retained gzip SHA-256 |
|---|---:|---|---|
| `m7q-pair-1-on` | 19,096,671 | `fc7e42197cb16eacc740ac6cb39643eabadaa6c144804b6dea7216e25a7e8e0e` | `32ef732fa6c6bb53464f2e8f6e927db4c971650318069b15bb61326c260964ca` |
| `m7q-pair-2-on` | 19,064,311 | `337e4a9658b1457cfa92063ba988632cc740fe2de8a3cfab3d711f3264431e4b` | `01840f2948b3dc88aa8c55edd0d3e81f36141a03f0b7036d2713d10202544e14` |
| `m7q-pair-3-on` | 19,175,616 | `f313e227d2aa23ff5e365f30752d506927f215a15eabfe6564c722ea7e413605` | `de3e034f6876042ab73459218913086dd08d9bf7dee884a8a887f73ef00d516f` |
| `m7q-pair-4-on` | 19,004,398 | `6aa114f44cba311af98f2d7af2606f944efae4a68c90119b77aa350d8a066037` | `dd60b3991864c9ba02a1689b0fce07b266eb4a3df6c7d4ee614a2226be8fd619` |

## Squash-merge source replay

A disposable local bare remote was prepared with a synthetic post-squash `main` commit whose tree contains the M7Q report and evidence, while `refs/pull/315/head` retained the original feature history. A fresh depth-1 clone used no shared object store. Initially, both pinned source commits and the runner tree entry were absent (`git cat-file -e` exit 128). The actual M7Q evidence CLI failed closed with exit 1 and reported missing capture and analysis source commits/tree entries.

The existing source-fetch helper was then run with the retained-ref fallback forced, matching the post-squash case where exact-SHA fetching is unavailable. It fetched `refs/pull/315/head`, verified the runner and analysis source paths at their pinned commits, and made both commit objects available. The same unchanged `node scripts/run-m7q-evidence.mjs` then passed: 8/8 captures, Decision Path B, Broad E2E `not-qualified`. The temporary clone had no shared object store and no tracked evidence was changed.

## Review-Fix Round 1 — Rederive Node heartbeat summaries

Independent review found that the evaluator accepted a normalized Node-heartbeat maximum changed to 9,999 ms if the corresponding aggregate summary and normalized digest were changed with it, even though the retained raw heartbeat samples were unchanged. The evidence boundary now closes that gap.

Evaluator v2 validates each normalized Node sample's timestamps, interval arithmetic, excess-over-50-ms value, and assertion-window membership, then recomputes each attempt's rounded maximum from the sample intervals. The raw-evidence verifier independently filters the retained M7P capture's Node heartbeat samples by that capture's original assertion entry/settlement, requires the normalized sample list to match, and recomputes the maximum from those raw samples. The report's per-arm timing summary is checked against the rederived per-attempt maxima.

The mutation regression forges a self-consistent 9,999 ms normalized sample and summary, updates the normalized digest, and leaves the raw M7P captures unchanged. The pure evaluator accepts the internally consistent normalized fields, while the raw-evidence check identifies the sample mismatch and the production CLI exits nonzero. Capture reports, raw M7P samples, traces, and their digests remain unchanged. The corrected analysis-source pin (`a33897808decbff0ccc7acc1a54d3e1497f5cd35`) is recorded in the machine report and fetched by CI from the retained PR history.

## Historical reconciliation

| Evidence | Light-peer target outcomes |
|---|---:|
| M7O | 3/3 passed |
| M7P P3, tracing on | 0/3 passed |
| M7Q Q-off | 0/4 passed |
| M7Q Q-on | 0/4 passed |

M7Q establishes that tracing is not needed for the current reproduction. It does not explain the earlier M7O pass. M7O and M7P/Q used different capture implementations and browser-side observers, different execution source revisions, and captures made at different times. M7Q holds those factors fixed between its arms, but cannot make the historical runs contemporaneous. The historical discrepancy remains unresolved.

M7P's synthetic P5 control also remains a counterexample under its own conditions: three of three passed with a bounded 5.4-second browser-main-thread stall. That does not establish that a similar stall can never contribute to a failure in another workload or matcher schedule.

## Decision and M7 handoff

**Decision Path B — both conditions fail.** CDP tracing is not required for the failure under this tested four-worker light-peer configuration. Stop the tracing-toggle investigation and close the M7N–M7Q scheduling-diagnosis sequence; do not open another general scheduling-diagnosis phase from this result.

The evidence does not prove that a generic renderer-main-thread task caused the assertion failure. It does not identify an application frame or WebGL operation, GPU saturation, a resource leak, a defective matcher, or an invalid readiness contract. The Canvas observation is not proof that Playwright's private matcher retry observed that same DOM state.

The next M7 activity should be qualification-impact driven:

1. Refresh and classify current outcomes for the 82 historically unexpected M7K identities. Do not assume they all still fail or share a cause.
2. Separate reproducible application defects from test-infrastructure instability; make matched baseline/candidate corrections for confirmed application failures.
3. Adjudicate the 75 historical skips and state which are supported exclusions versus required coverage.
4. Track spontaneous/external native GPU device loss as an independent blocked item requiring native qualification evidence.
5. Run final M7 evaluation against predefined evidence and authorization requirements.

Keep these four tests required. Do not change the assertion timeout or retry policy, serialize the workload, or launch another trace campaign on this evidence alone.

## Validation

- M7Q evidence tests: 16 passed; the offline M7Q integrity CLI accepted all 8 captures and Path B.
- Existing M7P and M7O evidence checks passed without changing their reports or captures.
- Typecheck, lint, CSS structure check, and production build passed.
- The full unit/integration suite reported 3,896 passed and one timeout in the existing `m7kCaptureWorkflow` Git-history test (its 5-second limit was exceeded during the suite). That exact test passed by itself in 1.84 seconds. The M7Q tests also passed in the suite. No broad E2E matrix or historical M7O/M7P capture was rerun.

## Qualification boundaries

M7K's accepted historical full-suite baseline remains 278 discovered, 121 passed, 82 unexpected, and 75 skipped. M7Q's selected four-test cohort is not Broad E2E qualification.

- Broad E2E: `not-qualified`
- M7: `partially-qualified`
- M8 entry: denied
- Spontaneous/external GPU device loss: blocked
- Production Ground Glass: WebGL-only
- Production WebGPU: disabled

M7Q evidence-integrity PASS means only that this diagnostic report agrees with its retained evidence.
