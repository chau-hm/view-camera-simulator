# Architecture Rise v2 — Design Specification

**Planning basis:** origin/main at 8a8b428789b94b4f03f5306549f0b243d49639a9

**Visual direction:** approved architecture-rise-v2-target.png (SHA-256 d24336e6ac92eac6b8e704af789973c2df0e51afa3218df3d24c0f65ccd30103).
**Priority:** teaching and optical integrity → coherent architecture → multi-view geometry → runtime ownership → visual resemblance.

The following architecture is a coordinate-level proposal for PR B. It is design intent, not a claim about current source geometry. The approved image informs proportion, material language and detailing. The current canonical targets and scene envelope remain the authority.

## Coordinate frame and retained anchors

Use millimetres at scene boundaries. World +X runs across the facade, +Y is up, and +Z moves away from the physical lens; smaller Z is nearer the lens. The physical lens origin is derived from the current scene/optics state. Convert to Three.js world units through the existing helper.

Keep the current main volume X −1400…1400, Y −1200…3000, Z 8900…10100 mm, with its current 650 mm parapet ending at Y=3650. Keep the ground at Y=−1200, public scene bounds, focus range and composition bounds listed in the [contract map](architecture-rise-v2-contract-map.md).

The canonical focus chart occupies X −375…375 and Y 525…1275 mm around (0,900); the fine-detail assembly occupies X 640…1000 and Y 1990…2410 mm around (820,2200). Their physical Z positions must continue to come from the canonical helpers. These areas are not openings, windows or editable texture decals.

## Proposed massing and facade grid

| Element | Proposed world-space envelope / centers (mm) | Construction intent |
|---|---|---|
| Main townhouse | Retain X −1400…1400, Y −1200…3650, Z 8900…10100. | Continuous masonry shell with true corner returns; no freestanding front sheet or disconnected trim strip. |
| Rusticated base | Main facade, Y −1200…0. | Pale stone blocks and a continuous plinth; openings and doorway are built into the wall assembly rather than placed over a solid face. |
| Brick shaft | Main facade, Y 0…2820. | Warm brick-colored masonry with a consistent course rhythm. Do not invent a new shared brick material API in PR B: current shared patterns are limestone, cut-stone, concrete, plaster, wood, paper and fabric. Reuse an appropriate existing recipe or model restrained brick courses with shared/instanced geometry. |
| Main cornice and parapet | Cornice around Y 2820…3040; parapet remains Y 3000…3650. | Seat each course into the wall with consistent returns and coping. The 20 mm band overlap is deliberate assembly overlap, not coincident separated faces. |
| Attached service return | X 1400…1900, Y −1200…1800, Z 9600…10500. | Attach directly to the main east wall at X=1400 with a shared Z overlap from 9600…10100. Continue the wall/roof connection into the rear extension; no gap or separate silhouette block. Keep its roof below the main parapet. |
| Ground-floor entrance | Center X=0; opening about 500 mm wide, from Y≈−1180 to Y≈180. | A single arched or framed door with threshold/step and continuous jambs. Its opening is separate from every window and leaves the focus chart’s lower edge clear. |
| Ground-floor windows | Centers X≈−900 and +900, Y≈−500; openings about 420×500. | Keep clear of the central entry. Recess glass behind the masonry plane; connect jambs, sill and lintel to the wall. |
| Lower upper-storey row | Centers X≈−950, 0 and +950, Y≈1620; openings about 420×420. | Align across the facade. Keep the lower surround at least 75 mm above the checkerboard’s upper edge and the upper surround at least 75 mm below the fine panel’s lower edge. |
| Upper-storey row | Centers X≈−950, 0 and +950, Y≈2710; openings about 420×360. | Align with the lower row. Keep its sill/surround at least 50 mm above the fine panel and its lintel below the cornice. |
| Fine-detail quiet zone | Existing X 640…1000, Y 1990…2410, at canonical Z. | Reserve the spandrel between upper rows. In this zone the existing focus panel and its own frame/grid are the only added relief. No window glass, lintel, sill, cornice, wall fixture or trim may cross its lens-origin rays. |
| Checkerboard quiet zone | Existing X −375…375, Y 525…1275, at canonical Z. | Keep a calm central spandrel above the doorway. Do not place an opening, lintel, sign, pilaster or applied material panel in front of it. |
| Street stage and sign | Keep current street-context coordinates and extents by default. | Refine sidewalk slabs, curb joints and sign detail in place. Keep the existing depth-reference props readable. |

