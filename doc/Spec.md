# View Camera Movement Simulator — Execution Specification

**文件名稱**：`SPEC.md`
**版本**：MVP v0.1
**狀態**：Ready for implementation
**目標**：建立可在 Desktop Browser 運行的大片幅相機前組 movement 教學模擬器。

---

## 1. 實作目標

建立一個純前端 Web 應用程式，模擬一部固定規格的 4×5 view camera，讓使用者可即時調整：

* Front Rise
* Front Tilt
* Front Swing
* Focus Distance
* Aperture

每次調整必須同步更新：

1. 3D 相機與場景視圖
2. 地面玻璃預覽
3. 側視／俯視 2D 幾何圖
4. 焦平面與景深可視化
5. 關卡完成狀態與教學回饋

MVP 必須提供三個教學場景：

* 建築物：Rise
* 桌面靜物：Tilt
* 斜向書架或走廊：Swing

---

## 2. 不可變更的 MVP 範圍

### 2.1 必須實作

* React + TypeScript + Vite。
* Three.js 或 React Three Fiber。
* Zustand 狀態管理。
* 單一 4×5 虛擬相機。
* 單一 150mm 鏡頭預設。
* 前組 Rise、Tilt、Swing。
* Focus 與 Aperture。
* 3D 場景。
* Ground Glass 預覽。
* 2D 幾何示意圖。
* 教學級焦平面與景深模擬。
* Guided Mode。
* Free Practice Mode。
* 三個任務關卡。
* Unit、integration、E2E tests。

### 2.2 明確不做

以下內容不得加入 MVP：

* Rear movements。
* Front shift 或 fall。
* 多鏡頭、鏡頭品牌資料庫。
* 8×10、5×7 或其他片幅。
* 真實鏡頭像差、散景形狀、色散、暗角。
* 光線追蹤。
* 底片、片盒、暗片、快門流程。
* 登入、帳戶、後端 API。
* 雲端儲存。
* 手機優先版面。
* 自訂場景上傳。
* 多人協作。

---

## 3. 技術基線

| 類別          | 要求                           |
| ----------- | ---------------------------- |
| Runtime     | Node.js LTS                  |
| 語言          | TypeScript                   |
| Build Tool  | Vite                         |
| UI          | React                        |
| 3D          | Three.js + React Three Fiber |
| State       | Zustand                      |
| 2D Geometry | SVG                          |
| Test Runner | Vitest                       |
| UI Test     | React Testing Library        |
| E2E         | Playwright                   |
| Styling     | CSS Modules、Tailwind 或等效方案   |
| Deploy      | Static Hosting               |

---

## 4. 專案結構

必須使用以下目錄結構：

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx

  components/
    layout/
      AppShell.tsx
      SimulatorWorkspace.tsx

    controls/
      MovementControls.tsx
      FocusControl.tsx
      ApertureControl.tsx
      ViewOptions.tsx
      ResetControls.tsx

    simulator/
      SceneViewport.tsx
      GroundGlassViewport.tsx
      GeometryViewport.tsx
      TaskPanel.tsx
      FeedbackPanel.tsx

  core/
    math/
      vec.ts
      plane.ts
      ray.ts
      transform.ts
      clamps.ts

    optics/
      deriveOpticsState.ts
      calculateLensPlane.ts
      calculateFocusPlane.ts
      calculateDepthOfField.ts
      calculateGroundGlassProjection.ts
      calculateSharpness.ts
      calculateCompositionCoverage.ts

    tasks/
      evaluateTask.ts
      evaluateFocusTargets.ts
      evaluateCompositionTargets.ts
      feedbackEngine.ts

  scenes/
    definitions/
      architecture-rise.ts
      table-tilt.ts
      shelf-swing.ts
      index.ts

    assets/
      architecture/
      table/
      shelf/

  render/
    SceneRenderer.tsx
    GroundGlassRenderer.tsx
    postprocessing/
      DepthOfFieldPass.ts
      FocusAssistPass.ts

  state/
    appStore.ts
    selectors.ts

  types/
    camera.ts
    optics.ts
    scene.ts
    task.ts
    ui.ts

  utils/
    formatters.ts
    constants.ts

  tests/
    unit/
    integration/
    e2e/
