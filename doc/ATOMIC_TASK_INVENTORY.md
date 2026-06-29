# View Camera Movement Simulator — Atomic Task Inventory

**版本**：MVP v0.1
**任務粒度原則**：每個 Task 只產生一個可驗收結果；不可將多個無直接依賴的工作混入同一項。
**優先級**：`P0` 必須完成；`P1` 可於核心流程完成後加入。
**建議執行方式**：每個 Task 使用獨立 branch / PR，完成後須通過 typecheck、lint 與相關測試。

---

# Phase 0 — 專案基礎

* [x] **ENV-001｜P0｜建立 Vite React TypeScript 專案**

  * 依賴：無
  * 驗收：可執行 `npm run dev` 並顯示基本 React 頁面。

* [x] **ENV-002｜P0｜啟用 TypeScript strict mode**

  * 依賴：ENV-001
  * 驗收：`tsconfig.json` 啟用 strict；專案可通過 `npm run typecheck`。

* [x] **ENV-003｜P0｜安裝 Three.js**

  * 依賴：ENV-001
  * 驗收：專案可 import `three`，無 build error。

* [x] **ENV-004｜P0｜安裝 React Three Fiber**

  * 依賴：ENV-003
  * 驗收：可 render 最小化 `<Canvas />` 元件。

* [x] **ENV-005｜P0｜安裝 React Three Drei**

  * 依賴：ENV-004
  * 驗收：可 import 至少一個 Drei helper，無 build error。

* [x] **ENV-006｜P0｜安裝 Zustand**

  * 依賴：ENV-001
  * 驗收：可建立最小 state store 並在 React component 讀取。

* [x] **ENV-007｜P0｜安裝 Vitest**

  * 依賴：ENV-001
  * 驗收：`npm run test` 可執行一個 sample test。

* [x] **ENV-008｜P0｜安裝 React Testing Library**

  * 依賴：ENV-007
  * 驗收：可 render 一個 React component 並斷言文字存在。

* [x] **ENV-009｜P0｜安裝 Playwright**

  * 依賴：ENV-001
  * 驗收：可執行 sample browser test。

* [x] **ENV-010｜P0｜設定 ESLint**

  * 依賴：ENV-001
  * 驗收：`npm run lint` 可執行並檢查 `src/`。

* [x] **ENV-011｜P0｜設定 Prettier**

  * 依賴：ENV-001
  * 驗收：可執行格式化指令，且不與 ESLint 衝突。

* [x] **ENV-012｜P0｜建立 npm scripts**

  * 依賴：ENV-007、ENV-009、ENV-010
  * 驗收：具備 `dev`、`build`、`typecheck`、`lint`、`test`、`test:e2e` scripts。

* [x] **ENV-013｜P0｜建立指定目錄結構**

  * 依賴：ENV-001
  * 驗收：建立 `app`、`components`、`core`、`render`、`scenes`、`state`、`types`、`tests` 等目錄。

* [x] **ENV-014｜P0｜建立 App Root**

  * 依賴：ENV-013
  * 驗收：`App.tsx` 可載入應用程式主框架。

* [x] **ENV-015｜P0｜建立基本 Router**

  * 依賴：ENV-014
  * 驗收：至少支援首頁、Simulator、Not Found 三個 route。

* [x] **ENV-016｜P0｜建立 App Shell**

  * 依賴：ENV-015
  * 驗收：提供 header、main content container 及全域錯誤顯示區域。

* [x] **ENV-017｜P1｜建立 Error Boundary**

  * 依賴：ENV-016
  * 驗收：子元件 throw error 時顯示 fallback，而非白畫面。

* [x] **ENV-018｜P0｜建立 WebGL 支援檢測**

  * 依賴：ENV-014
  * 驗收：不支援 WebGL 時顯示可理解的 fallback 訊息。

---

# Phase 1 — 型別、常數與資料契約

* [x] **DOM-001｜P0｜定義 Vec3 型別**

  * 依賴：ENV-013
  * 驗收：建立 `{ x, y, z }` 型別，供所有幾何模組共用。

* [x] **DOM-002｜P0｜定義 Ray 型別**

  * 依賴：DOM-001
  * 驗收：Ray 具備 `origin` 與 normalized `direction`。

* [x] **DOM-003｜P0｜定義 Plane 型別**

  * 依賴：DOM-001
  * 驗收：Plane 具備 `point` 與 normalized `normal`。

* [x] **DOM-004｜P0｜定義 Transform 型別**

  * 依賴：DOM-001
  * 驗收：可表示 position、rotation 或 quaternion。

* [x] **DOM-005｜P0｜定義 Bounds3 型別**

  * 依賴：DOM-001
  * 驗收：可表示 3D bounding box 的 min/max。

* [x] **DOM-006｜P0｜定義 CameraState 型別**

  * 依賴：DOM-001
  * 驗收：包含 focal length、aperture、focus、rise、tilt、swing、模式及 UI flags。

* [x] **DOM-007｜P0｜定義 DerivedOpticsState 型別**

  * 依賴：DOM-002、DOM-003、DOM-006
  * 驗收：包含 lens plane、film plane、optical axis、focus plane、DOF planes 及 diagnostics。

* [x] **DOM-008｜P0｜定義 SceneDefinition 型別**

  * 依賴：DOM-005、DOM-006
  * 驗收：包含場景 ID、資產、camera preset、focus targets、composition targets。

* [x] **DOM-009｜P0｜定義 FocusTarget 型別**

  * 依賴：DOM-001
  * 驗收：包含 ID、label、world position、weight。

* [x] **DOM-010｜P0｜定義 CompositionTarget 型別**

  * 依賴：DOM-005
  * 驗收：包含 ID、label、world bounds。

* [x] **DOM-011｜P0｜定義 TaskDefinition 型別**

  * 依賴：DOM-006、DOM-008
  * 驗收：包含 task ID、scene ID、enabled controls、constraints、criteria、feedback rules。

* [x] **DOM-012｜P0｜定義 TaskEvaluation 型別**

  * 依賴：DOM-011
  * 驗收：包含 status、criteria、score、primary feedback、secondary feedback。

* [x] **DOM-013｜P0｜建立相機常數**

  * 依賴：DOM-006
  * 驗收：固定 4×5 尺寸、150mm 鏡頭、rise/tilt/swing 範圍與 aperture options。

* [x] **DOM-014｜P0｜建立預設 CameraState**

  * 依賴：DOM-006、DOM-013
  * 驗收：可作為首次載入及 reset 基準。

