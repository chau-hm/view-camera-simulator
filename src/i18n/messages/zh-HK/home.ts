import { homeMessages as englishHomeMessages } from "../en/home";
import type { MessageShape } from "../types";

export const homeMessages = {
  hero: {
    eyebrow: "互動式大型相機學習",
    title: "在按下快門前，了解大型相機如何改變影像。",
    description:
      "移動整部相機或前組及後組，然後在對焦屏上比較視點、構圖、透視及對焦如何改變。",
    exploreSimulator: "探索模擬器",
    learnWhy: "了解原因",
  },
  why: {
    ariaLabel: "為甚麼使用大型相機",
  },
  info: {
    control: {
      title: "大型相機在曝光前可以控制甚麼？",
      body:
        "大型相機把一些經常混在一起的決定分開：相機從哪個位置觀察、主體如何構圖、影像幾何如何控制，以及清晰焦平面位於哪裏。這些關係可以在曝光前於相機上調整，而不只是事後當作修正。",
    },
    movements: {
      title: "為甚麼相機移動很重要？",
      body:
        "上移及橫移可以在不改變視點的情況下改變構圖。傾斜及擺動可以旋轉清晰焦平面。移動整部相機會改變視點、透視關係及視差。實用的問題是：你想改變哪一種實體關係？",
    },
    artists: {
      title: "為甚麼藝術家仍然使用大型相機？",
      body:
        "大型相機令拍攝過程慢下來。對焦屏上的倒置影像鼓勵細心觀察，而每一個移動都成為有意識的選擇。藝術家使用它不只是為了影像質素，也因為這種方法改變了觀看及創作相片的方式。",
    },
  },
  focusCta: {
    eyebrow: "對焦基礎",
    title: "比較前組及後組對焦",
    body:
      "透過移動前組或後組，分別對同一物件的兩個深度對焦，然後觀察它們在對焦屏上的對齊如何改變。光圈固定為 f/32，讓比較集中於對焦方式。",
    action: "開啟對焦基礎",
  },
} satisfies MessageShape<typeof englishHomeMessages>;
