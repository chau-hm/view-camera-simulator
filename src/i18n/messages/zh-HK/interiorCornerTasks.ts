export const interiorCornerTaskMessages = {
  interiorCornerCompose: {
    title: "使用前組上移為室內角落構圖",
    objective: "保持相機水平，使用前組上移將上方建築細節納入畫面。",
    notes: {
      composition: "利用對焦屏邊緣，將上方細節帶到較安全的畫面位置。",
      level: "前組上移會改變構圖，不會令相機俯仰或改變房間的透視。",
    },
    criteria: {
      composition: "上方細節及房間角落都在安全畫面內",
      cameraLevel: "相機及後組保持水平",
    },
    feedback: {
      passPrimary: "構圖已修正，而相機沒有傾斜。保留這個構圖，接著轉向延伸的牆面。",
      defaultFailPrimary: "保持相機水平，使用前組上移將上方建築細節納入畫面。",
      primary: {
        composition: "上方建築細節仍然太接近頂部邊緣，請逐步增加前組上移。",
        cameraLevel: "保持相機及後組水平；這項構圖調整請使用前組上移。",
      },
      secondary: {
        composition: "繼續之前，比較上方細節及房間角落與對焦屏邊緣的距離。",
        cameraLevel: "前組上移只改變構圖，不應令相機俯仰或垂直線收斂。",
      },
    },
  },
  interiorCornerSwing: {
    title: "使用前組擺動轉動清晰焦平面",
    objective: "使用前組擺動，將清晰焦平面轉向延伸的牆面。暫時保持對焦不變，以觀察方向改變。",
    notes: {
      swing: "保持已完成的構圖，加入正向前組擺動。",
      orientation: "這一步改變焦平面的方向；下一步才會將它準確放到牆面上。",
      level: "前組改變焦平面方向時，保持相機水平。",
    },
    criteria: {
      allowedAperture: "光圈保持在 f/5.6",
      composition: "已完成的上方細節及房間角落仍在安全畫面內",
      swingRange: "前組擺動在有效的正向範圍內",
      orientation: "清晰焦平面方向已轉向延伸的牆面",
      cameraLevel: "相機及後組保持水平",
    },
    feedback: {
      passPrimary: "清晰焦平面已向正確方向轉動，但仍未準確放到牆面上。下一步再微調對焦。",
      defaultFailPrimary: "保持已完成的構圖，使用正向前組擺動將清晰焦平面轉向延伸的牆面。",
      primary: {
        allowedAperture: "保持光圈在 f/5.6，讓這一步顯示方向而不是額外景深。",
        composition: "加入焦平面轉動時，保留有效的前組上移構圖。",
        swingRange: "使用適度的正向前組擺動；相反方向會令焦平面轉離延伸牆面。",
        orientation: "清晰焦平面尚未轉向牆面，請使用正向前組擺動並比較俯視圖。",
        cameraLevel: "保持相機水平；擺動改變焦平面方向，不會令相機俯仰。",
      },
      secondary: {
        allowedAperture: "保留 f/5.6，讓移軸方向的效果清楚可見。",
        composition: "前組上移構圖是前提；不要以改變相機位置來完成這一步。",
        swingRange: "判斷方向前，先比較俯視圖中的焦平面與延伸牆面。",
        orientation: "牆面暫時未會全部清晰，這一步建立方向；準確對焦留待下一步。",
        cameraLevel: "保持水平的後組，讓房間的垂直參考穩定，同時由擺動轉動焦平面。",
      },
    },
  },
  interiorCornerRefine: {
    title: "將清晰焦平面放到牆面上",
    objective: "保留有效的擺動關係，微調對焦，令牆面近處、中間及遠處細節落在同一個清晰焦平面上。",
    notes: {
      focus: "使用對焦將已定好方向的焦平面放到延伸牆面上。",
      wall: "比較牆面近處、中間及遠處細節，不要只依靠一個參考點。",
      level: "保持相機水平，並保留有效的前組上移構圖。",
    },
    criteria: {
      allowedAperture: "光圈保持在 f/5.6",
      composition: "已完成的上方細節及房間角落仍在安全畫面內",
      swingRange: "前組擺動保持在有效的正向範圍內",
      focusUsed: "對焦由起始位置作出微調",
      wallFocus: "牆面近處、中間及遠處細節都清晰",
      cameraLevel: "相機及後組保持水平",
    },
    feedback: {
      passPrimary: "延伸牆面已在 f/5.6 對齊。最後一步是在這個焦平面周圍增加景深。",
      defaultFailPrimary: "保留有效的正向擺動關係，微調對焦，直到牆面近處、中間及遠處細節都清晰。",
      primary: {
        allowedAperture: "保持光圈在 f/5.6，先放置焦平面，再在周圍增加景深。",
        composition: "微調焦平面時，保留已修正的前組上移構圖。",
        swingRange: "放置焦平面時，保持前組擺動接近有效的正向關係。",
        focusUsed: "由起始位置微調對焦，將已轉好方向的焦平面移到牆面上。",
        wallFocus: "部分牆面細節仍然偏柔，請比較近處、中間及遠處，再微調對焦。",
        cameraLevel: "保持相機水平；這一步只應改變焦平面的位置。",
      },
      secondary: {
        allowedAperture: "開放的 f/5.6 令這一步集中處理焦平面位置，而不是景深。",
        composition: "比較三個牆面距離時，以現有構圖作為護欄。",
        swingRange: "俯視圖顯示有效的左右方向，對焦時不要失去這個關係。",
        focusUsed: "改變焦平面方向後，要重新對焦，將它準確放到牆面上。",
        wallFocus: "只清晰一個牆面位置並不足夠，請一起檢查近處、中間及遠處。",
        cameraLevel: "前組上移及擺動不需要相機俯仰，保持後組水平。",
      },
    },
  },
  interiorCornerAperture: {
    title: "在已對齊的焦平面周圍增加景深",
    objective: "焦平面已經對齊。現在適度收細光圈，增加周圍的容錯，而不是取代上移、擺動或對焦。",
    notes: {
      aperture: "保留已對齊的移軸及對焦關係，選擇下一個適度收細的光圈。",
      preserve: "光圈只會在正確放置的焦平面周圍增加景深，不能修復錯誤的焦平面。",
      level: "保持相機水平及已建立的構圖不變。",
    },
    criteria: {
      allowedAperture: "光圈已設定為適度收細的最後值",
      composition: "已完成的上方細節及房間角落仍在安全畫面內",
      swingRange: "前組擺動保持在有效的正向範圍內",
      focusPreserved: "已對齊的牆面對焦關係得以保留",
      cameraLevel: "相機及後組保持水平",
    },
    feedback: {
      passPrimary: "完成。上移修正構圖，擺動定位焦平面，對焦將它放到牆面上，最後以較細光圈在周圍增加景深。",
      defaultFailPrimary: "保留已對齊的構圖及焦平面，再適度收細一級光圈。光圈不能取代之前的調整。",
      primary: {
        allowedAperture: "選擇下一個適度收細的 f/11，完成最後一步。",
        composition: "收細光圈時，保持已建立的前組上移構圖不變。",
        swingRange: "依靠光圈之前，先恢復有效的正向擺動關係。",
        focusPreserved: "開放光圈時牆面尚未對齊，請恢復正確的上移、擺動及對焦狀態。",
        cameraLevel: "保持相機水平；光圈不應改變已建立的幾何關係。",
      },
      secondary: {
        allowedAperture: "收細幅度是刻意保持適度，為已對齊的焦平面增加容錯。",
        composition: "改變光圈後，比較同一組上方細節及房間角落。",
        swingRange: "比較增加的景深時，保持相同的焦平面方向。",
        focusPreserved: "如果收細後清晰度仍然不足，應修正焦平面位置，不要以更細光圈取代。",
        cameraLevel: "保持水平相機及不變的構圖，令比較集中於可用景深。",
      },
    },
  },
} as const;