* [x] **DOM-015｜P0｜建立集中式 UI 文字資料**

  * 依賴：ENV-013
  * 驗收：教學提示與 user-facing labels 不散落於 renderer 或 math modules。

---

# Phase 2 — State Management

* [x] **STA-001｜P0｜建立 Zustand Store Skeleton**

  * 依賴：ENV-006、DOM-006
  * 驗收：Store 可保存 `camera`、`scene`、`task`、`ui` 四類 state。

* [x] **STA-002｜P0｜實作 setRise action**

  * 依賴：STA-001、DOM-013
  * 驗收：輸入值被 clamp 至 `0–40mm`。

* [x] **STA-003｜P0｜實作 setTilt action**

  * 依賴：STA-001、DOM-013
  * 驗收：輸入值被 clamp 至 `-10° 至 +10°`。

* [x] **STA-004｜P0｜實作 setSwing action**

  * 依賴：STA-001、DOM-013
  * 驗收：輸入值被 clamp 至 `-10° 至 +10°`。

* [x] **STA-005｜P0｜實作 setFocusDistance action**

  * 依賴：STA-001
  * 驗收：focus 被限制於當前 scene 的合法範圍。

* [x] **STA-006｜P0｜實作 setAperture action**

  * 依賴：STA-001、DOM-013
  * 驗收：只接受 `f/5.6`、`f/11`、`f/22`、`f/32`。

* [x] **STA-007｜P0｜實作 setMode action**

  * 依賴：STA-001
  * 驗收：可在 `guided` 與 `free` 間切換。

* [x] **STA-008｜P0｜實作 setActiveScene action**

  * 依賴：STA-001
  * 驗收：切換 scene 時更新 scene ID。

* [x] **STA-009｜P0｜實作 setActiveTask action**

  * 依賴：STA-001
  * 驗收：可載入指定 task 或清除 active task。

* [x] **STA-010｜P0｜實作 ground glass assist toggle**

  * 依賴：STA-001
  * 驗收：切換值可被 renderer 讀取。

* [x] **STA-011｜P0｜實作 focus assist toggle**

  * 依賴：STA-001
  * 驗收：切換值可被 renderer 及 UI 讀取。

* [x] **STA-012｜P0｜實作 grid toggle**

  * 依賴：STA-001
  * 驗收：切換值可被 ground glass overlay 讀取。

* [x] **STA-013｜P0｜實作 resetMovements action**

  * 依賴：STA-002 至 STA-006、DOM-014
  * 驗收：只重設 rise、tilt、swing、focus、aperture，不改變 scene 或 mode。

* [x] **STA-014｜P0｜實作 restartTask action**

  * 依賴：STA-008、STA-009
  * 驗收：完整恢復 task 的 initial camera state 與提示狀態。

* [x] **STA-015｜P0｜建立 camera state selector**

  * 依賴：STA-001
  * 驗收：UI 可訂閱 camera state 而不造成不必要 re-render。

* [x] **STA-016｜P0｜建立 derived optics selector**

  * 依賴：STA-001、OPT-019
  * 驗收：所有 renderer 與 evaluator 可取得相同 DerivedOpticsState instance。

---

# Phase 3 — Math Foundation

* [x] **MTH-001｜P0｜實作 Vec3 add**

  * 依賴：DOM-001
  * 驗收：輸入兩個 Vec3，回傳正確相加結果。

* [x] **MTH-002｜P0｜實作 Vec3 subtract**

  * 依賴：DOM-001
  * 驗收：回傳正確相減結果。

* [x] **MTH-003｜P0｜實作 Vec3 scale**

  * 依賴：DOM-001
  * 驗收：回傳正確倍數向量。

* [x] **MTH-004｜P0｜實作 Vec3 dot product**

  * 依賴：DOM-001
  * 驗收：回傳正確內積。

* [x] **MTH-005｜P0｜實作 Vec3 cross product**

  * 依賴：DOM-001
  * 驗收：回傳符合右手座標系的外積。

* [x] **MTH-006｜P0｜實作 Vec3 normalize**

  * 依賴：DOM-001
  * 驗收：正常向量回傳 unit vector；零向量安全回退。

* [x] **MTH-007｜P0｜實作 Vec3 distance**

  * 依賴：DOM-001
  * 驗收：回傳兩點 Euclidean distance。

* [x] **MTH-008｜P0｜實作 Vec3 angle**

  * 依賴：MTH-004、MTH-006
  * 驗收：可正確計算兩法線夾角。

* [x] **MTH-009｜P0｜實作繞 X 軸 rotation helper**

  * 依賴：DOM-001
  * 驗收：可將 unit vector 旋轉指定角度。

* [x] **MTH-010｜P0｜實作繞 Y 軸 rotation helper**

  * 依賴：DOM-001
  * 驗收：可將 unit vector 旋轉指定角度。

* [x] **MTH-011｜P0｜實作 Plane 建構 helper**

  * 依賴：DOM-003、MTH-006
  * 驗收：輸出 plane normal 必為 normalized。

* [x] **MTH-012｜P0｜實作 point-to-plane distance**

  * 依賴：DOM-003、MTH-004
  * 驗收：可取得點到平面的有號與絕對距離。

* [x] **MTH-013｜P0｜實作 ray-plane intersection**

  * 依賴：DOM-002、DOM-003
  * 驗收：相交時回傳 point；平行時回傳明確 null 或 result state。

* [x] **MTH-014｜P0｜實作 plane-plane intersection line**

  * 依賴：DOM-003、MTH-005
  * 驗收：非平行平面可回傳交線 point 與 direction。

* [x] **MTH-015｜P0｜實作平面近似平行檢查**

  * 依賴：MTH-008
  * 驗收：可按 threshold 判斷兩平面是否近平行。

* [x] **MTH-016｜P0｜建立數值安全工具**

  * 依賴：MTH-001 至 MTH-015
  * 驗收：提供 `isFiniteVec3`、safe normalize、epsilon guard。

---

# Phase 4 — Optics Kernel

* [x] **OPT-001｜P0｜建立固定 Film Plane**

  * 依賴：DOM-003、DOM-013
  * 驗收：film plane 固定於指定座標，normal 指向 `+Z`。

* [x] **OPT-002｜P0｜建立 Base Lens Center**

  * 依賴：DOM-001、DOM-013
  * 驗收：鏡頭中心的預設位置以毫米表示，並可作為 movement 基準。

* [x] **OPT-003｜P0｜計算 Rise 後 Lens Center**

  * 依賴：OPT-002、STA-002
  * 驗收：只改變 lens center 的 Y 值。

