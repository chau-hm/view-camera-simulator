# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fringe-club-dev-integration.spec.ts >> Stage 2N-A join probes retain fresh RTT identity through bounded motion
- Location: src/tests/e2e/fringe-club-dev-integration.spec.ts:758:1

# Error details

```
Test timeout of 1200000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "Fringe Club runtime A/B validation — development only" [level=1] [ref=e5]
  - status
  - main [ref=e6]:
    - generic [ref=e7]:
      - note [ref=e8]:
        - strong [ref=e9]: NOT A PUBLIC SCENE.
        - text: Stage 2H remains the current runtime authority. Stage 2N-A is a development candidate only. Camera and focus probes are
        - strong [ref=e10]: DEVELOPMENT_PROBE_ONLY
        - text: ; they are not Fringe Club camera calibration or lesson targets.
      - paragraph [ref=e11]: "Fixed Ground Glass reference: Architecture Rise scene/profile, focal length 150 mm, aperture f/11, standard render quality, raw RTT orientation. The selected diagnostic probe only aligns the asset subject; it does not change VCS optics."
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Runtime candidate
          - combobox "Runtime candidate" [ref=e14]:
            - option "Stage 2H — current authority"
            - option "Stage 2N-A — candidate" [selected]
        - generic [ref=e15]:
          - text: Renderer mode
          - combobox "Renderer mode" [ref=e16]:
            - option "Observer only"
            - option "Ground Glass only"
            - option "Observer + Ground Glass" [selected]
        - generic [ref=e17]:
          - text: Diagnostic probe
          - combobox "Diagnostic probe" [ref=e18]:
            - option "Wyndham — rectangular sash pair"
            - option "Wyndham — segmental window"
            - option "Wyndham — main transom"
            - option "Wyndham — vent/louver close view"
            - option "Wyndham — frieze"
            - option "Lower Albert — timber window"
            - option "Lower Albert — light louver door"
            - option "Lower Albert — dark louver door"
            - option "Entrance — timber window"
            - option "Entrance — paired glazed entry"
            - option "Seam — Wyndham window/frame"
            - option "Seam — Lower Albert louver/frame"
            - option "Seam — entrance frame/glass" [selected]
            - option "Seam — Wyndham sill/frame"
        - generic [ref=e19]:
          - text: Bounded view movement
          - combobox "Bounded view movement" [ref=e20]:
            - option "Center"
            - option "Slight left (40 mm)"
            - option "Slight right (40 mm)" [selected]
            - option "Slight near (40 mm)"
            - option "Slight far (40 mm)"
        - button "Release source asset" [active] [ref=e21]
        - link "Exit development fixture" [ref=e22] [cursor=pointer]:
          - /url: /scenes
      - paragraph [ref=e23]:
        - text: "Probe family:"
        - code [ref=e24]: DOOR_EN_PAIRED_FRAME_GLASS_JOIN
        - text: ". Observer probe lens: 70 mm; target (14.081, -1.03, 6.2137) m. Both candidates receive the same Observer camera, target alignment, Ground Glass optics, viewport, DPR, lighting, tone mapping, and anisotropy."
      - paragraph [ref=e25]: "Motion sample: Slight right (40 mm); the Observer camera shifts by (39.9, 0.0, 2.7) mm, with the matching opposite scene-relative translation in the fixed Ground Glass profile."
      - paragraph [ref=e26]:
        - text: "Selected GLB:"
        - code [ref=e27]: /assets/generated/fringe-club/development/stage-2n-a-candidate.glb
      - status [ref=e28]: Selected Fringe Club source ready
      - generic [ref=e29]:
        - paragraph [ref=e30]: "Observer renderer: WebGL 2; geometries 49, textures 15 (count, not MiB), calls 90, triangles 206932, points 0, lines 0; Fringe meshes 90; max anisotropy 16."
        - paragraph [ref=e31]: Source lifecycle — active source owners 1, Observer/RTT instance leases 2; source geometries 61, material templates 17, textures 16, ImageBitmap backings 14.
        - paragraph [ref=e32]: "stage2n-a loads: requests 2, completed 1, cancelled 1, stale parsed results disposed 0; fetch 74.7 ms, parse 50.7 ms, total 127.4 ms. These are observations, not FPS or GPU-memory claims."
        - paragraph [ref=e33]: Requested anisotropy 4×; applied 4× (Observer renderer maximum 16×).
      - generic [ref=e34]:
        - region "Observer renderer" [ref=e35]:
          - heading "Observer renderer" [level=2] [ref=e36]
        - region "Actual Ground Glass RTT — Architecture Rise reference" [ref=e41]:
          - heading "Actual Ground Glass RTT — Architecture Rise reference" [level=2] [ref=e42]
          - paragraph [ref=e43]:
            - text: "Development probe family:"
            - code [ref=e44]: DOOR_EN_PAIRED_FRAME_GLASS_JOIN
            - text: . Only the registered visual subject translation changes with the selected diagnostic position. Canonical optics and the actual GroundGlassRTT pass graph stay fixed.
          - paragraph [ref=e46]: RTT camera ready; raw contentful true; final contentful true; candidate identity stage2n-a|probe:join-entrance-frame-glass|motion:right; RTT calls 85, triangles 218190, points 0, lines 0; renderer geometries 55, textures 24 (count, not MiB).
      - paragraph [ref=e52]: The Observer and Ground Glass use one selected source owner and, when both are enabled, distinct registered instance roots. The Ground Glass panel mounts the actual GroundGlassRTT component with its VCS camera, pass graph, diagnostics, and cleanup. Renderer counters are per renderer; texture counters are counts, not measured GPU memory.
```