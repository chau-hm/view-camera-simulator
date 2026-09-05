export const guidedLessonMessageKeys = {
  common: {
    title: "guidedLesson.common.title",
    progressAria: "guidedLesson.common.progressAria",
    stepOf: "guidedLesson.common.stepOf",
    previous: "guidedLesson.common.previous",
    continue: "guidedLesson.common.continue",
    lessonComplete: "guidedLesson.common.lessonComplete",
    finalChallengePending: "guidedLesson.common.finalChallengePending",
    lastStagePending: "guidedLesson.common.lastStagePending",
    backToScenes: "guidedLesson.common.backToScenes",
    restartLesson: "guidedLesson.common.restartLesson",
  },
  stages: {
    observe: "guidedLesson.stages.observe",
    compose: "guidedLesson.stages.compose",
    alignFocus: "guidedLesson.stages.alignFocus",
    depthOfField: "guidedLesson.stages.depthOfField",
    finalChallenge: "guidedLesson.stages.finalChallenge",
  },
  lessons: {
    obliqueArchitecture: {
      lessonName: "guidedLesson.lessons.obliqueArchitecture.lessonName",
      observeTitle: "guidedLesson.lessons.obliqueArchitecture.observeTitle",
      observeBody: "guidedLesson.lessons.obliqueArchitecture.observeBody",
      completionBody: "guidedLesson.lessons.obliqueArchitecture.completionBody",
    },
    architectureForeground: {
      lessonName: "guidedLesson.lessons.architectureForeground.lessonName",
      observeTitle: "guidedLesson.lessons.architectureForeground.observeTitle",
      observeBody: "guidedLesson.lessons.architectureForeground.observeBody",
      completionBody: "guidedLesson.lessons.architectureForeground.completionBody",
    },
    interiorCorner: {
      lessonName: "guidedLesson.lessons.interiorCorner.lessonName",
      observeTitle: "guidedLesson.lessons.interiorCorner.observeTitle",
      observeBody: "guidedLesson.lessons.interiorCorner.observeBody",
      completionBody: "guidedLesson.lessons.interiorCorner.completionBody",
    },
  },
} as const;

type MessageKeyValues<T> = T extends Record<string, infer V>
  ? V extends string
    ? V
    : MessageKeyValues<V>
  : never;

export type GuidedLessonMessageKey = MessageKeyValues<typeof guidedLessonMessageKeys>;

export type GuidedLessonCopyMessageKeys = {
  lessonName: GuidedLessonMessageKey;
  observeTitle: GuidedLessonMessageKey;
  observeBody: GuidedLessonMessageKey;
  completionBody: GuidedLessonMessageKey;
};

const guidedLessonCopyById: Record<string, GuidedLessonCopyMessageKeys> = {
  "oblique-architecture": guidedLessonMessageKeys.lessons.obliqueArchitecture,
  "architecture-foreground": guidedLessonMessageKeys.lessons.architectureForeground,
  "interior-corner": guidedLessonMessageKeys.lessons.interiorCorner,
};

export const getGuidedLessonCopyKeys = (lessonId: string): GuidedLessonCopyMessageKeys =>
  guidedLessonCopyById[lessonId] ?? guidedLessonCopyById["oblique-architecture"];
