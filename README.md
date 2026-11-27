# View Camera Simulator

View Camera Simulator is a web-based interactive learning tool for
understanding large-format view-camera movements, focusing, viewpoint,
framing, perspective geometry, and plane-of-sharp-focus control. Learners
compare changes through an interactive 3D scene, the Ground Glass, 2D
geometry, and learner readouts.

The simulator is an instructional visualization rather than a physically exact
camera model or a ray tracer. Its purpose is to make important photographic
relationships observable and comparable.

## What it teaches

The simulator separates four relationships that are often bundled together:

- **Viewpoint** — moving the whole camera changes the physical position from
  which the subject is observed. It may change perspective relationships,
  parallax, and which subject surfaces are visible.
- **Framing** — where the subject appears in the image or Ground Glass.
  Front or Rear standard translation can change framing without relocating
  the whole-camera viewpoint. Rise and Shift primarily demonstrate this
  framing control while the viewpoint remains fixed.
- **Perspective geometry** — the projected relationships visible in the
  image. Viewpoint changes and film-plane orientation can affect this geometry,
  while a framing change alone does not automatically mean that perspective
  changed.
- **Plane of sharp focus** — the plane rendered sharply by the simulator's
  instructional optics model. Front Tilt and Front Swing rotate lens-plane
  orientation to control this plane; it is not the same as depth of field.

The broader practice is **perspective control**, not a promise that every
movement performs a universal “perspective correction.” Whole-camera movement,
Front-standard movement, and Rear-standard movement are taught as different
physical actions. Front and Rear focusing are compared separately. Rear
angular movement changes the film-plane relationship and can alter projected
geometry as well as focus-plane relationships.

See [the canonical learning model](docs/LEARNING_MODEL.md) for the complete
pedagogical and terminology reference.

## Learning experience

The simulator has two scene-specific modes:

- **Free Practice** is exploratory. It provides scene-aware teaching guidance,
  live observations, and learner readouts without a scored task. The anatomy
  entry uses this route for its explanatory Lesson 0 walkthrough.
- **Guided Task** provides an explicit objective, requirements, allowed
  controls, live criterion feedback, and a completion summary. Guided Tasks
  are available only for the scenes listed below that support them. Some
  scenes group several Guided Tasks into a staged guided lesson.

The application currently supports English (`en`) and Hong Kong Traditional
Chinese (`zh-HK`). The Language Selector is available in both the normal site
header and the simulator header, and the locale preference persists while
navigating. Translated learner-facing content is presentation-only; routes,
scene IDs, task IDs, and evaluator facts remain locale-neutral. See the
[internationalization contract](docs/I18N.md) for details.

That contract uses `大片幅相機` for large-format camera, `相機移軸` for
camera movements, and `整部相機移動` for whole-camera movement. Generic
Front/Rear standard adjustment remains `調整前組／後組`, while Front/Rear
focusing remains `前組／後組對焦`.

## Teaching scenes

The public catalog currently presents these scenes in learning-domain groups.
Within each group, scenes follow the canonical catalog order:

| Group | Scene | Learning purpose | Available mode(s) |
| --- | --- | --- | --- |
| Foundations | **Lesson 0 — Meet the View Camera** | Identify the major physical parts of a conceptual view camera and connect the controls to those parts. | Free Practice (anatomy lesson) |
| Foundations | **Understanding Camera Movements** | Understand how whole-camera movement and Front/Rear standard movements affect viewpoint, framing, perspective geometry and the Ground Glass image. | Free Practice |
| Foundations | **Focus Fundamentals — Two Targets** | Understand how Front and Rear focusing differ when focusing across two depths of the same object. | Free Practice |
| Core Movements | **Architecture Rise** | Understand how Front Rise changes framing while a level camera keeps verticals parallel. | Free Practice + Guided Task (`rise-01`) |
| Core Movements | **Table Tilt** | Understand how Front Tilt changes the plane of sharp focus across subject depth. | Free Practice + Guided Task (`tilt-01`) |
| Core Movements | **Shelf Swing** | Understand how Front Swing changes the plane of sharp focus across subjects arranged diagonally in depth. | Free Practice + Guided Task (`swing-01`) |
| Core Movements | **Mirror Shift** | Understand how Front Shift can restore framing without restoring the original viewpoint or parallax. | Free Practice + Guided Task (`mirror-shift-01`) |
| Combined Movements | **Oblique Tabletop** | Understand why an inclined subject plane needs both Tilt and Swing components to align the plane of sharp focus. | Free Practice + Guided Task |
| Combined Movements | **Oblique Architecture** | Combine Front Rise and Front Swing to frame an oblique building while keeping verticals parallel and the receding façade sharp. | Free Practice + Guided Task |
| Combined Movements | **Architecture + Foreground** | Frame level architecture while using foreground depth to study focus-plane alignment and depth of field. | Free Practice + Guided Task |
| Combined Movements | **Interior Corner — Rise + Swing** | Use Front Rise for level composition, then Front Swing, Focus, and Aperture to study a receding wall. | Free Practice + Guided Task |