* [x] **OPT-004｜P0｜計算 Tilt Rotation**

  * 依賴：MTH-009、STA-003
  * 驗收：tilt 只繞 X 軸旋轉。

* [x] **OPT-005｜P0｜計算 Swing Rotation**

  * 依賴：MTH-010、STA-004
  * 驗收：swing 只繞 Y 軸旋轉。

* [x] **OPT-006｜P0｜計算 Lens Normal**

  * 依賴：OPT-004、OPT-005
  * 驗收：zero tilt/swing 時，lens normal 與 film normal 平行。

* [x] **OPT-007｜P0｜建立 Lens Plane**

  * 依賴：OPT-003、OPT-006、MTH-011
  * 驗收：lens plane 使用正確 center 與 normal。

* [x] **OPT-008｜P0｜建立 Optical Axis**

  * 依賴：OPT-003、OPT-006
  * 驗收：ray origin 為 lens center；direction 與 lens normal 一致。

* [x] **OPT-009｜P0｜計算 Focus Point**

  * 依賴：OPT-008、STA-005
  * 驗收：focus point 位於 optical axis 上，距離等於 focusDistanceMm。

* [x] **OPT-010｜P0｜判斷 Lens 與 Film 是否近平行**

  * 依賴：OPT-001、OPT-007、MTH-015
  * 驗收：夾角小於 `0.1°` 時回傳 true。

* [x] **OPT-011｜P0｜建立平行模型 Focus Plane**

  * 依賴：OPT-001、OPT-009
  * 驗收：focus plane 通過 focus point，normal 與 film plane 相同。

* [x] **OPT-012｜P0｜計算 Lens / Film 交線**

  * 依賴：OPT-001、OPT-007、MTH-014
  * 驗收：非平行時可取得 hinge line。

* [x] **OPT-013｜P0｜建立 Scheimpflug Focus Plane**

  * 依賴：OPT-009、OPT-012、MTH-005、MTH-006
  * 驗收：focus plane 同時經過 hinge line 與 focus point。

* [x] **OPT-014｜P0｜建立 Focus Plane Fallback**

  * 依賴：OPT-010、OPT-011、OPT-013
  * 驗收：近平行時使用平行模型，否則使用 Scheimpflug 模型。

* [x] **OPT-015｜P0｜建立 Optics Diagnostics**

  * 依賴：OPT-010、OPT-014
  * 驗收：輸出 `isParallelLensFilm`、tilt angle、swing angle、fallback state。

* [x] **OPT-016｜P0｜建立 Aperture Tolerance Mapping**

  * 依賴：DOM-013
  * 驗收：f/5.6 至 f/32 對應單調增加的 acceptable sharpness range。

* [x] **OPT-017｜P0｜建立 Depth-of-Field Near Plane**

  * 依賴：OPT-014、OPT-016
  * 驗收：near plane 與 focus plane 平行，並向近端偏移。

* [x] **OPT-018｜P0｜建立 Depth-of-Field Far Plane**

  * 依賴：OPT-014、OPT-016
  * 驗收：far plane 與 focus plane 平行，並向遠端偏移。

* [x] **OPT-019｜P0｜計算單一 Focus Target Sharpness**

  * 依賴：OPT-014、OPT-016、MTH-012
  * 驗收：回傳 distance、acceptable range、score、status。

* [x] **OPT-020｜P0｜建立 Focus Target Sharpness Collection**

  * 依賴：OPT-019、DOM-009
  * 驗收：可對 scene 所有 targets 計算一致結果。

* [x] **OPT-021｜P0｜計算 Film Plane 四角**

  * 依賴：OPT-001、DOM-013
  * 驗收：回傳正確 4×5 尺寸的四個世界座標角點。

* [x] **OPT-022｜P0｜建立 Off-axis Projection Input**

  * 依賴：OPT-003、OPT-021
  * 驗收：輸出 lens center 與 film corners，供 renderer 建立 projection matrix。

* [x] **OPT-023｜P0｜計算 Off-axis Projection Matrix**

  * 依賴：OPT-022
  * 驗收：zero rise 時正常投影；rise 增加時可改變畫面垂直構圖。

* [x] **OPT-024｜P0｜整合 deriveOpticsState**

  * 依賴：OPT-001 至 OPT-023
  * 驗收：單一 pure function 回傳完整 DerivedOpticsState。

* [x] **OPT-025｜P0｜為 deriveOpticsState 加入數值安全回退**

  * 依賴：OPT-024、MTH-016
  * 驗收：不合法或近退化輸入不產生 NaN / Infinity。

* [x] **OPT-026｜P0｜建立 Derived Optics Memoization**

  * 依賴：OPT-024、STA-016
  * 驗收：只有 relevant camera 或 scene 值改變時才重算。

---

# Phase 5 — Optics Unit Tests

* [x] **TST-OPT-001｜P0｜測試 Rise 改變 Lens Center Y**

  * 依賴：OPT-003
  * 驗收：rise 前後只有 Y 值改變。

* [x] **TST-OPT-002｜P0｜測試 Tilt 改變 Lens Normal**

  * 依賴：OPT-006
  * 驗收：tilt 不為零時 normal 改變。

* [x] **TST-OPT-003｜P0｜測試 Swing 改變 Lens Normal**

  * 依賴：OPT-006
  * 驗收：swing 不為零時 normal 改變。

* [x] **TST-OPT-004｜P0｜測試 Zero Movement 平行狀態**

  * 依賴：OPT-010
  * 驗收：tilt=0、swing=0 時判定近平行。

* [x] **TST-OPT-005｜P0｜測試平行 Focus Plane**

  * 依賴：OPT-011
  * 驗收：focus plane normal 與 film normal 平行。

* [x] **TST-OPT-006｜P0｜測試 Tilt 改變 Focus Plane 側視方向**

  * 依賴：OPT-013
  * 驗收：tilt 改變時 focus plane normal 改變。

* [x] **TST-OPT-007｜P0｜測試 Swing 改變 Focus Plane 俯視方向**

  * 依賴：OPT-013
  * 驗收：swing 改變時 focus plane normal 改變。

* [x] **TST-OPT-008｜P0｜測試 Aperture 不改變 Focus Plane**

  * 依賴：OPT-014、OPT-016
  * 驗收：不同 aperture 取得相同 focus plane normal。

* [x] **TST-OPT-009｜P0｜測試 Aperture 擴大 DOF**

  * 依賴：OPT-017、OPT-018
  * 驗收：f/32 的 DOF 寬度大於 f/5.6。

