export const simulatorMessages = {
  task: {
    title: "Task",
    freePractice: "Free practice",
  },
  feedback: {
    title: "Feedback",
    liveObservation: "Live observation",
  },
  movementHelp: {
    button: "Help",
    title: "Movement help",
    close: "Close help",
    rise:
      "Front Rise moves the lens standard vertically to change framing without moving the whole-camera viewpoint.",
    tilt:
      "Front Tilt rotates the lens standard in the vertical/depth relationship, rotating the plane of sharp focus through depth.",
    swing:
      "Front Swing rotates the lens standard in the horizontal/depth relationship, rotating the plane of sharp focus across subjects arranged diagonally in depth.",
  },
  freePractice: {
    generic: {
      objective: "Explore the scene without a scored task.",
      observation:
        "Changes are reflected immediately in the 3D Scene, Ground Glass, and learner readouts.",
    },
    understanding: {
      objective:
        "Compare whole-camera viewpoint movement with Front and Rear standard movements, and observe which image relationships change.",
      bullets: {
        viewpoint:
          "Move Viewpoint lower and higher with the standards neutral. Watch perspective relationships, parallax, and visible subject surfaces change as the whole camera moves.",
        tilt:
          "Return to the neutral viewpoint, then compare Front and Rear Tilt. Front Tilt changes lens-plane orientation; Rear Tilt changes film-plane orientation, so their image consequences are not interchangeable.",
        verticalFraming:
          "Compare Front and Rear Vertical Framing. The whole-camera viewpoint stays fixed while the selected standard moves vertically.",
        compare:
          "Use the 3D camera geometry and Ground Glass together. Ask what physically moved, what stayed fixed, and what changed in the image.",
      },
      observation:
        "Whole-camera Viewpoint movement changes perspective relationships and parallax. Front or Rear standard movement keeps the whole-camera viewpoint fixed. Compare the Ground Glass and camera geometry to see which relationship each movement changes.",
    },
    focusFundamentals: {
      objective:
        "Explore Front and Rear focusing across two depths of the same object at fixed f/32.",
      bullets: {
        focusDistance: "Move focus between the near and far detail.",
        readouts: "Watch the white near gate and far pointer.",
        compare:
          "Compare Front focusing, which changes their image alignment, with Rear focusing, which keeps them aligned.",
      },
      observation:
        "Watch the white near gate and far pointer as Front and Rear focusing change their image alignment.",
    },
    architectureRise: {
      objective:
        "Explore how Front Rise changes framing while the camera remains level and the whole-camera viewpoint stays fixed.",
      bullets: {
        rise: "Increase Front Rise to include more of the building.",
        level:
          "Keep the camera body and intended film-plane orientation level; watch the parallel verticals.",
        focus:
          "Adjust Focus and Aperture to compare sharpness and depth of field.",
      },
      observation:
        "Watch the top of the building as Front Rise changes. Framing moves while the whole-camera viewpoint stays fixed and the intended verticals remain parallel.",
    },
    tableTilt: {
      objective:
        "Use Front Tilt and Focus to align the plane of sharp focus with the three coplanar focus cards above the tabletop.",
      bullets: {
        focus:
          "At 0° Front Tilt, move Focus from the near card through the middle notebook to the far chart.",
        tilt:
          "Apply positive Front Tilt and watch the plane of sharp focus rotate through the focus-card surfaces.",
        patches:
          "Refine Focus until all three patches—not only their centre points—are covered.",
        aperture:
          "Compare f/11 and f/22, but do not rely on f/32 to solve the exercise.",
      },
      observation:
        "Front Tilt rotates the plane of sharp focus through the tabletop arrangement. Compare the geometry, Ground Glass sharpness, depth-of-field bounds, and Focus Targets readout as you refine Tilt and Focus.",
    },
    shelfSwing: {
      objective:
        "Use Front Swing and Focus to align the plane of sharp focus with subjects arranged diagonally in depth.",
      bullets: {
        start:
          "Begin near 0° Swing and move Focus through the subjects to see that their different depths do not become sharp together.",
        geometry:
          "Apply Front Swing and watch the plane of sharp focus rotate in the Top geometry view.",
        refine:
          "Refine Focus after changing Swing so the plane of sharp focus passes through the diagonal subject arrangement.",
        compare:
          "Compare the geometry, Ground Glass sharpness, and relevant learner readouts rather than relying on one indicator alone.",
      },
      observation:
        "Without Swing, changing Focus moves sharpness between subject depths. Front Swing rotates the plane of sharp focus through the diagonal arrangement. Compare the Top geometry view and Ground Glass as you refine Swing and Focus.",
    },
    mirrorShift: {
      objective:
        "Separate viewpoint from framing: move the whole camera sideways, then use opposite Front Shift to restore the mirror framing without returning the camera to its original viewpoint.",
      bullets: {
        position:
          "Move Camera Position sideways until the camera reflection moves clear of the mirror.",
        viewpoint:
          "Leave Camera Position there. The whole-camera viewpoint has now changed.",
        framing:
          "Apply Front Shift in the opposite direction to restore approximately the original mirror framing.",
        parallax:
          "Watch the reflected props and parallax. Restoring the framing does not restore the original viewpoint.",
      },
      observation:
        "Camera Position changes the whole-camera viewpoint and reflected parallax. Front Shift changes framing without returning to the original viewpoint. If the mirror framing looks similar again, compare the reflected props to see that the viewpoint is still different.",
    },
  },
} as const;
