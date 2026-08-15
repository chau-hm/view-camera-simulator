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
          "In the side view, the green focus plane should become nearly horizontal across the probe height.",
        nearSharp: "Watch the cup focus card in Ground Glass and the near target sharpness readout.",
        midSharp: "Use the notebook line chart as the initial focusing reference.",
        farSharp: "The far checker chart should sharpen as the focus plane reaches the far focus-card surface.",
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
        movementRange: "In Top view, the green focus plane should align with the diagonal subject trace through all three chart markers.",
        frontSharp: "In Top view, check that the green focus plane crosses the Front chart marker.",
        middleSharp: "Use the Middle chart marker as the initial focusing reference in Top view.",
        backSharp: "In Top view, extend the green focus plane through the Back chart marker.",
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
