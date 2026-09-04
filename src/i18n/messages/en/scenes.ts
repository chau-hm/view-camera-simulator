export const scenesMessages = {
  page: {
    title: "Scenes",
    intro:
      "Choose a scene to compare viewpoint, framing, perspective geometry and plane-of-sharp-focus control on the Ground Glass.",
    noScenesAvailable: "No scenes available.",
  },
  viewCameraAnatomy: {
    title: "Lesson 0 — Meet the View Camera",
    description:
      "Identify the major physical parts of a conceptual view camera before exploring its movements.",
    topics: {
      anatomy: "Camera anatomy",
      focusing: "Focusing screen",
      filmPlane: "Shared image plane",
    },
  },
  understanding: {
    title: "Understanding Camera Movements",
    description:
      "Understand how whole-camera movement and Front/Rear standard movements affect viewpoint, framing, perspective geometry and the Ground Glass image.",
    topics: {
      viewpoint: "Viewpoint",
      framing: "Framing",
      frontRearStandards: "Front / Rear standards",
      perspectiveControl: "Perspective control",
    },
  },
  focusFundamentals: {
    title: "Focus Fundamentals — Two Targets",
    description:
      "Understand how Front and Rear focusing differ when focusing across two depths of the same object.",
    topics: {
      frontRearFocusing: "Front / Rear focusing",
      imageAlignment: "Image alignment",
      fixedAperture: "Fixed f/32",
    },
  },
  architectureRise: {
    title: "Architecture Rise",
    description:
      "Understand how Front Rise changes framing while a level camera keeps verticals parallel.",
    topics: {
      frontRise: "Front Rise",
      framing: "Framing",
      perspectiveControl: "Perspective control",
    },
  },
  architectureForeground: {
    title: "Architecture + Foreground",
    description:
      "Frame a level architectural subject while observing how foreground depth creates a second focusing problem.",
    topics: {
      levelFraming: "Level framing",
      foregroundDepth: "Foreground depth",
      sharpness: "Sharpness across depth",
    },
  },
  interiorCorner: {
    title: "Interior Corner — Rise + Swing",
    description:
      "Explore a neutral interior corner where upper architectural detail presses against the frame and one receding wall creates a future Front Swing and Focus problem.",
    topics: {
      frontRise: "Front Rise",
      frontSwing: "Front Swing",
      architecturalDepth: "Architectural depth",
    },
  },
  obliqueArchitecture: {
    title: "Oblique Architecture",
    description:
      "Combine Front Rise and Front Swing to frame an oblique building while keeping verticals parallel and the receding façade sharp.",
    topics: {
      frontRise: "Front Rise",
      frontSwing: "Front Swing",
      compoundMovements: "Compound movements",
    },
  },
  tableTilt: {
    title: "Table Tilt",
    description:
      "Understand how Front Tilt changes the plane of sharp focus across subject depth.",
    topics: {
      frontTilt: "Front Tilt",
      planeOfSharpFocus: "Plane of sharp focus",
      scheimpflugPrinciple: "Scheimpflug principle",
    },
  },
  shelfSwing: {
    title: "Shelf Swing",
    description:
      "Understand how Front Swing changes the plane of sharp focus across subjects arranged diagonally in depth.",
    topics: {
      frontSwing: "Front Swing",
      planeOfSharpFocus: "Plane of sharp focus",
      scheimpflugPrinciple: "Scheimpflug principle",
    },
  },
  obliqueTabletop: {
    title: "Oblique Tabletop",
    description:
      "Photograph an oblique tabletop from an angle. In the neutral setup, different parts of the table fall at different depths, so you cannot keep the whole surface sharp at once.",
    topics: {
      obliquePlane: "Oblique plane",
      depthVariation: "Depth variation",
      focusDistance: "Focus distance",
    },
  },
  mirrorShift: {
    title: "Mirror Shift",
    description:
      "Understand how Front Shift can restore framing without restoring the original viewpoint or parallax.",
    topics: {
      viewpoint: "Viewpoint",
      framing: "Framing",
      frontShift: "Front Shift",
      parallax: "Parallax",
    },
  },
} as const;
