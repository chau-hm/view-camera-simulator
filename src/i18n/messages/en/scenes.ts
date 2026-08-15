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
  mirrorShift: {
    title: "Mirror Shift",
    description:
      "Understand how framing can be restored with Front Shift while viewpoint and parallax remain changed.",
    topics: {
      viewpoint: "Viewpoint",
      framing: "Framing",
      frontShift: "Front Shift",
      parallax: "Parallax",
    },
  },
} as const;
