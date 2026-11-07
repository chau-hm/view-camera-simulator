# M7R — Broad E2E Qualification Recovery

## Executive finding

M7R refreshed the broad E2E baseline on the exact current M7Q merge source, `d34fe8b39f6c1e0509b3ffecb6fcc6566282d9f8`, using the application-default WebGL configuration. Discovery matched the retained M7K inventory: 278 tests across 80 ordinary Chromium spec files and four renderer-serial tests.

The completed capture found 118 passing tests, 85 unexpected outcomes, and 75 skips. It had zero retries, flaky results, or incomplete results. The ordinary Chromium lane had four-way worker overlap; the separate renderer-serial lane passed all four required tests. The Broad E2E suite therefore remains **not qualified**. M7 remains **partially qualified**, and M8 remains denied.

This report prioritizes three bounded follow-up work packets: verify the shared Learning Drawer open-state contract for 11 failures, triage 15 newly unexpected identities individually, and adjudicate the lane and exclusion policy for all 75 skipped identities. These are investigation priorities, not confirmed root causes or approved exclusions.

## Capture identity and environment

| Role | Pinned identity |
|---|---|
| Execution source | `d34fe8b39f6c1e0509b3ffecb6fcc6566282d9f8` |
| Execution source tree | `483e20dc144961c6028f717fe2c4ab0ef18a8e16` |
| Original two-lane capture runner | `ccae6bdd904d654fc73b12ec5875376575c3e16b` |
| Corrected M7R analysis tooling/evaluator | `a731929ae377d5ff0d991179f6dcc5d34c318d26` |
| Evaluator revision | `m7r-broad-e2e-recovery-evaluator-v7` |

The ordinary lane used Playwright 1.61.1 with Chromium 149.0.7827.55, Node 24.3.0, macOS arm64, headless Chromium, a 1280×720 viewport, and Three.js 0.187.0. The renderer was the application's default WebGL path using Chromium SwiftShader. Native WebGPU and native WebGPU feature gates were disabled. The ordinary lane used four configured workers and zero retries. The renderer-serial lane used one worker, zero retries, and disabled project dependencies. The two lanes ran sequentially on isolated strict ports; each prior listener was absent and each server was closed after its invocation.

The source worktree was clean before execution, and discovery matched the execution source. No application source or timeout changed during capture.

## Attempt record and capture validity

Two preflight attempts are retained separately from the test results:

1. The sandbox browser probe failed with Chromium `SIGTRAP` / MachPortRendezvous permission denial before Playwright started or tests were invoked.
2. The runner refused to overwrite the output directory created by that first preflight. This was an expected collision guard; no discovery or test execution occurred.

The valid capture was then performed in the isolated execution worktree. The ordinary lane ran to completion with exit code 1 because of test outcomes; the renderer-serial lane completed with exit code 0. The capture preserves both exit codes and is considered complete because all discovered tests have terminal outcomes. These preflight failures are not counted as E2E attempts.

The first runner summary misidentified nested Playwright suite titles because nested suites repeat their source file field. Re-derivation from the retained raw Playwright report matched all 274 ordinary identities with no missing, extra, or duplicate identities. The correction changes identity mapping only; it does not alter any test status or outcome. The normalized report records the original mismatch and the correction.

## Current results

| Lane | Discovered | Passed | Failed | Timed out | Skipped | Unexpected | Retries / flaky / incomplete |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ordinary Chromium, four configured workers | 274 | 114 | 49 | 36 | 75 | 85 | 0 / 0 / 0 |
| Renderer-serial, one worker | 4 | 4 | 0 | 0 | 0 | 0 | 0 / 0 / 0 |
| **Combined inventory** | **278** | **118** | **49** | **36** | **75** | **85** | **0 / 0 / 0** |

The ordinary raw results show four distinct `parallelIndex` worker slots (`0–3`) with a peak of four concurrently active tests. The longest interval with all four workers active lasted 120,463 ms. This is measured overlap, not an inference from the configured worker count. The renderer-serial lane retains its four required tests and its independent 4/4 pass result.

