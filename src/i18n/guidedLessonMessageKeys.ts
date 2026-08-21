export const guidedLessonMessageKeys = {
  common: {
    title: "guidedLesson.common.title",
    progressAria: "guidedLesson.common.progressAria",
    stepOf: "guidedLesson.common.stepOf",
    previous: "guidedLesson.common.previous",
    continue: "guidedLesson.common.continue",
    lessonComplete: "guidedLesson.common.lessonComplete",
    finalChallengePending: "guidedLesson.common.finalChallengePending",
    backToScenes: "guidedLesson.common.backToScenes",
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
};

export const getGuidedLessonCopyKeys = (lessonId: string): GuidedLessonCopyMessageKeys =>
  guidedLessonCopyById[lessonId] ?? guidedLessonCopyById["oblique-architecture"];
