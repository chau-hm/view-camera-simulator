import { guidedLessonMessages as englishGuidedLessonMessages } from "../en/guidedLesson";
import type { MessageShape } from "../types";

export const guidedLessonMessages = {
  common: {
    title: "引導課程",
    progressAria: "引導課程進度",
    stepOf: "第 {{current}} / {{total}} 步",
    previous: "上一步",
    continue: "繼續",
    lessonComplete: "課程完成",
    finalChallengePending: "完成最終挑戰以完成課程。",
    backToScenes: "返回場景",
  },
  stages: {
    observe: "觀察",
    compose: "構圖",
    alignFocus: "對齊焦平面",
    depthOfField: "景深",
    finalChallenge: "最終挑戰",
  },
  lessons: {
    obliqueArchitecture: {
      lessonName: "斜向建築攝影引導課程",
      observeTitle: "觀察問題",
      observeBody:
        "在調整相機之前，先觀察對焦屏。屋頂被裁掉，而單靠對焦，無法令延伸的立面由近至遠同時保持清晰。",
      completionBody: "你已完成建築構圖，保持垂直線平行，並將清晰焦平面對齊延伸的立面。",
    },
    architectureForeground: {
      lessonName: "建築物與前景引導課程",
      observeTitle: "觀察問題",
      observeBody:
        "調整相機之前，先觀察對焦屏。相機保持水平、建築垂直線平行，但屋頂被裁掉，而近處前景仍然偏柔。",
      completionBody:
        "你以 Rise 修正構圖，以 Tilt 和 Focus 對齊及放置焦平面，最後用 Aperture 擴闊由前景到建築物的可用景深。",
    },
  },
} satisfies MessageShape<typeof englishGuidedLessonMessages>;