The ordinary run's 85 unexpected results are classified from the top-level assertion line rather than incidental stack or call-log text:

| Failure signature | Count |
|---|---:|
| Test timeout | 36 |
| CSS assertion | 13 |
| Visibility assertion | 8 |
| Attribute assertion | 7 |
| Count assertion | 7 |
| Equality assertion | 3 |
| Text assertion | 3 |
| Predicate timeout | 2 |
| Checked-state assertion | 1 |
| Enabled-state assertion | 1 |
| Numeric greater-than assertion | 1 |
| Numeric less-than assertion | 1 |
| Other assertion | 1 |
| Value assertion | 1 |
| **Total** | **85** |

These signatures describe observed failures. They do not establish shared causes.

## Historical M7K comparison

M7K remains the immutable historical baseline: 278 discovered, 121 passed, 82 unexpected, 75 skipped, zero flaky, zero incomplete, and zero retries. Identity reconciliation against M7R yields:

| M7K state | M7R passed | M7R unexpected | M7R skipped | Missing or changed identity |
|---|---:|---:|---:|---:|
| 121 historical passes | 106 | 15 | 0 | 0 |
| 82 historical unexpected | 12 | 70 | 0 | 0 |
| 75 historical skips | 0 | 0 | 75 | 0 |

Thus, 12 previously unexpected identities passed once in this capture; they are not classified as fixed. Fifteen identities that passed in M7K were unexpected in this current run. Seventy of the historical unexpected identities remain unexpected, with 46 retaining the same normalized signature and 24 showing a changed signature. All 75 historical skips remain skipped. Every one of the 278 identities reconciles; no identity is removed to improve the result.

The 15 newly unexpected identities include heterogeneous timeout, CSS, visibility, attribute, count, and value symptoms. Their diversity does not support a single common-cause claim.

## Prioritized recovery work

### 1. Verify the shared Learning Drawer open-state contract

Eleven failures at `helpers/learningOverlay.ts:20` or `:36` fail the non-translated transform assertion. Their call logs show a connected drawer with `aria-hidden=false` while its transform remains nonzero. This is a shared observed failure path, but the capture does not establish that the application violates its public contract or that the assertion is wrong.

The next bounded step is to verify the documented open/pinned state contract in one public workflow and reproduce the translated state. Any proposed correction must compare current main and candidate under matched evidence, retain the existing content assertions, and include a closed/peek negative control that remains offscreen. No timeout increase or arbitrary delay is proposed.

### 2. Triage the 15 newly unexpected identities

These identities span multiple product surfaces and assertion types. Select the next cases by user impact, inspect the exact current assertion and contract, and adjudicate each identity with a bounded matched baseline/candidate comparison. A pass in one run is not a fix, and unrelated failures should not be bundled into one remediation.

### 3. Adjudicate the 75 skipped identities

All 75 remain unapproved skips. Their annotations suggest 73 platform-gated and two development/research-only cases, but annotation text does not prove the condition is appropriately gated and is not approval to exclude a test. Build an explicit lane matrix covering ordinary WebGL regression, renderer-serial regression, native WebGPU lifecycle qualification, research-only evidence, and production-preview isolation. Record a lane and an explicit owner decision for each identity. Native lifecycle coverage, including spontaneous/external device loss, remains separately blocked until qualified.

The complete identity lists and acceptance gates for these work packets are in the [machine-readable report](GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json).

## Historical evidence, privacy, and digests

The original capture was private local evidence. Because this repository is public, the committed raw reports and capture manifest are redacted public exports: local account paths, temporary execution-worktree paths, and transient tool session identifiers were removed or replaced. A final privacy scan caught and removed absolute paths from the capture manifest and preflight command records as well. Test outcomes, timing data, and assertion content were not changed. The original capture digests are retained in the machine-readable report and export metadata; the committed export digests identify the public files that the evaluator checks.

