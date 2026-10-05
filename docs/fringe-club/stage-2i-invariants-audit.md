# Stage 2I integration invariants audit

| Invariant | Result | Evidence |
|---|---|---|
| Imported Stage 2H GLB SHA-256 is authoritative | PASS | `1f15e04fa6161e327d6f4f89f9b011f3b8f41bcf305e7ee2e3a1a127fef93b8e`; manifest and packaged file agree |
| Geometry, scale, units, and coordinate authority are unchanged | PASS | Imported GLB remains metres, +Y up, identity root; R3F root scale is 1 |
| Stage 2F material authority is unchanged | PASS | No color, roughness, material-family, or material-authority edits |
| Stage 2G UV and bake authority is unchanged | PASS | No UV, texture, normal, tangent, or bake edits |
| Stage 2H grouping and mesh authority is unchanged | PASS | The selected GLB is loaded as supplied; no regrouping or geometry rewrite |
| Source images are not rebaked or recompressed | PASS | Seven embedded images are loaded from the verified GLB |
| Public scene catalog and public scene identity are unchanged | PASS | No public scene metadata changes; fixture route is development-gated |
| Guided task and scene publication registries are unchanged | PASS | No task/publication files changed; registry completeness tests pass |
| Canonical simulator and optics state are unchanged | PASS | Fixture has no canonical simulator-state dependency or writes |
| Ground Glass profile/RTT integration is absent | PASS | Fringe Club is not registered in `sceneSubjectRegistry` or RTT profiles |
| FCC content and weathering are absent | PASS | No FCC, weathering, or material-design changes |
| Production startup does not eagerly load the GLB | PASS | Normal-route browser checks and production preview recorded zero GLB requests |
| Registered scene asset factory and disposer are paired | PASS | `fringe-club-runtime-subject` / `threejs-fringe-club-runtime`; React wrapper uses shared registered create/dispose path |
| Source owner reaches final release | PASS | Browser asset counters return to zero; repeated release stays at zero |
| Instance A can be removed while B remains mounted | PASS | Browser test observes B's 32 meshes and sole instance lease after A unmount |
| Renderer-global resources are not disposed by the asset | PASS | Asset disposer releases only tracked asset resources; repeated app renderer counts stabilize |
