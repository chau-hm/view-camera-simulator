import { guidedLessonMessages as englishGuidedLessonMessages } from "../en/guidedLesson";
import type { MessageShape } from "../types";

export const guidedLessonMessages = {
  common: {
    title: "引導課程",
    lessonName: "斜向建築攝影引導課程",
    progressAria: "引導課程進度",
    stepOf: "第 {{current}} / {{total}} 步",
    previous: "上一步",
    continue: "繼續",
    lessonComplete: "課程完成",
    finalChallengePending: "完成最終挑戰以完成課程。",
    completionBody: "你已完成建築構圖，保持垂直線平行，並將清晰焦平面對齊延伸的立面。",
    backToScenes: "返回場景",
  },
  observe: {
    title: "觀察問題",
    body:
      "在調整相機之前，先觀察對焦屏。屋頂被裁掉，而單靠對焦，無法令延伸的立面由近至遠同時保持清晰。",
  },
  stages: {
    observe: "觀察",
    compose: "構圖",
    alignFocus: "對齊焦平面",
    finalChallenge: "最終挑戰",
  },
} satisfies MessageShape<typeof englishGuidedLessonMessages>;
