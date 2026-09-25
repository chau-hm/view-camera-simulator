# View Camera Simulator — Learning Model

## Purpose

This document is the canonical current pedagogical and content reference for
the View Camera Simulator. It describes the learning model represented by the
current implementation and provides the terminology and relationships that
future learner-facing copy should preserve.

It is a content reference, not a product roadmap, optics specification, or
mandatory curriculum sequence. The current public lessons are described by
role. This section follows the public catalog for discoverability, but the
runtime catalog, order, modes, and identifiers remain defined by
`src/app/publicScenes.ts` rather than by this document.

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
| Lens coverage | The projected region a lens profile models as usable, represented by a perpendicular reference circle or its intersection with the actual film plane. |
| Image Circle | The circular finite-coverage region on a plane perpendicular to the optical axis; it is the actual film region when the film plane is perpendicular to that axis. |
| Reference Image Circle | The perpendicular-plane circle derived from lens coverage, used as a reference when the actual film plane is tilted or swung. |
| Coverage Footprint | The finite coverage region formed where the coverage cone intersects a non-parallel film plane. |
| Natural illumination | Gradual off-axis brightness falloff, approximated separately from the finite-coverage boundary. |
| Bellows extension | The physical lens-to-film separation required by the selected focus. |
| Bellows factor | The exposure multiplier caused by image distance in the current thin-lens model. |
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

## Image circle and lens coverage

### Lens coverage

Lens coverage is the projected region that a lens profile models as usable.
Real lenses do not provide useful image indefinitely, but this simulator does
not model measured coverage for every real lens. Here, `Not modelled` means
that the simulator does not impose a finite coverage boundary for that lens
option; it does not claim that the real lens has unlimited coverage.

Coverage is a lens property separate from focal length. Focal length changes
angle of view and framing at a fixed camera position, but does not determine
coverage by itself. Two lenses with the same focal length may have different
coverage. The current 150 mm `simulator-parametric-150mm` profile uses a 72°
full angular coverage angle as explicit simulator teaching data, not as a
manufacturer specification. Other current focal-length profiles without
finite data remain `Not modelled`.

### Image Circle

A finite circular coverage cone intersects any plane perpendicular to the
optical axis as a circle. When that plane is the actual film plane, the finite
film coverage region is the Image Circle. The fixed rectangular 4×5 film
format sits within the available coverage; the film dimensions do not grow or
shrink with a movement.

Rise and Shift change how the film rectangle and available coverage overlap.
Front Rise or Front Shift moves the lens standard and its projected coverage
relative to the fixed rear standard and film; Rear Rise or Rear Shift moves the
film through the lens coverage. Name the standard because these are different
physical actions. Both can use up spare coverage in the movement direction;
neither creates more coverage. A film edge or corner that reaches the current
usable boundary is clipped by this teaching model.

### Coverage Footprint

When the actual film plane is not perpendicular to the finite coverage cone,
its intersection is generally not circular. The simulator calls this actual
film-plane region the Coverage Footprint. It is the same lens coverage
intersecting a different plane, not a second optical phenomenon. The current
canonical state represents the bounded region with `Q(x,y) <= 0` and the
image-side condition `T(x,y) > 0`. Ground Glass clipping and the 3D footprint
consume that same `GroundGlassCoverageState`; UI components do not reconstruct
the cone or invent an equivalent conic diameter.

`DerivedLensCoverage` remains separate: it describes the perpendicular
reference Image Circle from the lens profile and canonical image distance.
That reference remains useful for a tilted film, but it is not the size or
shape of the actual Coverage Footprint on that film.

### Natural illumination is separate

The simulator's current parallel-film natural-illumination approximation is
gradual `cos⁴(theta)` off-axis falloff. It can darken image edges before finite
coverage clips points outside the usable region. Natural illumination is not
the Image Circle, does not define its boundary, and is neutral for current
non-parallel Tilt/Swing states. The finite-coverage boundary is a hard teaching
boundary with only about one output pixel of raster anti-aliasing; it is not a
measured real-lens illumination, contrast, or resolution transition. Future
usable-coverage roll-off or optical/mechanical vignetting may soften that
boundary as a separate model from `cos⁴` illumination.

### Macro extension

For the simulator's fixed angular-coverage teaching profile, the perpendicular
reference-circle diameter is

```text
D = 2 v tan(alpha / 2)
```

where `v` is canonical image distance and `alpha` is the profile's full
included coverage angle. In Macro Bellows Extension, closer focus increases
`v`, so the physical reference Image Circle grows. This is a simulator profile
relationship, not a universal measured rule for real lenses.

