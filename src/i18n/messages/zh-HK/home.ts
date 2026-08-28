import { homeMessages as englishHomeMessages } from "../en/home";
import type { MessageShape } from "../types";

export const homeMessages = {
  hero: {
    eyebrow: "互動式大片幅相機學習",
    title: "在按下快門前，了解大片幅相機如何改變影像。",
    description:
      "移動整部相機，或調整前組及後組，然後在對焦屏上比較視點、構圖、透視及對焦如何改變。",
    exploreSimulator: "探索模擬器",
  },
  why: {
    ariaLabel: "為甚麼使用大片幅相機",
  },
  info: {
    control: {
      title: "大片幅相機在曝光前可以控制甚麼？",
      body:
        "大片幅相機把一些經常混在一起的決定分開：相機從哪個位置觀察、主體如何構圖、影像幾何如何控制，以及清晰焦平面位於哪裏。這些關係可以在曝光前於相機上調整，而不只是事後當作修正。",
    },
    movements: {
      title: "為甚麼相機移軸重要？",
      body:
        "上移及橫移可以在不改變視點的情況下改變構圖。傾斜及擺動可以旋轉清晰焦平面。移動整部相機會改變視點、透視關係及視差。實用的問題是：你想改變哪一種實體關係？",
    },
    artists: {
      title: "為甚麼藝術家仍然使用大片幅相機？",
      body:
        "大片幅相機令拍攝過程慢下來。對焦屏上的倒置影像鼓勵細心觀察，而每一項移軸都成為有意識的選擇。藝術家使用它不只是為了影像質素，也因為這種方法改變了觀看及創作相片的方式。",
    },
  },
  // FAQ translations are not available yet; keep the supplied English source copy via the locale boundary.
  faq: englishHomeMessages.faq,
} satisfies MessageShape<typeof englishHomeMessages>;
