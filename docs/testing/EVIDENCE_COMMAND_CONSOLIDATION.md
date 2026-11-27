# Evidence command consolidation

Implementation base: `6fe97800c2de3f07bb0b073a902d48083910c17b`. The previous closeout captured 75 npm scripts; this change removes 26 legacy registrations and adds `evidence`, leaving **50** (25 fewer, 33.3% reduction). This counts package entry points, not runtime or CI savings. The dispatcher preserves the existing implementations and is not a qualification engine.

## Interface and inventory

Use `npm run evidence -- help` or `list`, then `npm run evidence -- <action> <family> [arguments...]`; qualification takes `npm run evidence -- qualify [arguments...]` with no family. `normalize m7o-matrix` selects the matrix normalizer separately from `normalize m7o`. Arguments, including paths containing spaces, follow fixed mode arguments in their original order. Commands run from the actual checkout root with inherited environment and standard streams; node options and child exit/failure are preserved. The registry uses explicit action/family targets and array-based spawning, not a shell or arbitrary paths. Capture and normalization may create outputs; consult the historical source reports before execution. No action deploys production.

The table preserves the original executable, ordered fixed arguments, and full migration mapping. All targets are Node scripts, normally run from the repository root with the caller's environment. The original npm invocation forwarded user arguments after `--`; the current form forwards arguments after the family. Exit codes originate from the target; signals and spawn errors fail. Research/capture actions retain their documented browser, GPU, and artifact prerequisites; no capture or migration is run merely for this inventory.

| Legacy npm registration | Original target and fixed arguments | Current `npm run evidence -- ...` | Decision / dependency |
| --- | --- | --- | --- |
| `evidence:replay:m7e` | `node ./scripts/run-m7e-offline-replay.mjs` | `replay m7e` | Retained: M7E recorded replay invocation |
| `evidence:replay:m7f` | `node ./scripts/run-m7f-presentation-evidence-replay.mjs` | `replay m7f` | Removed; manifest consumer migrated |
| `evidence:replay:m7g` | `node ./scripts/run-m7g-consolidation.mjs` | `replay m7g` | Removed; no active registered consumer found |
| `evidence:report:m7g` | `node ./scripts/run-m7g-consolidation.mjs --diagnostic` | `report m7g` | Removed; manifest consumer migrated |
| `e2e:triage:m7h` | `node ./scripts/run-m7h-triage.mjs --inventory` | `triage m7h` | Removed; no active registered consumer found |
| `e2e:compare:m7h` | `node ./scripts/run-m7h-triage.mjs` | `compare m7h` | Removed; no active registered consumer found |
| `evidence:check:m7h` | `node ./scripts/run-m7h-triage.mjs --diagnostic` | `check m7h` | Removed; manifest consumer migrated |
| `evidence:check:m7i` | `node ./scripts/run-m7i-remediation.mjs --diagnostic` | `check m7i` | Removed; manifest consumer migrated |
| `evidence:check:m7j` | `node ./scripts/run-m7j-four-worker-stability.mjs` | `check m7j` | Removed; manifest consumer migrated |
| `e2e:run:m7k` | `node ./scripts/run-m7k-broad-e2e.mjs` | `run m7k` | Removed; no active registered consumer found |
| `evidence:check:m7k` | `node ./scripts/run-m7k-qualification.mjs` | `check m7k` | Removed; manifest consumer migrated |
| `evidence:require-qualified:m7k` | `node ./scripts/run-m7k-qualification.mjs --require-qualified` | `require-qualified m7k` | Removed; no active registered consumer found |
| `evidence:check:m7l` | `node ./scripts/run-m7l-learning-drawer-remediation.mjs` | `check m7l` | Removed; manifest consumer migrated |
| `evidence:check:m7m` | `node ./scripts/run-m7m-scene-readiness.mjs` | `check m7m` | Removed; manifest consumer migrated |
| `evidence:check:m7n` | `node ./scripts/run-m7n-renderer-lifecycle.mjs` | `check m7n` | Removed; manifest consumer migrated |
| `e2e:capture:m7o` | `node ./scripts/run-m7o-canvas-assertion-timing.mjs` | `capture m7o` | Removed; no active registered consumer found |
| `evidence:normalize:m7o` | `node ./scripts/normalizeM7oCanvasAssertionTimingCapture.mjs` | `normalize m7o` | Removed; no active registered consumer found |
| `evidence:normalize:m7o:matrix` | `node ./scripts/normalizeM7oCanvasAssertionTimingMatrix.mjs` | `normalize m7o-matrix` | Removed; no active registered consumer found |
| `evidence:check:m7o` | `node ./scripts/run-m7o-evidence.mjs` | `check m7o` | Removed; manifest consumer migrated |
| `e2e:capture:m7p` | `node ./scripts/run-m7p-assertion-scheduling.mjs` | `capture m7p` | Removed; no active registered consumer found |
| `evidence:normalize:m7p` | `node ./scripts/normalizeM7pAssertionSchedulingCapture.mjs` | `normalize m7p` | Retained: normalizer usage text preserved |
| `evidence:check:m7p` | `node ./scripts/run-m7p-evidence.mjs` | `check m7p` | Removed; manifest consumer migrated |
| `e2e:capture:m7q` | `node ./scripts/run-m7q-light-peer-trace-ab.mjs` | `capture m7q` | Removed; no active registered consumer found |
| `evidence:normalize:m7q` | `node ./scripts/normalizeM7qLightPeerTraceAb.mjs` | `normalize m7q` | Retained: normalizer usage text preserved |
| `evidence:check:m7q` | `node ./scripts/run-m7q-evidence.mjs` | `check m7q` | Removed; manifest consumer migrated |
| `evidence:normalize:m7r` | `node ./scripts/normalizeM7rBroadE2eCapture.mjs` | `normalize m7r` | Retained: M7R exact package/workflow contract |
| `evidence:check:m7r` | `node ./scripts/run-m7r-evidence.mjs` | `check m7r` | Retained: M7R exact package/workflow contract |
| `evidence:check:m7v` | `node ./scripts/run-m7v-qualification.mjs validate-policy` | `check m7v` | Retained: M7V exact package contract |
| `evidence:require-approved:m7v` | `node ./scripts/run-m7v-qualification.mjs require-approved` | `require-approved m7v` | Retained: M7V exact package contract |
| `evidence:require-qualified:m7v` | `node ./scripts/run-m7v-qualification.mjs require-qualified` | `require-qualified m7v` | Retained: M7V exact package contract |
| `evidence:normalize:m7w` | `node ./scripts/normalizeM7wQualificationCapture.mjs` | `normalize m7w` | Removed; no active registered consumer found |
| `evidence:check:m7w` | `node ./scripts/run-m7w-evidence.mjs` | `check m7w` | Removed; manifest consumer migrated |
| `evidence:qualification:historical` | `node ./scripts/run-historical-qualification.mjs` | `qualify` | Removed; no active registered consumer found |
| `evidence:migrate:m7e` | `node --experimental-strip-types ./scripts/migrateM7ePersistedCaptures.mjs` | `migrate m7e` | Removed; no active registered consumer found |
| `test:e2e:m7j-renderer` | `playwright test --project=chromium-renderer-serial --no-deps --workers=1 --retries=0 --reporter=list,json` | Retained original | Retained Playwright-specific runner |

