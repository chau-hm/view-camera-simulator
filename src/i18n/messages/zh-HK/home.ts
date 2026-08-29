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
  faq: {
    title: "常見問題",
    items: {
      audience: {
        question: "View Camera Simulator 適合哪些人使用？",
        intro: "View Camera Simulator 適合任何希望更清楚理解相機移軸與攝影幾何的人。",
        photographersNew: "初次接觸大片幅相機或觀景式相機的攝影者；",
        experiencedPhotographers: "希望進一步探索相機移軸的有經驗攝影者；",
        studentsAndEducators: "攝影學生及教育工作者；",
        geometryInterested: "對透視、對焦、構圖及相機幾何有興趣的人。",
        closing: "毋須具備使用大片幅相機的經驗。",
      },
      ownership: {
        question: "我需要擁有大片幅相機嗎？",
        intro: "不需要。",
        geometry:
          "模擬器利用大片幅相機的結構，把攝影幾何關係直接呈現出來。即使你從未打算使用大片幅相機，也可以藉此理解相機位置、透視、構圖、對焦，以及鏡頭、主體與成像平面之間的關係。",
        otherCameras:
          "很多原理同樣適用於無反相機、單反相機、智能電話、移軸鏡頭及技術相機。不過，並非每種相機都提供相同的實體移軸功能。",
      },
      learning: {
        question: "我可以透過 View Camera Simulator 學到甚麼？",
        intro: "模擬器讓你觀察不同相機移軸如何影響影像。",
        cameraPosition: "相機位置與構圖的關係；",
        perspective: "透視與焦距；",
        standardMovements: "前組及後組移軸；",
        lensAndImagePlanes: "鏡頭平面與成像平面；",
        focusAndDepthOfField: "對焦與景深；",
        resultingGroundGlass: "以及最終在對焦屏上形成的影像。",
        closing: "與其死記規則，你可以直接改變相機設定並觀察結果。",
      },
      model: {
        question: "模擬器是否以某一款特定的大片幅相機或鏡頭為基礎？",
        opening: "並不完全是。",
        body:
          "View Camera Simulator 採用概念化、通用化的大片幅相機模型，而不是重現某一款單軌、外拍、摺疊式或其他特定類型的大片幅相機。它是一個教學模型，而不是任何商業相機或鏡頭的數碼複製品。",
        movements:
          "前組及後組提供理解一般相機移軸原理所需的運動，但並不一定重現某一種相機設計的機械限制。某些操作自由度可能近似高度可調的單軌相機，但不應把模擬器理解為任何特定相機的模型。",
        dimensions:
          "模擬相機的尺寸、焦距、片幅、光圈設定及移軸範圍，均以支援所示範概念為目的，因此可能與 Sinar、Arca-Swiss、Toyo 或 Linhof 等實際系統有所不同。",
      },
      movementAvailability: {
        question: "我的相機會提供模擬器展示的所有移軸功能嗎？",
        opening: "不一定。",
        body:
          "實際大片幅相機在機械設計及可用移軸方面各有不同。有些相機提供廣泛的前組及後組移軸；另一些則會因便攜性、剛性、重量或操作簡潔等考慮而限制部分移軸。",
        closing: "模擬器展示的是某項移軸的一般攝影效果。實際可用的移軸種類及範圍，請參考你所使用相機的規格。",
      },
      realism: {
        question: "模擬器有多真實？",
        body:
          "View Camera Simulator 呈現相機移軸背後的主要幾何關係，但其主要用途是教學，而不是完整的光學或機械模擬。",
        feedback:
          "對焦屏上的清晰度、模糊程度及景深等視覺回饋，是用來解釋攝影概念，不應視為對某一支鏡頭、某種菲林、感光元件或相機的精確量度。",
      },
      practice: {
        question: "它可以取代使用實際大片幅相機的學習嗎？",
        opening: "不可以。",
        body:
          "模擬器是實際操作的補充。真正的大片幅相機還涉及其他因素，包括皮腔限制、機械移軸範圍、鏡頭像圈限制、相機剛性、使用放大鏡對焦、在黑布下操作、片盒，以及不同相機與鏡頭本身的特性。",
        closing: "模擬器讓你暫時抽離這些實務因素，集中探索相機幾何與移軸概念。",
      },
    },
  },
} satisfies MessageShape<typeof englishHomeMessages>;
