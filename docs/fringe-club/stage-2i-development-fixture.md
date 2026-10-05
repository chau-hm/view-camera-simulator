# Stage 2I development fixture

This is a development-only runtime integration check. It is **NOT A PUBLIC
SCENE** and must not be used as a lesson or catalog entry.

Run Vite with the repository's default base path, then open:

```text
http://localhost:5173/view-camera-simulator/__dev/fringe-club
```

The fixture has no link from normal product navigation. Use **Load source asset**
to fetch and parse the Stage 2H GLB. Use the A/B checkboxes to mount zero, one, or
two independently owned instances; **Release source asset** cancels an in-flight
load or releases the current source and instances. The fixture reports its
asset-owned leases and resources alongside `renderer.info` counts.

The route only exists when Vite's development condition is true. The asset URL is
resolved through `publicAssetUrl`, so it follows the configured Vite base path.
Production builds do not include the development route.

The fixture uses a React/R3F Canvas with the application's render-quality,
presentation-lighting, shadow-participation, scene-asset registry, registered
factory, and disposer paths. It has its own presentation-only camera and does not
mount canonical simulator state or Ground Glass RTT. Placement uses scale 1 and
metre units. A and B keep stable symmetric horizontal offsets even when only one
is visible; the preview camera follows that instance. Toggling the other
instance therefore does not recreate the remaining registered object.
