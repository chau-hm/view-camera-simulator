# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fringe-club-dev-integration.spec.ts >> Stage 2N-A join probes retain fresh RTT identity through bounded motion
- Location: src/tests/e2e/fringe-club-dev-integration.spec.ts:758:1

# Error details

```
Test timeout of 1200000ms exceeded.
```

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('fringe-rtt-metrics')
Expected: "true"
Received: ""

Call log:
  - Expect "toHaveAttribute" with timeout 60000ms
  - waiting for getByTestId('fringe-rtt-metrics')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "Fringe Club runtime A/B validation — development only" [level=1] [ref=e5]
  - status
  - main [ref=e6]:
    - generic [ref=e7]:
      - note [ref=e8]:
        - strong [ref=e9]: NOT A PUBLIC SCENE.
        - text: Stage 2H remains the current runtime authority. Stage 2N-A is a development candidate only. Camera and focus probes are
        - strong [ref=e10]: DEVELOPMENT_PROBE_ONLY
        - text: ; they are not Fringe Club camera calibration or lesson targets.
      - paragraph [ref=e11]: "Fixed Ground Glass reference: Architecture Rise scene/profile, focal length 150 mm, aperture f/11, standard render quality, raw RTT orientation. The selected diagnostic probe only aligns the asset subject; it does not change VCS optics."
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Runtime candidate
          - combobox "Runtime candidate" [ref=e14]:
            - option "Stage 2H — current authority"
            - option "Stage 2N-A — candidate" [selected]
        - generic [ref=e15]:
          - text: Renderer mode
          - combobox "Renderer mode" [ref=e16]:
            - option "Observer only"
            - option "Ground Glass only"
            - option "Observer + Ground Glass" [selected]
        - generic [ref=e17]:
          - text: Diagnostic probe
          - combobox "Diagnostic probe" [ref=e18]:
            - option "Wyndham — rectangular sash pair"
            - option "Wyndham — segmental window"
            - option "Wyndham — main transom"
            - option "Wyndham — vent/louver close view"
            - option "Wyndham — frieze"
            - option "Lower Albert — timber window"
            - option "Lower Albert — light louver door"
            - option "Lower Albert — dark louver door"
            - option "Entrance — timber window"
            - option "Entrance — paired glazed entry"
            - option "Seam — Wyndham window/frame"
            - option "Seam — Lower Albert louver/frame"
            - option "Seam — entrance frame/glass" [selected]
            - option "Seam — Wyndham sill/frame"
        - generic [ref=e19]:
          - text: Bounded view movement
          - combobox "Bounded view movement" [ref=e20]:
            - option "Center"
            - option "Slight left (40 mm)"
            - option "Slight right (40 mm)"
            - option "Slight near (40 mm)" [selected]
            - option "Slight far (40 mm)"
        - button "Release source asset" [active] [ref=e21]
        - link "Exit development fixture" [ref=e22] [cursor=pointer]:
          - /url: /scenes
      - paragraph [ref=e23]:
        - text: "Probe family:"
        - code [ref=e24]: DOOR_EN_PAIRED_FRAME_GLASS_JOIN
        - text: ". Observer probe lens: 70 mm; target (14.081, -1.03, 6.2137) m. Both candidates receive the same Observer camera, target alignment, Ground Glass optics, viewport, DPR, lighting, tone mapping, and anisotropy."
      - paragraph [ref=e25]: "Motion sample: Slight near (40 mm); the Observer camera shifts by (2.7, -2.7, -39.8) mm, with the matching opposite scene-relative translation in the fixed Ground Glass profile."
      - paragraph [ref=e26]:
        - text: "Selected GLB:"
        - code [ref=e27]: /assets/generated/fringe-club/development/stage-2n-a-candidate.glb
      - status [ref=e28]: Selected Fringe Club source ready
      - generic [ref=e29]:
        - paragraph [ref=e30]: "Observer renderer: WebGL 2; geometries 49, textures 15 (count, not MiB), calls 90, triangles 206932, points 0, lines 0; Fringe meshes 90; max anisotropy 16."
        - paragraph [ref=e31]: Source lifecycle — active source owners 1, Observer/RTT instance leases 2; source geometries 61, material templates 17, textures 16, ImageBitmap backings 14.
        - paragraph [ref=e32]: "stage2n-a loads: requests 2, completed 1, cancelled 1, stale parsed results disposed 0; fetch 76.4 ms, parse 69.7 ms, total 147.7 ms. These are observations, not FPS or GPU-memory claims."
        - paragraph [ref=e33]: Requested anisotropy 4×; applied 4× (Observer renderer maximum 16×).
      - generic [ref=e34]:
        - region "Observer renderer" [ref=e35]:
          - heading "Observer renderer" [level=2] [ref=e36]
        - region "Actual Ground Glass RTT — Architecture Rise reference" [ref=e41]:
          - heading "Actual Ground Glass RTT — Architecture Rise reference" [level=2] [ref=e42]
          - paragraph [ref=e43]:
            - text: "Development probe family:"
            - code [ref=e44]: DOOR_EN_PAIRED_FRAME_GLASS_JOIN
            - text: . Only the registered visual subject translation changes with the selected diagnostic position. Canonical optics and the actual GroundGlassRTT pass graph stay fixed.
          - paragraph [ref=e46]: RTT camera ready; raw contentful true; final contentful true; candidate identity stage2n-a|probe:join-entrance-frame-glass|motion:near; RTT calls 85, triangles 218190, points 0, lines 0; renderer geometries 55, textures 24 (count, not MiB).
      - paragraph [ref=e52]: The Observer and Ground Glass use one selected source owner and, when both are enabled, distinct registered instance roots. The Ground Glass panel mounts the actual GroundGlassRTT component with its VCS camera, pass graph, diagnostics, and cleanup. Renderer counters are per renderer; texture counters are counts, not measured GPU memory.