The five exact M7R/M7V registrations and their original implementations remain; ordinary Pages checks are unchanged. M7E remains because its replay records the legacy invocation; M7P/M7Q normalizer aliases remain because their existing script usage text names them, without modifying historical tooling. The M7J Playwright-specific entry remains. Historical reports retain old commands as facts about the captured revision, not current instructions.

## Qualification and consumer boundary

The manifest still uses npm argument arrays and the same validators, selection graph, source pins, artifacts, and production policy. Eligible arrays now invoke `npm run evidence -- ...`, preserving the remainder of each argument list; M7E and M7R use their retained aliases. Existing manifest owner labels retain historical names and are not current command instructions. M7G still runs its existing child replays directly, and the historical runner retains its standalone-versus-child M7F comparison. `scripts/evidence.mjs` and `scripts/evidence-commands.mjs` are added to the existing shared qualification paths so edits select broad qualification. Unknown archive dependencies remain conservative. The dispatcher does not determine applicability.

Parallel agents should fetch current main in their own worktree, inspect the feature merge base and their actual CI/release/package diffs, and reconcile intentionally changed invocation sites using the table. Existing older worktrees retain their own package scripts. Do not overwrite their outputs or automatically rebase or change their branches. Current-head validation is required after integration; coordinate renderer-heavy jobs and separate ports and artifacts. Open PRs #359, #379, #382, #384, #386 and #387 were present at preparation; their status can change. PRs #382, #386 and #387 modify the historical manifest, and #387 also changes release source qualification; reconcile those diffs against the new command arrays and shared paths in their own branches. Their presence alone does not establish a defect.

## Validation and limits

The focused suite exercises the explicit target map, fixed modes, forwarded arguments, spaces, invalid operations, worktree root, child failure, interruption, and conservative routing. Relevant existing routing, release, M7F/G, M7R, M7V and M7K tests supplement it. At the implementation base with Node 26, matched old and new invocations produced identical M7F report JSON, identical substantive M7H diagnostic and M7P integrity output, and identical M7K strict rejection (exit 3). Old and new M7R/M7V checks each exited 0 with identical substantive output. The historical `--files=README.md` route returned `NOT_APPLICABLE` on both paths; timestamps and npm banners differ. The full changed-file route returned `QUALIFIED`, including the M7F standalone/M7G child report comparison. `npm run evidence -- qualify --all` ran all 16 registered validator invocations successfully, but returned `UNVERIFIED` (exit 1) because M7S, M7T and M7U have no complete offline validators under the existing full-archive policy. M7O ordinary and matrix targets are independently asserted in the registry test. Capture, normalization and migration actions are dispatch-tested rather than requalified by writing frozen artifacts. Native GPU research is out of scope.

Rollback with a normal revert PR restoring the old package registrations and manifest arrays together, removing the dispatcher, registry and their shared path declarations. Preserve M7R/M7V and source pins throughout; do not rewrite or regenerate historical artifacts.