```

---

## 5. 核心資料模型

### 5.1 `CameraState`

```ts
export type CameraState = {
  focalLengthMm: number;
  aperture: 5.6 | 11 | 22 | 32;
  focusDistanceMm: number;

  frontRiseMm: number;
  frontTiltDeg: number;
  frontSwingDeg: number;

  activeSceneId: string;
  activeTaskId: string | null;

  mode: "guided" | "free";

  groundGlassAssistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  geometryView: "side" | "top";
};
```

### 5.2 固定相機常數

```ts
export const CAMERA_CONSTANTS = {
  filmWidthMm: 127,
  filmHeightMm: 101.6,

  focalLengthMm: 150,

  riseMinMm: 0,
  riseMaxMm: 40,

  tiltMinDeg: -10,
  tiltMaxDeg: 10,

  swingMinDeg: -10,
  swingMaxDeg: 10,

  apertureOptions: [5.6, 11, 22, 32] as const,

  tiltParallelThresholdDeg: 0.1,
};
```

### 5.3 `DerivedOpticsState`

所有 renderer、diagram、task evaluator 必須只依賴此物件，而不是自行從 `CameraState` 重算。

```ts
export type DerivedOpticsState = {
  lensCenterWorld: Vec3;
  lensNormalWorld: Vec3;
  lensPlane: Plane;

  filmCenterWorld: Vec3;
  filmNormalWorld: Vec3;
  filmPlane: Plane;

  opticalAxis: Ray;

  focusPointWorld: Vec3;
  focusPlane: Plane;

  depthOfFieldNearPlane: Plane;
  depthOfFieldFarPlane: Plane;

  groundGlassProjection: ProjectionData;

  focusTargets: FocusTargetSharpness[];

  diagnostics: {
    isParallelLensFilm: boolean;
    tiltAngleDeg: number;
    swingAngleDeg: number;
  };
};
```

---

## 6. 座標與平面規則

### 6.1 世界座標

| 軸 | 定義       |
| - | -------- |
| X | 場景右方     |
| Y | 場景上方     |
| Z | 相機望向場景方向 |

相機初始朝向固定為 `+Z`。

### 6.2 底片平面

* 後組在 MVP 固定。
* 底片平面固定在世界原點附近。
* 底片法線預設指向 `+Z`。
* 底片尺寸固定為 `127mm × 101.6mm`。

### 6.3 鏡頭平面

鏡頭平面由下列值決定：

```text
鏡頭中心 = 基準鏡頭中心 + Rise 垂直位移

鏡頭旋轉 =
  Swing(Y 軸) × Tilt(X 軸)
```

### 6.4 Movement 定義

| Movement | 軸     | 作用        |
| -------- | ----- | --------- |
| Rise     | Y 軸位移 | 改變垂直取景    |
| Tilt     | X 軸旋轉 | 改變前後方向焦平面 |
| Swing    | Y 軸旋轉 | 改變左右方向焦平面 |

不得將 Rise 實作成相機整體旋轉或相機位置改變。

---

## 7. 焦平面計算規格

### 7.1 一般情況

當鏡頭平面與底片平面不平行：

1. 計算 lens plane 與 film plane 的交線。
2. 建立沿 optical axis 的 focus point。
3. 建立同時通過交線及 focus point 的 focus plane。
4. 將該 focus plane 作為最佳清晰平面。

### 7.2 平行回退規則

當鏡頭平面與底片平面夾角小於 `0.1°`：

* 不計算交線。
* Focus plane 必須與 film plane 平行。
* Focus plane 通過目前 `focusPointWorld`。

### 7.3 必要函式

```ts
deriveOpticsState(cameraState, sceneDefinition): DerivedOpticsState

calculateLensPlane(cameraState): Plane

calculateFocusPoint(cameraState, lensCenter, opticalAxis): Vec3

calculateFocusPlane(
  lensPlane,
  filmPlane,
  focusPointWorld
): Plane