```

# Test source

```ts
  76  |   lines: number;
  77  |   geometries: number;
  78  |   textures: number;
  79  |   sampledAtMs: number;
  80  | };
  81  |
  82  | const readObserverMetrics = async (page: Page): Promise<ObserverMetrics> =>
  83  |   page.getByTestId("fringe-renderer-metrics").evaluate((element) => {
  84  |     const value = (key: string): number => Number(element.getAttribute(key) ?? NaN);
  85  |     return {
  86  |       geometries: value("data-geometries"),
  87  |       textures: value("data-textures"),
  88  |       calls: value("data-calls"),
  89  |       triangles: value("data-triangles"),
  90  |       points: value("data-points"),
  91  |       lines: value("data-lines"),
  92  |       fringeMeshes: value("data-fringe-meshes"),
  93  |       candidateId: element.getAttribute("data-observer-candidate-id") ?? "",
  94  |       rootId: element.getAttribute("data-observer-root-id") ?? "",
  95  |       sampledAtMs: value("data-observer-sampled-at-ms"),
  96  |       sourceAssets: value("data-source-assets"),
  97  |       ownerLeases: value("data-owner-leases"),
  98  |       instanceLeases: value("data-instance-leases"),
  99  |       sourceGeometries: value("data-source-geometries"),
  100 |       sourceMaterials: value("data-source-materials"),
  101 |       sourceTextures: value("data-source-textures"),
  102 |       imageBackings: value("data-image-backings"),
  103 |       instanceMaterials: value("data-instance-materials"),
  104 |       maxAnisotropy: value("data-anisotropy-max"),
  105 |       appliedAnisotropy: value("data-applied-anisotropy"),
  106 |       loadMs: value("data-load-ms"),
  107 |       fetchMs: value("data-fetch-ms"),
  108 |       parseMs: value("data-parse-ms"),
  109 |       webglVersion: element.getAttribute("data-webgl-version") ?? "",
  110 |       threeVersion: element.getAttribute("data-three-version") ?? "",
  111 |       rendererVendor: element.getAttribute("data-renderer-vendor") ?? "",
  112 |       rendererDevice: element.getAttribute("data-renderer-device") ?? "",
  113 |     };
  114 |   });
  115 |
  116 | const readGroundGlassMetrics = async (page: Page): Promise<GroundGlassMetrics> =>
  117 |   page.getByTestId("fringe-rtt-metrics").evaluate((element) => {
  118 |     const value = (key: string): number => Number(element.getAttribute(key) ?? NaN);
  119 |     return {
  120 |       candidateIdentity: element.getAttribute("data-rtt-render-sanity-identity") ?? "",
  121 |       sourceId: element.getAttribute("data-subject-source-id") ?? "",
  122 |       candidateId: element.getAttribute("data-subject-candidate-id") ?? "",
  123 |       probeId: element.getAttribute("data-subject-probe-id") ?? "",
  124 |       motionId: element.getAttribute("data-subject-motion-id") ?? "",
  125 |       rootId: element.getAttribute("data-subject-root-id") ?? "",
  126 |       cameraOk: element.getAttribute("data-rtt-camera-ok") === "true",
  127 |       rawContentful: element.getAttribute("data-rtt-raw-contentful") === "true",
  128 |       finalContentful: element.getAttribute("data-rtt-final-contentful") === "true",
  129 |       generation: value("data-rtt-render-sanity-generation"),
  130 |       sanityKey: element.getAttribute("data-rtt-render-sanity-state") ?? "",
  131 |       calls: value("data-rtt-calls"),
  132 |       triangles: value("data-rtt-triangles"),
  133 |       points: value("data-rtt-points"),
  134 |       lines: value("data-rtt-lines"),
  135 |       geometries: value("data-rtt-renderer-geometries"),
  136 |       textures: value("data-rtt-renderer-textures"),
  137 |       sampledAtMs: value("data-rtt-sampled-at-ms"),
  138 |     };
  139 |   });
  140 |
  141 | const installBrowserErrorCapture = (page: Page) => {
  142 |   const pageErrors: string[] = [];
  143 |   const consoleProblems: string[] = [];
  144 |   page.on("pageerror", (error) => pageErrors.push(error.message));
  145 |   page.on("console", (message) => {
  146 |     if (isKnownFiberClockDeprecation(message)) return;
  147 |     if (/GL Driver Message .*GPU stall due to ReadPixels/.test(message.text())) return;
  148 |     if (message.type() === "error" || message.type() === "warning") {
  149 |       consoleProblems.push(message.text());
  150 |     }
  151 |   });
  152 |   return { pageErrors, consoleProblems };
  153 | };
  154 |
  155 | const waitForGroundGlass = async (
  156 |   page: Page,
  157 |   candidate: "stage2h" | "stage2n-a",
  158 |   probeId: string,
  159 |   motionId: string = "center",
  160 | ) => {
  161 |   const identity =
  162 |     candidate +
  163 |     "|probe:" +
  164 |     probeId +
  165 |     (motionId === "center" ? "" : "|motion:" + motionId);
  166 |   await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
  167 |     "data-rtt-render-sanity-identity",
  168 |     identity,
  169 |     { timeout: 60_000 },
  170 |   );
  171 |   await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
  172 |     "data-rtt-camera-ok",
  173 |     "true",
  174 |     { timeout: 60_000 },
  175 |   );
