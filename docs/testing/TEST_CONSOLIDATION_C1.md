# C1 — Ground Glass orientation test consolidation

Implementation base `97651a38a16026e3f237ca54f4a428ea48db27eb` from `origin/main` after PR #376. The original declarations are in `src/tests/unit/groundGlassRttOrientation.test.ts`. The primary keeper is `matches fixed asymmetric film, sampler, display, and source-crop references` in `src/tests/unit/groundGlassCoordinateContract.test.ts`.

## Preservation matrix

| Original declaration | Original defect detected | Primary keeper assertion | Unique behavior | Removal decision |
| --- | --- | --- | --- | --- |
| `renders an asymmetric upright reference as a 180-degree Raw image` | Missing or extra flip on either Raw axis, or an unwanted Upright flip | `Raw framebuffer` and `Upright framebuffer` compare both axes with fixed asymmetric positions after converting bottom-origin raster V to visible top-origin V | Raw rotates the physically asymmetric image by 180° relative to Upright. Upright preserves source sampler UV. The explicit visible-origin conversion is reversible, so the fixed offsets constrain the original sampler coordinates as well. | Removed after A failed at the fixed Raw framebuffer reference. |
| `keeps source-to-film coordinates separate from the Raw display flip` | A display flip or incorrect origin leaks into the canonical film coordinate | `configured RTT camera` independently pins both source UV axes to the physical reference. `sampler-to-film mapping` pins canonical film UV to that same fixed value. `Raw framebuffer` pins the separate display transform. | The source is bottom-origin, and its numeric coordinates coincide with canonical top-left film UV because of the reflected-camera configuration. The visible coordinate is independently pinned. | Removed after B failed at the fixed sampler-to-film reference. |
| `maps physical film points through the same display transform as the RTT` | Physical overlays and visible raster diverge, or both agree at a wrong screen position | `Raw target` / `Upright target` and `Raw framebuffer` / `Upright framebuffer` each compare both axes with the same fixed top-origin coordinate for that mode | Physical-to-display mapping and raster position converge on independently tabulated values. Those Raw and Upright positions are complementary on both visible axes. Agreement between two wrong outputs cannot pass the fixed checks. | Removed after C failed at the fixed physical-display reference. |

## Fixed physical references

The film measures 127 × 101.6 mm. The keeper tests the physical film-plane projection, configured RTT camera projection, source-to-film mapping, both raster and physical display mappings, and the crop position in both modes. A 4× crop also checks its physical size of 31.75 × 25.4 mm. The expected coordinates are literal fixture data.

| Reference point | Canonical film UV and expected source UV | Raw visible UV | Upright visible UV | Top-origin source crop UV, both modes | Film X, Y (mm) |
| --- | --- | --- | --- | --- | --- |
| Off-center upper-left | (0.17, 0.28) | (0.83, 0.28) | (0.17, 0.72) | (0.17, 0.72) | (−41.91, 22.352) |
| Off-center upper-right | (0.82, 0.21) | (0.18, 0.21) | (0.82, 0.79) | (0.82, 0.79) | (40.64, 29.464) |
| Off-center lower-left | (0.23, 0.79) | (0.77, 0.79) | (0.23, 0.21) | (0.23, 0.21) | (−34.29, −29.464) |
| Off-center lower-right | (0.76, 0.84) | (0.24, 0.84) | (0.76, 0.16) | (0.76, 0.16) | (33.02, −34.544) |
| Noncentral interior | (0.37, 0.61) | (0.63, 0.61) | (0.37, 0.39) | (0.37, 0.39) | (−16.51, −11.176) |

## Negative controls

Each mutation ran in a detached disposable worktree of `97651a38a16026e3f237ca54f4a428ea48db27eb`. Only one production file was changed per run. The keeper and expected values were byte-for-byte identical to the base and final feature. Actuals below are rounded for readability.

| Control | Modified production function and injected defect | First failing keeper assertion | Keeper result | Cleanup |
| --- | --- | --- | --- | --- |
| A | `src/render/groundGlassRttOrientation.ts`, `resolveGroundGlassRttDisplayTransform`. Set only Raw `flipDisplayX` to `false`. | Upper-left `Raw framebuffer u`, actual 0.17 vs fixed 0.83 (line 111). | 1 failed, 2 filtered out, exit 1 | Original bytes restored and diff against HEAD empty. |
| B | `src/render/groundGlassRttOrientation.ts`, `mapGroundGlassRttTextureUvToCanonicalFilmUv`. Return `1 - textureUv.v` on V only. | Upper-left `sampler-to-film mapping v`, actual 0.72 vs fixed 0.28 (line 97). | 1 failed, 2 filtered out, exit 1 | Original bytes restored and diff against HEAD empty. |
| C | `src/render/groundGlassTargetProjection.ts`, `mapPhysicalFilmUvToGroundGlassDisplayUv`. In Upright only, return the physical V without inversion. The RTT sampler was left intact. | Upper-left `Upright target v`, actual 0.28 vs fixed 0.72 (line 114). | 1 failed, 2 filtered out, exit 1 | Original bytes restored and diff against HEAD empty. |

