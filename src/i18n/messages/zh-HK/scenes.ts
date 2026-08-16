import { scenesMessages as englishScenesMessages } from "../en/scenes";
import type { MessageShape } from "../types";

export const scenesMessages = {
  page: {
    title: "場景",
    intro: "選擇一個場景，在對焦屏上比較視點、構圖、透視幾何及清晰焦平面控制。",
    noScenesAvailable: "暫時沒有可用場景。",
  },
  understanding: {
    title: "認識大片幅相機移軸",
    description:
      "理解整部相機移動與前、後組移軸，如何分別影響視點、構圖、透視幾何與對焦屏影像。",
    topics: {
      viewpoint: "視點",
      framing: "構圖",
      frontRearStandards: "前組／後組",
      perspectiveControl: "透視控制",
    },
  },
  focusFundamentals: {
    title: "前後組對焦比較",
    description:
      "理解前組與後組對焦，在同一物件不同深度之間對焦時所產生的差異。",
    topics: {
      frontRearFocusing: "前組／後組對焦",
      imageAlignment: "影像對齊",
      fixedAperture: "固定 f/32",
    },
  },
  architectureRise: {
    title: "建築構圖與上移",
    description:
      "理解前組上移如何改變構圖，同時讓水平相機保持垂直線平行。",
    topics: {
      frontRise: "前組上移",
      framing: "構圖",
      perspectiveControl: "透視控制",
    },
  },
  obliqueArchitecture: {
    title: "斜向建築 — 靜態問題",
    description:
      "觀察保持水平、從斜角觀看的相機：建築頂部被裁切，而沿深度延伸的立面不會由近至遠都同樣清晰。",
    topics: {
      levelCamera: "水平相機",
      croppedFraming: "裁切構圖",
      facadeDepth: "立面深度",
    },
  },
  tableTilt: {
    title: "桌面焦平面與傾斜",
    description:
      "理解前組傾斜如何改變清晰焦平面在景物深度中的方向。",
    topics: {
      frontTilt: "前組傾斜",
      planeOfSharpFocus: "清晰焦平面",
      scheimpflugPrinciple: "Scheimpflug 原理",
    },
  },
  shelfSwing: {
    title: "斜向焦平面與擺動",
    description: "理解前組擺動如何改變清晰焦平面，使其配合沿深度斜向排列的主體。",
    topics: {
      frontSwing: "前組擺動",
      planeOfSharpFocus: "清晰焦平面",
      scheimpflugPrinciple: "Scheimpflug 原理",
    },
  },
  mirrorShift: {
    title: "鏡面構圖與視點",
    description:
      "理解前組橫移如何恢復構圖，而不會恢復原本的視點與視差。",
    topics: {
      viewpoint: "視點",
      framing: "構圖",
      frontShift: "前組橫移",
      parallax: "視差",
    },
  },
} satisfies MessageShape<typeof englishScenesMessages>;
