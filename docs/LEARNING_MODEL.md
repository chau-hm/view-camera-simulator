# View Camera Simulator — Learning Model

## Purpose

This document is the canonical current pedagogical and content reference for
the View Camera Simulator. It describes the learning model represented by the
current implementation and provides the terminology and relationships that
future learner-facing copy should preserve.

It is a content reference, not a product roadmap, optics specification, or
mandatory curriculum sequence. The six public lessons are described by role;
runtime scene order and homepage navigation are intentionally outside this
document's authority.

## Core mental model

The simulator teaches relationships between physical camera changes and
observable results in the camera geometry, 3D scene, and Ground Glass. A
movement should not be taught as an isolated promise such as “rise changes
perspective” or “tilt changes focus.” Copy should identify what physically
moves, what stays fixed, and which visible relationship the learner should
compare.

### Viewpoint

Viewpoint is the physical position from which the whole camera observes the
subject. Moving the whole camera changes the viewpoint and may change:

- perspective relationships;
- parallax;
- the relative visibility of subject surfaces.

Standard translation is not a viewpoint change. Front or rear standard
movement can change the image without moving the whole camera to a new
viewpoint. In the focusing lesson, front focusing moves the lens standard
relative to the fixed film, while rear focusing moves the film standard with
the lens and whole-camera viewpoint held fixed.

### Framing

Framing is where the subject appears within the image or Ground Glass. It is
image placement, not camera position. Framing can change without changing the
viewpoint, for example through front rise or front shift. A framing change
should not automatically be described as a perspective change.

### Perspective geometry

Perspective geometry is the projected relationship between subject features
visible in the image. The learning model distinguishes:

- changes caused by a changed whole-camera viewpoint;
- changes caused by film-plane orientation;
- changes that primarily alter framing while the viewpoint remains fixed.

Use “perspective control” for the broader practice of managing these
relationships. Do not describe every movement as “perspective correction”;
some lessons deliberately show convergence or changed geometry so that the
learner can observe its cause.

### Lens-plane orientation

Front-standard tilt and swing change lens-plane orientation. Their principal
teaching role is to control the orientation of the plane of sharp focus:
front tilt addresses the vertical/depth relationship, while front swing is
the horizontal analogue.

### Film-plane orientation

Rear-standard angular movement changes film-plane orientation relative to the
subject. It can alter projected image geometry as well as the relationship
between the film plane and the plane of sharp focus. Front and rear angular
movements are therefore not interchangeable teaching examples.

### Plane of sharp focus

Plane of sharp focus is the canonical term for the plane rendered sharply
according to the simulator's instructional optics model. Tilt and swing
lessons use it to explain how lens-plane orientation changes focus across
subjects arranged in depth. It must not be conflated with depth of field:
depth of field is a related tolerance region around the focused geometry, and
is also affected by aperture.

## Canonical terminology

Use these English terms consistently in learner-facing copy, guided tasks,
help text, documentation, and translations.

| Term | Canonical meaning |
| --- | --- |
| Viewpoint | The whole camera's physical observing position relative to the subject. |
| Framing | The subject's placement within the image or Ground Glass. |
| Perspective | The appearance of projected spatial relationships from a viewpoint and plane geometry. |
| Perspective geometry | The observable projected relationships, such as convergence, scale, and parallax. |
| Perspective control | Deliberately managing perspective geometry through viewpoint, standard movement, and plane orientation. |
| Front standard | The camera standard carrying the lens; its movement changes lens position or orientation. |
| Rear standard | The camera standard carrying the film; its movement changes film position or orientation. |
| Lens plane | The plane associated with the lens standard and its orientation. |
| Film plane | The image-recording plane associated with the rear standard. |
| Plane of sharp focus | The plane rendered sharply by the instructional optics model. |
| Depth of field | The finite tolerance region around the focused geometry that appears acceptably sharp. |
| Focus distance | The selected subject depth used to establish focus. |
| Front focusing | Focusing by moving the front/lens standard relative to fixed film; in the current comparison lesson this changes image alignment differently from rear focusing. |
| Rear focusing | Focusing by moving the rear/film standard while the lens and whole-camera viewpoint remain fixed. |
| Rise | Upward vertical translation of a standard to place a higher part of the subject in the frame. |
| Fall | Downward counterpart to rise; use the term for downward vertical standard movement. |
| Shift | Horizontal standard translation used to change framing without moving the whole-camera viewpoint. |
| Tilt | Angular standard movement in the vertical/depth relationship; front tilt changes lens-plane orientation, while rear tilt changes film-plane orientation. |
| Swing | Angular standard movement in the horizontal/depth relationship; front swing changes lens-plane orientation, while rear swing changes film-plane orientation. |
| Whole-camera movement | Translation of the camera body and standards together; it changes the viewpoint. |
| Ground Glass | The simulator's image-plane preview used to inspect framing, projected geometry, and focus effects. |

“Front” and “Rear” identify the standard being moved. Keep those words in the
term whenever the distinction matters; do not replace both with an ambiguous
“camera movement.”

## Movement and image-effect model

| Physical action | Primary instructional distinction | Observable relationship to explain |
| --- | --- | --- |
| Whole-camera movement | Viewpoint changes. | Compare perspective relationships, parallax, and surface visibility before and after the move. |
| Front-standard translation (rise, fall, or shift) | The lens standard moves while the whole-camera viewpoint stays fixed. | Framing can change without a viewpoint change; the effect is not automatically a perspective correction. |
| Rear-standard translation | The film standard moves while the whole-camera viewpoint stays fixed. | Framing and projected image relationships can differ from the corresponding front-standard movement. |
| Front-standard tilt or swing | Lens-plane orientation changes. | The plane of sharp focus rotates through depth; compare focus-plane alignment with subject surfaces. |
| Rear-standard tilt or swing | Film-plane orientation changes. | Projected image geometry and focus-plane relationships change; compare with the corresponding front movement. |
| Front versus rear focusing | The moving standard is different. | Front focusing changes lens/film image alignment differently from rear focusing, which keeps the lens and viewpoint fixed in the current two-target lesson. |
| Aperture | The acceptable-sharpness tolerance changes. | Compare depth of field separately from the orientation or position of the plane of sharp focus. |