* [x] **TST-OPT-010｜P0｜測試 Focus Target Score 上限**

  * 依賴：OPT-019
  * 驗收：score 永遠位於 0 至 1。

* [x] **TST-OPT-011｜P0｜測試 Focus Plane 上 Target 接近 Sharp**

  * 依賴：OPT-019
  * 驗收：位於 focus plane 上的 target score ≥ 0.99。

* [x] **TST-OPT-012｜P0｜測試離焦距離增加時 Score 遞減**

  * 依賴：OPT-019
  * 驗收：距離較遠 target 的 score 較低。

* [x] **TST-OPT-013｜P0｜測試近乎平行 Fallback**

  * 依賴：OPT-025
  * 驗收：非常小 tilt 不會造成 invalid plane。

* [x] **TST-OPT-014｜P0｜測試 Off-axis Projection Rise 行為**

  * 依賴：OPT-023
  * 驗收：rise 增加時 projection 的垂直偏移值改變。

---

# Phase 6 — 3D Renderer

* [x] **R3D-001｜P0｜建立主 React Three Fiber Canvas**

  * 依賴：ENV-004、ENV-018
  * 驗收：Simulator route 顯示 WebGL Canvas。

* [x] **R3D-002｜P0｜建立主場景背景**

  * 依賴：R3D-001
  * 驗收：Canvas 有固定背景色或環境背景。

* [x] **R3D-003｜P0｜建立基本環境燈光**

  * 依賴：R3D-001
  * 驗收：場景中的相機與目標物可辨識。

* [x] **R3D-004｜P0｜建立固定後組模型**

  * 依賴：OPT-001
  * 驗收：後組位置不受 movement 影響。

* [x] **R3D-005｜P0｜建立前組 Frame 模型**

  * 依賴：OPT-007
  * 驗收：前組可接受 position 與 rotation props。

* [x] **R3D-006｜P0｜建立 Lens Board 模型**

  * 依賴：R3D-005
  * 驗收：鏡頭板隨前組移動與旋轉。

* [x] **R3D-007｜P0｜建立簡化鏡頭模型**

  * 依賴：R3D-006
  * 驗收：鏡頭固定於鏡頭板中心。

* [x] **R3D-008｜P0｜建立固定底片平面可視化**

  * 依賴：OPT-001
  * 驗收：4×5 底片平面在 3D 場景中可辨識。

* [x] **R3D-009｜P0｜建立簡化皮腔模型**

  * 依賴：R3D-004、R3D-005
  * 驗收：皮腔在前後組之間持續連接。

* [x] **R3D-010｜P0｜建立光軸 Overlay**

  * 依賴：OPT-008
  * 驗收：可顯示 lens center 至 focus point 的光軸線。

* [x] **R3D-011｜P0｜將 Derived Optics 套用至前組**

  * 依賴：R3D-005、OPT-024
  * 驗收：rise、tilt、swing 即時反映於前組模型。

* [x] **R3D-012｜P1｜建立 Orbit Controls**

  * 依賴：R3D-001
  * 驗收：使用者可旋轉與縮放「觀察相機」，不改變虛擬大片幅相機位置。

* [x] **R3D-013｜P1｜建立 3D View Reset**

  * 依賴：R3D-012
  * 驗收：可回復預設觀察角度。

* [x] **R3D-014｜P1｜建立 Focus Plane Overlay**

  * 依賴：OPT-014
  * 驗收：focus plane 可在 3D 場景中顯示及隱藏。

* [x] **R3D-015｜P1｜建立 DOF Region Overlay**

  * 依賴：OPT-017、OPT-018
  * 驗收：near/far 範圍隨 aperture 改變。

* [x] **R3D-016｜P1｜建立 Render Quality Profile**

  * 依賴：R3D-001
  * 驗收：可選 high / standard / low 三種 render quality。

---

# Phase 7 — Scene Definitions

* [ ] **SCN-001｜P0｜建立 Scene Registry**

  * 依賴：DOM-008
  * 驗收：可透過 scene ID 取得 SceneDefinition。

* [ ] **SCN-002｜P0｜建立 Architecture Scene 基本地面**

  * 依賴：R3D-001
  * 驗收：有地面與可辨識拍攝位置。

* [ ] **SCN-003｜P0｜建立 Architecture Scene 建築立面**

  * 依賴：SCN-002
  * 驗收：包含明確垂直線與建築頂部。

* [ ] **SCN-004｜P0｜定義 Architecture Composition Target：建築頂部**

  * 依賴：SCN-003
  * 驗收：有可計算 bounds 的 building top target。

* [ ] **SCN-005｜P0｜定義 Architecture Composition Target：主建築**

  * 依賴：SCN-003
  * 驗收：有可計算 bounds 的 main building target。

* [ ] **SCN-006｜P0｜建立 Architecture Scene Camera Preset**

  * 依賴：SCN-003
  * 驗收：初始狀態未完整收入建築頂部。

* [ ] **SCN-007｜P0｜建立 Table Scene 桌面 Geometry**

  * 依賴：R3D-001
  * 驗收：桌面由近至遠明確延伸。

* [ ] **SCN-008｜P0｜建立 Table Scene 近景 Target**

  * 依賴：SCN-007
  * 驗收：近景物件有固定 world position。

* [ ] **SCN-009｜P0｜建立 Table Scene 中景 Target**

  * 依賴：SCN-007
  * 驗收：中景物件有固定 world position。

* [ ] **SCN-010｜P0｜建立 Table Scene 遠景 Target**

  * 依賴：SCN-007
  * 驗收：遠景物件有固定 world position。

* [ ] **SCN-011｜P0｜建立 Table Scene Camera Preset**

  * 依賴：SCN-008 至 SCN-010
  * 驗收：zero tilt 時不可在 f/22 內令三 target 全部 sharp。

* [ ] **SCN-012｜P0｜建立 Shelf Scene 主體 Geometry**

  * 依賴：R3D-001
  * 驗收：主體在 X/Z 平面有明確斜向延伸。

* [ ] **SCN-013｜P0｜建立 Shelf Scene 前景 Target**

  * 依賴：SCN-012
  * 驗收：前景 target 有固定 world position。

* [ ] **SCN-014｜P0｜建立 Shelf Scene 中景 Target**

  * 依賴：SCN-012
  * 驗收：中景 target 有固定 world position。

* [ ] **SCN-015｜P0｜建立 Shelf Scene 遠景 Target**

  * 依賴：SCN-012
  * 驗收：遠景 target 有固定 world position。

