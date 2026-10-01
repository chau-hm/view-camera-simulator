---
name: vcs-dream-loop-visual-quality
description: Apply View Camera Simulator authority and write-scope rules during Dream Loop scene-appearance work.
---

# VCS Dream Loop Visual Quality

Use this overlay together with the external Dream Loop workflow when a user explicitly starts a visual iteration. It supplies VCS-specific constraints; it does not replace or vendor upstream Dream Loop. Follow `AGENTS.md`, [Visual Pipeline Readiness](../../../docs/VISUAL_PIPELINE_READINESS.md), and [Dream Loop Visual Workflow](../../../docs/DREAM_LOOP_VISUAL_WORKFLOW.md) for project authority and pilot procedure.

## Appearance scope

For the selected pilot, Dream Loop may improve only the appearance allowed by its manifest, including non-semantic mesh detail, bevels and thickness, decorative geometry, appearance-only subdivision, materials, roughness and metalness, textures and normal/roughness maps, color variation, render-only props, and visual metadata.

The target image is a visual optimization reference. It may guide material appearance, surface detail, decorative detail, visual density, realism, texture character, and visual hierarchy. It never overrides canonical optics, teaching semantics, scene presentation contracts, or interaction behavior.

## Immutable VCS contracts

Do not alter canonical camera state, lens or film geometry, focus geometry or targets, composition targets, movement signs or limits, scene calibration, task thresholds or definitions, scene identity, route/catalog publication, image-circle physics, Ground Glass Raw/Upright semantics or film mapping, renderer selection, or `TeachingLighting` architecture to match a target.

Treat current lighting, tone mapping, exposure, shadow policy, and renderer as fixed capture conditions. Do not change geometry to compensate for lighting. Keep Architecture Rise in the existing `sceneAssetRegistry` path, preserve its instance-owned resource lifecycle, and share the registered implementation across observer and RTT consumers.

## Required iteration checks

1. Capture the real observer canvas with `npm run dream-loop:capture -- --pilot architecture-rise`; use that baseline to create a locked target under ignored `.dream-loop/`.
2. Work only within the selected manifest's allowlist. Run `npm run dream-loop:guard -- --pilot architecture-rise --base <clean-iteration-baseline>` immediately after each worker pass. A failure is a stop-and-report result; never restore forbidden edits automatically.
3. Run focused semantic and registered-asset regression tests, recapture the observer, and review critic feedback only for visual-only changes.
4. Ground Glass Raw and Upright are regression views, never separate visual targets. Reject critic suggestions that change protected semantics.
5. Stop after three visual implementation/critique rounds and request human review.

Do not use this skill to run an actual production visual redesign before the shared lighting-profile architecture is established and the user authorizes the pilot.