The simulator's sharpness, blur, and depth-of-field displays are instructional
approximations. Copy should describe observable relationships and direction,
not claim metrological precision.

## Current public lessons

These are the six current public scenes. Their inclusion here does not assert
a required course order.

### Focus Fundamentals — Two Targets

This lesson compares focusing with the Front versus Rear standard using two
depths on the same connected object. The learner moves focus between the near
and far detail and observes the white near gate and far pointer. Front
focusing changes their image alignment/framing differently; Rear focusing
keeps them aligned because the lens and whole-camera viewpoint stay fixed.

The aperture is fixed at f/32 in the current lesson. Aperture choice is not a
learning variable for this scene and must not be described as one.

### Understanding Camera Movements

This lesson compares whole-camera viewpoint movement with front- and
rear-standard movement. Its public controls continuously explore three
dimensions:

- Viewpoint: move the whole camera lower or higher;
- Tilt: choose the Front or Rear standard and vary its angle;
- Vertical Framing: choose the Front or Rear standard and vary its vertical translation.

The learner compares the consequences in camera geometry and Ground Glass.
The historical A/B/C1/C2/C3/D1/D2/D3 calibration cases support implementation
and diagnostics, but they are not the learner-facing conceptual structure of
the current continuous lesson.

### Architecture Rise

This lesson uses Front Rise while keeping the camera body and film-plane
orientation level. The learner includes the upper part of a building without
tilting the camera upward and observes the intended parallel verticals.

The key relationship is:

```text
same viewpoint + appropriate film-plane orientation + Front Rise
→ changed framing without requiring a viewpoint change
```

Teach this as framing and perspective control under level-camera geometry, not
as the simplistic claim that “rise corrects perspective.”

### Table Tilt

This lesson uses Front Tilt to change lens-plane orientation. The learner
aligns the plane of sharp focus with three coplanar focus cards above the
tabletop, demonstrating Scheimpflug-style focus-plane control in the
simulator's instructional model. The focus plane, not depth of field alone,
is the primary relationship to observe.

### Shelf Swing

This is the horizontal analogue of Table Tilt. The learner uses Front Swing
to rotate the plane of sharp focus through subjects arranged diagonally in
depth, using the Top view to compare the focus plane with the diagonal subject
trace.

### Mirror Shift

This lesson demonstrates that Viewpoint and Framing are distinct. The learner
first moves the whole camera laterally until its reflection is outside the
mirror, thereby changing the viewpoint. With the camera left in that new
position, the learner applies opposite Front Shift to restore approximately
the original mirror framing. The reflected subject relationships and parallax
remain those of the changed viewpoint.

Mirror Shift is therefore a viewpoint-versus-framing lesson, not merely a
static mirror inspection scene. The task keeps the film plane parallel to the
mirror while separating whole-camera movement from Front Shift.

## Cross-scene teaching principles

### Principle A — Separate viewpoint from standard movement

Whole-camera motion changes viewpoint. Front-standard translation does not
move the camera viewpoint; rear-standard movement also remains a standard
movement rather than whole-camera translation.

### Principle B — Separate framing from perspective

A framing change does not automatically imply a viewpoint or perspective
change. State which physical relationship changed before describing the image
result.

### Principle C — Front versus Rear are not pedagogically interchangeable

Front and rear movements can produce visibly different image consequences.
Copy must identify which standard is moving whenever that distinction matters.

### Principle D — Separate focus plane from depth of field

Tilt and swing primarily demonstrate plane-of-sharp-focus control. Aperture and
depth of field are related but different concepts.

### Principle E — Prefer “perspective control” over universal “perspective correction”

Some lessons deliberately show convergence or changed geometry. Do not imply
that every valid camera movement exists to produce geometrically corrected
architecture.

### Principle F — Explain observable relationships

Learner-facing copy should tell the learner what relationship to observe, not
merely which control to move.

## Content and localization contract

This document prepares the content model for PR 6B and later content work; it
does not implement internationalization.

- English is the canonical source language.
- Learner-facing terminology follows the canonical glossary in this document.
- Learner-facing prose must be written so it can be localized without losing
  the physical relationship or teaching intent.
- Scene and task domain state must never depend on translated display strings.
- Translations must preserve optical and pedagogical semantics.
- Locale-specific wording may differ where natural language requires it, but
  the instructional meaning must remain equivalent.
- Future learner-facing strings should not be unnecessarily embedded directly
  in rendering, business, or domain logic.
- Translation keys and locale files will be introduced separately from this
  learning-model document.

The intended initial locales are `en` and `zh-HK`. PR 6A adds no i18n
library, locale files, language selector, routing change, or translated UI.

## Scope and authority

`docs/LEARNING_MODEL.md` is authoritative for:

- current pedagogical concepts;
- canonical teaching terminology;
- cross-scene content semantics;
- future learner-facing copy alignment.

It does not override actual optics implementation, calibration constants,
runtime state contracts, tests, or scene/task implementation. Current
repository code and tests remain the technical source of truth. Scene-specific
calibration documents remain authoritative for calibrated implementation
details where applicable, including the Understanding Camera Movements and
Shelf Swing documents.

The original MVP PRD, SDD, Spec, and task inventories remain historical
evidence of the project's initial scope. They are intentionally not rewritten
to match this current model.