calculateDepthOfField(
  focusPlane,
  aperture,
  focalLengthMm
): {
  nearPlane: Plane;
  farPlane: Plane;
}
```

### 7.4 焦平面正確性條件

* Tilt 改變時，側視焦平面方向必須改變。
* Swing 改變時，俯視焦平面方向必須改變。
* Aperture 改變時，焦平面方向不可改變。
* Focus distance 改變時，焦平面位置可移動，但其方向不應無故改變。
* Tilt = 0 且 Swing = 0 時，focus plane 必須與 film plane 平行。

---

## 8. 景深與清晰度計算規格

### 8.1 景深模型

MVP 使用教學級近似模型。

清晰度主要由以下因素決定：

* 物件與 focus plane 的距離。
* Aperture。
* 預設可接受 Circle of Confusion tolerance。

### 8.2 清晰度輸出範圍

每個 focus target 必須回傳 `sharpnessScore`，範圍為：

```text
0.0 = 明顯失焦
1.0 = 最佳清晰
```

```ts
type FocusTargetSharpness = {
  targetId: string;
  distanceToFocusPlaneMm: number;
  acceptableRangeMm: number;
  sharpnessScore: number;
  status: "sharp" | "near-sharp" | "blurred";
};
```

### 8.3 狀態分類

|              Score | 狀態         |
| -----------------: | ---------- |
|           `>= 0.8` | sharp      |
| `>= 0.5` 且 `< 0.8` | near-sharp |
|            `< 0.5` | blurred    |

### 8.4 Aperture 行為

| 光圈    | 景深寬度 |
| ----- | ---- |
| f/5.6 | 最窄   |
| f/11  | 較窄   |
| f/22  | 較寬   |
| f/32  | 最寬   |

不得讓 Aperture 改變 focus plane 的方向。

---

## 9. Ground Glass 渲染規格

### 9.1 必要視覺結果

Ground Glass 必須：

* 以 4×5 比例顯示。
* 反映 Rise、Tilt、Swing、Focus、Aperture。
* 預設上下倒轉與左右反轉。
* 支援開啟 orientation assist，將畫面轉正。
* 支援 grid overlay。
* 支援 focus assist overlay。
* 顯示目前數值。

### 9.2 Render Pipeline

```text
3D Scene
  → Off-axis camera projection
  → Color Render Target
  → Depth Render Target
  → DOF shader
  → Optional focus assist overlay
  → Optional grid overlay
  → Ground Glass panel
