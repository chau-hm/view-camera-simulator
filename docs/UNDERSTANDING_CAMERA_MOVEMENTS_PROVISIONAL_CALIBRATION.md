# Understanding Camera Movements — Provisional Calibration

Status: provisional instructional calibration, not a claim of metrological camera accuracy.

Evaluation base: `8451e379bf8e20a5511ce5caa120882b87d28eb2`.
The starting scaffold used the same 3 × 3 × 5 lattice with 260 mm cubes,
0 mm gaps, 2,000 mm subject/focus distance, a 105 mm lens, and `±15°`
viewpoint anchors. This packet changes only the evidenced focal length and arc
to 90 mm and `±20°`; the subject dimensions and focus distance remain intact.

## Canonical contract

- Geometry and optics use millimetres.
- +X is camera-right, +Y is up, and +Z runs from lens to subject.
- The mid-anchor zero-movement lens datum is `(0, 0, 0)`.
- Finite-focus film is at rig-local `Z = -v`, where the shared thin-lens helper
  calculates `v = fU / (U - f)`.
- Positive front/rear rise translates that standard along rig-local +Y.
- Positive standard tilt rotates its normal about rig-local +X around that
  standard's centre. Front swing is zero in every teaching case.
- Positive body pitch rotates the rigid camera about the fixed tripod/rail
  pivot so rig-local +Z moves toward rig-local -Y. Local standard movements
  happen first, body pitch second, and outer rig placement last.
- The viewpoint arc lies in world YZ, is centred on the lattice centre, and has
  radius equal to the mid lens-datum-to-subject-centre distance.
- Ground Glass UV is raw and unclamped: origin top-left, +U right, +V down.

The evaluator calls the existing effective-calibration resolver, lattice
generator, rig-anchor resolver, `deriveOpticsState`, and canonical projection
diagnostics. It contains no independent plane or projection calculation.

The immutable `CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION` object is the
only selected-value source for subject geometry and distance, focal length and
focus distance, and rig radius and arc angle. Production scene calibration and
the selected teaching candidate both derive from it. The candidate keeps
`subjectDistanceMm`, `focusDistanceMm`, `focalLengthMm`, and `arcRadiusMm`
independent; the current equality of the two distances and radius is a selected
result, not an evaluator assumption. The lightweight teaching-case module
contains only case identities and movement states, while the candidate search,
optics derivation, and projection metrics remain in the development evaluator.

## Selected values

Physical scene calibration is stored separately from the internal teaching
movements.

| Kind | Selected values |
| --- | --- |
| Physical subject | 3 × 3 × 5; 260 mm cubes; 0 mm gaps; centre `(0, 0, 2000)` |
| Physical optics | 90 mm focal length; 2,000 mm finite-focus distance |
| Physical rig | 2,000 mm radius; high/low arc `+20°/-20°`; base pitch `0°` |
| Internal teaching movements | tilt `5°`; rise/fall `±20 mm`; body pitch `±6°` |

The physical values are exact candidate inputs. Raw projection, plane-normal,
coverage, convergence, distance, identity, and fallback evidence remains in
the structured evaluator result; it is not rounded into the internal movement
values.

## Bounded evaluation

Each factor group was varied alone before combining a shortlist. Subject
checks used cube sizes 200/260/320 mm, gaps 0/50/100 mm, and distances
1,800/2,000/2,400/3,000 mm. Optics used 90/105/120/150 mm; rig arc used
10/12/15/18/20°; tilt used 5/7.5/10°; body pitch used 6/8/10/12°.

The initial 80/120/160 mm rise set was rejected: even 80 mm moved every
selected rise/fall target outside the 4 × 5 frame. A bounded visibility
follow-up tested 20/40/60 mm on the selected physical geometry:

| Rise/fall | Front target ΔV | Rear target ΔV | Targets in frame | Minimum overlap across all nine teaching cases |
| ---: | ---: | ---: | --- | ---: |
| 20 mm | ±0.20613 | ±0.19685 | yes | 0.77328 |
| 40 mm | ±0.41225 | ±0.39370 | yes | 0.61116 |
| 60 mm | ±0.61838 | ±0.59055 | no | 0.33294 |

Twenty millimetres is the smallest candidate with a clear, signed response,
in-frame selected targets, and meaningful lattice overlap. Its rise/fall-only
minimum overlap is 0.88937; the lower 0.77328 global minimum belongs to the C3
high-viewpoint case.

The final physical shortlist was:

| Candidate | Neutral margins L/R; T/B | Neutral frame coverage | High/low target offset | Rise/fall lattice |
| --- | --- | ---: | --- | --- |
| 200 mm cubes, 90 mm lens | 0.36905; 0.22719 | 1.00000 | 0.04007 / 0.03919 | fully off at 80 mm |
| 200 mm cubes, 105 mm lens | 0.34601; 0.17920 | 1.00000 | 0.04662 / 0.04559 | mixed full/partial at 80 mm |
| **260 mm cubes, 90 mm lens** | **0.32025; 0.12552** | **1.00000** | **0.01865 / 0.01895** | **all four rise/fall cases partially off-frame; minimum overlap 0.05473 at 80 mm** |

The 260 mm / 90 mm candidate was selected because it preserved the strongest
region extent, best high/low centring, and non-zero lattice overlap under the
initial stress case. The 20 mm follow-up then supplied the internal teaching
movement.

## Teaching-case evidence

