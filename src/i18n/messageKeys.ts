export const publicSceneMessageKeys = {
  viewCameraAnatomy: {
    title: "scenes.viewCameraAnatomy.title",
    description: "scenes.viewCameraAnatomy.description",
    topics: {
      anatomy: "scenes.viewCameraAnatomy.topics.anatomy",
      focusing: "scenes.viewCameraAnatomy.topics.focusing",
      filmPlane: "scenes.viewCameraAnatomy.topics.filmPlane",
    },
  },
  understanding: {
    title: "scenes.understanding.title",
    description: "scenes.understanding.description",
    topics: {
      viewpoint: "scenes.understanding.topics.viewpoint",
      framing: "scenes.understanding.topics.framing",
      frontRearStandards: "scenes.understanding.topics.frontRearStandards",
      perspectiveControl: "scenes.understanding.topics.perspectiveControl",
    },
  },
  focusFundamentals: {
    title: "scenes.focusFundamentals.title",
    description: "scenes.focusFundamentals.description",
    topics: {
      frontRearFocusing: "scenes.focusFundamentals.topics.frontRearFocusing",
      imageAlignment: "scenes.focusFundamentals.topics.imageAlignment",
      fixedAperture: "scenes.focusFundamentals.topics.fixedAperture",
    },
  },
  architectureRise: {
    title: "scenes.architectureRise.title",
    description: "scenes.architectureRise.description",
    topics: {
      frontRise: "scenes.architectureRise.topics.frontRise",
      framing: "scenes.architectureRise.topics.framing",
      perspectiveControl: "scenes.architectureRise.topics.perspectiveControl",
    },
  },
  architectureForeground: {
    title: "scenes.architectureForeground.title",
    description: "scenes.architectureForeground.description",
    topics: {
      levelFraming: "scenes.architectureForeground.topics.levelFraming",
      foregroundDepth: "scenes.architectureForeground.topics.foregroundDepth",
      sharpness: "scenes.architectureForeground.topics.sharpness",
    },
  },
  interiorCorner: {
    title: "scenes.interiorCorner.title",
    description: "scenes.interiorCorner.description",
    topics: {
      frontRise: "scenes.interiorCorner.topics.frontRise",
      frontSwing: "scenes.interiorCorner.topics.frontSwing",
      architecturalDepth: "scenes.interiorCorner.topics.architecturalDepth",
    },
  },
  obliqueArchitecture: {
    title: "scenes.obliqueArchitecture.title",
    description: "scenes.obliqueArchitecture.description",
    topics: {
      frontRise: "scenes.obliqueArchitecture.topics.frontRise",
      frontSwing: "scenes.obliqueArchitecture.topics.frontSwing",
      compoundMovements: "scenes.obliqueArchitecture.topics.compoundMovements",
    },
  },
  tableTilt: {
    title: "scenes.tableTilt.title",
    description: "scenes.tableTilt.description",
    topics: {
      frontTilt: "scenes.tableTilt.topics.frontTilt",
      planeOfSharpFocus: "scenes.tableTilt.topics.planeOfSharpFocus",
      scheimpflugPrinciple: "scenes.tableTilt.topics.scheimpflugPrinciple",
    },
  },
  shelfSwing: {
    title: "scenes.shelfSwing.title",
    description: "scenes.shelfSwing.description",
    topics: {
      frontSwing: "scenes.shelfSwing.topics.frontSwing",
      planeOfSharpFocus: "scenes.shelfSwing.topics.planeOfSharpFocus",
      scheimpflugPrinciple: "scenes.shelfSwing.topics.scheimpflugPrinciple",
    },
  },
  obliqueTabletop: {
    title: "scenes.obliqueTabletop.title",
    description: "scenes.obliqueTabletop.description",
    topics: {
      obliquePlane: "scenes.obliqueTabletop.topics.obliquePlane",
      depthVariation: "scenes.obliqueTabletop.topics.depthVariation",
      focusDistance: "scenes.obliqueTabletop.topics.focusDistance",
    },
  },
  mirrorShift: {
    title: "scenes.mirrorShift.title",
    description: "scenes.mirrorShift.description",
    topics: {
      viewpoint: "scenes.mirrorShift.topics.viewpoint",
      framing: "scenes.mirrorShift.topics.framing",
      frontShift: "scenes.mirrorShift.topics.frontShift",
      parallax: "scenes.mirrorShift.topics.parallax",
    },
  },
} as const;

type PublicSceneMessageGroup = (typeof publicSceneMessageKeys)[keyof typeof publicSceneMessageKeys];
type TopicValues<T extends { topics: Record<string, string> }> = T["topics"][keyof T["topics"]];

export type PublicSceneTitleKey = PublicSceneMessageGroup["title"];
export type PublicSceneDescriptionKey = PublicSceneMessageGroup["description"];
export type PublicSceneTopicKey =
  | TopicValues<typeof publicSceneMessageKeys.viewCameraAnatomy>
  | TopicValues<typeof publicSceneMessageKeys.understanding>
  | TopicValues<typeof publicSceneMessageKeys.focusFundamentals>
  | TopicValues<typeof publicSceneMessageKeys.architectureRise>
  | TopicValues<typeof publicSceneMessageKeys.architectureForeground>
  | TopicValues<typeof publicSceneMessageKeys.interiorCorner>
  | TopicValues<typeof publicSceneMessageKeys.obliqueArchitecture>
  | TopicValues<typeof publicSceneMessageKeys.tableTilt>
  | TopicValues<typeof publicSceneMessageKeys.shelfSwing>
  | TopicValues<typeof publicSceneMessageKeys.obliqueTabletop>
  | TopicValues<typeof publicSceneMessageKeys.mirrorShift>;
