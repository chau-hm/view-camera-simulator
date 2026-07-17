---
name: vcs-threejs-rtt
description: Analyze, implement, or review Three.js, React Three Fiber, and Ground Glass render-to-texture behavior in View Camera Simulator. Use for RTT cameras, render targets, shader uniforms, DOF post-processing, WebGL fallback, scene subject registration, lighting, clipping, zoom quality, blank or stale canvases, duplicate renderers, resource ownership, disposal, and SPA renderer lifecycle.
---

# View Camera Three.js and RTT

Own renderer behavior and GPU resource lifecycle. Do not change physical calibration merely to improve the picture.

## Identify the render path

Trace:

```text
canonical camera state
→ derived optics
→ scene subject registry
→ Three.js / R3F scene
→ Ground Glass RTT camera
→ color and depth targets
→ DOF passes
→ displayed canvas
```

Determine whether the defect is:

- incorrect optics input
- camera configuration
- scene subject or lighting
- render-target lifecycle
- shader uniform or post-processing
- clipping or DPR
- DOM staging, zoom, or orientation
- stale state during SPA navigation

Read `references/renderer-checklist.md`.

## Resource ownership

For every allocated resource, identify the owner and teardown:

- geometries
- materials
- textures
- depth textures
- render targets
- post-processing scenes
- controls
- registered scene groups

Dispose only owned resources. Do not generically dispose shared Architecture or Focus resources.

## Diagnostics

Prefer narrow, truthful diagnostics:

- active scene subject identity
- RTT resource generation
- finite uniform state
- content sanity
- target dimensions
- camera validity
- disposal or replacement counters when lifecycle is under test

Do not add diagnostics that always mirror props and therefore cannot detect stale internal resources.

## Testing rules

Separate:

- WebGL-independent component and routing tests
- WebGL-dependent RTT and lifecycle tests

A lifecycle test must:

- perform client-side navigation
- avoid full page reload between transitions
- observe meaningful subject or resource replacement
- detect stale scene objects or duplicate canvases
- capture page errors and relevant Three.js/WebGL warnings

Do not use screenshot byte size as the only proof of correctness.

## Scope boundary

Prefer changes in:

```text
src/render/**
renderer-specific components
renderer-specific tests
```

Escalate optical ambiguity to `$vcs-optics-geometry`.
Escalate layout, accessibility, task, or routing work to `$vcs-ui-tasks`.

## Output contract

Report:

- root render path
- resource owner and lifecycle
- defect classification
- diagnostics added or reused
- WebGL-independent evidence
- WebGL-dependent evidence
- disposal and SPA navigation result
- remaining optics or UI dependency
