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

| Rise/fall | Front target ΔV | Rear target ΔV | Targets in frame | Minimum lattice overlap |
| ---: | ---: | ---: | --- | ---: |
| 20 mm | ±0.20613 | ±0.19685 | yes | 0.77328 |
| 40 mm | ±0.41225 | ±0.39370 | yes | 0.61116 |
| 60 mm | ±0.61838 | ±0.59055 | no | 0.33294 |

Twenty millimetres is the smallest candidate with a clear, signed response,
in-frame selected targets, and meaningful lattice overlap.

The final physical shortlist was:

| Candidate | Neutral margins L/R; T/B | Neutral frame coverage | High/low target offset | Rise/fall lattice |
| --- | --- | ---: | --- | --- |
| 200 mm cubes, 90 mm lens | 0.36905; 0.22719 | 1.00000 | 0.04007 / 0.03919 | fully off at 80 mm |
| 200 mm cubes, 105 mm lens | 0.34601; 0.17920 | 1.00000 | 0.04662 / 0.04559 | mixed full/partial at 80 mm |
| **260 mm cubes, 90 mm lens** | **0.32025; 0.12552** | **1.00000** | **0.01865 / 0.01895** | **partial, never full, at 80 mm** |

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

## Known boundary

The current public rise controls clamp movement to 0–40 mm. C1/C2 use reachable
positive values, but D1/D2 require internal -20 mm fall values and are not yet
publicly selectable. A UI/state follow-up must expose fall without changing
this optical sign contract.

The lattice may remain partially outside the 4 × 5 frame in moved cases even
when the selected teaching target is visible; the reported overlap is a raw
projection measurement, not a renderer crop fix. Blur, sharpness, and depth of
field remain illustrative. Visual validation of target legibility and overlay
extent belongs to the renderer/UI follow-up. The calibration remains
provisional until that review confirms the measured geometry is teachable in
the composed scene.