Every case has 224 canonical lattice edges, finite normalized lens/film/focus
plane normals, `fallbackApplied = false`, a null fallback reason, and a finite
lens-to-target distance.

| Case | Anchor / target | Isolated movement | Target UV | Target in frame | Lattice status / overlap | Convergence |
| --- | --- | --- | --- | --- | --- | ---: |
| neutral | mid / middle | none | (0.50000, 0.50000) | yes | all / 1.00000 | 0 |
| A-front-tilt | mid / middle | front tilt +5° | (0.50000, 0.50000) | yes | all / 1.00000 | 0 |
| B-rear-tilt | mid / middle | rear tilt +5° | (0.50000, 0.50000) | yes | all / 1.00000 | +0.06823 |
| C1-front-rise | mid / middle | front rise +20 mm | (0.50000, 0.29387) | yes | partial / 0.88937 | 0 |
| C2-rear-rise | mid / middle | rear rise +20 mm | (0.50000, 0.69685) | yes | partial / 0.90476 | 0 |
| C3-high-viewpoint | high / upper | body pitch +6° | (0.50000, 0.51865) | yes | partial / 0.77328 | +0.08435 |
| D1-front-fall | mid / middle | front rise -20 mm | (0.50000, 0.70613) | yes | partial / 0.88937 | 0 |
| D2-rear-fall | mid / middle | rear rise -20 mm | (0.50000, 0.30315) | yes | partial / 0.90476 | 0 |
| D3-low-viewpoint | low / lower | body pitch -6° | (0.50000, 0.48105) | yes | partial / 0.78178 | -0.08338 |

A-front-tilt changes the lens normal by exactly 5° while leaving the film
normal unchanged. B-rear-tilt changes the film normal by exactly 5° while
leaving the lens normal unchanged. Their centred target does not fabricate a
composition shift; their instructional difference comes from the canonical
planes and B's perspective convergence. Rise/fall pairs have equal-and-opposite
signed target movement. High/low cases use symmetric anchors and body pitch,
with opposite convergence.

The canonical `-5°` rear-tilt probe is also finite, projectable, non-fallback,
and not fully off-frame. It produces convergence `-0.06823`, equal in magnitude
and opposite in sign to B's `+0.06823`; neutral remains inside the `1e-6`
parallel epsilon. C3/D3 convergence differs in magnitude by about 1.2%, their
projected frame coverage differs by about 1.1%, and their lens-film distance is
invariant.

## Bounded composed-scene inspection

All nine internal cases were inspected at 1024 × 768 through the development
calibration route in the default 3D view, fixed Camera inspection view, raw
Ground Glass, final Ground Glass, and 2D Geometry. The temporary inspection
harness and captures were not committed.

| Case | Composed-scene observation |
| --- | --- |
| neutral | Lattice and target are centred and readable; raw/final Ground Glass is fully framed; verticals are parallel. |
| A | Front-standard and focus-plane rotation is visible in 3D/2D; framing stays neutral and parallel; final DOF differs subtly from raw. |
| B | Rear-plane change and bottom convergence are visible; target remains centred and the complete lattice remains framed. |
| C1 | Positive front rise shifts the selected target upward; the target remains readable with 88.94% lattice overlap. |
| C2 | Positive rear rise produces the opposite Ground Glass shift; the target remains readable with 90.48% overlap. |
| C3 | Upper target remains readable in raw/final Ground Glass with expected outer crop and bottom convergence; default 3D clips part of the rig at upper-right. |
| D1 | Front fall mirrors C1; the selected target remains readable with 88.94% overlap. |
| D2 | Rear fall mirrors C2; the selected target remains readable with 90.48% overlap. |
| D3 | Lower target remains readable with expected outer crop and top convergence; default 3D clips part of the lower rig. |

Every raw and final RTT was contentful; its camera, uniforms, and depth state
were finite; color, depth, and final targets agreed at 528 × 422; and no page,
Three.js, WebGL, or GPU errors were observed. The fixed Camera inspection
observer does not follow the high/low rig: C3 is nearly blank in that auxiliary
view and D3 is substantially clipped. This is an external observer-framing
limitation rather than a physical calibration failure, so the provisional
subject, optics, rig, and movement values were not changed. The 2D header also
reports front rise only, so C2/D2 read `Rise: 0.0 mm` even though their rear-rise
ray geometry is correct.

## Known boundary

The current public rise controls clamp movement to 0–40 mm. C1/C2 use reachable
positive values, but D1/D2 require internal -20 mm fall values and are not yet
publicly selectable. A UI/state follow-up must expose fall without changing
this optical sign contract.

The lattice may remain partially outside the 4 × 5 frame in moved cases even
when the selected teaching target is visible; the reported overlap is a raw
projection measurement, not a renderer crop fix. Blur, sharpness, and depth of
field remain illustrative. Composed-scene inspection confirms the selected
targets and movement differences are readable, subject to the fixed Camera
inspection and 2D rear-rise readout limitations above. The calibration remains
provisional and is not a claim of final lesson composition or metrological
accuracy.

## Validation

- Focused teaching, projection, renderer, RTT, resource, and 2D tests: 104 passed.
- Focused Understanding Camera Movements Playwright: 4 passed.
- Full unit/integration suite: 91 files and 849 tests passed.
- Type-check, lint, CSS structure, and production build passed.
- Full local E2E merge gate passed, including 53 Playwright tests.
- `git diff --check` passed.
