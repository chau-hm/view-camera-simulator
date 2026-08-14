import { commonMessages as englishCommonMessages } from "../en/common";
import type { MessageShape } from "../types";

export const commonMessages = {
  nav: {
    home: "主頁",
    scenes: "場景",
    primaryNavigation: "主要導覽",
  },
  language: {
    label: "語言",
    english: "English",
    traditionalChinese: "繁體中文",
  },
  brand: {
    homeLabel: "View Camera Simulator 主頁",
  },
  footer: {
    description: "一個簡單的互動式大型相機對焦、透視及移動訓練工具。",
  },
  site: {
    desktopExperienceTitle: "建議使用桌面瀏覽器",
    desktopExperienceBody:
      "模擬器為配備 WebGL 及較大螢幕的桌面瀏覽器而設。在手機、平板電腦或較窄的瀏覽器視窗上，3D 場景及對焦屏可能無法使用，或不易操作。",
    desktopExperienceNarrowLine:
      "為獲得最佳體驗，請使用視窗寬度至少 1024 像素的桌面瀏覽器。",
  },
  sceneCard: {
    openScene: "開啟場景",
    startGuidedTask: "開始引導任務",
    inDevelopment: "開發中",
  },
} satisfies MessageShape<typeof englishCommonMessages>;
