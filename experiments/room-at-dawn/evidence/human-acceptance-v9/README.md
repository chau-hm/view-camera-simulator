# Human optical acceptance — v9

## Provenance

The observations below were reported by the user after manual interaction with the experimental Room-at-Dawn Ground Glass page. They are qualitative acceptance evidence, not calibrated optical measurements.

The original screenshot files were not present in the current worktree or the available task attachment files during closeout. No replacement photographs were generated, and the user's images have not been altered or copied into this folder. The capture identities, browser/GPU, exact composition/lateral placement, and source revision are unknown unless stated otherwise below.

The expected filenames are listed for a later import of the original supplied images. Do not treat those filenames as files that exist today.

## Front Tilt — `FRONT_TILT_VISUAL_PASS`

- A: 90 mm, focus 1610 mm, f/5.6, Front Tilt 0°, Front Swing 0°.
- B: same settings with Front Tilt +9°; the user reports Tilt as the only changed setting.
- Observed: neutral retains clearer foreground bed-frame/floor detail; tilted view shows clearer wall decorations/headboard and reduces near-foreground sharpness. This is consistent with focus-plane orientation changing across scene depth.
- Limit: does not measure exact alignment of a selected physical surface to the canonical plane or quantify the blur footprint.
- Capture identity, composition, source revision: not supplied / unknown.
- Original expected filename: `tilt-0-vs-9.png`.

## Front Swing — `FRONT_SWING_VISUAL_PASS`

- A: 90 mm, focus 1610 mm, f/5.6, Front Tilt 0°, Front Swing 0°.
- B: same settings with Front Swing +5°; the user reports Swing as the only changed setting.
- Observed: the left wall map softens, while right-side framed pictures and the wooden headboard become clearer. Sharpness redistributes horizontally.
- Limit: qualitative evidence only; not a calibrated blur footprint or plane-intersection measurement.
- Capture identity, composition, source revision: not supplied / unknown.
- Original expected filename: `swing-0-vs-5.png`.

## Focus / depth of field — `FOCUS_DOF_BASIC_VISUAL_PASS`

- A: 90 mm, focus 460 mm, f/5.6, neutral Tilt/Swing.
- B: same settings with focus 5520 mm; the user reports Focus as the only changed setting.
- Observed: near focus substantially defocuses the background; far focus makes bed and wall decoration clearer. Focus breathing changes framing.
- Known limitation: the foreground plant does not show fully convincing far-focus defocus; duplicated/ghost-like leaf and stem edges are visible.
- Limit: does not establish complete depth-of-field correctness, calibrated PSF, or blur transfer.
- Capture identity, composition, source revision: not supplied / unknown.
- Original expected filename: `focus-460-vs-5520.png`.

## Foreground plant artifact

- Expected original detail filename: `foreground-ghosting-detail.png`.
- User observation: with the original room, 90 mm, f/5.6, neutral Tilt/Swing and far focus at 5520 mm (near reference 460 mm), thin foreground leaves/stems show duplicated or ghost-like edges.
- Root cause: unresolved. Sparse sampling, coverage, occlusion, thin geometry, depth representation, and source sampling remain hypotheses rather than findings.
- Matched Raw RTT Debug versus Processed comparison at the user's exact composition: not performed because composition/lateral placement was not supplied; no replacement composition is claimed as equivalent.
- Material inspection found modeled leaf geometry and opaque RGBA source maps; the source does not configure alpha testing or transparency. Runtime depth-write state was not inspected, so this does not determine the artifact cause.

## Scheimpflug classification

The Tilt and Swing comparisons support `SCHEIMPFLUG_FOCUS_PLANE_CONTROL_QUALITATIVE_PASS`: recognizable focus-plane redistribution is present. They do not independently prove the exact Scheimpflug intersection, hinge rule, or quantitative image-space blur.

## Import instructions

When the original images are supplied as local files, copy them byte-for-byte into this directory under the expected names. Add their SHA-256 hashes, file sizes, any visible capture/frame identities, and any newly established browser/source revision to `manifest.json`. Keep unknown metadata null/unknown. Do not invent camera values, composition, or provenance.