```

### 9.3 Ground Glass 反轉規則

預設：

```text
flipX = true
flipY = true
```

當 `groundGlassAssistEnabled = true`：

```text
flipX = false
flipY = false
```

### 9.4 焦點輔助

Focus assist 不可只用顏色。

每個關鍵目標需有：

* 文字名稱。
* 清晰度百分比。
* `sharp / near-sharp / blurred` 狀態。
* 可選 outline 或非單色 pattern。

---

## 10. 2D 幾何圖規格

### 10.1 側視圖

側視圖必須顯示：

* Film plane。
* Lens plane。
* Optical axis。
* Focus point。
* Focus plane。
* 景深近端及遠端範圍。
* 被攝主體代表平面。
* Rise 位移。

側視圖主要支援：

* Rise。
* Tilt。
* Focus。
* Aperture。

### 10.2 俯視圖

俯視圖必須顯示：

* Film plane。
* Lens plane。
* Optical axis。
* Focus plane。
* 景深近端及遠端範圍。
* 被攝物橫向分布。

俯視圖主要支援：

* Swing。
* Focus。
* Aperture。

### 10.3 實作要求

* 必須使用 SVG。
* 不得由 renderer 手動保存獨立狀態。
* 必須直接輸入 `DerivedOpticsState`。
* 每個平面須有文字標示。
* 不可只依賴顏色區分平面。
* 必須有圖例。

---

## 11. 場景與任務資料規格

### 11.1 場景格式

```ts
export type SceneDefinition = {
  id: string;
  title: string;
  description: string;

  assetUrl: string;

  initialCameraState: Partial<CameraState>;

  cameraPlacement: {
    position: Vec3;
    target: Vec3;
  };

  focusTargets: Array<{
    id: string;
    label: string;
    worldPosition: Vec3;
    weight: number;
  }>;

  compositionTargets?: Array<{
    id: string;
    label: string;
    worldBounds: Bounds3;
  }>;
};
```

### 11.2 任務格式

```ts
export type TaskDefinition = {
  id: string;
  sceneId: string;
  title: string;
  learningObjective: string;

  enabledControls: Array<
    "rise" | "tilt" | "swing" | "focus" | "aperture"
  >;

  initialCameraOverride?: Partial<CameraState>;

  constraints: {
    allowedApertures?: number[];
    riseRangeMm?: [number, number];
    tiltRangeDeg?: [number, number];
    swingRangeDeg?: [number, number];
  };

  successCriteria: SuccessCriterion[];

  feedbackRules: FeedbackRule[];
};
```

---

## 12. 關卡規格

## 12.1 Rise 關卡

### ID

```text
rise-01
```

### 場景

```text
architecture-rise
```

### 開放控制

```text
rise
focus
aperture
```

### 目標

在不改變相機方向的條件下，完整收入建築頂部。

### 成功條件

```text
1. 建築頂部可見範圍 >= 95%
2. 建築主體可見範圍 >= 70%
3. Rise >= 12mm
4. Rise <= 35mm
```

### 主要回饋

| 條件      | 回饋                      |
| ------- | ----------------------- |
| 建築頂部未入畫 | 增加 Rise，避免直接改變相機俯仰角。    |
| Rise 太低 | 目前垂直取景不足，建築頂部仍被裁切。      |
| Rise 太高 | 取景已偏離主要主體，嘗試略為降低 Rise。  |
| 完成      | 你以 Rise 改變取景，而沒有抬高相機視軸。 |

---

## 12.2 Tilt 關卡

### ID

```text
tilt-01
```

### 場景

```text
table-tilt
```

### 開放控制

```text
tilt
focus
aperture
```

### 目標

在光圈不得小於 f/22 的限制下，令桌面近、中、遠三個目標同時進入可接受清晰範圍。

### 成功條件

```text
1. Aperture 必須為 f/5.6、f/11 或 f/22
2. 不可使用 f/32
3. 近景 target sharpness >= 0.8
4. 中景 target sharpness >= 0.8
5. 遠景 target sharpness >= 0.8
6. abs(Tilt) >= 1.5°
7. abs(Tilt) <= 8°
```

### 主要回饋

| 條件        | 回饋                         |
| --------- | -------------------------- |
| 三目標皆模糊    | 先設定 focus，再用 Tilt 調整焦平面方向。 |
| 近景清晰、遠景失焦 | Tilt 不足，焦平面未沿桌面延伸。         |
| 遠景清晰、近景失焦 | Tilt 或 focus 過量，焦平面偏離前景。   |
| 使用 f/32   | 請用 Tilt 解決焦平面問題，而非依賴最小光圈。  |
| 完成        | 你用 Tilt 令焦平面接近桌面方向。        |

---

## 12.3 Swing 關卡

### ID

```text
swing-01
```

### 場景

```text
shelf-swing
```

### 開放控制

```text
swing
focus
aperture
```

### 目標

令斜向排列的前、中、遠三個標記同時清晰。

### 成功條件

```text
1. Aperture 不可為 f/32
2. 前景 target sharpness >= 0.8
3. 中景 target sharpness >= 0.8
4. 遠景 target sharpness >= 0.8
5. abs(Swing) >= 1.5°
6. abs(Swing) <= 8°
```

### 主要回饋

| 條件        | 回饋                       |
| --------- | ------------------------ |
| 前景清晰、遠景失焦 | Swing 不足或方向不正確。          |
| 遠景清晰、前景失焦 | Swing 過量，焦平面已偏離近景。       |
| 所有目標略微模糊  | 保持目前 Swing，微調 Focus。     |
| 完成        | 你以 Swing 令焦平面沿主體的左右方向旋轉。 |

---

## 13. 任務判定規格

### 13.1 `evaluateTask()`

```ts
export function evaluateTask(
  task: TaskDefinition,
  scene: SceneDefinition,
  camera: CameraState,
  optics: DerivedOpticsState
): TaskEvaluation;
```

### 13.2 輸出格式

```ts
export type TaskEvaluation = {
  status: "in-progress" | "completed" | "blocked";

  criteria: Array<{
    id: string;
    passed: boolean;
    currentValue: number | string;
    expectedValue: string;
  }>;

  score: number;

  feedback: {
    primary: string;
    secondary?: string;
  };
};
```

### 13.3 分數計算

```text
每個成功條件均分。

