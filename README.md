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
  live observations, and learner readouts without a scored task.
- **Guided Task** provides an explicit objective, requirements, allowed
  controls, live criterion feedback, and a completion summary. Guided Tasks
  are available only for the scenes listed below that support them.

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

The public catalog currently presents these scenes in this order:

| Scene | Learning purpose | Available mode(s) |
| --- | --- | --- |
| **Understanding Camera Movements** | Compare whole-camera viewpoint changes with Front and Rear standard movements and observe their effects on framing, perspective geometry, and the Ground Glass image. | Free Practice |
| **Focus Fundamentals — Two Targets** | Compare Front and Rear focusing across two depths of the same object. | Free Practice |
| **Architecture Rise** | Use Front Rise to change framing while a level camera keeps the scene's verticals parallel. | Free Practice + Guided Task (`rise-01`) |
| **Table Tilt** | Use Front Tilt to change the plane of sharp focus across subject depth. | Free Practice + Guided Task (`tilt-01`) |
| **Shelf Swing** | Use Front Swing to change the plane of sharp focus across subjects arranged diagonally in depth. | Free Practice + Guided Task (`swing-01`) |
| **Mirror Shift** | Use Front Shift to restore framing without restoring the original viewpoint or parallax. | Free Practice + Guided Task (`mirror-shift-01`) |

## Current scope

The current learner-facing scope includes:

- whole-camera viewpoint movement and its perspective/parallax consequences;
- Front and Rear standard comparisons, including Front and Rear focusing;
- Front Rise, Front Tilt, Front Swing, and Front Shift;
- Rear Tilt in the camera-movement comparison lesson;
- Front/Rear vertical-framing comparison;
- focus and aperture controls where a scene exposes them, including the fixed
  f/32 comparison in Focus Fundamentals;
- plane-of-sharp-focus and depth-of-field visualization;
- synchronized 3D scene, Ground Glass, 2D geometry, and learner-readout views;
- exploratory Free Practice and scene-specific Guided Tasks.

The simulator does not attempt to reproduce every mechanical movement of every
real view-camera design. It also does not model a specific camera brand,
provide photorealistic or physically exact ray-traced optics, or provide user
accounts, cloud persistence, or multiplayer features.

## How the simulator works

- React and TypeScript provide the application and learning surfaces.
- Three.js and React Three Fiber provide the interactive 3D visualization.
- The Ground Glass reflects the current camera and scene state through the
  simulator's render-to-texture pipeline.
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
test, and build checks. `npm run ci:local:e2e` adds the Playwright suite.

## CI/CD and deployment

The [Pages workflow](.github/workflows/pages.yml) runs CI for pull requests
and pushes to branches. Its CI job runs lint, type-check, and unit/integration
tests. `main` is the development and integration branch.

Production deployment occurs only after a push to `production`. The release
process merges the intended reviewed `main` state into that deployment branch;
CI must pass before the GitHub Pages deploy job runs. The Pages build uses the
repository-name base path and copies `dist/index.html` to `dist/404.html` for
SPA deep-link fallback.
