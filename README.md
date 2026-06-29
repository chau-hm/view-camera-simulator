# View Camera Simulator

View Camera Simulator is a browser-based learning tool for understanding large-format camera front-standard movements.

This MVP focuses on:

- 2D geometry diagrams
- simple 3D scene and ground-glass preview
- interactive **rise**, **tilt**, and **swing**
- focus-plane and illustrative depth-of-field feedback

## Project Status

Foundation (`FND-*`) bootstrap is now in place:

- React + TypeScript + Vite app scaffold
- ESLint + Prettier setup
- Zustand store baseline
- minimal React Three Fiber scene viewport
- app routes for Home / Mode / Simulator / Result / fallback
- WebGL and scene-load fallback states

Product/design specs remain under `doc/`.

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

## Tech Stack

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

## Development

```bash
npm install
npm run dev
```

### Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run test:e2e`

## Next Steps

1. Continue with `STA-*` and `OPT-*` deeper implementation.
2. Increase geometry/optics correctness to match full Spec equations.
3. Replace placeholder scene assets/rendering with task-scene content.
4. Expand integration and E2E coverage.