Opening sizes and floor centers above are proposed presentation values, not canonical constants. A PR B worker may refine them after a mounted geometry review. Preserve the minimum quiet-zone clearances and avoid adding openings behind the checkerboard or fine panel. The three-bay upper rhythm is a coherent target interpretation, not a required exact count.

### Wall thickness and window assembly

The current factory places its glass and most trim at Z values smaller than the 8900 mm front-wall plane. Those are camera-facing overlays; copying their offsets would preserve the floating-window impression. In the rebuild, make a real opening through modular wall panels or wall sections. At the front plane, return reveals into the wall, place the dark recess and glazing farther from the lens (greater Z), and place only the outer frame/stone trim on the front face. Keep mullions, transoms and glazing inside the opening. Make sill and lintel profiles support the opening with continuous masonry connections.

The focus chart and fine-detail panel sit in front of the canonical facade plane by deliberate millimetre-scale offsets. Build the surrounding wall to its current front datum and leave those targets visible; do not move them backward into the window recess.

## Service wing, entrance and roof

The current side mass spans X 1640…2160 mm while the main building ends at X 1400, leaving a 240 mm air gap. Its four side windows are defined separately from that mass. Replace it with the attached return shown above: the two volumes meet along a real east wall and overlap in plan where they connect. Side windows face the east elevation and are inset into that elevation. End the service roof against the main wall and continue coping/drainage deliberately. A downpipe can connect the service roof to the ground; it must not float or obscure a focus target.

The current entry centered at X=−880 overlaps the Y=300 window row both vertically and horizontally. Centering a narrower doorway between the two ground-floor windows gives a clear entry hierarchy. Design its door, arched head, jambs, transom and step as one assembled opening. No decorative frame should cross either neighboring window aperture.

Keep parapet/cornice/coping returns continuous around all exposed corners. Low roof hatches or vents may sit inside the existing parapet top. Defer tall chimneys that rise beyond the current building-top composition target unless a separate task/composition review demonstrates that the protected framing outcome is unchanged.

## Geometry, material and lifecycle ownership

- Keep the same architecture-rise-subject asset registration and createArchitectureRiseGroup/paired disposer path. Observer and Ground Glass must consume the same registered asset.
- Move window-bay definitions out of canonical geometry into an explicit renderer-neutral Architecture Rise presentation layout. Current front/side arrays are presentation-only, but the Ground Glass host test currently reads the front array for window landmarks; update that fixture to the new layout instead of retaining semantic authority in the old file.
- Keep canonical building/focus/composition data in the canonical geometry module. Do not copy those constants into the presentation layout.
- Prefer the existing shared box geometry and shared materials for repeating courses; use instancing only where the current subject/lifecycle path can own it safely. Mesh count is evidence, not a design goal.
- Use existing subject-owned procedural material factories. Do not add a global brick pattern, environmental lighting, lantern emissives, reflection system or renderer policy as a hidden dependency of this geometry PR.
- Every added/replaced geometry or material must be registered through the existing factory and disposed by the same factory owner. Do not let Observer and RTT build different architecture.

## Target interpretation matrix