Coverage growth and bellows exposure loss are separate effects. At the 1:1
thin-lens checkpoint, `v ≈ 2f`, so the reference-circle diameter is about
twice its infinity-reference diameter while the current bellows factor
`(v/f)²` is about 4×, or +2 stops of exposure compensation. The larger circle
does not cause a 4× exposure change through its area. At a fixed aperture the
bellows loss dims the Ground Glass overall even while coverage grows. Aperture
affects exposure and depth of field under their existing models; it does not
set the Image Circle diameter.

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

These are the current public lessons and scenes. Their inclusion here does not
assert a required course order.

### Lesson 0 — Meet the View Camera

This free-only anatomy lesson introduces the conceptual view camera before the
movement studies. The learner identifies the Front Standard, Lens Board, Lens,
Aperture, Bellows, Rear Standard, Ground Glass, Film Holder, and Camera
Support, then learns the Image Circle as the conceptual prerequisite for Front
Rise and Front Shift before connecting Front Rise, Front Shift, Front Tilt,
Front Swing, Front/Rear focusing, and Aperture controls to the physical parts
they change. It is an anatomy and control walkthrough, not a scored movement
task.

The Image Circle step is a presentation-only teaching illustration: it shows a
rose circular projection around the rectangular 4×5 film format, using the
same visual language as the physical finite-coverage overlay shown in the Rise
and Shift steps. Its diameter is deliberately conceptual and is not a measured
lens specification, finite coverage model, movement limit, or Ground Glass
rendering input. Rise and Shift then show canonical finite coverage moving
relative to the unchanged film rectangle to teach vertical and horizontal spare
coverage consistently.

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

### Focus Fundamentals — Two Targets

This lesson compares focusing with the Front versus Rear standard using two
depths on the same connected object. The learner moves focus between the near
and far detail and observes the white near gate and far pointer. Front
focusing changes their image alignment/framing differently; Rear focusing
keeps them aligned because the lens and whole-camera viewpoint stay fixed.

The aperture is fixed at f/11 in the current lesson. Aperture choice is not a
learning variable for this scene and must not be described as one.

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

The public focus range is scene-calibrated to the nearest foreground focus
probe and far scene bound (3,090–13,000 mm at the current 150 mm lens). The
generic real-image minimum only protects the mathematical condition `U > f`;
it is not a suitable learner-facing focus range for every scene. Rear-standard
position and bellows length continue to follow the canonical thin-lens image
distance without a rendering travel cap.

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

### Oblique Tabletop

This lesson uses an inclined plan board resting on a normal table. The subject
plane varies both near-to-far and laterally, so Front Tilt addresses one
direction while Front Swing addresses the other. The guided progression keeps
focus, Tilt, Swing, refinement of Focus, and the final Aperture/depth-of-field
tolerance comparison as distinct learning steps.

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

### Oblique Architecture

This lesson combines Front Rise and Front Swing for an oblique building. The
learner keeps the camera level so the architectural verticals remain parallel,
uses Rise to establish framing, and turns the plane of sharp focus toward the
receding façade with Swing and Focus. The guided lesson progresses from
composition to focus-plane alignment and then a compound challenge.

### Architecture + Foreground

This lesson places a nearer foreground problem in front of level architecture.
The learner uses Front Rise to include the roof while keeping the camera level,
Front Tilt and Focus to align the plane of sharp focus across the foreground
and building, and Aperture to add usable depth around that aligned plane. The
compound guided task keeps framing, focus-plane alignment, and depth of field
as related but separate decisions.

### Interior Corner — Rise + Swing

This lesson uses a level interior corner where upper architectural detail
presses against the frame and a side wall recedes through near, middle, and far
details. The learner uses Front Rise for composition, Front Swing to orient the
focus plane toward the wall, Focus to place that plane on the wall, and a
modestly smaller Aperture to add tolerance around the aligned plane. The
guided sequence makes those four relationships explicit.

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

- English is the canonical source language.
- Learner-facing terminology follows the canonical glossary in this document.
- Learner-facing prose must be written so it can be localized without losing
  the physical relationship or teaching intent.
- Scene and task domain state must never depend on translated display strings.
- The application currently supports bundled `en` and `zh-HK` presentation
  resources. Translations must preserve optical and pedagogical semantics.
- Locale-specific wording may differ where natural language requires it, but
  the instructional meaning must remain equivalent.
- Current locale resolution, persistence, language-selector surfaces, and
  intentional localization exclusions are defined in [the internationalization
  contract](I18N.md).

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
