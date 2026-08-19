export const guidedLessonMessageKeys = {
  common: {
    title: "guidedLesson.common.title",
    lessonName: "guidedLesson.common.lessonName",
    progressAria: "guidedLesson.common.progressAria",
    stepOf: "guidedLesson.common.stepOf",
    previous: "guidedLesson.common.previous",
    continue: "guidedLesson.common.continue",
    lessonComplete: "guidedLesson.common.lessonComplete",
    finalChallengePending: "guidedLesson.common.finalChallengePending",
    completionBody: "guidedLesson.common.completionBody",
    backToScenes: "guidedLesson.common.backToScenes",
  },
  observe: {
    title: "guidedLesson.observe.title",
    body: "guidedLesson.observe.body",
  },
  stages: {
    observe: "guidedLesson.stages.observe",
    compose: "guidedLesson.stages.compose",
    alignFocus: "guidedLesson.stages.alignFocus",
    finalChallenge: "guidedLesson.stages.finalChallenge",
  },
} as const;

type MessageKeyValues<T> = T extends Record<string, infer V>
  ? V extends string
    ? V
    : MessageKeyValues<V>
  : never;

export type GuidedLessonMessageKey = MessageKeyValues<typeof guidedLessonMessageKeys>;
