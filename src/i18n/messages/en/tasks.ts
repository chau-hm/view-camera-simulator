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