The catalog and its public order are defined in
[`src/app/publicScenes.ts`](src/app/publicScenes.ts). Scenes with a staged
guided lesson expose their current sequence through that catalog; this table
intentionally omits the detailed task registry.
The future Macro Photography group remains hidden until it has a published scene.

## Current scope

The current learner-facing scope includes:

- whole-camera viewpoint movement and its perspective/parallax consequences;
- a conceptual Front and Rear standard model, with public controls exposed by
  lesson: Front Rise, Front Shift, Front Tilt, and Front Swing where relevant;
- Front/Rear Tilt and Front/Rear Vertical Framing comparisons in Understanding
  Camera Movements, plus Front/Rear focusing in Focus Fundamentals;
- Mirror Shift's comparison of whole-camera lateral position and Front Shift;
- focus and aperture controls where a scene exposes them, including the fixed
  f/32 comparison in Focus Fundamentals;
- plane-of-sharp-focus and depth-of-field visualization using instructional
  optical calculations and circle-of-confusion-based sharpness/blur feedback;
- Ground Glass raw/upright inspection, zoom/pan interaction, and aperture-
  dependent relative illuminance in the render-to-texture scenes;
- teaching lighting, shadows, and focus-friendly surface detail that keep
  movement and focus differences observable in the 3D scenes;
- synchronized 3D scene, Ground Glass, 2D geometry, and learner-readout views;
- finite simulator lens coverage shown as an Image Circle on a parallel film
  plane or as a Coverage Footprint on a tilted film plane; Rise/Shift and Macro
  extension demonstrate how framing uses that coverage;
- exploratory Free Practice and scene-specific Guided Tasks.