* [ ] **SCN-016｜P0｜建立 Shelf Scene Camera Preset**

  * 依賴：SCN-013 至 SCN-015
  * 驗收：zero swing 時不可在 f/22 內令三 target 全部 sharp。

* [ ] **SCN-017｜P0｜建立所有 SceneDefinition**

  * 依賴：SCN-006、SCN-011、SCN-016
  * 驗收：三個 scene 均註冊於 Scene Registry。

* [ ] **SCN-018｜P1｜壓縮場景紋理**

  * 依賴：SCN-017
  * 驗收：主要紋理具壓縮格式，初始載入不明顯阻塞。

* [ ] **SCN-019｜P1｜場景 Lazy Loading**

  * 依賴：SCN-017
  * 驗收：只載入當前 scene 必需資產。

---

# Phase 8 — Ground Glass

* [ ] **GGL-001｜P0｜建立 Ground Glass Panel Component**

  * 依賴：ENV-016
  * 驗收：Simulator Workspace 可顯示固定 4×5 比例 panel。

* [ ] **GGL-002｜P0｜建立 Ground Glass Render Target**

  * 依賴：R3D-001
  * 驗收：可把場景渲染至獨立 texture。

* [ ] **GGL-003｜P0｜建立 Ground Glass 專用 Camera**

  * 依賴：GGL-002
  * 驗收：ground glass 使用獨立 camera，不影響 3D observer camera。

* [ ] **GGL-004｜P0｜套用 Off-axis Projection Matrix**

  * 依賴：GGL-003、OPT-023
  * 驗收：ground glass camera 使用 DerivedOpticsState projection data。

* [ ] **GGL-005｜P0｜驗證 Rise 改變 Ground Glass 垂直構圖**

  * 依賴：GGL-004
  * 驗收：rise 增加時畫面包含更多上方場景。

* [ ] **GGL-006｜P0｜建立 Ground Glass Flip Shader**

  * 依賴：GGL-002
  * 驗收：可獨立控制 X 與 Y flip。

* [ ] **GGL-007｜P0｜預設啟用上下及左右反轉**

  * 依賴：GGL-006
  * 驗收：assist 關閉時 `flipX=true`、`flipY=true`。

* [ ] **GGL-008｜P0｜實作 Orientation Assist**

  * 依賴：STA-010、GGL-006
  * 驗收：assist 開啟時畫面恢復正常方向。

* [ ] **GGL-009｜P0｜建立 Grid Overlay**

  * 依賴：GGL-001、STA-012
  * 驗收：格線可開關且不影響 render texture。

* [ ] **GGL-010｜P0｜建立 Center Line Overlay**

  * 依賴：GGL-001
  * 驗收：顯示水平及垂直中心線。

* [ ] **GGL-011｜P0｜建立 Current Settings Overlay**

  * 依賴：STA-015
  * 驗收：顯示 rise、tilt、swing、focus、aperture 數值。

* [ ] **GGL-012｜P0｜建立 Depth Render Target**

  * 依賴：GGL-002
  * 驗收：可取得與 color target 對應的 depth texture。

* [ ] **GGL-013｜P0｜建立深度值線性化**

  * 依賴：GGL-012
  * 驗收：shader 可將 depth sample 轉換為可用距離資料。

* [ ] **GGL-014｜P0｜建立 World Position Reconstruction**

  * 依賴：GGL-013、OPT-024
  * 驗收：shader 可近似取得 pixel 對應的世界位置。

* [ ] **GGL-015｜P0｜建立 Focus Plane Distance Shader Logic**

  * 依賴：GGL-014、OPT-014
  * 驗收：每 pixel 可計算至 focus plane 的距離。

* [ ] **GGL-016｜P0｜建立 Aperture-based Blur Strength Logic**

  * 依賴：GGL-015、OPT-016
  * 驗收：f/5.6 blur 強度高於 f/32。

* [ ] **GGL-017｜P0｜建立 Half-resolution Blur Pass**

  * 依賴：GGL-016
  * 驗收：景深模糊在半解析度 pass 執行。

* [ ] **GGL-018｜P0｜整合 Ground Glass DOF Pipeline**

  * 依賴：GGL-012 至 GGL-017
  * 驗收：focus、tilt、swing、aperture 改變時清晰帶即時更新。

* [ ] **GGL-019｜P1｜建立 Focus Target Status Overlay**

  * 依賴：OPT-020、STA-011
  * 驗收：可顯示每個 target 的 sharpness status。

* [ ] **GGL-020｜P1｜建立非色彩 Focus Assist Pattern**

  * 依賴：GGL-019
  * 驗收：sharp / near-sharp / blurred 不只依賴顏色區分。

* [ ] **GGL-021｜P1｜建立 Ground Glass Zoom Mode**

  * 依賴：GGL-001
  * 驗收：使用者可局部放大地面玻璃畫面，不改變 camera state。

---

# Phase 9 — 2D Geometry Diagrams

* [ ] **GEO-001｜P0｜建立 SVG Geometry Viewport**

  * 依賴：ENV-013
  * 驗收：可 render 可縮放 SVG canvas。

* [ ] **GEO-002｜P0｜建立 SVG PlaneLine 元件**

  * 依賴：GEO-001
  * 驗收：可用 point 與 normal 表示一條平面截線。

* [ ] **GEO-003｜P0｜建立 SVG RayLine 元件**

  * 依賴：GEO-001
  * 驗收：可顯示 optical axis 或 hinge line。

* [ ] **GEO-004｜P0｜建立 SVG PointMarker 元件**

  * 依賴：GEO-001
  * 驗收：可顯示 focus point 或交點標記。

* [ ] **GEO-005｜P0｜建立 SVG Region 元件**

  * 依賴：GEO-001
  * 驗收：可表示 DOF near/far 區域。

* [ ] **GEO-006｜P0｜建立 Diagram Legend 元件**

  * 依賴：GEO-001
  * 驗收：能以文字識別 film plane、lens plane、focus plane、DOF。

* [ ] **GEO-007｜P0｜建立世界座標轉側視座標 Helper**

  * 依賴：DOM-001
  * 驗收：將 X/Z 或 Y/Z 資料正確映射至 SVG。

* [ ] **GEO-008｜P0｜建立世界座標轉俯視座標 Helper**

  * 依賴：DOM-001
  * 驗收：將 X/Z 資料正確映射至 SVG。

* [ ] **GEO-009｜P0｜建立 Side View Film Plane 顯示**

  * 依賴：GEO-002、OPT-001
  * 驗收：側視圖可顯示固定底片平面。

