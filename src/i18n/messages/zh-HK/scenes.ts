import { scenesMessages as englishScenesMessages } from "../en/scenes";
import type { MessageShape } from "../types";

export const scenesMessages = {
  page: {
    title: "場景",
    intro: "選擇一個場景，在對焦屏上比較視點、構圖、透視幾何及清晰焦平面控制。",
    noScenesAvailable: "暫時沒有可用場景。",
  },
  understanding: {
    title: "了解大型相機移動",
    description:
      "比較整部相機改變視點與前組、後組移動，並觀察各自如何影響構圖、透視幾何及對焦屏影像。",
    topics: {
      viewpoint: "視點",
      framing: "構圖",
      frontRearStandards: "前組／後組",
      perspectiveControl: "透視控制",
    },
  },
  focusFundamentals: {
    title: "對焦基礎 — 兩個目標",
    description:
      "在同一物件的兩個深度上比較前組及後組對焦（固定 f/32），並觀察影像在對焦屏上的對齊如何改變。",
    topics: {
      frontRearFocusing: "前組／後組對焦",
      imageAlignment: "影像對齊",
      fixedAperture: "固定 f/32",
    },
  },
  architectureRise: {
    title: "建築上移",
    description:
      "保持相機水平，使用前組上移把建築物較高的部分納入畫面，同時保持場景預期的垂直線平行。",
    topics: {
      frontRise: "前組上移",
      framing: "構圖",
      perspectiveControl: "透視控制",
    },
  },
  tableTilt: {
    title: "桌面傾斜",
    description:
      "使用前組傾斜旋轉清晰焦平面，直到它與桌面上方三張共面的對焦卡對齊。",
    topics: {
      frontTilt: "前組傾斜",
      planeOfSharpFocus: "清晰焦平面",
      scheimpflugPrinciple: "Scheimpflug 原理",
    },
  },
  shelfSwing: {
    title: "書架擺動",
    description: "使用前組擺動，讓清晰焦平面穿過沿深度斜向排列的主體。",
    topics: {
      frontSwing: "前組擺動",
      planeOfSharpFocus: "清晰焦平面",
      scheimpflugPrinciple: "Scheimpflug 原理",
    },
  },
  mirrorShift: {
    title: "鏡面橫移",
    description:
      "將整部相機向側面移動以避開相機倒影，然後使用相反方向的前組橫移恢復鏡面構圖，同時保留已改變的視點。",
    topics: {
      viewpoint: "視點",
      framing: "構圖",
      frontShift: "前組橫移",
      parallax: "視差",
    },
  },
} satisfies MessageShape<typeof englishScenesMessages>;
