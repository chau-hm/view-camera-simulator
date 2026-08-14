export const scenesMessages = {
  page: {
    title: "Scenes",
    intro:
      "Choose a scene to compare viewpoint, framing, perspective geometry and plane-of-sharp-focus control on the Ground Glass.",
    noScenesAvailable: "No scenes available.",
  },
  understanding: {
    title: "Understanding Camera Movements",
    description:
      "Compare whole-camera viewpoint changes with Front and Rear standard movements, and observe how each affects framing, perspective geometry and the Ground Glass image.",
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
      "Compare Front and Rear focusing across two depths of one object at fixed f/32, and observe how image alignment changes on the Ground Glass.",
    topics: {
      frontRearFocusing: "Front / Rear focusing",
      imageAlignment: "Image alignment",
      fixedAperture: "Fixed f/32",
    },
  },
  architectureRise: {
    title: "Architecture Rise",
    description:
      "Keep the camera level and use Front Rise to include more of the building while preserving the scene's intended parallel verticals.",
    topics: {
      frontRise: "Front Rise",
      framing: "Framing",
      perspectiveControl: "Perspective control",
    },
  },
  tableTilt: {
    title: "Table Tilt",
    description:
      "Use Front Tilt to rotate the plane of sharp focus until it aligns with three coplanar focus cards above the tabletop.",
    topics: {
      frontTilt: "Front Tilt",
      planeOfSharpFocus: "Plane of sharp focus",
      scheimpflugPrinciple: "Scheimpflug principle",
    },
  },
  shelfSwing: {
    title: "Shelf Swing",
    description:
      "Use Front Swing to rotate the plane of sharp focus through subjects arranged diagonally in depth.",
    topics: {
      frontSwing: "Front Swing",
      planeOfSharpFocus: "Plane of sharp focus",
      scheimpflugPrinciple: "Scheimpflug principle",
    },
  },
  mirrorShift: {
    title: "Mirror Shift",
    description:
      "Move the whole camera sideways to clear its reflection, then use opposite Front Shift to restore the mirror framing while keeping the changed viewpoint.",
    topics: {
      viewpoint: "Viewpoint",
      framing: "Framing",
      frontShift: "Front Shift",
      parallax: "Parallax",
    },
  },
} as const;
