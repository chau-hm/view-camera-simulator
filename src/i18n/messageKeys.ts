export const publicSceneMessageKeys = {
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
  | TopicValues<typeof publicSceneMessageKeys.understanding>
  | TopicValues<typeof publicSceneMessageKeys.focusFundamentals>
  | TopicValues<typeof publicSceneMessageKeys.architectureRise>
  | TopicValues<typeof publicSceneMessageKeys.tableTilt>
  | TopicValues<typeof publicSceneMessageKeys.shelfSwing>
  | TopicValues<typeof publicSceneMessageKeys.mirrorShift>;