Coverage is a lens property separate from focal length. The published 90, 105,
120, and 150 mm simulator teaching profiles share an approximately 217.963 mm
infinity reference Image Circle by design; those angles are not manufacturer
data, and unknown focal lengths still use an unbounded compatibility fallback.
Natural-illumination falloff is separate from finite coverage. See
[the learning model](docs/LEARNING_MODEL.md)
and [the current optics architecture](docs/SDD.md#91-lens-specification-and-coverage-contract)
for the full teaching and implementation contracts.

The underlying camera model contains more state than any one public lesson
exposes. The public catalog is therefore not a claim that every mechanical
movement of every real view-camera design is available in every scene.

The simulator does not attempt to reproduce every mechanical movement of every
real view-camera design. It also does not model a specific camera brand,
provide photorealistic or physically exact ray-traced optics, or provide user
accounts, cloud persistence, or multiplayer features.

## How the simulator works

- React and TypeScript provide the application and learning surfaces.
- Three.js and React Three Fiber provide the interactive 3D visualization.
- A shared camera and scene state drives the 3D scene, Ground Glass, 2D
  geometry, learner readouts, and Guided Task evaluation.
- The Ground Glass reflects the current camera and scene state through the
  simulator's render-to-texture pipeline, including the current focus and
  aperture-dependent presentation.
- 2D geometry diagrams expose the relationships being taught.
- Zustand holds simulator state, while the task and evaluation layer powers
  Guided Tasks.
- i18next and react-i18next provide the English and `zh-HK` presentation
  layer.

## Tech stack

- TypeScript
- React
- Vite
- Three.js and React Three Fiber
- Zustand
- i18next and react-i18next
- Vitest
- Playwright

## Documentation map

### Current references

- [README.md](README.md) — current project orientation and capabilities.
- [docs/LEARNING_MODEL.md](docs/LEARNING_MODEL.md) — canonical current
  pedagogical model and terminology.
- [docs/I18N.md](docs/I18N.md) — current localization architecture and
  `zh-HK` terminology contract.
- [AGENTS.md](AGENTS.md) — repository-level coding-agent and workflow rules.
- [docs/AI_AGENT_WORKFLOW.md](docs/AI_AGENT_WORKFLOW.md) — proportional
  coding-agent workflow and review handoff guidance.
- [src/app/publicScenes.ts](src/app/publicScenes.ts) — current public scene
  catalog, order, modes, and Guided Task IDs.

### Historical MVP planning

- [docs/PRD.md](docs/PRD.md)
- [docs/SDD.md](docs/SDD.md)
- [docs/Spec.md](docs/Spec.md)
- [docs/TASK_INVENTORY.md](docs/TASK_INVENTORY.md)
- [docs/ATOMIC_TASK_INVENTORY.md](docs/ATOMIC_TASK_INVENTORY.md)

These documents preserve the original MVP v0.1 baseline. They are historical
records, not current product specifications; use the README and current
references above for present-day orientation.

### Specialized references

- [docs/SHELF_SWING.md](docs/SHELF_SWING.md) — specialized Shelf Swing scene,
  calibration, route, and rendering note.
- [docs/UNDERSTANDING_CAMERA_MOVEMENTS_PROVISIONAL_CALIBRATION.md](docs/UNDERSTANDING_CAMERA_MOVEMENTS_PROVISIONAL_CALIBRATION.md)
  — provisional instructional calibration record for the camera-movement
  comparison scene.

## Development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run check:css
npm run test
npm run test:watch
npm run test:e2e
npm run ci:local
npm run ci:local:e2e
npm run preview
```

## Testing

The project uses Vitest for unit and integration tests and Playwright for
browser end-to-end tests. `npm run ci:local` runs the local lint, typecheck,
CSS structure, test, and build checks. `npm run ci:local:e2e` adds the
Playwright suite.

## CI/CD and deployment

The [Pages workflow](.github/workflows/pages.yml) runs CI for pull requests
and pushes to branches. Its CI job runs lint, type-check, and unit/integration
tests. `main` is the development and integration branch.

Production deployment occurs only after a push to `production`. The release
process merges the intended reviewed `origin/main` state into that deployment
branch from an isolated worktree; `main` must remain production-releasable. CI
must pass before the GitHub Pages deploy job runs. Use the repository's
promotion checks for a release:

```bash
npm run promote:preflight
npm run promote:production
```

The Pages build uses the repository-name base path and copies `dist/index.html`
to `dist/404.html` for SPA deep-link fallback.

### Pages artifact pilot

The separate manual `Pages artifact pilot (non-publishing)` workflow builds a
candidate from its selected workflow revision. It has read-only repository
permissions and cannot deploy or update production. A candidate from a feature
branch is not a main release, and a successful pilot is neither ordinary CI nor
cumulative release qualification. Main integration still does not deploy; the
existing production promotion and its checks remain the only active release path.

With Node 24, installed dependencies, a clean committed tree, and no `VITE_*`
or conflicting `NODE_ENV` overrides, prepare and verify a candidate locally:

```bash
node scripts/pages-artifact.mjs prepare /tmp/pages-candidate
node scripts/pages-artifact.mjs pin /tmp/pages-candidate /tmp/pages-identity.json "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})"
VCS_PAGES_ARTIFACT=/tmp/pages-candidate/payload npm run test:e2e -- --config=playwright.pages-artifact.config.ts --project=chromium-pages-artifact --workers=1
node scripts/pages-artifact.mjs verify-pinned /tmp/pages-candidate /tmp/pages-identity.json "$(git rev-parse HEAD)" "$(git rev-parse HEAD^{tree})"
```

The destination must not already exist. Preparation runs the checked build
(`tsc -b` and one Vite production bundle) with the repository-name base, then
copies `index.html` to `404.html`. Preview serves the existing payload and does
not build. Its server serves the fallback body for deep links; a dedicated browser test
requests the HTTP 404 response Pages uses. Existing root-based renderer tests
are redirected to the subpath and use a successful SPA fallback response. Existing root
Preview coverage remains independent. This server is a focused test harness,
not a complete GitHub Pages hosting emulator. Before Preview, the pilot pins
the complete manifest SHA-256, source and tree, schema, base, payload digest,
file count and size in a separate file outside the candidate. After Preview it
recomputes and compares all identities before upload. This detects accidental
mutation, including a coordinated manifest and payload replacement; it does
not defend against a compromised runner controlling the pin itself. Its JSON
result records content integrity, not release authorization.

The version 1 manifest is outside the public payload. It records source commit
and tree, build configuration, Node and lockfile identity, optional run
identity, and sorted regular-file paths, sizes and SHA-256 hashes. The content
digest is SHA-256 of the UTF-8 JSON serialization of that file array. It does
not hash itself or transport archive metadata. The verifier rejects content,
source, schema, and unsupported filesystem-entry mismatches. The manifest is a
producer claim: a future deployment gate must independently check the trusted
repository, exact source/tree, producing run and attempt, successful relevant
jobs and cumulative qualification, and compare the verified content after
safe extraction. Reject traversal, links, unexpected entries, missing or expired
artifacts, and any digest mismatch before deployment; never rely on an artifact
name or an upload/download warning as authorization.

The pilot uploads only the candidate directory with hidden files included,
so `.nojekyll` and files inside `.well-known` are retained. Other hidden entries,
environment files, credential names, private-key extensions, links and other
unsupported types are rejected;
the candidate root allows only the payload, manifest and validation metadata.
After upload the pilot downloads that artifact ID into a fresh directory and
compares its manifest and complete contents with the original pin. The focused
integrity and workflow-contract tests also run in ordinary `npm run test`.

GitHub Actions retains `pages-candidate-<run-id>-<attempt>` for 30 days.
Retention is finite and does not provide rollback storage. After this workflow is
merged to the default branch, dispatch **Pages artifact pilot (non-publishing)**
from Actions on `main` (or run `gh workflow run pages-artifact-pilot.yml --ref main`),
then inspect its source/tree, pin, Preview, upload and fresh-download verification,
result, and lack of deployment. The pilot is not a release authorization. Main-CI integration is deferred until the separate CI
routing work stabilizes. Until then this pilot adds a separate build; it does
not reduce the existing production CI or establish a deployable release.

### Trusted artifact preflight

Release B provides a **non-publishing** preflight for an explicitly selected
source, successful main CI run and attempt, successful artifact-pilot run and
attempt, and retained artifact ID. It neither deploys nor performs cumulative
production release qualification. With Node 24, Python 3, authenticated `gh`
with read access to repository contents and Actions, and a freshly fetched
`origin/main`, run:

```bash
git fetch origin
node scripts/release-artifact-preflight.mjs \
  <source-commit-sha> <ci-run-id> <ci-attempt> \
  <producer-run-id> <producer-attempt> <artifact-id>
```

Standard output is a JSON result; standard error provides the operator summary
or a failure reason. A successful result is `RELEASE_PREFLIGHT_VERIFIED`,
`RELEASE_QUALIFICATION_PENDING`, `NOT_DEPLOYED`. An unsuccessful preflight
returns nonzero. No application build or production ref change takes place.

The policy checks the canonical repository, authoritative main ancestry, exact
source tree and pinned reviewed workflow definitions, exact run IDs, attempts,
events, branches, required job and step conclusions. Workflow IDs and Git blob
identities are intentionally narrow; an independently reviewed policy update is
required when those workflows change. Successful jobs and main source history
are trusted; this is not protection against a compromised GitHub service,
runner or authorized modification of source and supporting scripts.

The selected artifact must be unexpired and associated with the producer run.
The producer's successful job log must bind its artifact ID to both the original
pre-Preview identity and retained identity. The downloaded archive must match
GitHub's exact size and SHA-256; a bounded temporary extraction rejects unsafe
paths, duplicate paths, links and unsupported entries. The Release A verifier
then compares the entire retrieved candidate with the **original logged pin**,
including source, tree, manifest and payload digests; it checks validation
metadata, producing run/attempt and the source lockfile. Staging is removed on
completion. Missing logs, expired artifacts, inaccessible runs, changed workflow
policy, main movement during verification, and any identity mismatch fail closed.
Actions artifact retention is
finite; this preflight is not rollback storage, cross-run deployment or release
approval. Production continues to use the existing isolated promotion path.

Archive names are preserved exactly, but before creating the extraction
directory the extractor compares every file and directory prefix using Unicode
NFD, case folding, and NFD again. It rejects aliases rather than renaming them,
including file/directory collisions and differing case or Unicode spellings of
the same directory. As a conservative Windows-compatible subset it also rejects
reserved device names, colon and other forbidden punctuation, and trailing dots
or spaces. This policy covers those portability hazards; it does not claim to
model every filesystem's naming rules. Archives remain bounded to 10,000 entries,
512 MiB expanded, and 128 MiB transport, with regular files only.

Each required job must belong to the selected run, attempt and source, and all
required steps must have succeeded within that attempt. A partial rerun without
complete attempt-specific evidence is rejected rather than reconstructed from
other attempts. The current policy accepts one explicitly reviewed set of
workflow versions. Before Release D production cutover, a separately reviewed
integration must define compatibility for multiple reviewed workflow contract
versions so newer CI routing can be accepted without unnecessarily excluding
eligible retained artifacts from older contracts. Never accept new workflow
versions merely because they are current. The currently reviewed Git blob pins
are `37490702733b5130bd9ec125e0d41102751ed004` (Pages CI),
`3a449d8f6f896c2cc38252209362daa0778dc6d6` (historical qualification), and
`94b7feb1e0370ac020b24103f581dbc03a2f6643` (artifact pilot).
