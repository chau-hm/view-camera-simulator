# Stage 2J-A development fixture

This fixture is **NOT A PUBLIC SCENE**. Do not use it as a lesson or catalog
entry.

Start the Vite development server and open:

```text
http://localhost:5173/__dev/fringe-club-rtt?sceneCapacityProfiling=1&rttDiagnostics=1
```

When using a non-root Vite base path, include that base prefix before the route.
Use **Load source asset** to mount the Observer instance and the real Ground
Glass RTT instance from one Stage 2H source. Toggle either instance checkbox to
exercise independent instance leases. **Release source asset** releases the
owner and all mounted instances.

The RTT camera, lighting, render targets, and shader passes belong to the
existing Architecture Rise-backed `GroundGlassRTT` pipeline. Its reference
camera comes from the Architecture Rise scene definition and default camera
preset. Fringe placement is a fixed development presentation transform at scale
1; it does not change simulator state or scene calibration.

Both the route and the profile override are guarded by the Vite development
condition. There is no product navigation link or public scene identity.
