import { simulatorMessages as englishSimulatorMessages } from "../en/simulator";
import type { MessageShape } from "../types";

export const simulatorMessages = {
  task: {
    title: "任務",
    freePractice: "自由練習",
  },
  feedback: {
    title: "回饋",
    liveObservation: "即時觀察",
  },
  movementHelp: {
    button: "說明",
    title: "移動說明",
    close: "關閉說明",
    rise: "前組上移會垂直移動前組，在不移動整部相機視點的情況下改變構圖。",
    tilt: "前組傾斜會在垂直／深度關係中旋轉鏡頭平面，令清晰焦平面沿深度旋轉。",
    swing: "前組擺動會在水平／深度關係中旋轉鏡頭平面，令清晰焦平面穿過沿深度斜向排列的主體。",
  },
  freePractice: {
    generic: {
      objective: "自由探索場景，不設評分任務。",
      observation: "變更會即時反映在 3D 場景、對焦屏及相關讀數上。",
    },
    understanding: {
      objective: "比較整部相機的視點移動與前組、後組移動，並觀察哪些影像關係會隨之改變。",
      bullets: {
        viewpoint:
          "在前組、後組保持中立時，將視點降低及升高。觀察整部相機移動時，透視關係、視差及可見的主體表面如何改變。",
        tilt:
          "回到中立視點，然後比較前組傾斜與後組傾斜。前組傾斜會改變鏡頭平面方向；後組傾斜會改變底片平面方向，因此兩者的影像效果並不可以互相取代。",
        verticalFraming:
          "比較前組及後組垂直構圖。整部相機的視點保持不變，而選定的組件向垂直方向移動。",
        compare: "同時使用 3D 相機幾何圖及對焦屏。思考實際移動了甚麼、甚麼保持不變，以及影像改變了甚麼。",
      },
      observation:
        "整部相機的視點移動會改變透視關係及視差；前組或後組移動則保持整部相機的視點不變。比較對焦屏與相機幾何圖，了解每種移動改變了哪一種關係。",
    },
    focusFundamentals: {
      objective: "在固定 f/32 下，探索同一物件兩個深度的前組及後組對焦。",
      bullets: {
        focusDistance: "在同一物件的近處及遠處細節之間移動對焦。",
        readouts: "觀察白色近處框線及遠處指標。",
        compare: "比較前組對焦與後組對焦：前組對焦會改變它們的影像對齊，而後組對焦會保持對齊。",
      },
      observation: "觀察前組及後組對焦如何改變白色近處框線及遠處指標的影像對齊。",
    },
    architectureRise: {
      objective: "探索前組上移如何在保持相機水平及整部相機視點不變的情況下改變構圖。",
      bullets: {
        rise: "增加前組上移，把建築物較高的部分納入畫面。",
        level: "保持相機及預期的底片平面方向水平，並觀察垂直線保持平行。",
        focus: "調整對焦及光圈，比較清晰度及景深。",
      },
      observation: "觀察前組上移時建築物上方如何進入畫面。構圖改變，但整部相機的視點保持不變，預期的垂直線仍然平行。",
    },
    tableTilt: {
      objective: "使用前組傾斜及對焦，讓清晰焦平面與桌面上方三張共面的對焦卡對齊。",
      bullets: {
        focus: "在 0° 前組傾斜時，將對焦由近處卡片移經中間筆記簿至遠處圖表。",
        tilt: "施加正向前組傾斜，觀察清晰焦平面如何旋轉，穿過對焦卡表面。",
        patches: "調整對焦，直到三個區域都被覆蓋，不只是中心點。",
        aperture: "比較 f/11 及 f/22，但不要依靠 f/32 解決練習。",
      },
      observation: "前組傾斜會令清晰焦平面旋轉，穿過桌面上的排列。調整傾斜及對焦時，同時比較幾何圖、對焦屏清晰度、景深界線及 Focus Targets 讀數。",
    },
    shelfSwing: {
      objective: "使用前組擺動及對焦，讓清晰焦平面與沿深度斜向排列的主體對齊。",
      bullets: {
        start: "從接近 0° 擺動開始，移動對焦，觀察不同深度的主體不能同時變得清晰。",
        geometry: "施加前組擺動，並在 Top 幾何圖中觀察清晰焦平面旋轉。",
        refine: "改變擺動後重新調整對焦，讓清晰焦平面通過斜向排列的主體。",
        compare: "同時比較幾何圖、對焦屏清晰度及相關讀數，不要只依靠一個指標。",
      },
      observation: "沒有擺動時，改變對焦只會在不同主體深度之間移動清晰位置。前組擺動會令清晰焦平面穿過斜向排列。調整擺動及對焦時，比較 Top 幾何圖及對焦屏。",
    },
    mirrorShift: {
      objective: "分開視點與構圖：將整部相機向側面移動，然後使用相反方向的前組橫移恢復鏡面構圖，而不把相機移回原本的視點。",
      bullets: {
        position: "將 Camera Position 向側面移動，直到相機倒影離開鏡面。",
        viewpoint: "讓 Camera Position 停留在該位置。整部相機的視點已經改變。",
        framing: "向相反方向使用前組橫移，恢復大致原本的鏡面構圖。",
        parallax: "觀察反射的道具及視差。恢復相似構圖 ≠ 恢復原本視點。",
      },
      observation: "Camera Position 會改變整部相機的視點及反射視差。前組橫移會改變構圖，但不會把相機移回原本視點。即使鏡面構圖看起來相近，也要比較反射道具，確認視點仍然不同。",
    },
  },
} satisfies MessageShape<typeof englishSimulatorMessages>;
