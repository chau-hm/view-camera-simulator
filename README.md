# View Camera Simulator

A web-based interactive simulator for learning the optics and camera movements of a large-format view camera.

## Why build a view camera simulator?

Modern cameras are incredibly capable. Features such as autofocus, automatic exposure and digital perspective correction solve many photographic problems with a single click.

As a result, many of the underlying optical principles become almost invisible.

A view camera exposes those principles.

Every movement has a visible consequence. Raising the lens changes composition without tilting the camera. Tilting the lens rotates the plane of focus. Swing changes focus across depth. Nothing happens automatically—the photographer controls the geometry directly.

This simulator was created to make those relationships easy to understand through interactive visualization.

## Isn't Photoshop enough?

Software can correct many problems after a photograph has been taken, but it does so by transforming an existing image.

A view camera changes how the image is formed in the first place.

Consider photographing a tall building from a narrow street.

With a conventional camera, the photographer often tilts the camera upward, causing vertical lines to converge. The image is then corrected later by stretching and cropping.

With a view camera, the camera body remains level while the lens is raised (rise). The building moves upward within the frame while the vertical lines remain parallel. The desired perspective is created during capture instead of reconstructed afterward.

Another example is photographing a long table or a row of products extending into the distance.

Instead of relying on an extremely small aperture or focus stacking, the lens can be tilted so that the plane of focus follows the surface of the table, allowing much more of the subject to appear sharp in a single exposure.

Photoshop is an excellent editing tool, but some optical decisions are simpler—and sometimes only possible—when they are made before the shutter is released.

## Why do artists still use view cameras?

The answer is rarely nostalgia.

Many photographers continue using view cameras because they offer a fundamentally different creative process.

Every photograph is intentional. Composition, focus and camera movements are considered carefully before exposure. The ground glass provides direct visual feedback, revealing how optical changes affect the final image.

The camera becomes more than a recording device—it becomes a tool for thinking about perspective, geometry and focus.

Many artists value that experience as much as the finished photograph.

## Project goals

The simulator aims to make concepts that are normally hidden inside modern cameras visible and interactive.

Current goals include:

* Interactive 3D scene visualization
* Ground glass image simulation
* Real-time Rise / Shift / Tilt / Swing movements
* Perspective visualization
* Plane of focus visualization
* Depth of field visualization
* 2D geometric diagrams
* Educational explanations alongside interactive demonstrations

Rather than teaching users to operate a specific camera model, the project focuses on helping them understand the optical principles shared by all view cameras.

If the simulator helps someone say **"Now I finally understand what tilt actually does."**, then it has achieved its purpose.

## MVP Scope

Included:

* Front rise, tilt, swing
* Focus and aperture controls
* Guided learning tasks + free practice mode
* Synchronized updates across 2D/3D/ground-glass views

Not included in MVP:

* Rear movements (rear rise/tilt/swing/shift)
* Front fall/shift
* User accounts, cloud persistence, multiplayer
* Photorealistic or ray-traced optical rendering

## Tech Stack

* TypeScript
* React
* Vite
* Three.js + React Three Fiber
* Zustand
* Vitest + Playwright

## Documentation

* `doc/PRD.md` — product requirements
* `doc/SDD.md` — system design
* `doc/Spec.md` — execution specification
* `doc/TASK_INVENTORY.md` and `doc/ATOMIC_TASK_INVENTORY.md` — implementation tasks

## Development

```bash
npm install
npm run dev
```

### Scripts

* `npm run dev`
* `npm run build`
* `npm run lint`
* `npm run typecheck`
* `npm run test`
* `npm run test:watch`
* `npm run test:e2e`
* `npm run ci:local` (lint + typecheck + test + build)
* `npm run ci:local:e2e` (`ci:local` + Playwright E2E)

## CI/CD and GitHub Pages deployment

This repository includes `.github/workflows/pages.yml`:

* CI on pull requests and pushes to all branches (`lint`, `typecheck`, `test`)
* CD on pushes to the repository default branch (build + deploy to GitHub Pages)

Deployment uses the repository name as the Vite base path and publishes `dist/` to Pages.
For SPA deep-link fallback on GitHub Pages, the workflow also copies `dist/index.html` to `dist/404.html`.

### Run CI checks locally

To run the CI-style checks before pushing:

```bash
npm run ci:local
```

To include Playwright E2E checks as well:

```bash
npm run ci:local:e2e
```
