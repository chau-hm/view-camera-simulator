import { scenesMessages as englishScenesMessages } from "../en/scenes";
import type { MessageShape } from "../types";

export const scenesMessages = {
  page: {
    title: "場景",
    intro: "選擇一個場景，在對焦屏上比較視點、構圖、透視幾何及清晰焦平面控制。",
    noScenesAvailable: "暫時沒有可用場景。",
  },
  groups: {
    foundations: {
      title: "基礎概念",
      description: "先了解大片幅相機如何運作，再應用個別相機移軸。",
    },
    coreMovements: {
      title: "基本相機移軸",
      description: "探索主要相機移軸及各自的效果。",
    },
    combinedMovements: {
      title: "複合相機移軸",
      description: "在較複雜的攝影問題中，結合相機移軸、對焦與景深。",
    },
    macroPhotography: {
      title: "微距攝影",
      description: "探索微距距離下的近距離對焦、放大率、景深及相機移軸。",
    },
  },
  macroBellowsExtension: {
    title: "1:1 平面主體",
    description:
      "探索近距離對焦時皮腔伸長與放大率如何增加，直到平面主體達至接近 1:1 原大倍率。",
    topics: {
      bellowsExtension: "皮腔伸長",
      magnification: "放大率",
      lifeSizeReproduction: "1:1 原大倍率",
    },
  },
  macroDepthOfField: {
    title: "立體微距攝影",
    description:
      "觀察高放大率下可用景深如何大幅縮減，以及近、中、遠細節之間的清晰範圍變化。",
    topics: {
      macroDepthOfField: "微距景深",
      aperture: "光圈",
      focusDistribution: "對焦分佈",
    },
  },
  macroObliquePlane: {
    title: "傾斜微距平面",
    description:
      "探索如何使用前組俯仰，將清晰對焦平面對準與相機斜置的細節主體。",
    topics: {
      frontTilt: "前組俯仰",
      scheimpflugPrinciple: "Scheimpflug 原理",
      obliqueFocusPlane: "傾斜對焦平面",
    },
  },
  macroCompoundMovements: {
    title: "複合微距靜物",
    description:
      "結合俯仰、搖擺、對焦與光圈，控制同時具有橫向位置與前後深度變化的小型靜物清晰範圍。",
    topics: {
      tiltSwing: "俯仰 + 搖擺",
      compoundMovements: "複合移軸",
      macroFocusControl: "微距對焦控制",
    },
  },
  viewCameraAnatomy: {
    title: "第 0 課 — 認識大片幅相機",
    description: "在探索相機移軸前，先認識概念大片幅相機的主要實體部件。",
    topics: {
      anatomy: "相機結構",
      focusing: "對焦屏",
      filmPlane: "相同影像平面",
    },
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
      fixedAperture: "固定 f/11",
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
  architectureForeground: {
    title: "建築物與前景",
    description:
      "在保持建築物垂直線平行的水平相機下取景，同時觀察前景深度帶來的第二個對焦問題。",
    topics: {
      levelFraming: "水平取景",
      foregroundDepth: "前景深度",
      sharpness: "不同深度的清晰度",
    },
  },
  interiorCorner: {
    title: "室內轉角 — 上移與擺動",
    description:
      "探索一個中性室內轉角：上方建築細節略嫌貼近畫面邊緣，而一面向後延伸的側牆為前組擺動與對焦帶來深度問題。",
    topics: {
      frontRise: "前組上移",
      frontSwing: "前組擺動",
      architecturalDepth: "建築深度",
    },
  },
  obliqueArchitecture: {
    title: "斜向建築攝影",
    description:
      "結合前組上移與前組擺動，在斜角拍攝建築物時保持垂直線平行，並讓延伸的立面由近至遠保持清晰。",
    topics: {
      frontRise: "前組上移",
      frontSwing: "前組擺動",
      compoundMovements: "複合運動",
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
  obliqueTabletop: {
    title: "斜向桌面",
    description:
      "從斜角拍攝一塊放在普通桌面上的傾斜圖板。圖板同時沿近遠及左右方向延伸，因此單靠俯仰無法對齊整個主體平面，還需要擺動。",
    topics: {
      obliquePlane: "斜向平面",
      depthVariation: "深度變化",
      focusDistance: "對焦距離",
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
