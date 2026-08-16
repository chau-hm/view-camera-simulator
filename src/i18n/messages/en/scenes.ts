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
  obliqueArchitecture: {
    title: "Oblique Architecture — Static Problem",
    description:
      "Observe a level camera facing a receding building corner: the top is cropped and the façade does not stay equally sharp from near to far.",
    topics: {
      levelCamera: "Level camera",
      croppedFraming: "Cropped framing",
      facadeDepth: "Façade depth",
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
      "Understand how Front Shift can restore framing without restoring the original viewpoint or parallax.",
    topics: {
      viewpoint: "Viewpoint",
      framing: "Framing",
      frontShift: "Front Shift",
      parallax: "Parallax",
    },
  },
} as const;