| Artifact | Committed public export SHA-256 | Original capture SHA-256 |
|---|---|---|
| Ordinary Playwright report | `24ae52f1143e4c95ba62d93ac02a056a866911454516c744ebdc61f4218cc201` | `449c663cd4e475604f43a1cb5d7cb3c5ae749e1d91e8adb0152dc40bb90ff46c` |
| Renderer-serial Playwright report | `766017bcdd512b712a60896e454cb62e18ac91b3d38f43d37cd4b29589f4f620` | `39f6b3438a9ae198532d438089aec759803b528689f03c0a0aab30e2983112ca` |
| Capture manifest | `bcfcd28dcdeedd254e2185cda7de80a72ccffc1589e42702e32323c1f9d8d840` | `1acebf81b63ed2b80b7b0bd583c5cdece1f43acf0ab72030391cc2805af1a7e6` |
| Normalized capture | `3ea64e1fa325583dd87e5cdad56bf8d4231ca64d0062495723b0ba8777b540d5` | Regenerated from the retained redacted manifest and raw reports by the pinned analysis tooling |

The M7K/M7G/M7I historical digest values remain unchanged, including the M7I report SHA-256 `486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde`, M7G raw Playwright SHA-256 `393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6`, and M7K ordinary/serial report SHA-256 values `95a7abebfaa7abe53805be7171d0ff84166dbb9e3e3d45eaa134a68f098963de` and `4be43aa1e68c5bd45d861092cf298db6f43e77576f3a338dc4533f162e32d71a`.

## Diagnostic closure and qualification boundary

M7N–M7Q remain closed as a bounded scheduling-diagnosis sequence. M7R identifies a current broad-suite backlog to prioritize by qualification impact; it does not reopen the general scheduling investigation. The selected renderer-serial result is not a full-suite result, and the current complete ordinary inventory is not a qualification pass.

The report's decision is `R1 — Ready for targeted remediation PRs`. It establishes no application fix and no root cause. Any skip exclusion requires an explicit identity-level lane decision and approval.

The accepted authorization state is unchanged:

- Broad E2E: **not qualified**.
- M7: **partially qualified**.
- M8 entry: **denied**.
- Spontaneous/external GPU device loss: **blocked**.
- Production Ground Glass: **WebGL-only**.
- Production WebGPU: **disabled**.

M7R evidence-check success means only that this current capture and its interpretation are internally consistent with the retained evidence. It does not qualify Broad E2E, establish native WebGPU lifecycle behavior, or authorize a milestone promotion.

## Validation

Hosted CI on evaluator v6 failed its positive M7R evidence check with `m7r-capture-artifact-manifest-invalid` and `m7r-normalized-artifact-digests-not-recomputed`, despite the local checker passing. Comparing all 171 manifest entries with Git's tracked paths identified four console logs that existed locally but matched the repository-wide `*.log` ignore rule, so a clean hosted checkout did not contain them. The four logs were checked for private absolute paths and their on-disk sizes and SHA-256 values matched the existing manifest. Evaluator v7 reports missing, size-mismatched, or digest-mismatched artifact paths individually, and the positive mutation test prints evaluator issues on failure.

The normalized capture was regenerated from the unchanged redacted manifest and raw Playwright reports using analysis source `a731929ae377d5ff0d991179f6dcc5d34c318d26`; the only normalized changes are generation time and analysis-source provenance. Raw outcomes, the capture manifest, raw Playwright exports, and their recorded digests are unchanged. The four existing console logs were committed byte-for-byte so the full persisted artifact manifest is available in a clean checkout.

The production-facing `npm run evidence:check:m7r` command passes and reports 118 passed, 85 unexpected, 75 skipped, zero retries, and `not-qualified`. The focused `src/tests/unit/m7rBroadE2eRecoveryEvidence.test.ts` suite passes all 15 tests, including the production CLI negative control. Final-head hosted CI on `183a8f4902acdfdd2fdae9b460c54093dbaaad93` passed in [workflow run 42340897734](https://github.com/chau-hm/view-camera-simulator/actions/runs/42340897734): all 3,914 tests across 326 files, lint, typecheck, ordinary Chromium smoke, production-preview WebGL isolation, and retained evidence checks through M7R. The deploy job was skipped for this PR. Local typecheck, lint, focused tests, evidence check, and `git diff --check` also pass.
