# View Camera Simulator

View Camera Simulator is a browser-based learning tool for understanding large-format camera front-standard movements.

This MVP focuses on:

- 2D geometry diagrams
- simple 3D scene and ground-glass preview
- interactive **rise**, **tilt**, and **swing**
- focus-plane and illustrative depth-of-field feedback

## Project Status

This repository is currently in the planning/scaffold phase.

- Product/design specs are available under `doc/`
- Application source code has not been bootstrapped yet

## MVP Scope

Included:

- Front rise, tilt, swing
- Focus and aperture controls
- Guided learning tasks + free practice mode
- Synchronized updates across 2D/3D/ground-glass views

Not included in MVP:

- Rear movements (rear rise/tilt/swing/shift)
- Front fall/shift
- User accounts, cloud persistence, multiplayer
- Photorealistic or ray-traced optical rendering

## Planned Tech Stack

- TypeScript
- React
- Vite
- Three.js + React Three Fiber
- Zustand
- Vitest + Playwright

## Documentation

- `doc/PRD.md` — product requirements
- `doc/SDD.md` — system design
- `doc/Spec.md` — execution specification
- `doc/TASK_INVENTORY.md` and `doc/ATOMIC_TASK_INVENTORY.md` — implementation tasks

## Next Steps

1. Bootstrap the React + TypeScript + Vite project.
2. Implement core simulation state and optics kernel.
3. Add synchronized 2D, 3D, and ground-glass views.
4. Implement guided tasks and validation tests.