* [ ] **GEO-010｜P0｜建立 Side View Lens Plane 顯示**

  * 依賴：GEO-002、OPT-007
  * 驗收：rise、tilt 改變時 lens plane 同步更新。

* [ ] **GEO-011｜P0｜建立 Side View Optical Axis 顯示**

  * 依賴：GEO-003、OPT-008
  * 驗收：光軸由 lens center 指向 focus point。

* [ ] **GEO-012｜P0｜建立 Side View Focus Plane 顯示**

  * 依賴：GEO-002、OPT-014
  * 驗收：tilt 改變時 focus plane 顯示方向更新。

* [ ] **GEO-013｜P0｜建立 Side View DOF Region 顯示**

  * 依賴：GEO-005、OPT-017、OPT-018
  * 驗收：aperture 改變時區域寬度改變。

* [ ] **GEO-014｜P0｜建立 Top View Film Plane 顯示**

  * 依賴：GEO-002、OPT-001
  * 驗收：俯視圖可顯示底片平面。

* [ ] **GEO-015｜P0｜建立 Top View Lens Plane 顯示**

  * 依賴：GEO-002、OPT-007
  * 驗收：swing 改變時 lens plane 顯示方向更新。

* [ ] **GEO-016｜P0｜建立 Top View Optical Axis 顯示**

  * 依賴：GEO-003、OPT-008
  * 驗收：俯視光軸與 derived state 一致。

* [ ] **GEO-017｜P0｜建立 Top View Focus Plane 顯示**

  * 依賴：GEO-002、OPT-014
  * 驗收：swing 改變時 focus plane 顯示方向更新。

* [ ] **GEO-018｜P0｜建立 Top View DOF Region 顯示**

  * 依賴：GEO-005、OPT-017、OPT-018
  * 驗收：aperture 改變時 DOF 區域更新。

* [ ] **GEO-019｜P0｜建立 Geometry View Selector**

  * 依賴：GEO-009 至 GEO-018
  * 驗收：可切換 side 與 top view。

* [ ] **GEO-020｜P0｜為 Guided Task 設定預設 Geometry View**

  * 依賴：GEO-019、TSK-001
  * 驗收：Rise/Tilt 預設 side；Swing 預設 top。

* [ ] **GEO-021｜P1｜建立 Diagram Snapshot Tests**

  * 依賴：GEO-019
  * 驗收：固定 movement state 可產生穩定 SVG snapshot。

---

# Phase 10 — Task Engine

* [ ] **TSK-001｜P0｜建立 Task Registry**

  * 依賴：DOM-011
  * 驗收：可用 task ID 取得 TaskDefinition。

* [ ] **TSK-002｜P0｜建立 Success Criterion：Focus Targets Sharp**

  * 依賴：OPT-020
  * 驗收：可檢查指定 targets 是否達 `sharpness >= 0.8`。

* [ ] **TSK-003｜P0｜建立 Success Criterion：Movement Used**

  * 依賴：DOM-006
  * 驗收：可檢查 rise、tilt 或 swing 是否超過最低使用值。

* [ ] **TSK-004｜P0｜建立 Success Criterion：Movement Range**

  * 依賴：DOM-006
  * 驗收：可檢查 movement 是否處於 task 指定範圍。

* [ ] **TSK-005｜P0｜建立 Success Criterion：Allowed Aperture**

  * 依賴：DOM-006
  * 驗收：可阻止使用指定禁止光圈完成關卡。

* [ ] **TSK-006｜P0｜建立 Ground Glass Frame Bounds 計算**

  * 依賴：OPT-023
  * 驗收：可取得可見 frame 的世界座標範圍或 projection relation。

* [ ] **TSK-007｜P0｜建立 Composition Coverage 計算**

  * 依賴：TSK-006、DOM-010
  * 驗收：可回傳 composition target 可見比例。

* [ ] **TSK-008｜P0｜建立 Success Criterion：Composition Visible**

  * 依賴：TSK-007
  * 驗收：可檢查指定 target 的最低可見比例。

* [ ] **TSK-009｜P0｜建立 Task Score 計算**

  * 依賴：TSK-002 至 TSK-008
  * 驗收：score = passed criteria / total criteria × 100。

* [ ] **TSK-010｜P0｜建立 Task Completion 判定**

  * 依賴：TSK-009
  * 驗收：全部 required criteria pass 才為 completed。

* [ ] **TSK-011｜P0｜建立 Rise Task Definition**

  * 依賴：SCN-017、TSK-001
  * 驗收：`rise-01` 限制及成功條件符合 Spec。

* [ ] **TSK-012｜P0｜建立 Tilt Task Definition**

  * 依賴：SCN-017、TSK-001
  * 驗收：`tilt-01` 禁止 f/32，要求三 target sharp 與合理 tilt。

* [ ] **TSK-013｜P0｜建立 Swing Task Definition**

  * 依賴：SCN-017、TSK-001
  * 驗收：`swing-01` 禁止 f/32，要求三 target sharp 與合理 swing。

* [ ] **TSK-014｜P0｜建立 Task Evaluator**

  * 依賴：TSK-002 至 TSK-013
  * 驗收：輸入 task、scene、camera、optics 後回傳完整 TaskEvaluation。

* [ ] **TSK-015｜P0｜建立 Rise Task Primary Feedback**

  * 依賴：TSK-014、DOM-015
  * 驗收：可針對 top 未入畫、rise 太低、rise 太高、完成提供不同文字。

* [ ] **TSK-016｜P0｜建立 Tilt Task Primary Feedback**

  * 依賴：TSK-014、DOM-015
  * 驗收：可針對 tilt 不足、過量、focus 不準、f/32 限制、完成提供不同文字。

* [ ] **TSK-017｜P0｜建立 Swing Task Primary Feedback**

  * 依賴：TSK-014、DOM-015
  * 驗收：可針對 swing 不足、過量、方向錯誤、focus 不準、完成提供不同文字。

* [ ] **TSK-018｜P0｜建立 Feedback Priority Rule**

  * 依賴：TSK-015 至 TSK-017
  * 驗收：同時多項失敗時只輸出最具教學價值的一條 primary feedback。

* [ ] **TSK-019｜P0｜建立 Secondary Hint Rule**

  * 依賴：TSK-018
  * 驗收：可選擇性提供第二條補充提示，最多一條。

---

# Phase 11 — Simulator UI

* [ ] **UI-001｜P0｜建立 Simulator Workspace Grid**

  * 依賴：ENV-016
  * 驗收：Desktop 1280px 寬時同時顯示 3D、ground glass、geometry、controls。

