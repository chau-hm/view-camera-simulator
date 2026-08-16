import { tasksMessages as englishTasksMessages } from "../en/tasks";
import type { MessageShape } from "../types";

export const tasksMessages = {
  common: {
    guidedTask: "引導任務",
    allowedControls: "允許的控制項目",
    viewRequirements: "查看要求",
    notStarted: "尚未開始",
    waitingForEvaluation: "按照任務指示調整允許的控制項目。系統評估任務時，回饋會隨之更新。",
    inProgress: "進行中",
    completed: "已完成",
    score: "分數",
    nextAdjustment: "下一步調整",
    requirementsMet: "已符合的要求",
    requirementsCompletedAria: "已完成的任務要求",
    passed: "通過",
    needsAdjustment: "需要調整",
    taskCompleted: "任務完成",
    noAdjustmentNeeded: "無需調整",
    progress: "已符合 {{total}} 項要求中的 {{passed}} 項",
    finalSettings: "最後設定",
    secondaryFeedback: "補充回饋",
    genericCriterion: "任務要求",
    genericPassPrimary: "已符合任務要求。",
    genericFailPrimary: "調整允許的控制項目，繼續比較場景。",
    genericSecondary: "按照任務要求決定下一步要調整的項目。",
  },
  controls: {
    rise: "前組上移",
    tilt: "前組傾斜",
    swing: "前組擺動",
    focusDistance: "對焦",
    aperture: "光圈",
    geometryView: "2D 幾何圖",
    cameraPosition: "相機位置",
    frontShift: "前組橫移",
  },
  results: {
    focusTargetsSharp: {
      pass: "對焦目標已足夠清晰",
      fail: "部分對焦目標仍然太模糊",
    },
    movementUsed: {
      rise: {
        pass: "已使用前組上移",
        fail: "前組上移幅度不足",
      },
      tilt: {
        pass: "已使用前組傾斜",
        fail: "前組傾斜幅度不足",
      },
      swing: {
        pass: "已使用前組擺動",
        fail: "前組擺動幅度不足",
      },
    },
    movementRange: {
      rise: {
        pass: "前組上移在允許範圍內",
        fail: "前組上移超出允許範圍",
      },
      tilt: {
        pass: "前組傾斜在允許範圍內",
        fail: "前組傾斜超出允許範圍",
      },
      swing: {
        pass: "前組擺動在允許範圍內",
        fail: "前組擺動超出允許範圍",
      },
    },
    allowedAperture: {
      pass: "光圈設定可用",
      fail: "光圈設定不適用於此任務",
    },
    compositionVisible: {
      pass: "構圖目標的可見範圍已足夠",
      fail: "構圖目標的可見範圍不足",
    },
    cameraLevel: {
      pass: "相機及後組保持水平",
      fail: "相機水平或後組中立狀態已改變",
    },
    mirrorReflectionClear: {
      pass: "相機倒影已離開鏡面範圍",
      fail: "相機倒影仍然透過鏡面可見",
    },
    mirrorFramingRestored: {
      pass: "鏡面構圖接近 Neutral",
      fail: "鏡面構圖仍然偏離 Neutral",
    },
    mirrorViewpointRetained: {
      pass: "反射道具顯示視點已改變",
      fail: "反射道具的視差仍未足夠明顯",
    },
  },
  rise: {
    title: "使用前組上移構圖建築物",
    objective: "保持相機水平，使用前組上移把建築物頂部納入畫面，同時不改變整部相機的視點。",
    notes: {
      useRise: "使用前組上移，不要使用前組傾斜或前組擺動，把建築物頂部納入畫面。",
      levelGeometry: "保持相機水平，並維持預期的垂直線平行關係。",
    },
    criteria: {
      buildingTopVisible: "建築物頂部可見度至少為 {{coverage}}%",
      buildingMainVisible: "建築物主要部分可見度至少為 {{coverage}}%",
      movementUsed: "已使用前組上移",
      movementRange: "前組上移保持在 {{min}} mm 至 {{max}} mm 之間",
    },
    feedback: {
      passPrimary: "你使用前組上移納入建築物頂部，沒有傾斜相機機身。",
      defaultFailPrimary: "增加前組上移，同時保持前組傾斜及前組擺動為 0°。",
      primary: {
        buildingTopVisible: "建築物頂部仍被裁切，請進一步增加前組上移。",
        buildingMainVisible: "建築物主要部分的覆蓋範圍太低，請稍微減少過大的前組上移。",
        movementUsed: "前組上移幅度不足以完成此構圖任務。",
        movementRange: "此練習請將前組上移保持在 {{min}} mm 至 {{max}} mm 之間。",
      },
      secondary: {
        buildingTopVisible: "查看對焦屏頂部邊緣，並保持垂直線穩定。",
        buildingMainVisible: "使用前組上移重新構圖，讓建築物主體保持在中央，同時保留頂部。",
        movementUsed: "先從約 15 mm 開始，再逐步微調前組上移。",
        movementRange: "不要用前組傾斜解決問題；使用前組上移控制構圖。",
      },
    },
  },
  obliqueRise: {
    title: "為建築物構圖",
    objective: "使用前組上移把整座建築物納入畫面，同時保持相機水平及垂直線平行。",
    notes: {
      useRise: "保持前組傾斜及前組擺動為 0°，然後增加前組上移，讓屋頂進入畫面。",
      keepBase: "把指定的建築物頂部納入畫面，同時保留較低的建築物底部。",
      depth: "此課程只處理構圖；延伸立面仍會有不均勻的清晰度。",
    },
    criteria: {
      buildingTopVisible: "指定的建築物頂部範圍可見",
      buildingBaseVisible: "指定的建築物底部範圍仍然可見",
      cameraLevel: "相機及後組保持水平",
      movementUsed: "已使用前組上移",
    },
    feedback: {
      passPrimary: "前組上移恢復了建築物構圖，同時保持相機水平。",
      defaultFailPrimary: "使用前組上移納入屋頂，同時保持底部及垂直線穩定。",
      primary: {
        buildingTopVisible: "指定的屋頂範圍仍被裁切，請增加前組上移。",
        buildingBaseVisible: "調整前組上移時，請保留畫面內較低的建築物底部。",
        cameraLevel: "保持相機及後組水平；不要加入傾斜、擺動或後組移軸。",
        movementUsed: "增加前組上移，開始解決構圖問題。",
      },
      secondary: {
        buildingTopVisible: "觀察對焦屏頂部邊緣，直到指定的屋頂角落都在畫面內。",
        buildingBaseVisible: "把屋頂納入畫面時，留意對焦屏底部邊緣。",
        cameraLevel: "前組上移改變構圖，不會令相機俯仰或使垂直線收斂。",
        movementUsed: "使用前組上移完成此構圖任務；不會指定必須使用的數值。",
      },
    },
  },
  tableTilt: {
    title: "對齊桌面清晰焦平面",
    objective: "使用前組傾斜及對焦，讓清晰焦平面與三張共面的對焦卡對齊。",
    notes: {
      focusAndTilt: "先對焦中間卡片，然後使用正向前組傾斜，讓清晰焦平面與三張共面的對焦卡對齊。",
      constraints: "保持前組上移及前組擺動為零。使用 f/11 或 f/22 完成任務，不要用 f/32 走捷徑。",
    },
    criteria: {
      allowedAperture: "光圈為 f/11 或 f/22",
      riseZero: "前組上移保持在 0 mm",
      swingZero: "前組擺動保持在 0°",
      movementRange: "前組傾斜保持在 {{min}}° 至 {{max}}° 之間",
      nearSharp: "近處杯子的對焦卡清晰",
      midSharp: "中間筆記簿線條圖清晰",
      farSharp: "遠處書本對焦圖清晰",
    },
    feedback: {
      passPrimary: "很好。正向前組傾斜讓清晰焦平面與三張共面的對焦卡對齊。",
      defaultFailPrimary: "先對焦中間卡片，施加正向前組傾斜，再調整對焦，讓三張對焦卡都清晰。",
      primary: {
        allowedAperture: "不要使用 f/32；使用 f/11 或 f/22 配合前組傾斜及對焦完成任務。",
        riseZero: "將前組上移恢復至 0 mm；此任務使用前組傾斜及對焦完成。",
        swingZero: "將前組擺動恢復至 0°；擺動不能對齊由近至遠的桌面。",
        movementRange: "此桌面校準請將前組傾斜調至約 {{tiltDeg}}° 的正值。",
        nearSharp: "近處杯子的對焦卡不夠清晰；設定校準的前組傾斜後微調對焦。",
        midSharp: "中間線條圖不夠清晰；以中間目標為中心重新對焦。",
        farSharp: "遠處書本圖表不夠清晰；微調對焦，不要加入前組擺動。",
      },
      secondary: {
        allowedAperture: "比較 f/11 及 f/22，但不要依靠 f/32。",
        riseZero: "側視幾何圖應讓鏡頭中心保持在標準基準位置。",
        swingZero: "查看俯視讀數：此傾斜任務中前組擺動必須保持為零。",
        movementRange: "在側視圖中，綠色清晰焦平面應在探測高度之間接近水平。",
        nearSharp: "在對焦屏及近處目標清晰度讀數中查看杯子的對焦卡。",
        midSharp: "以筆記簿線條圖作為最初的對焦參考。",
        farSharp: "當清晰焦平面抵達遠處對焦卡表面時，遠處棋盤圖應變得清晰。",
      },
    },
  },
  shelfSwing: {
    title: "對齊斜向清晰焦平面",
    objective: "使用負向前組擺動及對焦，讓清晰焦平面穿過沿深度斜向排列的三張圖表。",
    notes: {
      focusAndSwing: "先對焦中間圖表，然後使用負向前組擺動，讓清晰焦平面旋轉穿過前、中、後三張圖表。",
      constraints: "保持前組上移及前組傾斜為零。使用 f/11 或 f/22 完成任務，不要依靠 f/32。",
    },
    criteria: {
      allowedAperture: "光圈為 f/11 或 f/22",
      riseZero: "前組上移保持在 0 mm",
      tiltZero: "前組傾斜保持在 0°",
      movementRange: "前組擺動保持在 {{min}}° 至 {{max}}° 之間",
      frontSharp: "前方圖表清晰",
      middleSharp: "中間圖表清晰",
      backSharp: "後方圖表清晰",
    },
    feedback: {
      passPrimary: "很好。負向前組擺動讓清晰焦平面穿過三張斜向排列的圖表。",
      defaultFailPrimary: "先對焦中間圖表，施加負向前組擺動，再調整對焦，直到三張圖表都清晰。",
      primary: {
        allowedAperture: "使用 f/11 或 f/22 完成任務；不要依靠 f/32 掩蓋不正確的清晰焦平面。",
        riseZero: "將前組上移恢復至 0 mm；此任務使用前組擺動及對焦完成。",
        tiltZero: "將前組傾斜恢復至 0°；傾斜改變垂直方向的對焦關係，不屬於此任務。",
        movementRange: "此任務請將前組擺動調至約 {{swingDeg}}° 的負值；正向前組擺動會令清晰焦平面向相反方向旋轉。",
        frontSharp: "清晰焦平面尚未到達前方圖表；保持負向前組擺動並微調對焦。",
        middleSharp: "先在中間圖表建立清晰對焦，再微調負向前組擺動。",
        backSharp: "清晰焦平面尚未延伸至後方圖表；微調負向前組擺動及對焦。",
      },
      secondary: {
        allowedAperture: "使用俯視幾何圖判斷平面對齊，不要再收細光圈。",
        riseZero: "在俯視幾何圖中，讓鏡頭中心保持在標準光軸基準位置。",
        tiltZero: "此任務使用水平的俯視關係；保持前組傾斜為零。",
        movementRange: "在俯視幾何圖中，綠色清晰焦平面應沿斜向主體線穿過三個圖表標記。",
        frontSharp: "在俯視幾何圖中，確認綠色清晰焦平面穿過前方圖表標記。",
        middleSharp: "在俯視幾何圖中，以中間圖表標記作為最初的對焦參考。",
        backSharp: "在俯視幾何圖中，讓綠色清晰焦平面延伸至後方圖表標記。",
      },
    },
  },
  mirrorShift: {
    title: "改變視點後恢復鏡面構圖",
    objective: "將整部相機向側面移動以避開相機倒影，然後使用相反方向的前組橫移恢復鏡面構圖，同時保留已改變的視點。",
    notes: {
      clearReflection: "將整部相機向側面移動，直到相機倒影完全離開鏡面。",
      restoreFraming: "保持相機位置不變，向相反方向使用前組橫移恢復鏡面構圖。",
      retainViewpoint: "保持底片平面與鏡面平行；倒影清除後不要把相機移回原位。",
    },
    criteria: {
      reflectionClear: "相機倒影已離開鏡面範圍",
      framingRestored: "鏡面構圖恢復至接近 Neutral",
      viewpointRetained: "反射道具保留已改變的視點",
    },
    feedback: {
      passPrimary: "成功。鏡面構圖已恢復，而相機仍然留在倒影以外。",
      passSecondary: "反射道具仍然與 Neutral 不同，因為視點已改變。前組橫移恢復了構圖，但沒有把相機移回原本的位置。",
      defaultFailPrimary: "將整部相機向側面移動，直到相機倒影完全離開鏡面。",
      primary: {
        reflectionClear: "將整部相機向側面移動，直到相機倒影完全離開鏡面。",
        framingRestored: "很好——相機已離開倒影。保持相機位置不變，向相反方向使用前組橫移恢復鏡面構圖。",
        viewpointRetained: "構圖已接近原本狀態，但視點改變仍然不足。",
      },
      secondary: {
        reflectionClear: "暫時不要使用前組橫移隱藏相機；移動整部相機才會改變視點。",
        framingRestored: "查看對焦屏。前組橫移會改變構圖，但不會把相機移回原本的視點。",
        viewpointRetained: "將整部相機再向側面移動，然後再次用前組橫移補償。比較兩件反射道具，以視差作為線索。",
      },
    },
  },
} satisfies MessageShape<typeof englishTasksMessages>;