| Target feature | Faithfully reproduce | Adapt to contract | Defer | Reason |
|---|---|---|---|---|
| Narrow classical townhouse and three-part base/shaft/parapet | Yes | Fit the current 2800×4200×1200 mm main envelope. | — | The architectural hierarchy is the approved direction; scene scale remains calibrated. |
| Three dominant facade bays | Use as the preferred rhythm. | Upper bay positions and floor heights may change to maintain the focus quiet zones. | Exact floor/bay count as acceptance metric. | The image is concept art, and current windows are explicitly presentation-only. |
| Warm brick, pale stone and dark glazing | Use the palette and contrast. | Reuse existing material recipes or shared geometry relief. | New shared material generator or environment maps. | Shared material and renderer scope is outside a clean architecture rebuild. |
| Deep windows with mullions, jambs, sills and lintels | Yes. | Build actual inset openings, and ray-check all canonical target sightlines. | Any ornament that conflicts with the chart zones. | The image’s windows guide construction; canonical focus surfaces stay at their source coordinates. |
| Arched ground entrance with lanterns | Reproduce a distinct doorway and threshold. | Place it at the selected ground-floor bay with no adjacent aperture collision. | Emissive lantern light and interior furnishings. | The image does not authorize a lighting contract change. |
| Checkerboard centered in a facade opening | No literal pixel placement. | Keep the canonical 750 mm checkerboard at (0,900) mm in a quiet spandrel above the door. | Moving it behind glass or into a window. | Its world position and size are teaching geometry. |
| Red fine-detail panel near an upper-left window | No literal pixel placement. | Keep the 360×420 mm panel at (820,2200) mm, inside a quiet masonry spandrel. | Moving it to match the image or putting it behind glazing. | It contains the high-frequency focus lines used by the lesson. |
| Attached brick side return, vent and downpipe | Yes, as an architectural side volume. | Join it to the main wall and roof inside current stage/composition bounds. | Old detached side block; tall stack outside the current composition region. | A real connection must remain visible from the side and above. |
| Roof cornice, coping, parapet panels | Yes. | Keep the established top extent and maintain connected returns. | Roof silhouettes beyond protected composition bounds. | The Rise task measures existing roof regions. |
| Sidewalk, signpost and depth props | Preserve their role and visual quietness. | Refine detail inside existing bounds and at existing reference positions. | Urban clutter, traffic and people. | These objects support depth and Ground Glass interpretation. |
| Soft global shadows, rich reflections, indoor plants | Treat as visual inspiration only. | Preserve current renderer/world-lighting behavior. | Lighting, environment and large prop changes. | They are aspirational in the reference and outside PR B scope. |

## Geometry-quality requirements

PR B is visually unacceptable if any of these are present:

- a window, door, trim course, service wall or roof piece floats, intersects visibly, or exposes a gap from front, side or above-roof views;
- any doorway and window apertures touch or overlap;
- glazing reads as a front-mounted panel rather than an inset opening;
- a masonry course terminates without a return at a visible corner;
- any new mesh blocks the canonical checkerboard, any of the six fine lines, or any canonical fine-detail frame/grid sample from the physical lens;
- composition-required roof/body regions disappear or shift outside the existing task bounds.

## Multi-view and optical validation protocol

Use the actual registered asset and public scene route. Capture the current clean Observer reset state and teaching-overlay state. Then inspect a close front facade, left and right oblique/corner views, a side view, and an above-roof view. Do not substitute a single front screenshot for three-dimensional validation.

For focus visibility, cast Three.js rays from deriveOpticsState(cameraState, architectureRiseScene).lensCenterWorld through the complete mounted registered group. Sample all 64 focus-chart cells and both marker bars; sample every canonical fine-detail panel/frame/grid/fine-line piece, including line centers and line endpoints, frame-strip centers and outer corners, and intersections adjacent to window decoration. Use getArchitectureFacadeFineDetailPieces() and the focus-chart helpers as the target source. Raycast every subject mesh; do not omit decoration from the intersection set. Record the first hit object, hit distance and target distance. Compare the baseline behavior so pre-existing obstructions are distinguished from new ones.

Repeat representative samples at the reset state (focus 8890 mm, zero movement), at public focus endpoints (3090 and 13000 mm), at the guided task’s 12 and 35 mm Rise boundaries, and at a reachable mixed state such as Rise 22 mm / Tilt 0.4° / Swing −1.1°. Use the real derived lens center for each state; do not inject unreachable values or assume the lens origin is fixed when movements change it. The ray test should include a test-only negative-control blocker and prove that the same assertion detects it.

For Ground Glass, capture matched Processed, Raw and Upright Assist views at reset and a representative finite-focus/Rise state. Verify the checkerboard/fine-detail region, blur response, physical image orientation, RTT camera validity and absence of page/renderer errors. Observer camera orbit does not replace lens-origin geometry checks; both forms of evidence are required.
