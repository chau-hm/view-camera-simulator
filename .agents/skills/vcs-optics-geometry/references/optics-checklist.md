# Optics Checklist

## Coordinate contract

Confirm:

- axis directions
- millimetre/world conversion
- film datum
- lens centre
- optical-axis direction
- plane normal orientation
- movement sign convention
- pivot or rotation centre

## Plane contract

For film, lens, focus, near DOF, and far DOF planes:

- point is finite
- normal is finite and normalized
- orientation matches the intended sign
- intersections are handled without unstable division
- visual clipping does not mutate the physical plane

## Scene calibration

Confirm:

- focus probes come from canonical subject geometry
- calibration uses the same probes exposed to tasks
- raw solution is preserved
- rounded UI solution uses shared control steps
- nearby step values remain finite and continuous
- task thresholds reflect the instructional target rather than hidden precision

## Cross-view consistency

Confirm all derive from canonical state:

- 2D geometry
- 3D focus/DOF overlays
- Ground Glass camera and blur state
- focus target readout
- task evaluator
- debug diagnostics

## Prohibited shortcuts

Do not:

- add scene-name conditionals inside generic optics to force one scene
- flip signs only in one view
- change target coordinates only for the task
- lower sharpness thresholds without evidence
- add duplicate projection helpers
- treat visual plane caps as physical distances