score =
  passedCriteria / totalCriteria × 100
```

完成條件：

```text
所有 required success criteria 必須 passed。
```

---

## 14. UI 行為規格

### 14.1 Guided Mode

* 僅啟用當前關卡必要 controls。
* 其他 controls 必須 visible 但 disabled。
* Disabled control 必須顯示原因，例如：

  * 「本關集中練習 Rise」
  * 「此關不需要 Swing」

### 14.2 Free Mode

* 同時啟用 Rise、Tilt、Swing、Focus、Aperture。
* 可切換三個場景。
* 不顯示完成壓力，但可顯示即時 focus target 狀態。

### 14.3 Reset

必須提供兩個 reset：

| 按鈕              | 行為                                           |
| --------------- | -------------------------------------------- |
| Reset Movements | 重設 Rise、Tilt、Swing、Focus、Aperture，但保留當前場景與模式 |
| Restart Task    | 完整回復關卡初始狀態與初始提示                              |

---

## 15. 可及性規格

### 15.1 鍵盤

所有 slider 必須支援：

| 快捷鍵               | 行為       |
| ----------------- | -------- |
| Tab               | 切換 focus |
| Arrow Left / Down | 減少數值     |
| Arrow Right / Up  | 增加數值     |
| Shift + Arrow     | 大步調整     |
| Home              | 移至最小值    |
| End               | 移至最大值    |

### 15.2 非色彩提示

Focus state 不可只以顏色顯示，必須包括：

* 文字狀態。
* Icon 或圖樣。
* 數值百分比。

### 15.3 Reduced Motion

如偵測到 `prefers-reduced-motion: reduce`：

* 禁止平滑補間動畫。
* 直接更新相機與 diagram。
* 保留必要狀態變更。

---

## 16. 效能規格

### 16.1 最低要求

| 項目                         |                  要求 |
| -------------------------- | ------------------: |
| 互動更新延遲                     |             < 100ms |
| 一般 desktop FPS             |           >= 30 FPS |
| Ground Glass render target | 預設為主 Canvas 50%–75% |
| DOF pass                   |              預設半解析度 |
| 初始場景載入                     |               < 5 秒 |
| 切換場景                       |               < 2 秒 |

### 16.2 優化規則

* 不可在每個 animation frame 重新建立 geometry。
* optics derivation 僅於 relevant camera state 改變時執行。
* SVG geometry diagram 必須 memoize。
* 景深 shader 必須可降級或關閉。
* 場景資產必須採低至中等多邊形數量。
* 不可使用高成本即時 ray tracing。

---

## 17. 測試規格

## 17.1 Unit Tests

必須覆蓋：

```text
1. Rise 正確更新 lensCenterWorld.y
2. Tilt 正確更新 lensNormalWorld
3. Swing 正確更新 lensNormalWorld
4. 沒有 movement 時 focusPlane 平行 filmPlane
5. Tilt 改變側視 focusPlane orientation
6. Swing 改變俯視 focusPlane orientation
7. Aperture 不改變 focusPlane orientation
8. Aperture 改變 acceptable sharpness range
9. Movement inputs 正確 clamp
10. Task success criteria 正確判定
11. Parallel-plane fallback 正確運作
```

## 17.2 Integration Tests

必須覆蓋：

```text
1. 調整 Rise 後，Ground Glass、3D Scene、2D Diagram 同步更新
2. 調整 Tilt 後，側視圖 focus plane 更新
3. 調整 Swing 後，俯視圖 focus plane 更新
4. Guided Mode disabled controls 不可操作
5. Reset Movements 回復預設數值
6. Restart Task 回復關卡初始狀態
7. Ground glass orientation assist 正確翻轉畫面
```

## 17.3 Playwright E2E Tests

必須覆蓋：

```text
1. 使用者可開啟 Rise 關卡
2. 調整 Rise 後成功完成 Rise 關卡
3. 使用者可開啟 Tilt 關卡
4. 選用 f/32 時 Tilt 關卡不可完成
5. 合理 Tilt + Focus + f/22 可完成 Tilt 關卡
6. 合理 Swing + Focus 可完成 Swing 關卡
7. Free Mode 可切換三個場景
8. WebGL 不支援時顯示 fallback 訊息
```

---

## 18. Definition of Done

以下條件全部達成後，MVP 才可視為完成：

* [ ] Desktop browser 可正常載入應用程式。
* [ ] 三個 3D 場景均可進入。
* [ ] Rise、Tilt、Swing、Focus、Aperture 可操作。
* [ ] 所有視圖共享同一份 `DerivedOpticsState`。
* [ ] Rise 正確改變垂直取景。
* [ ] Tilt 正確改變側視焦平面。
* [ ] Swing 正確改變俯視焦平面。
* [ ] Aperture 正確改變景深範圍。
* [ ] Ground Glass 支援倒像／左右反轉及 orientation assist。
* [ ] 三個關卡均可完成。
* [ ] 每關有清楚提示與失敗原因。
* [ ] Unit tests 全部通過。
* [ ] Integration tests 全部通過。
* [ ] E2E tests 全部通過。
* [ ] 沒有 TypeScript compile errors。
* [ ] 沒有 console errors。
* [ ] 一般 desktop browser 保持最低 30 FPS。
* [ ] 沒有加入任何 MVP 外功能。

---

## 19. 實作順序

工程代理必須按以下順序實作：

```text
Phase 1
- 初始化 React + TypeScript + Vite
- 建立基本路由與 App Shell
- 建立 Zustand Store
- 建立 CameraState 及固定常數

