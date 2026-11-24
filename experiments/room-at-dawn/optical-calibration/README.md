# Room-at-Dawn optical calibration notes

These scripts analyze existing focus-fixture captures. They do not change the
camera model or the Ground Glass shaders. `analyze-focus-captures.cjs` compares
the v6 hardware Raw and Processed captures, while `analyze-v5-optics.cjs`
re-measures the saved v5 Focus/Tilt/Swing captures.

## Reproduce the offline analysis

From the repository root, using Node 18 or newer:

```sh
node experiments/room-at-dawn/optical-calibration/analyze-focus-captures.cjs \
  /private/tmp/room-focus-stage-hardware \
  /private/tmp/room-focus-raw-hardware \
  /private/tmp/room-focus-calibration-analysis.json

node experiments/room-at-dawn/optical-calibration/analyze-v5-optics.cjs \
  experiments/room-at-dawn/evidence/hdr-optics-v5/optical \
  /private/tmp/room-v5-optics-calibration.json
```

The v6 evidence was captured at commit
`ea4389756e2b59e9e43118504e6599ae8366c4c9` on Chromium 149 / WebGL2 / ANGLE
Metal / Apple M4 Pro. The v5 movement set was captured at commit
`d6439bd5aeaa3f8bcc232e98a070ccc3807edb6c` on Chromium 149 / SwiftShader.
Each report preserves the capture frame IDs and camera settings.

## Measurement contract

- Geometry, focus-plane distance, signed CoC, and footprint radii come from the
  existing canonical fixture diagnostics.
- Edge width is the median of per-row, display-referred RGB8 luma 10–90%
  profiles. A deterministic 2,000-resample bootstrap reports a conditional 95%
  interval over rows.
- An eight-offset horizontal resampling sweep describes sensitivity of the
  captured RGB8 crop. It is not a bound on native renderer pixel-phase effects.
  The reporting floor is 0.25 CSS px, not an optical tolerance.
- A comparison is inconclusive when the bootstrap interval and phase envelope
  do not separate. These metrics do not claim a physical CoC-to-PSF transfer.
- The v6 processed screenshot is the 960×720 same-frame canvas image and the
  Raw screenshot is 480×361. Both are normalized to the recorded 480×360 CSS
  grid for the edge comparison. This is not a native-resolution Raw/Processed
  image comparison. The Raw PNG is captured separately from its readiness
  snapshot: matching request/generation does not prove its exact frame identity.
  The new data must not be described as proving native Raw/Processed parity.
- The CPU aperture-gather reference is not used as a WebGL oracle. The WebGL
  fragment shader and CPU/WebGPU reference differ in footprint-edge smoothing
  and source sampling; exact CPU/GPU forward parity is unproven.

## Results from the existing captures

In the v6 near-edge focus sweep, canonical major radius at the 1.1 m feature is
0.1004 internal px at 1080 mm, 0.0497 px at 1090 mm, 0 at 1100 mm, 0.0487 px
at 1110 mm, 0.0965 px at 1120 mm, and 1.1381 px at 1400 mm. The renderer's
stage CoC readback changes smoothly through this interval; near-layer alpha
switches from 0 at 1100 mm to 1 at 1110 mm, as the signed CoC changes from a
small positive value to negative. The 1100 mm stage sample is +0.00146 mm
despite the canonical point prediction of zero. Stage values are quantized at
1/4096 mm, but that residual is 4–6 codes and the exact selected texel world
position was not reconstructed, so it is not classified as quantization-only.

Projection and raster phase are a substantial competing explanation for the
observed edge-width change between 1080 and 1090 mm. Projected horizontal
position moves from 716.142 to 715.946 internal pixels, crossing the readback
texel boundary from x=716 to x=715. Raw width changes from 1.336 to 0.897 CSS
px, and Processed width from 1.526 to 0.936 CSS px. This is evidence that the
input raster itself changes across those Focus states; it does not identify a
Gather defect. The 8-offset phase envelope is 0.53–0.81 CSS px across the
near-edge cases. All near-edge Raw/Processed width differences are therefore
inconclusive relative to the descriptive resampling envelope. Several larger fixture regions
show resolved additional Processed spread, but these do not calibrate the
near-field CoC transfer.

The v5 canonical Focus/Tilt/Swing states produce the expected focus-plane and
CoC rankings for most fixture targets. The smallest predicted CoC is also the
smallest median measured edge width in all five isolated/combined movement
cases. However, every movement pairwise edge comparison is inconclusive after
phase uncertainty. Focus-far also has a reversed measured sharpness rank, but
that comparison is inconclusive. These older SwiftShader/display captures
support canonical geometry ordering; they do not demonstrate quantitative
Tilt/Swing blur transfer.

## Near-gather support gap and candidate

The current WebGL near gather proposes 32 golden-angle samples in a 60 px
radius disk. From its GLSL radial rule, the first noncentral proposal is
`60 * sqrt(0.5 / 32) = 7.5` internal px. The v6 known near-feature radii are
0.05–1.14 internal px for the tested focus states. This confirms a proposal
support gap: those footprints lie inside the first noncentral proposal radius,
so an output pixel outside the foreground geometry pixel can receive no local
proposal from that foreground footprint. It is a concrete algorithmic
limitation, but it is not proof that it caused the manually reported room
oscillation.

The smallest plausible candidate for a later A/B experiment is to bias the
Near-only radial proposal toward the center while retaining the same 32-sample
budget, maximum radius, golden-angle ordering, and existing depth/ellipse
tests. A radial transform `r = R * u^gamma` (with `gamma > 1`) can place early
proposals inside the current 7.5 px gap. It must carry the matching
importance-weight ratio `2*gamma*(r/R)^(2 - 1/gamma)` into color accumulation
and the existing area-based coverage estimate; otherwise radial oversampling
changes brightness/coverage. This is only a candidate design, not an accepted
fix. The modified proposal distribution would still need actual-GPU A/B proof
for small and large CoC, edge pixel phases, foreground/background occlusion,
Near alpha continuity, raw/processed matching, performance, and representative
shared teaching scenes before it could be enabled.

No gather or optics change is justified by these captures alone. The manually
reported interactive room defect remains `NOT_REPRODUCED / NEEDS_MANUAL_REVIEW`
by the separate settled and frame-order evidence; this analysis localizes a
measurable small-footprint proposal gap but does not connect it causally to the
user-visible report.
