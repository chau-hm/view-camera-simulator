# Renderer Checklist

## Render path

- correct scene definition resolved
- registered subject selected
- one visible 3D canvas
- one Ground Glass RTT renderer
- no reachable legacy scene mockup for RTT scenes
- correct Ground Glass camera and projection matrix
- finite near/far range
- color and depth targets match resolved dimensions
- post-processing uniforms are finite

## Content

- subject is inside camera frustum
- lighting reaches relevant materials
- raw RTT is contentful
- final RTT is contentful
- focus changes affect the expected targets
- movement sign changes the expected geometry
- orientation assist does not mutate canonical optics

## Lifecycle

- old registered subject removed
- owned resources disposed once
- replacement group is fresh
- stale diagnostics cleared
- scene switch uses SPA navigation
- no duplicate canvases
- no disposed-resource or feedback-loop warnings
- shared resources are not accidentally disposed

## Test integrity

Reject tests that:

- reload the whole page between claimed scene transitions
- assert only wrapper attributes derived directly from current props
- use arbitrary waits instead of observable state
- rely only on screenshot file size
- suppress unknown console warnings broadly
