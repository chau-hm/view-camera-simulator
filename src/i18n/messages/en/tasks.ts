export const tasksMessages = {
  common: {
    guidedTask: "Guided task",
    allowedControls: "Allowed controls",
    viewRequirements: "View requirements",
    notStarted: "Not started",
    waitingForEvaluation:
      "Follow the task instructions and adjust the allowed controls. Feedback will update as the task is evaluated.",
    inProgress: "In progress",
    completed: "Completed",
    score: "Score",
    nextAdjustment: "Next adjustment",
    requirementsMet: "Requirements met",
    requirementsCompletedAria: "Task requirements completed",
    passed: "Passed",
    needsAdjustment: "Needs adjustment",
    taskCompleted: "Task completed",
    noAdjustmentNeeded: "No adjustment needed",
    progress: "{{passed}} of {{total}} requirements met",
    finalSettings: "Final settings",
    secondaryFeedback: "Secondary feedback",
    genericCriterion: "Task requirement",
    genericPassPrimary: "The task requirements are met.",
    genericFailPrimary: "Adjust the allowed controls and continue comparing the scene.",
    genericSecondary: "Use the task requirements to decide what to adjust next.",
  },
  controls: {
    rise: "Front Rise",
    tilt: "Front Tilt",
    swing: "Front Swing",
    focusDistance: "Focus",
    aperture: "Aperture",
    geometryView: "2D Geometry",
    cameraPosition: "Camera Position",
    frontShift: "Front Shift",
  },
  results: {
    focusTargetsSharp: {
      pass: "Focus targets are sharp enough",
      fail: "Some focus targets are too soft",
    },
    movementUsed: {
      rise: {
        pass: "Front Rise movement used",
        fail: "Front Rise movement not used enough",
      },
      tilt: {
        pass: "Front Tilt movement used",
        fail: "Front Tilt movement not used enough",
      },
      swing: {
        pass: "Front Swing movement used",
        fail: "Front Swing movement not used enough",
      },
    },
    focusUsed: {
      pass: "Focus has been adjusted",
      fail: "Focus has not been adjusted enough",
    },
    movementRange: {
      rise: {
        pass: "Front Rise is within the allowed range",
        fail: "Front Rise is outside the allowed range",
      },
      tilt: {
        pass: "Front Tilt is within the allowed range",
        fail: "Front Tilt is outside the allowed range",
      },
      swing: {
        pass: "Front Swing is within the allowed range",
        fail: "Front Swing is outside the allowed range",
      },
    },
    allowedAperture: {
      pass: "Aperture is allowed",
      fail: "Aperture is not allowed for this task",
    },
    compositionVisible: {
      pass: "Composition target is visible enough",
      fail: "Composition target visibility is too low",
    },
    cameraLevel: {
      pass: "Camera and film plane remain level",
      fail: "Camera or film-plane orientation is no longer level",
    },
    mirrorReflectionClear: {
      pass: "Camera reflection is outside the mirror aperture",
      fail: "Camera reflection is still visible through the mirror",
    },
    mirrorFramingRestored: {
      pass: "Mirror framing is close to Neutral",
      fail: "Mirror framing is still displaced from Neutral",
    },
    mirrorViewpointRetained: {
      pass: "Reflected props show a changed viewpoint",
      fail: "Reflected-prop parallax is not yet large enough",
    },
  },
  rise: {
    title: "Frame the building with Front Rise",
    objective:
      "Keep the camera level and use Front Rise to include the building top without changing the whole-camera viewpoint.",
    notes: {
      useRise: "Use Front Rise without Front Tilt or Front Swing to include the building top.",
      levelGeometry: "Keep the camera level and retain the intended parallel vertical relationship.",
    },
    criteria: {
      buildingTopVisible: "Building top visibility is at least {{coverage}}%",
      buildingMainVisible: "Main building visibility is at least {{coverage}}%",
      movementUsed: "Front Rise movement is used",
      movementRange: "Front Rise remains within {{min}} mm to {{max}} mm",
    },
    feedback: {
      passPrimary:
        "You used Front Rise to include the building top without tilting the camera body.",
      defaultFailPrimary: "Increase Front Rise while keeping Front Tilt and Front Swing at 0°.",
      primary: {
        buildingTopVisible: "The building top is still clipped. Increase Front Rise further.",
        buildingMainVisible:
          "Main building coverage is too low. Reduce excessive Front Rise slightly.",
        movementUsed: "Front Rise is too low for this framing task.",
        movementRange: "Keep Front Rise between {{min}} mm and {{max}} mm for this exercise.",
      },
      secondary: {
        buildingTopVisible: "Check the Ground Glass top edge and keep the verticals stable.",
        buildingMainVisible:
          "Reframe with Front Rise so the building body stays centered while retaining the top.",
        movementUsed: "Start from about 15 mm and fine-tune Front Rise upward.",
        movementRange: "Avoid solving this with Front Tilt; use Front Rise for the framing.",
      },
    },
  },
  obliqueRise: {
    title: "Frame the Building",
    objective:
      "Use Front Rise to include the full building while keeping the camera level and the verticals parallel.",
    notes: {
      useRise: "Keep Front Tilt and Front Swing at 0°, then increase Front Rise to bring the roof into the frame.",
      keepBase: "Include the required building top while keeping the lower building base inside the frame.",
      depth: "This lesson solves framing only; the receding façade will still have uneven sharpness.",
    },
    criteria: {
      buildingTopVisible: "Required building-top region is visible",
      buildingBaseVisible: "Required building-base region remains visible",
      cameraLevel: "Camera and rear standard remain level",
      movementUsed: "Front Rise is used",
    },
    feedback: {
      passPrimary: "Front Rise restored the building framing while the camera stayed level.",
      defaultFailPrimary: "Use Front Rise to include the roof while keeping the base and verticals stable.",
      primary: {
        buildingTopVisible: "The required roof region is still cropped. Increase Front Rise.",
        buildingBaseVisible: "Keep the lower building base inside the frame while adjusting Front Rise.",
        cameraLevel: "Keep the camera and rear standard level; do not introduce tilt, swing, or rear movement.",
        movementUsed: "Increase Front Rise to begin solving the framing problem.",
      },
      secondary: {
        buildingTopVisible: "Watch the Ground Glass top edge until the required roof corners are inside.",
        buildingBaseVisible: "Check the lower Ground Glass edge as you bring the roof into view.",
        cameraLevel: "Front Rise changes framing without pitching the camera or converging the verticals.",
        movementUsed: "Use the Front Rise control for this composition task; the exact value is not prescribed.",
      },
    },
  },
  architectureForegroundRise: {
    title: "Frame the Building",
    objective:
      "Use Front Rise to include the required roof region while keeping the building base in frame and the camera level.",
    notes: {
      useRise: "Increase Front Rise from the neutral state to bring the required roof region into frame.",
      keepBase: "Keep the building base inside the frame while you reframe upward.",
      foreground:
        "This task solves composition only; the near foreground remains softer than the building for a later lesson.",
    },
    criteria: {
      buildingTopVisible: "Required roof region is visible",
      buildingBaseVisible: "Building base remains visible",
      cameraLevel: "Camera and rear standard remain level",
      movementUsed: "Front Rise is used",
    },
    feedback: {
      passPrimary:
        "Front Rise corrected the composition while the camera stayed level. The foreground sharpness problem remains for a later lesson.",
      defaultFailPrimary:
        "Use Front Rise to include the roof while keeping the base and verticals stable.",
      primary: {
        buildingTopVisible: "The required roof region is still cropped. Increase Front Rise.",
        buildingBaseVisible: "Keep the building base inside the frame while adjusting Front Rise.",
        cameraLevel:
          "Keep the camera and rear standard level; do not introduce tilt, swing, or rear movement.",
        movementUsed: "Increase Front Rise to begin solving the composition problem.",
      },
      secondary: {
        buildingTopVisible: "Watch the Ground Glass top edge until the required roof region is inside.",
        buildingBaseVisible: "Check the lower Ground Glass edge as you bring the roof into view.",
        cameraLevel: "Front Rise changes framing without changing perspective or converging the verticals.",
        movementUsed: "Use Front Rise as the composition control; no exact slider value is required.",
      },
    },
  },
  architectureForegroundTiltFocus: {
    title: "Align the Focus Plane",
    objective:
      "Use Front Tilt and Focus to make the near foreground and the building usefully sharp while preserving the corrected architectural framing.",
    notes: {
      composition: "The building is already framed with Front Rise; keep that composition intact.",
      tilt: "Use Front Tilt to rotate the plane of sharp focus toward the foreground-to-building depth.",
      focus: "Adjust Focus to place that plane through the near foreground and the useful building reference.",
      depthOfField:
        "This task aligns the focus plane only. Aperture remains fixed, so some depth-of-field limitation remains for a later lesson.",
    },
    criteria: {
      buildingTopVisible: "Required roof region remains visible",
      buildingBaseVisible: "Building base remains visible",
      cameraLevel: "Camera and rear standard remain level",
      tiltUsed: "Front Tilt is used",
      tiltRange: "Front Tilt is within the useful range",
      focusUsed: "Focus is adjusted",
      nearSharp: "Near foreground is usefully sharp",
      buildingSharp: "Useful building reference is usefully sharp",
    },
    feedback: {
      passPrimary:
        "Front Tilt and Focus aligned the focus plane through the foreground and building while the composition stayed correct. Aperture will address the remaining depth-of-field limitation later.",
      defaultFailPrimary:
        "Keep the solved Rise framing, then use Front Tilt and Focus together to align the focus plane through the foreground and building.",
      primary: {
        buildingTopVisible: "Keep the required roof region inside the frame; do not change the solved Rise composition.",
        buildingBaseVisible: "Keep the building base inside the frame while refining the focus plane.",
        cameraLevel: "Keep the camera and rear standard level; Tilt should change the focus plane, not the film plane.",
        tiltUsed: "Apply a useful positive Front Tilt so the focus plane can reach the foreground depth.",
        tiltRange: "Refine Front Tilt within the useful positive range rather than using an excessive angle.",
        focusUsed: "Adjust Focus after applying Tilt so the focus plane is placed through the subject depth.",
        nearSharp: "The near foreground remains soft. Use positive Front Tilt and refine Focus until the paving target is sharp.",
        buildingSharp: "The building reference is not sharp enough. Refine Focus while keeping the useful Front Tilt range.",
      },
      secondary: {
        buildingTopVisible: "Use the Ground Glass top edge as a framing guardrail while working on focus.",
        buildingBaseVisible: "Tilt and Focus should preserve the solved Rise composition; watch the lower Ground Glass edge.",
        cameraLevel: "Front Tilt rotates the lens and focus plane without pitching the camera or rear standard, so verticals stay parallel.",
        tiltUsed: "A non-zero Front Tilt is needed; Focus alone cannot rotate the plane of sharp focus.",
        tiltRange: "The useful solution is modest and positive; do not chase sharpness with an extreme Tilt angle.",
        focusUsed: "Tilt changes plane orientation; Focus then places that plane through the foreground-to-building depth.",
        nearSharp: "Compare the regular near paving seams and the Near foreground target rather than judging only the building.",
        buildingSharp: "Use the building-middle reference as the architectural focus target, then compare the remaining finite DOF.",
      },
    },
  },
  architectureForegroundDof: {
    title: "Extend the Depth of Field",
    objective:
      "Stop down the Aperture until the foreground and building are acceptably sharp while keeping the existing composition and focus-plane alignment.",
    notes: {
      composition: "Front Rise has already corrected the framing; keep the roof and building base inside the frame.",
      focusPlane: "Front Tilt and Focus are already correct. Aperture does not move the focus plane.",
      aperture: "Use Aperture to stop down from f/11. A smaller aperture increases usable depth around the aligned focus plane.",
      depthOfField: "Stop down only as much as needed to cover the remaining subject depth; depth of field remains finite.",
    },
    criteria: {
      buildingTopVisible: "Required roof region remains visible",
      buildingBaseVisible: "Building base remains visible",
      cameraLevel: "Camera and rear standard remain level",
      aperture: "Aperture is stopped down for this task",
      focusTargets: "Foreground and architectural depth targets are acceptably sharp",
    },
    feedback: {
      passPrimary:
        "The focus plane was already aligned; stopping down has now expanded usable depth around it. Composition, perspective, Tilt, and Focus remain unchanged.",
      defaultFailPrimary:
        "Keep the solved composition and focus-plane alignment, then stop down Aperture until the foreground and building depth targets are acceptably sharp.",
      primary: {
        buildingTopVisible: "Keep the required roof region inside the frame; Aperture should not change the solved composition.",
        buildingBaseVisible: "Keep the building base inside the frame while extending depth of field.",
        cameraLevel: "Keep the camera and rear standard level; Aperture does not require a perspective change.",
        aperture: "Stop down from f/11 with the Aperture control. Do not reopen the aperture after the depth targets improve.",
        focusTargets: "The focus plane is aligned, but some foreground or architectural depth remains soft. Stop down Aperture further.",
      },
      secondary: {
        buildingTopVisible: "Use the Ground Glass edges as framing guardrails; Rise is already solved for this task.",
        buildingBaseVisible: "Aperture changes usable sharpness, not framing. Leave the solved base position intact.",
        cameraLevel: "Aperture broadens depth around the focus plane without pitching the camera or changing vertical convergence.",
        aperture: "Use the next smaller supported aperture rather than changing Tilt or Focus.",
        focusTargets: "Compare the regular paving seams with the building base and middle targets as depth of field expands.",
      },
    },
  },
  architectureForegroundCompound: {
    title: "Complete the Photograph",
    objective:
      "Correct the framing, align and place the focus plane, then use Aperture to produce an acceptably sharp architectural photograph from foreground to building while preserving parallel verticals.",
    notes: {
      composition: "Start from the neutral frame. Use Front Rise to bring the roof in without tilting the camera or rear standard.",
      tilt: "Use Front Tilt to orient the focus plane toward the foreground-to-building depth.",
      focus: "Use Focus to place that plane through useful foreground and architectural targets.",
      aperture: "Use Aperture to extend usable sharpness around the aligned plane; solve the whole result rather than one slider value.",
    },
    criteria: {
      buildingTopVisible: "Required roof region is visible",
      buildingBaseVisible: "Building base remains visible",
      cameraLevel: "Camera and rear standard remain level",
      focusTargets: "Foreground-to-building depth is acceptably sharp",
    },
    feedback: {
      passPrimary:
        "You completed the photograph: Rise corrected framing, Tilt and Focus aligned the focus plane, and Aperture extended usable depth while the rear standard stayed level.",
      defaultFailPrimary:
        "Solve the photograph as a whole: keep the camera level, include the roof and base, align focus through the subject depth, and extend usable sharpness.",
      primary: {
        buildingTopVisible: "Keep the required roof region inside the frame without pitching the camera or rear standard.",
        buildingBaseVisible: "Reduce excessive Rise so the building base remains inside the frame.",
        cameraLevel: "Keep the camera and rear standard level so the architectural verticals remain parallel.",
        focusTargets: "The focus plane or usable depth does not yet cover the foreground and building. Align Tilt and Focus before extending DOF with Aperture.",
      },
      secondary: {
        buildingTopVisible: "Use the Ground Glass top edge as a composition guardrail while solving the other photographic properties.",
        buildingBaseVisible: "Rise changes framing only; watch the lower Ground Glass edge as you include the roof.",
        cameraLevel: "Rise, Tilt, Focus, and Aperture can be combined while the level rear standard preserves parallel verticals.",
        focusTargets: "Compare the regular paving seams with the building base and middle targets; Aperture cannot hide a fundamentally misplaced focus plane.",
      },
    },
  },
  obliqueSwingFocus: {
    title: "Align the Façade Focus",
    objective:
      "Use Front Swing and Focus to keep the receding façade sharp from near to far while preserving the architectural framing.",
    notes: {
      composition: "The building is already framed with Front Rise; keep that composition intact.",
      swing: "Use Front Swing to rotate the plane of sharp focus toward the receding façade.",
      focus: "Refine Focus so the plane passes through the near, middle, and far façade regions.",
      level: "Keep the rear standard level so the building verticals remain parallel.",
    },
    criteria: {
      buildingTopVisible: "Required building-top region remains visible",
      buildingBaseVisible: "Required building-base region remains visible",
      cameraLevel: "Camera and rear standard remain level",
      nearSharp: "Near façade region is sharp",
      middleSharp: "Middle façade region is sharp",
      farSharp: "Far façade region is sharp",
    },
    feedback: {
      passPrimary: "Front Swing and Focus aligned the façade while the level rear standard preserved the framing.",
      defaultFailPrimary: "Keep the solved Rise framing, then use Front Swing and Focus until the façade is sharp from near to far.",
      primary: {
        buildingTopVisible: "Keep the required roof region inside the frame; do not change the solved Rise composition.",
        buildingBaseVisible: "Keep the lower building base inside the frame while refining the focus plane.",
        cameraLevel: "Keep the rear standard level; Front Swing should rotate the lens/focus plane, not the film plane.",
        nearSharp: "The near façade remains soft. Adjust Front Swing and refine Focus so the focus plane reaches the near region.",
        middleSharp: "The middle façade is not sharp enough. Refine Focus around the middle region before fine-tuning Swing.",
        farSharp: "The far façade remains soft. Continue refining Front Swing and Focus across the receding depth.",
      },
      secondary: {
        buildingTopVisible: "Use the Ground Glass top edge as a framing guardrail while working on focus.",
        buildingBaseVisible: "Swing and Focus should preserve the Rise composition; watch the lower Ground Glass edge.",
        cameraLevel: "A non-zero Front Swing changes lens-plane orientation without pitching the camera or rear standard.",
        nearSharp: "Check the near window target and its surrounding sharpness patch in the readout.",
        middleSharp: "Use the middle window as the initial focus reference, then compare all three depths.",
        farSharp: "Use the Top geometry view to see whether the focus plane reaches the far façade target.",
      },
    },
  },
  obliqueCompound: {
    title: "Complete the Photograph",
    objective:
      "Use Front Rise, Front Swing, and Focus to frame the building, keep its verticals parallel, and make the receding façade sharp from near to far.",
    notes: {
      composition: "Start by solving the composition with Front Rise.",
      swing: "Then use Front Swing to rotate the plane of sharp focus toward the receding façade.",
      focus: "Refine Focus until the near, middle, and far façade regions are all sharp.",
      level: "Keep the rear standard level throughout.",
    },
    criteria: {
      buildingTopVisible: "Required building-top region is visible",
      buildingBaseVisible: "Required building-base region is visible",
      cameraLevel: "Camera and rear standard remain level",
      nearSharp: "Near façade region is sharp",
      middleSharp: "Middle façade region is sharp",
      farSharp: "Far façade region is sharp",
    },
    feedback: {
      passPrimary:
        "The building is framed, its verticals remain parallel, and the receding façade is sharp from near to far.",
      defaultFailPrimary:
        "Use Front Rise to frame the building, then Front Swing and Focus to make the receding façade sharp.",
      primary: {
        buildingTopVisible: "Use Front Rise to bring the required roof region into the Ground Glass.",
        buildingBaseVisible: "Keep the lower building inside the frame while adjusting Front Rise.",
        cameraLevel: "Keep the rear standard level so the architectural verticals remain parallel.",
        nearSharp:
          "The near façade remains soft. Use Front Swing to align the focus plane with the receding façade, then refine Focus.",
        middleSharp: "The middle façade is not sharp enough. Refine Focus around the middle region.",
        farSharp: "The far façade remains soft. Continue refining Front Swing and Focus across the receding depth.",
      },
      secondary: {
        buildingTopVisible: "Watch the Ground Glass top edge until the required roof corners are inside.",
        buildingBaseVisible: "Check the lower Ground Glass edge as you bring the roof into view.",
        cameraLevel: "Front Rise and Front Swing should leave the rear standard level; do not pitch the camera.",
        nearSharp: "Compare the near façade target with the middle and far targets in the sharpness readout.",
        middleSharp: "Use the middle façade as your initial Focus reference before comparing all three depths.",
        farSharp: "Use the Top geometry view to see whether the plane of sharp focus reaches the far façade target.",
      },
    },
  },
  obliqueTabletopFocus: {
    title: "Focus the tabletop centre",
    objective:
      "Focus the middle region first. Notice that Focus moves the plane through space but does not match the tabletop's orientation.",
    notes: {
      focus: "Use the middle tabletop region as your reference, then compare it with the other visible regions.",
      constraints:
        "Keep Front Tilt and Front Swing at zero. Aperture stays at f/11; do not try to solve the whole tabletop yet.",
    },
    criteria: {
      allowedAperture: "Aperture remains at f/11",
      riseZero: "Front Rise remains at 0 mm",
      tiltZero: "Front Tilt remains at 0°",
      swingZero: "Front Swing remains at 0°",
      focusUsed: "Focus moves at least 100 mm from the starting position",
      middleSharp: "The middle tabletop region is sharp",
    },
    feedback: {
      passPrimary:
        "Good. Focus placed the plane through the middle region; the tabletop still disagrees with it in other directions.",
      defaultFailPrimary:
        "Focus the middle tabletop region first, then compare it with the surrounding near, far, left, and right regions.",
      primary: {
        allowedAperture: "Keep the aperture at f/11; aperture is not part of this first focus step.",
        riseZero: "Return Front Rise to 0 mm; this scene begins with focusing, not a camera movement.",
        tiltZero: "Keep Front Tilt at 0° until the focus reference is established.",
        swingZero: "Keep Front Swing at 0° until the focus reference is established.",
        focusUsed: "Move Focus from the starting position so the focus change is observable.",
        middleSharp: "Use the middle tabletop region as the focus reference and refine Focus until it is sharp.",
      },
      secondary: {
        allowedAperture: "The fixed f/11 aperture keeps this comparison about focus placement.",
        riseZero: "The tabletop is already framed; leave the camera position unchanged.",
        tiltZero: "Focus moves a plane through space; Front Tilt will address its near-to-far direction later.",
        swingZero: "Focus on the central reference before changing the tabletop plane's orientation.",
        focusUsed: "Compare the focus readout before and after moving the plane onto the middle region.",
        middleSharp: "After the middle region sharpens, observe that other tabletop regions remain soft.",
      },
    },
  },
  obliqueTabletopTilt: {
    title: "Improve near-to-far focus",
    objective:
      "Use Front Tilt and the Side view to improve the near-to-far relationship. Refine Focus if needed.",
    notes: {
      tilt: "Use the negative Front Tilt direction that brings the near, middle, and far depth regions closer to one focus plane.",
      constraints:
        "Keep Front Rise and Front Swing at zero. Aperture stays at f/11; the side-view improvement is intentionally partial.",
    },
    criteria: {
      allowedAperture: "Aperture remains at f/11",
      riseZero: "Front Rise remains at 0 mm",
      swingZero: "Front Swing remains at 0°",
      movementRange: "Front Tilt is in the calibrated negative range",
      nearSharp: "The near-centre tabletop region is sharp",
      middleSharp: "The middle tabletop region is sharp",
      farSharp: "The far-centre tabletop region is sharp",
    },
    feedback: {
      passPrimary:
        "Good. Front Tilt and Focus improved the principal near-to-far relationship. The lateral difference remains for the next stage.",
      defaultFailPrimary:
        "Use the calibrated negative Front Tilt direction in the Side view, then refine Focus across the near, middle, and far regions.",
      primary: {
        allowedAperture: "Keep the aperture at f/11; do not use depth of field to hide an incorrect plane.",
        riseZero: "Return Front Rise to 0 mm; this stage changes the focus-plane orientation with Front Tilt.",
        swingZero: "Keep Front Swing at 0°; the remaining lateral component is deliberate here.",
        movementRange: "Use the negative Front Tilt range; the opposite sign turns the near-to-far relationship the wrong way.",
        nearSharp: "The near-centre region is still soft. Set the negative Front Tilt direction, then refine Focus.",
        middleSharp: "Keep the middle region as a reference while adjusting Front Tilt and Focus.",
        farSharp: "The far-centre region is still soft. Continue with the negative Front Tilt direction and refine Focus.",
      },
      secondary: {
        allowedAperture: "The fixed f/11 aperture keeps this stage about plane orientation, not extra depth of field.",
        riseZero: "Use the Side geometry view to inspect the focus plane without changing the camera position.",
        swingZero: "Leave the lateral component unresolved so the effect of Front Tilt is clear.",
        movementRange: "Compare the green focus plane with the tabletop trace from near to far; do not use a positive tilt as a shortcut.",
        nearSharp: "Compare the near-centre readout with the middle and far-centre readouts.",
        middleSharp: "Refine Focus around the middle after each Tilt adjustment.",
        farSharp: "The improvement is along one direction only; the side view should still leave the lateral problem visible.",
      },
    },
  },
  obliqueTabletopSwing: {
    title: "Add the lateral component",
    objective:
      "Add Front Swing to improve the remaining left-to-right relationship while preserving the useful near-to-far Tilt relationship.",
    notes: {
      swing: "Keep the useful near-to-far Tilt relationship, then add negative Front Swing and refine Focus to improve the lateral component.",
      constraints:
        "Keep Front Rise at zero and leave the aperture at f/11. Compare the left and right regions; full visible-tabletop sharpness belongs to Refine Focus.",
    },
    criteria: {
      allowedAperture: "Aperture remains at f/11",
      riseZero: "Front Rise remains at 0 mm",
      tiltRange: "Front Tilt preserves a useful negative near-to-far relationship",
      movementRange: "Front Swing is in the useful negative range",
      focusUsed: "Focus is refined after changing the movements",
      lateralSharp: "The far-row left and right regions show lateral improvement",
    },
    feedback: {
      passPrimary:
        "Good. Swing has improved the lateral relationship. The compound plane is oriented more closely to the tabletop; refine Focus next to place it accurately.",
      defaultFailPrimary:
        "Keep the useful negative Tilt relationship, add negative Swing in the Top view, and compare the left and right regions. Full tabletop sharpness is intentionally left for Refine Focus.",
      primary: {
        allowedAperture: "Keep the aperture at f/11; the movement combination must solve the plane before stopping down.",
        riseZero: "Return Front Rise to 0 mm; this stage adds the lateral optical component.",
        tiltRange: "Keep Front Tilt in the useful negative range so the near-to-far relationship remains available while Swing changes the lateral component.",
        movementRange: "Use the useful negative Front Swing range; the opposite sign turns the lateral relationship the wrong way.",
        focusUsed: "Refine Focus after changing the movements so the visible lateral comparison is meaningful.",
        lateralSharp: "The far-row left and right regions are not yet close enough. Keep the useful Tilt relationship, add negative Swing, and refine Focus.",
      },
      secondary: {
        allowedAperture: "Use the Top view and f/11 to compare the movement solution without extra depth of field.",
        riseZero: "Do not change the camera position while comparing the left and right regions.",
        tiltRange: "The Top view shows Swing's contribution most clearly when the useful near-to-far Tilt relationship is retained.",
        movementRange: "Compare the green focus plane with the lateral tabletop trace; positive Swing rotates it away from the surface.",
        focusUsed: "Changing either movement can change plane placement, so refine Focus before judging the result.",
        lateralSharp: "Check the left and right regions in the far row, then remember that full visible-tabletop sharpness is the next stage.",
      },
    },
  },
  obliqueTabletopRefine: {
    title: "Place the compound focus plane",
    objective:
      "With Tilt and Swing setting the plane orientation, refine Focus until the visible tabletop regions fall on the same plane of sharp focus.",
    notes: {
      focus: "Keep both movement components near their useful relationship and use Focus to place the resulting plane on the tabletop.",
      constraints:
        "Keep Front Rise at zero and the aperture at f/11. Judge the result across the visible tabletop, not from one target alone.",
    },
    criteria: {
      allowedAperture: "Aperture remains at f/11",
      riseZero: "Front Rise remains at 0 mm",
      tiltRange: "Front Tilt remains near the calibrated compound relationship",
      swingRange: "Front Swing remains near the calibrated compound relationship",
      focusUsed: "Focus is refined from the starting position",
      allTargetsSharp: "All visible tabletop regions are sharp",
    },
    feedback: {
      passPrimary:
        "The compound plane is now placed on the tabletop at f/11. The final step will add depth around this aligned plane.",
      defaultFailPrimary:
        "Keep Tilt and Swing near their useful compound relationship, then refine Focus across the visible tabletop regions.",
      primary: {
        allowedAperture: "Keep the aperture at f/11; first place the compound plane before adding depth around it.",
        riseZero: "Return Front Rise to 0 mm; only Tilt, Swing, and Focus belong to this plane-placement step.",
        tiltRange: "Keep Front Tilt near its calibrated compound relationship while refining the plane placement.",
        swingRange: "Keep Front Swing near its calibrated compound relationship while refining the plane placement.",
        focusUsed: "Refine Focus from the starting position so the compound plane moves onto the tabletop.",
        allTargetsSharp: "Some visible regions are still soft. Compare the whole visible set and refine Focus without losing the compound movement relationship.",
      },
      secondary: {
        allowedAperture: "The f/11 setting makes the plane placement visible before the aperture step.",
        riseZero: "Use the geometry views to inspect the same focus plane without changing framing.",
        tiltRange: "Side view shows the near-to-far component of the one compound plane.",
        swingRange: "Top view shows the lateral component of that same plane.",
        focusUsed: "After changing either movement, refocus because the plane's position changes as well as its orientation.",
        allTargetsSharp: "Compare near/far and left/right rows; one sharp marker is not enough evidence of alignment.",
      },
    },
  },
  obliqueTabletopAperture: {
    title: "Add depth around the plane",
    objective:
      "The plane is aligned. Now stop down to add depth around that plane — not to replace the movements.",
    notes: {
      aperture: "Keep the compound Tilt, Swing, and Focus relationship, then choose the next modest smaller aperture.",
      constraints:
        "Do not change the movements or Focus in this final stage. Aperture changes usable depth around the aligned plane.",
    },
    criteria: {
      allowedAperture: "Aperture is set to the modest final stop-down",
      riseZero: "Front Rise remains at 0 mm",
      tiltRange: "Front Tilt remains near the calibrated compound relationship",
      swingRange: "Front Swing remains near the calibrated compound relationship",
      allTargetsSharp: "The aligned visible tabletop regions remain sharp",
    },
    feedback: {
      passPrimary:
        "Complete. Tilt and Swing oriented one three-dimensional focus plane, Focus placed it on the tabletop, and the smaller aperture added depth around it.",
      defaultFailPrimary:
        "Keep the compound plane aligned, then stop down one modest step. Aperture adds depth around the plane; it cannot replace the movements.",
      primary: {
        allowedAperture: "Choose the modest smaller aperture for this final step; do not leave the starting f/11 setting.",
        riseZero: "Keep Front Rise at 0 mm; aperture should not change the established framing.",
        tiltRange: "Restore Front Tilt to the useful compound relationship before relying on the final aperture.",
        swingRange: "Restore Front Swing to the useful compound relationship before relying on the final aperture.",
        allTargetsSharp: "The visible tabletop is not aligned yet. Aperture cannot substitute for the correct Tilt, Swing, and Focus state.",
      },
      secondary: {
        allowedAperture: "The stop-down is deliberately modest: it adds tolerance around an already aligned plane.",
        riseZero: "Keep the camera and tabletop framing unchanged while comparing depth around the plane.",
        tiltRange: "The Side view still represents the same near-to-far component after the aperture change.",
        swingRange: "The Top view still represents the same lateral component after the aperture change.",
        allTargetsSharp: "If a stopped-down image is soft in the wrong regions, return to plane alignment instead of stopping down further.",
      },
    },
  },
  tableTilt: {
    title: "Align the tabletop plane of sharp focus",
    objective:
      "Use Front Tilt and Focus to align the plane of sharp focus with all three coplanar focus cards.",
    notes: {
      focusAndTilt:
        "Focus near the middle card first. Then use positive Front Tilt to align the plane of sharp focus with all three coplanar focus cards.",
      constraints:
        "Keep Front Rise and Front Swing at zero. Solve the lesson at f/11 or f/22; do not use f/32 as a shortcut.",
    },
    criteria: {
      allowedAperture: "Aperture is f/11 or f/22",
      riseZero: "Front Rise remains at 0 mm",
      swingZero: "Front Swing remains at 0°",
      movementRange: "Front Tilt remains within {{min}}° to {{max}}°",
      nearSharp: "Near cup focus card is sharp",
      midSharp: "Middle notebook line chart is sharp",
      farSharp: "Far book focus chart is sharp",
    },
    feedback: {
      passPrimary:
        "Great. Positive Front Tilt aligned the plane of sharp focus with all three coplanar focus cards.",
      defaultFailPrimary:
        "Focus on the middle card, apply positive Front Tilt, then refine Focus across all three focus cards.",
      primary: {
        allowedAperture: "Do not use f/32. Solve this at f/11 or f/22 with Front Tilt and Focus.",
        riseZero: "Return Front Rise to 0 mm; this lesson is solved with Front Tilt and Focus.",
        swingZero: "Return Front Swing to 0°; Swing cannot align a near-to-far tabletop.",
        movementRange: "Use positive Front Tilt near {{tiltDeg}}° for this calibrated tabletop.",
        nearSharp:
          "The near cup focus card is soft. Fine-tune Focus after setting the calibrated Front Tilt.",
        midSharp: "The notebook line chart is soft. Refocus around the middle target.",
        farSharp: "The far book chart is soft. Refine Focus without adding Front Swing.",
      },
      secondary: {
        allowedAperture: "Compare f/11 and f/22, but do not rely on f/32.",
        riseZero: "The side-view geometry should keep the lens centre at the canonical datum.",
        swingZero: "Watch the top-view readout: Front Swing must remain zero for this tilt-only task.",
        movementRange:
          "In the side view, the green plane of sharp focus should become nearly horizontal across the probe height.",
        nearSharp: "Watch the cup focus card in Ground Glass and the near target sharpness readout.",
        midSharp: "Use the notebook line chart as the initial focusing reference.",
        farSharp: "The far checker chart should sharpen as the plane of sharp focus reaches the far focus-card surface.",
      },
    },
  },
  shelfSwing: {
    title: "Align the diagonal plane of sharp focus",
    objective:
      "Use negative Front Swing and Focus to align the plane of sharp focus through all three charts arranged diagonally in depth.",
    notes: {
      focusAndSwing:
        "Focus on the middle chart first, then apply negative Front Swing to rotate the plane of sharp focus through the front, middle, and back charts.",
      constraints:
        "Keep Front Rise and Front Tilt at zero. Solve the lesson at f/11 or f/22 rather than relying on f/32.",
    },
    criteria: {
      allowedAperture: "Aperture is f/11 or f/22",
      riseZero: "Front Rise remains at 0 mm",
      tiltZero: "Front Tilt remains at 0°",
      movementRange: "Front Swing remains within {{min}}° to {{max}}°",
      frontSharp: "Front chart is sharp",
      middleSharp: "Middle chart is sharp",
      backSharp: "Back chart is sharp",
    },
    feedback: {
      passPrimary:
        "Great. Negative Front Swing rotated the plane of sharp focus through all three diagonal charts.",
      defaultFailPrimary:
        "Focus on the middle chart, apply negative Front Swing, then refine Focus until all three charts are sharp.",
      primary: {
        allowedAperture:
          "Solve this at f/11 or f/22. Do not rely on f/32 to hide an incorrect plane of sharp focus.",
        riseZero: "Return Front Rise to 0 mm; this lesson is solved with Front Swing and Focus.",
        tiltZero: "Return Front Tilt to 0°; Tilt changes the vertical focus relationship and is not part of this lesson.",
        movementRange:
          "Use negative Front Swing near {{swingDeg}}°. Positive Front Swing rotates the plane of sharp focus in the opposite direction.",
        frontSharp: "The plane of sharp focus has not reached the front chart. Keep negative Front Swing and refine Focus.",
        middleSharp: "Establish sharp focus on the middle chart before refining negative Front Swing.",
        backSharp: "The plane of sharp focus has not extended through the back chart. Refine negative Front Swing and Focus.",
      },
      secondary: {
        allowedAperture: "Use the Top view to judge plane alignment instead of stopping down farther.",
        riseZero: "In Top view, keep the lens centre on the canonical optical-axis datum.",
        tiltZero: "This lesson uses the horizontal Top-view relationship; keep Front Tilt at zero.",
        movementRange: "In Top view, the green plane of sharp focus should align with the diagonal subject trace through all three chart markers.",
        frontSharp: "In Top view, check that the green plane of sharp focus crosses the Front chart marker.",
        middleSharp: "Use the Middle chart marker as the initial focusing reference in Top view.",
        backSharp: "In Top view, extend the green plane of sharp focus through the Back chart marker.",
      },
    },
  },
  mirrorShift: {
    title: "Restore mirror framing after changing viewpoint",
    objective:
      "Move the whole camera sideways to clear its reflection, then use opposite Front Shift to restore the mirror framing while keeping the changed viewpoint.",
    notes: {
      clearReflection: "Move the whole camera sideways until its reflection is completely outside the mirror.",
      restoreFraming: "Keep Camera Position there. Apply opposite Front Shift to restore the mirror framing.",
      retainViewpoint: "Keep the film plane parallel to the mirror; do not move the camera back after the reflection is clear.",
    },
    criteria: {
      reflectionClear: "Camera reflection is clear of the mirror",
      framingRestored: "Mirror framing is restored near Neutral",
      viewpointRetained: "Reflected props retain a changed viewpoint",
    },
    feedback: {
      passPrimary: "Success. Mirror framing is restored, and the camera remains outside the reflection.",
      passSecondary:
        "The reflected props still differ from Neutral because the viewpoint changed. Front Shift restored framing without returning the camera to its original position.",
      defaultFailPrimary: "Move the whole camera sideways until its reflection is completely outside the mirror.",
      primary: {
        reflectionClear: "Move the whole camera sideways until its reflection is completely outside the mirror.",
        framingRestored:
          "Good—the camera is out of the reflection. Keep it in place and apply opposite Front Shift to restore the mirror framing.",
        viewpointRetained: "The framing is close, but the viewpoint has not changed enough.",
      },
      secondary: {
        reflectionClear: "Do not use Front Shift yet to hide the camera. Moving the whole camera changes the viewpoint.",
        framingRestored:
          "Watch the Ground Glass. Front Shift changes framing without moving the camera back to the original viewpoint.",
        viewpointRetained:
          "Move the whole camera farther sideways, then compensate again with Front Shift. Compare the two reflected props as a parallax cue.",
      },
    },
  },
} as const;
