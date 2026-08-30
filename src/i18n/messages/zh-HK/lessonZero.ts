import { lessonZeroMessages as englishLessonZeroMessages } from "../en/lessonZero";
import type { MessageShape } from "../types";

export const lessonZeroMessages = {
  common: {
    lessonLabel: "第 0 課 · 認識大片幅相機",
    progressAria: "第 0 課相機結構進度",
    stepOf: "第 {{current}} / {{total}} 步",
    previous: "上一步",
    next: "下一步",
    reset: "重新開始課程",
    lessonComplete: "課程完成",
    backToScenes: "返回場景",
    showSmallAperture: "顯示較小光圈",
    showWideAperture: "顯示較大光圈",
  },
  steps: {
    completeCamera: {
      title: "完整相機",
      body:
        "大片幅相機由前、後兩組及中間的柔性皮腔組成。前組承托鏡頭，後組承托對焦屏或記錄用的後背。",
      cue: "從三分之四角度觀察前組、皮腔、後組及支架如何連接。",
    },
    frontStandard: {
      title: "前組",
      body:
        "前組承托鏡頭組件，是兩組結構的前半部；前、後組的位置調整會在後面的課程介紹。",
      cue: "找出包圍鏡頭板的直立框架。",
    },
    lensAndBoard: {
      title: "鏡頭與鏡頭板",
      body:
        "鏡頭形成影像。鏡頭板是獨立的板件，把鏡頭安裝到前組；不同相機的鏡頭板系統可能不同。",
      cue: "留意鏡頭周圍的板件，它與較大的前組框架是分開的。",
    },
    aperture: {
      title: "光圈",
      body:
        "光圈位於鏡頭內，控制光線通過的開口大小。較小的開口會以較大的 f 值表示。",
      cue: "比較光圈開口，確認其實際位置後再繼續。",
    },
    bellows: {
      title: "皮腔",
      body:
        "皮腔是前組與後組之間柔性而遮光的連接，讓兩組可以分開，同時封閉光路。",
      cue: "沿著摺疊的連接，觀察它如何由一組延伸到另一組。",
    },
    rearStandard: {
      title: "後組",
      body: "後組承托對焦屏或底片後背，構成相機的影像平面一側。",
      cue: "找出包圍後方開口的獨立框架。",
    },
    groundGlass: {
      title: "對焦屏",
      body:
        "實體對焦屏是相機後方的磨砂玻璃，用來在曝光前檢查焦點及構圖。",
      cue: "這是相機結構；模擬器的對焦屏面板是顯示影像的另一個預覽區域。",
    },
    filmHolder: {
      title: "底片夾",
      body:
        "曝光時，底片夾會取代對焦屏。底片表面與對焦屏位於同一影像平面。",
      cue: "留意底片夾圍繞著同一個後方影像平面位置。",
    },
    cameraSupport: {
      title: "相機支架",
      body:
        "支架在前、後組相對定位時保持整部相機結構對齊。不同的大片幅相機會使用不同支承方式，但結構作用相同。",
      cue: "沿著兩組下方的底座觀察；它支承相機，但不是移軸組件。",
    },
    recap: {
      title: "總結",
      body:
        "前組承托鏡頭板與鏡頭，光圈位於鏡頭內。皮腔連接後組；後組可放置對焦屏或底片夾，兩者位於相同影像平面，而相機支架支承整個結構。",
      cue: "你已準備好在後面的課程探索相機控制如何移動這些部件。",
    },
  },
} satisfies MessageShape<typeof englishLessonZeroMessages>;
