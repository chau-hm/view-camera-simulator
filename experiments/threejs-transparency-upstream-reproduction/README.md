# Three.js transparency reproduction

This fixture contains two independent browser entries:

- `shared/index.html` is the pure stock reproduction. It uses only the pinned Three.js package's `WebGLRenderer`, `WebGPURenderer`, `MeshBasicMaterial`, and `MeshStandardMaterial` APIs.
- `shared/adapter.html` adds a separately loaded, minimal copy of the Camera Simulator's material-aware `NodeMaterial.setupOutput()` transform. It is a comparison control, not part of the upstream reproduction.

The Three.js versions are isolated in `versions/r184`, `versions/r185`, and `versions/r186`; each has an exact dependency and lockfile. The runner starts one Vite server/version at a time, resolves imports to that version's `build/` files, and opens fresh browser contexts and renderers. A native-WebGPU request fails if its canvas context is actually WebGL2 fallback.

## Run

Use Node.js 20 or newer and a Chrome installation with WebGPU enabled. From the repository root:

```bash
npm ci --prefix experiments/threejs-transparency-upstream-reproduction
npm ci --prefix experiments/threejs-transparency-upstream-reproduction/versions/r184
npm ci --prefix experiments/threejs-transparency-upstream-reproduction/versions/r185
npm ci --prefix experiments/threejs-transparency-upstream-reproduction/versions/r186
npm run test --prefix experiments/threejs-transparency-upstream-reproduction
```

The short initialization smoke is `npm run test:smoke --prefix experiments/threejs-transparency-upstream-reproduction`.

The browser test compares browser-presentation PNGs. It does not report raw framebuffer values or fragment alpha. Selected screenshots and the expanded run evidence are written under the repository's ignored `test-results/threejs-transparency-upstream-reproduction/` directory. Retained paths use the same version/backend/output/fixture/family/opacity/background identity as the in-memory captures; a duplicate path claim or missing artifact fails the run. Each retained PNG is decoded and compared exactly with the measured capture's pixels. Pure filename and manifest guards can be run without starting the GPU matrix:

```bash
experiments/threejs-transparency-upstream-reproduction/node_modules/.bin/playwright test \
  --config=experiments/threejs-transparency-upstream-reproduction/playwright.config.ts \
  experiments/threejs-transparency-upstream-reproduction/screenshot-identity.spec.ts
```