> 176 |   await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
      |                                                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  177 |     "data-rtt-raw-contentful",
  178 |     "true",
  179 |     { timeout: 60_000 },
  180 |   );
  181 |   await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
  182 |     "data-rtt-final-contentful",
  183 |     "true",
  184 |     { timeout: 60_000 },
  185 |   );
  186 |   await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
  187 |     "data-rtt-calls",
  188 |     /^\d+$/,
  189 |     { timeout: 60_000 },
  190 |   );
  191 |   await expect(page.getByTestId("fringe-rtt-metrics")).toHaveAttribute(
  192 |     "data-rtt-triangles",
  193 |     /^[1-9]\d*$/,
  194 |     { timeout: 60_000 },
  195 |   );
  196 | };
  197 |
  198 | const composeSideBySidePanel = async (
  199 |   page: Page,
  200 |   title: string,
  201 |   observerH: Buffer,
  202 |   groundGlassH: Buffer,
  203 |   observerN: Buffer,
  204 |   groundGlassN: Buffer,
  205 | ): Promise<Buffer> => {
  206 |   const panelPage = await page.context().newPage();
  207 |   const image = (label: string, value: Buffer) =>
  208 |     "<figure><figcaption>" + label + "</figcaption><img src=\"data:image/png;base64," + value.toString("base64") + "\"></figure>";
  209 |   await panelPage.setContent(
  210 |     "<!doctype html><html><head><meta charset=\"utf-8\"><style>"
  211 |       + "body{font:14px system-ui;margin:12px;color:#111}h1{font-size:18px;margin:0 0 12px}"
  212 |       + ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0;border:1px solid #aaa;padding:6px}"
  213 |       + "figcaption{font-weight:600;margin-bottom:5px}img{display:block;width:100%;height:auto}"
  214 |       + "</style></head><body><h1>" + title + "</h1><div class=\"grid\">"
  215 |       + image("Stage 2H — Observer", observerH)
  216 |       + image("Stage 2H — Ground Glass RTT", groundGlassH)
  217 |       + image("Stage 2N-A — Observer", observerN)
  218 |       + image("Stage 2N-A — Ground Glass RTT", groundGlassN)
  219 |       + "</div></body></html>",
  220 |   );
  221 |   const output = await panelPage.screenshot({ fullPage: true });
  222 |   await panelPage.close();
  223 |   return output;
  224 | };
  225 |
  226 | const composeMotionPanel = async (
  227 |   page: Page,
  228 |   title: string,
  229 |   captures: Array<{ motionId: string; observer: Buffer; groundGlass: Buffer }>,
  230 | ): Promise<Buffer> => {
  231 |   const panelPage = await page.context().newPage();
  232 |   const imageData = await panelPage.evaluate(async ({ panelTitle, panelCaptures }) => {
  233 |     const decodeImage = (dataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  234 |       const image = new Image();
  235 |       image.onload = () => resolve(image);
  236 |       image.onerror = () => reject(new Error("Could not decode a captured motion frame"));
  237 |       image.src = dataUrl;
  238 |     });
  239 |     const images = await Promise.all(panelCaptures.map(async (capture) => ({
  240 |       motionId: capture.motionId,
  241 |       observer: await decodeImage(capture.observer),
  242 |       groundGlass: await decodeImage(capture.groundGlass),
  243 |     })));
  244 |     const cellWidth = 580;
  245 |     const imageHeight = Math.round(cellWidth * images[0].observer.height / images[0].observer.width);
  246 |     const rowHeight = imageHeight + 38;
  247 |     const canvas = document.createElement("canvas");
  248 |     canvas.width = cellWidth * 2 + 40;
  249 |     canvas.height = 56 + rowHeight * images.length;
  250 |     const context = canvas.getContext("2d");
  251 |     if (!context) throw new Error("Could not create the motion contact sheet");
  252 |     context.fillStyle = "#fff";
  253 |     context.fillRect(0, 0, canvas.width, canvas.height);
  254 |     context.fillStyle = "#111";
  255 |     context.font = "bold 18px system-ui";
  256 |     context.fillText(panelTitle, 12, 28);
  257 |     const labels: Record<string, string> = {
  258 |       center: "Center",
  259 |       left: "Slight left (40 mm)",
  260 |       right: "Slight right (40 mm)",
  261 |       near: "Slight near (40 mm)",
  262 |       far: "Slight far (40 mm)",
  263 |     };
  264 |     images.forEach((capture, index) => {
  265 |       const y = 46 + index * rowHeight;
  266 |       context.font = "600 13px system-ui";
  267 |       context.fillStyle = "#111";
  268 |       context.fillText(labels[capture.motionId] + " — Stage 2N-A Observer", 12, y + 13);
  269 |       context.fillText(labels[capture.motionId] + " — Ground Glass RTT", cellWidth + 28, y + 13);
  270 |       context.drawImage(capture.observer, 12, y + 18, cellWidth, imageHeight);
  271 |       context.drawImage(capture.groundGlass, cellWidth + 28, y + 18, cellWidth, imageHeight);
  272 |     });
  273 |     return canvas.toDataURL("image/png");
  274 |   }, {
  275 |     panelTitle: title,
  276 |     panelCaptures: captures.map(({ motionId, observer, groundGlass }) => ({
```