* [ ] **UI-002｜P0｜放置 Scene Viewport**

  * 依賴：UI-001、R3D-001
  * 驗收：左上區域顯示 3D scene。

* [ ] **UI-003｜P0｜放置 Ground Glass Viewport**

  * 依賴：UI-001、GGL-001
  * 驗收：右上區域顯示 ground glass。

* [ ] **UI-004｜P0｜放置 Geometry Viewport**

  * 依賴：UI-001、GEO-001
  * 驗收：左下區域顯示 SVG diagram。

* [ ] **UI-005｜P0｜建立 Movement Controls Panel**

  * 依賴：STA-002 至 STA-004
  * 驗收：包含 rise、tilt、swing slider 與數值。

* [ ] **UI-006｜P0｜建立 Rise Slider**

  * 依賴：UI-005
  * 驗收：操作 slider 更新 store，單位顯示為 mm。

* [ ] **UI-007｜P0｜建立 Tilt Slider**

  * 依賴：UI-005
  * 驗收：操作 slider 更新 store，單位顯示為 °。

* [ ] **UI-008｜P0｜建立 Swing Slider**

  * 依賴：UI-005
  * 驗收：操作 slider 更新 store，單位顯示為 °。

* [ ] **UI-009｜P0｜建立 Focus Slider**

  * 依賴：STA-005
  * 驗收：顯示距離值並受 scene range 限制。

* [ ] **UI-010｜P0｜建立 Aperture Selector**

  * 依賴：STA-006
  * 驗收：只可選固定 aperture options。

* [ ] **UI-011｜P0｜建立 View Options Controls**

  * 依賴：STA-010 至 STA-012
  * 驗收：可切換 orientation assist、grid、focus assist。

* [ ] **UI-012｜P0｜建立 Reset Movements Button**

  * 依賴：STA-013
  * 驗收：按下後只重設 movement、focus、aperture。

* [ ] **UI-013｜P0｜建立 Restart Task Button**

  * 依賴：STA-014
  * 驗收：按下後完整重設當前 task。

* [ ] **UI-014｜P0｜建立 Task Objective Panel**

  * 依賴：TSK-011 至 TSK-013
  * 驗收：顯示 task title、目標、限制及允許 controls。

* [ ] **UI-015｜P0｜建立 Criterion Status List**

  * 依賴：TSK-014
  * 驗收：顯示每個 criterion pass/fail、current value、expected value。

* [ ] **UI-016｜P0｜建立 Feedback Panel**

  * 依賴：TSK-018、TSK-019
  * 驗收：顯示 primary feedback 與可選 secondary hint。

* [ ] **UI-017｜P0｜建立 Task Completed Overlay**

  * 依賴：TSK-010
  * 驗收：完成時顯示分數、最終 movement、focus、aperture。

* [ ] **UI-018｜P0｜建立 Guided Mode Controls Lock**

  * 依賴：DOM-011、TSK-011 至 TSK-013
  * 驗收：非 task enabled controls 可見但 disabled，並附原因。

* [ ] **UI-019｜P0｜建立 Free Mode Scene Picker**

  * 依賴：SCN-017、STA-008
  * 驗收：可切換三個 scene。

* [ ] **UI-020｜P0｜建立 Free Mode All Controls Enabled Rule**

  * 依賴：STA-007、UI-018
  * 驗收：Free Mode 中所有 MVP controls 均可操作。

* [ ] **UI-021｜P1｜建立 Help Modal**

  * 依賴：DOM-015
  * 驗收：可顯示 Rise、Tilt、Swing 的短說明，不改變 simulator state。

* [ ] **UI-022｜P1｜加入 Keyboard Slider Support**

  * 依賴：UI-006 至 UI-010
  * 驗收：Arrow keys 微調，Shift+Arrow 大步調整，Home/End 到邊界。

* [ ] **UI-023｜P1｜加入 Reduced Motion Support**

  * 依賴：R3D-001、UI-001
  * 驗收：符合 `prefers-reduced-motion` 時取消不必要補間動畫。

* [ ] **UI-024｜P1｜加入 ARIA Labels**

  * 依賴：UI-005 至 UI-021
  * 驗收：controls、toggles、panels 均有可讀 label。

---

# Phase 12 — Integration Tests

* [ ] **TST-INT-001｜P0｜測試 Rise Slider 更新 Store**

  * 依賴：UI-006
  * 驗收：變更 slider 後 state rise 值正確。

* [ ] **TST-INT-002｜P0｜測試 Tilt Slider 更新 Store**

  * 依賴：UI-007
  * 驗收：變更 slider 後 state tilt 值正確。

* [ ] **TST-INT-003｜P0｜測試 Swing Slider 更新 Store**

  * 依賴：UI-008
  * 驗收：變更 slider 後 state swing 值正確。

* [ ] **TST-INT-004｜P0｜測試 Rise 同步更新 3D View**

  * 依賴：R3D-011、UI-006
  * 驗收：rise state 改變後前組 Y position 改變。

* [ ] **TST-INT-005｜P0｜測試 Tilt 同步更新 Side Diagram**

  * 依賴：GEO-012、UI-007
  * 驗收：tilt 改變後 focus plane SVG orientation 改變。

* [ ] **TST-INT-006｜P0｜測試 Swing 同步更新 Top Diagram**

  * 依賴：GEO-017、UI-008
  * 驗收：swing 改變後 focus plane SVG orientation 改變。

* [ ] **TST-INT-007｜P0｜測試 Aperture 同步更新 DOF**

  * 依賴：GGL-018、UI-010
  * 驗收：aperture 改變後 DOF uniform 或 derived range 改變。

* [ ] **TST-INT-008｜P0｜測試 Orientation Assist**

  * 依賴：GGL-008、UI-011
  * 驗收：toggle 正確切換 flip state。

* [ ] **TST-INT-009｜P0｜測試 Guided Mode Disabled Controls**

  * 依賴：UI-018
  * 驗收：Rise 關的 Tilt/Swing controls 無法互動。

* [ ] **TST-INT-010｜P0｜測試 Reset Movements**

  * 依賴：UI-012
  * 驗收：reset 後數值回到 task 或 default baseline。

* [ ] **TST-INT-011｜P0｜測試 Restart Task**

  * 依賴：UI-013
  * 驗收：scene、task、movement、feedback 均回到初始狀態。

* [ ] **TST-INT-012｜P0｜測試 Task Evaluation 顯示**

  * 依賴：UI-015、TSK-014
  * 驗收：criteria UI 與 evaluator 回傳結果一致。

