export const interiorCornerTaskMessages = {
  interiorCornerCompose: {
    title: "Compose the Interior Corner with Rise",
    objective:
      "Use Front Rise to bring the upper architectural detail into the frame while keeping the camera level.",
    notes: {
      composition: "Use the Ground Glass edges to bring the upper detail into a safer frame position.",
      level: "Front Rise changes framing without pitching the camera or changing the room's perspective.",
    },
    criteria: {
      composition: "Upper detail and room corner are inside the safe frame",
      cameraLevel: "Camera and rear standard remain level",
    },
    feedback: {
      passPrimary:
        "The composition is corrected without tilting the camera. Keep that framing and turn to the receding wall.",
      defaultFailPrimary:
        "Use Front Rise to bring the upper architectural detail into the frame while keeping the camera level.",
      primary: {
        composition: "The upper architectural detail is still too close to the top edge. Increase Front Rise gradually.",
        cameraLevel: "Keep the camera and rear standard level; use Front Rise for this framing adjustment.",
      },
      secondary: {
        composition: "Compare the upper detail and room corner against the Ground Glass edges before continuing.",
        cameraLevel: "Rise changes framing only. It should not introduce camera pitch or converging verticals.",
      },
    },
  },
  interiorCornerSwing: {
    title: "Turn the Focus Plane with Swing",
    objective:
      "Use Front Swing to rotate the focus plane toward the receding wall. Keep Focus unchanged for now so you can see the orientation change.",
    notes: {
      swing: "Add the positive Front Swing direction while preserving the useful composed framing.",
      orientation: "This stage changes the focus-plane direction; placing it accurately on the wall comes next.",
      level: "Keep the camera level while the front standard changes the focus-plane orientation.",
    },
    criteria: {
      allowedAperture: "Aperture remains at f/5.6",
      composition: "The composed upper detail and room corner remain inside the safe frame",
      swingRange: "Front Swing is in the useful positive range",
      orientation: "The focus-plane orientation points toward the receding wall",
      cameraLevel: "Camera and rear standard remain level",
    },
    feedback: {
      passPrimary:
        "The focus plane is turning in the right direction, but it is not yet placed on the wall. Refine Focus next.",
      defaultFailPrimary:
        "Keep the composed framing, then use positive Front Swing to turn the focus plane toward the receding wall.",
      primary: {
        allowedAperture: "Keep the aperture at f/5.6 so this stage reveals orientation rather than extra depth of field.",
        composition: "Preserve the useful Rise composition while adding the focus-plane rotation.",
        swingRange: "Use a moderate positive Front Swing; the opposite direction turns the plane away from the receding wall.",
        orientation: "The focus plane is not yet turning toward the wall. Use positive Front Swing and compare the top view.",
        cameraLevel: "Keep the camera level; Swing changes the focus-plane direction, not the camera pitch.",
      },
      secondary: {
        allowedAperture: "Leave f/5.6 selected so the movement's orientation effect remains visible.",
        composition: "The Rise composition is a prerequisite; do not solve this stage by changing the camera position.",
        swingRange: "Compare the top-view plane with the receding wall before judging the direction.",
        orientation: "The wall is not fully sharp yet. This stage establishes direction; accurate Focus placement belongs next.",
        cameraLevel: "A level rear standard keeps the room's vertical references stable while Swing rotates the focus plane.",
      },
    },
  },
  interiorCornerRefine: {
    title: "Place the Focus Plane on the Wall",
    objective:
      "Keep the useful Swing relationship and refine Focus until the near, middle, and far wall details fall on the same plane of sharp focus.",
    notes: {
      focus: "Use Focus to place the already oriented plane on the receding wall.",
      wall: "Compare the near, middle, and far wall details rather than relying on one reference.",
      level: "Keep the camera level and preserve the useful Rise composition.",
    },
    criteria: {
      allowedAperture: "Aperture remains at f/5.6",
      composition: "The composed upper detail and room corner remain inside the safe frame",
      swingRange: "Front Swing remains in the useful positive range",
      focusUsed: "Focus is refined from the starting position",
      wallFocus: "Near, middle, and far wall details are sharp",
      cameraLevel: "Camera and rear standard remain level",
    },
    feedback: {
      passPrimary:
        "The receding wall is aligned at f/5.6. The final step is to add depth around that plane.",
      defaultFailPrimary:
        "Keep the useful positive Swing relationship and refine Focus until the near, middle, and far wall details are sharp.",
      primary: {
        allowedAperture: "Keep the aperture at f/5.6; place the focus plane before adding depth around it.",
        composition: "Preserve the corrected Rise framing while refining the focus plane.",
        swingRange: "Keep Front Swing near its useful positive relationship while placing the plane.",
        focusUsed: "Refine Focus from the starting position so the oriented plane moves onto the wall.",
        wallFocus: "Some wall details are still soft. Compare near, middle, and far, then refine Focus.",
        cameraLevel: "Keep the camera level; only the focus-plane placement should change in this stage.",
      },
      secondary: {
        allowedAperture: "The open f/5.6 setting keeps this stage about plane placement, not depth of field.",
        composition: "Use the existing framing as a guardrail while comparing all three wall distances.",
        swingRange: "The top view shows the useful lateral orientation; avoid losing it while focusing.",
        focusUsed: "After changing the plane's orientation, refocus to place it accurately on the wall.",
        wallFocus: "One sharp wall detail is not enough. Check the near, middle, and far positions together.",
        cameraLevel: "Rise and Swing do not require camera pitch; keep the rear standard level.",
      },
    },
  },
  interiorCornerAperture: {
    title: "Add Depth around the Aligned Plane",
    objective:
      "The plane is already aligned. Stop down modestly to add tolerance around it — not to replace Rise, Swing, or Focus.",
    notes: {
      aperture: "Choose the next modest smaller aperture while leaving the aligned movements and Focus unchanged.",
      preserve: "Aperture adds depth around a correctly placed plane; it cannot repair an incorrect one.",
      level: "Keep the camera level and the established composition unchanged.",
    },
    criteria: {
      allowedAperture: "Aperture is set to the modest final stop-down",
      composition: "The composed upper detail and room corner remain inside the safe frame",
      swingRange: "Front Swing remains in the useful positive range",
      focusPreserved: "The aligned wall focus is preserved",
      cameraLevel: "Camera and rear standard remain level",
    },
    feedback: {
      passPrimary:
        "Complete. Rise corrected the framing, Swing oriented the focus plane, Focus placed it on the wall, and the smaller aperture added depth around it.",
      defaultFailPrimary:
        "Keep the aligned composition and focus plane, then stop down one modest step. Aperture cannot replace the earlier adjustments.",
      primary: {
        allowedAperture: "Choose the next modest smaller aperture, f/11, for this final stage.",
        composition: "Keep the established Rise composition unchanged while stopping down.",
        swingRange: "Restore the useful positive Swing relationship before relying on aperture.",
        focusPreserved: "The receding wall is not aligned at the open calibration aperture. Return to the correct Rise, Swing, and Focus state.",
        cameraLevel: "Keep the camera level; aperture should not change the established geometry.",
      },
      secondary: {
        allowedAperture: "The stop-down is deliberately modest: it adds tolerance around an already aligned plane.",
        composition: "Compare the same upper detail and room corner after changing aperture.",
        swingRange: "Keep the same focus-plane orientation while comparing the added depth.",
        focusPreserved: "If stopped-down sharpness is poor, fix plane placement rather than using a smaller aperture as a shortcut.",
        cameraLevel: "The level camera and unchanged framing keep this comparison about usable depth.",
      },
    },
  },
} as const;