The exact command for each keeper control and the restored control was:

```bash
npm run test -- --run src/tests/unit/groundGlassCoordinateContract.test.ts \
  -t 'matches fixed asymmetric film, sampler, display, and source-crop references'
```

For a direct comparison, each fault was also rerun against the corresponding original declaration via `npm run test -- --run src/tests/unit/groundGlassRttOrientation.test.ts -t '<original declaration>'`, substituting the exact case title from the matrix. A failed on original point A Raw U (0.2 vs 0.8), B on point A physical V (0.8 vs 0.2), and C on point A Upright raster/overlay V correspondence (0.8 vs 0.2). Each run reported one failure, five filtered cases and exit 1. The production diff was again empty after each restoration.

After restoration the same keeper command passed (1 passed, 2 filtered out, exit 0). The two filtered cases are the distinct pan/clamp and shifted-coverage cases. The baseline and final unfiltered targeted runs also exercised them.

## Validation and measured scope

Node 24.3.0 and Vitest 3.2.7 on the same local macOS host. The baseline test and implementation files matched the base commit. The final targeted run used the three declaration deletions and the removal of their now-unused in-file helper and fixture.

| Target | Before pass / fail / skip | After pass / fail / skip |
| --- | --- | --- |
| `groundGlassCoordinateContract.test.ts` | 3 / 0 / 0 | 3 / 0 / 0 |
| `groundGlassRttOrientation.test.ts` | 6 / 0 / 0 | 3 / 0 / 0 |
| Total | 9 / 0 / 0 | 6 / 0 / 0 |

The targeted Vitest durations were 1.23 s before and 0.844 s after, with 12 ms reported for test execution in both runs. An intermediate run that overlapped with discovery took 1.70 s. These observations do not establish a stable performance effect. `RUNTIME_SAVING_NOT_ESTABLISHED`.

Full Vitest discovery was measured with `./node_modules/.bin/vitest list --json /private/tmp/vcs-c1-baseline-discovery.json` at base and the same command with `/private/tmp/vcs-c1-final-discovery.json` after consolidation. Discovery changed from 359 files / 4,504 cases to 359 files / 4,501 cases. Comparing repository-relative file paths and full case names found exactly the three listed deletions and no other differences.

Three declarations removed, zero added. The test-source delta is −72 lines (63 declaration and separating lines, 9 in-file support lines). Separate support files and production code each have zero changed lines. Both test paths remain registered under `ground-glass-coordinates`, which remains in `coreRegressionOwnerIds`. Test-source changes still select full Vitest in Local Affected mode. The coordinate owner's `groundglass-interaction.spec.ts` requirement and existing GitHub browser and full Vitest checks retain their configured paths.

Retained contracts include the shifted/rise configured RTT camera's canonical film-local mapping, the 60 mm Architecture Rise physical-side and coverage-gain test, and the large-frame Focus Fundamentals camera and surface/corner assertions. The independent five-point test and the separate pan/clamp and shifted display/crop coverage cases remain. All three candidates had equivalent coverage for the orientation fault classes above.

Commands for the baseline and final targeted run, adjacent checks, full Local CI and source validation:

```bash
npm run test -- --run src/tests/unit/groundGlassCoordinateContract.test.ts \
  src/tests/unit/groundGlassRttOrientation.test.ts
npm run test -- --run src/tests/unit/groundGlassFilmPlaneProjection.test.ts \
  src/tests/unit/groundGlassFootprintCoordinates.test.ts \
  src/tests/unit/groundGlassPhysicalGrid.test.ts \
  src/tests/unit/groundGlassPhysicalScale.test.ts
npm run lint
npm run typecheck
npm run ci:local
npm run ci:local -- --workers=4
git diff --check
git status --short
```

The four adjacent files passed all 21 cases. The default-worker full Local CI run passed CSS, lint and typecheck, then reported 4,501 passing cases and a Vitest worker RPC timeout. It exited 1 before the build. The four-worker retry uses the same full suite. GitHub Full CI provides the authoritative PR check, including its configured browser checks.

## Independent preservation review

The independent reviewer inspected the original and retained declarations, the code diff, the coordinate owner map, and GitHub workflow configuration. They confirmed independent fixed expectations for both axes and both display modes, separate canonical and visible-origin assertions, and preservation of the three scene cases and two separate crop/coverage cases. The recorded mutations reached the expected keeper assertions. The reviewer found no declaration to restore and identified completion of this report and current-head GitHub CI as the remaining checks at review time.

## Rollback

Revert the C1 commit. To restore one contract, recover its original declaration and the fixture/helper it uses from the base revision. Then rerun both targeted files and repeat the matching negative control. The named coverage and geometry owners and CI configuration require no rollback.