* [ ] **TST-INT-013｜P0｜測試 Completion Overlay**

  * 依賴：UI-017
  * 驗收：task completed 時 overlay 出現。

---

# Phase 13 — End-to-End Tests

* [ ] **TST-E2E-001｜P0｜建立 Playwright 基礎設定**

  * 依賴：ENV-009
  * 驗收：可啟動 dev server 並執行一個 smoke test。

* [ ] **TST-E2E-002｜P0｜測試首頁進入 Guided Mode**

  * 依賴：ENV-015、UI-001
  * 驗收：使用者可由首頁進入第一個 task。

* [ ] **TST-E2E-003｜P0｜測試 Rise 關失敗狀態**

  * 依賴：TSK-011、UI-014
  * 驗收：初始 state 不可完成 rise 關。

* [ ] **TST-E2E-004｜P0｜測試 Rise 關完成**

  * 依賴：TST-E2E-003
  * 驗收：設定合理 rise 後 task 顯示 completed。

* [ ] **TST-E2E-005｜P0｜測試 Tilt 關禁止 f/32**

  * 依賴：TSK-012
  * 驗收：即使 targets 清晰，選 f/32 仍不可完成。

* [ ] **TST-E2E-006｜P0｜測試 Tilt 關完成**

  * 依賴：TSK-012
  * 驗收：合理 tilt、focus、f/22 設定可完成。

* [ ] **TST-E2E-007｜P0｜測試 Swing 關失敗狀態**

  * 依賴：TSK-013
  * 驗收：zero swing 時不可完成。

* [ ] **TST-E2E-008｜P0｜測試 Swing 關完成**

  * 依賴：TSK-013
  * 驗收：合理 swing、focus、f/22 設定可完成。

* [ ] **TST-E2E-009｜P0｜測試 Restart Task**

  * 依賴：UI-013
  * 驗收：完成或變更 task 後重啟，狀態回復初始值。

* [ ] **TST-E2E-010｜P0｜測試 Free Mode Scene Switching**

  * 依賴：UI-019、UI-020
  * 驗收：三個 scene 可正常切換且不出現 runtime error。

* [ ] **TST-E2E-011｜P1｜測試 WebGL Fallback**

  * 依賴：ENV-018
  * 驗收：模擬 WebGL 不可用時顯示 fallback UI。

---

# Phase 14 — Performance, Accessibility and Release

* [ ] **PERF-001｜P0｜量測 Movement Input Latency**

  * 依賴：GGL-018、R3D-011
  * 驗收：slider input 至主要視覺更新目標低於 100ms。

* [ ] **PERF-002｜P0｜量測 Ground Glass FPS**

  * 依賴：GGL-018
  * 驗收：一般 desktop 裝置可維持至少 30 FPS。

* [ ] **PERF-003｜P1｜加入 Ground Glass Resolution Scaling**

  * 依賴：GGL-018
  * 驗收：低效能模式可降低 render target resolution。

* [ ] **PERF-004｜P1｜加入 DOF Quality Scaling**

  * 依賴：GGL-017
  * 驗收：低效能模式可降低 blur samples 或停用高成本 pass。

* [ ] **PERF-005｜P1｜量測 Scene Switch Duration**

  * 依賴：SCN-019
  * 驗收：場景切換目標少於 2 秒。

* [ ] **A11Y-001｜P0｜檢查所有 Control Label**

  * 依賴：UI-005 至 UI-011
  * 驗收：所有 interactive controls 均有可讀 label。

* [ ] **A11Y-002｜P0｜檢查 Focus Status 非色彩資訊**

  * 依賴：GGL-019、GGL-020
  * 驗收：sharpness status 有文字或 icon，不只靠顏色。

* [ ] **A11Y-003｜P1｜完成 Keyboard-only Rise Task**

  * 依賴：UI-022
  * 驗收：只使用鍵盤可完成 Rise 關。

* [ ] **REL-001｜P0｜建立 CI Lint Job**

  * 依賴：ENV-010
  * 驗收：Pull Request 自動執行 lint。

* [ ] **REL-002｜P0｜建立 CI Typecheck Job**

  * 依賴：ENV-002
  * 驗收：Pull Request 自動執行 typecheck。

* [ ] **REL-003｜P0｜建立 CI Unit Test Job**

  * 依賴：ENV-007
  * 驗收：Pull Request 自動執行 Vitest。

* [ ] **REL-004｜P1｜建立 CI E2E Test Job**

  * 依賴：TST-E2E-001
  * 驗收：Pull Request 或 deployment preview 可執行 Playwright。

* [ ] **REL-005｜P1｜建立 Static Deployment Preview**

  * 依賴：REL-001 至 REL-003
  * 驗收：每次合併或 preview 可產出可訪問 static build。

* [ ] **REL-006｜P0｜建立 Release Checklist**

  * 依賴：所有 P0 Tasks
  * 驗收：包含 tests、performance、console errors、scope check、三關完成驗證。

* [ ] **REL-007｜P0｜完成 MVP Smoke Test**

  * 依賴：REL-006
  * 驗收：Rise、Tilt、Swing 三關可由新使用者流程完整通過。

---

# Recommended Execution Order

```text
1. ENV-001 至 ENV-018
2. DOM-001 至 DOM-015
3. STA-001 至 STA-015
4. MTH-001 至 MTH-016
5. OPT-001 至 OPT-026
6. TST-OPT-001 至 TST-OPT-014
7. R3D-001 至 R3D-011
8. SCN-001 至 SCN-017
9. GGL-001 至 GGL-018
10. GEO-001 至 GEO-020
11. TSK-001 至 TSK-019
12. UI-001 至 UI-020
13. TST-INT-001 至 TST-INT-013
14. TST-E2E-001 至 TST-E2E-010
15. PERF-001、PERF-002、A11Y-001、REL-001 至 REL-007
16. 最後才處理所有 P1 tasks
```

---

# First Implementable Work Package

以下是最適合首先交給工程代理執行的 atomic task 範圍：

```text
ENV-001 至 ENV-016
DOM-001 至 DOM-014
STA-001 至 STA-006
MTH-001 至 MTH-016
OPT-001 至 OPT-011
TST-OPT-001 至 TST-OPT-005
```

完成後應具備：

* 可運行的 React + TypeScript + Vite 專案。
* 可更新 rise、tilt、swing、focus、aperture 的 Zustand store。
* 正確的 core geometry 型別及 math helpers。
* 可建立 film plane、lens plane、optical axis、focus point。
* 無 tilt/swing 時可正確使用平行 focus plane 模型。
* 全部相關 unit tests 通過。