Phase 2
- 建立 core math utilities
- 實作 lens plane、film plane、optical axis
- 實作 focus plane derivation
- 為 optics kernel 建立 unit tests

Phase 3
- 建立基本 Three.js 場景
- 建立 4×5 相機模型
- 實作 Rise、Tilt、Swing 對 3D 相機模型的影響
- 建立第一個建築場景

Phase 4
- 實作 Ground Glass render target
- 實作畫面翻轉
- 實作 grid 與數值 overlay
- 實作簡化 DOF pass

Phase 5
- 實作 SVG 側視圖與俯視圖
- 連接 DerivedOpticsState
- 驗證 movement 與 diagram 一致

Phase 6
- 建立三個 SceneDefinition
- 建立 TaskDefinition
- 實作 Task Evaluator
- 實作 Feedback Engine

Phase 7
- 完成 Guided Mode 與 Free Mode
- 加入 Reset 與 Restart Task
- 加入 accessibility 支援

Phase 8
- 完成 integration tests
- 完成 Playwright tests
- 效能調校
- 靜態部署驗證
```

---

## 20. 工程約束

工程代理必須遵守：

1. 不可把光學計算直接散落於 React component。
2. `core/optics` 必須獨立、可 unit test。
3. 所有畫面必須共享同一份 derived optics result。
4. 不可在 MVP 引入後端、資料庫或帳戶系統。
5. 不可在 MVP 加入 rear movement。
6. 不可用單純 CSS transform 假裝 Tilt 或 Swing。
7. 不可只以視覺 blur 偽造焦平面；必須根據 focus plane 距離計算。
8. 任何 geometry fallback 必須保證 UI 不崩潰。
9. 預設畫面必須可在 1280px 寬度正常使用。
10. 所有 user-facing 文字必須集中於可維護的 content structure，不可散落硬編碼於 renderer。

---

## 21. 最終驗收問題

MVP 完成後，使用者應能從系統中自行理解以下問題：

1. 為甚麼 Rise 可以收納建築頂部，而不需要向上傾斜相機？
2. 為甚麼 Tilt 能令桌面近、中、遠物件同時清晰？
3. 為甚麼 Swing 對斜向排列的物件有效？
4. 為甚麼 Aperture 只改變景深範圍，而不改變焦平面方向？
5. 為甚麼 Focus、Tilt、Swing 必須互相配合？

如系統無法清楚呈現以上五點，則視為未符合 MVP 教學目標。
