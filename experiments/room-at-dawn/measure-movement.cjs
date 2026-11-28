// Local, exploratory feature registration in display-referred screenshots.
// Matching a patch does not establish that the authored point itself is unoccluded.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const folder = path.resolve(
  process.argv[2] || "experiments/room-at-dawn/evidence/review-fix-v3/movement",
);
const targetCases = ["rise-positive", "shift-positive", "shift-negative"];
const load = (name) => ({
  ...JSON.parse(fs.readFileSync(path.join(folder, `${name}.json`))),
  png: fs.readFileSync(path.join(folder, `${name}.png`)).toString("base64"),
});
(async () => {
  const base = load("neutral"),
    comparisons = targetCases.map((name) => ({ name, ...load(name) }));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const results = await page.evaluate(
      async ({ base, comparisons }) => {
        async function decode(s) {
          const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
          const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
          const c = document.createElement("canvas");
          c.width = bmp.width;
          c.height = bmp.height;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(bmp, 0, 0);
          return {
            width: c.width,
            height: c.height,
            data: ctx.getImageData(0, 0, c.width, c.height).data,
          };
        }
        function centre(sample, img) {
          const f = sample.snapshot.features.find((f) => f.id === "nightstand-top");
          if (!f?.projected?.visible) throw Error("nightstand projection is outside film");
          return [
            Math.round(f.projected.uRaw * (img.width - 1)),
            Math.round((1 - f.projected.vRaw) * (img.height - 1)),
          ];
        }
        const A = await decode(base.png),
          origin = centre(base, A),
          R = 12;
        function pix(img, x, y) {
          const i = (y * img.width + x) * 4;
          return 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
        }
        function patch(img, cx, cy) {
          if (cx - R < 0 || cy - R < 0 || cx + R >= img.width || cy + R >= img.height) return null;
          let a = [];
          for (let y = -R; y <= R; y++)
            for (let x = -R; x <= R; x++) a.push(pix(img, cx + x, cy + y));
          return a;
        }
        const ref = patch(A, ...origin),
          meanRef = ref.reduce((a, b) => a + b, 0) / ref.length;
        let varianceRef = ref.reduce((a, b) => a + (b - meanRef) ** 2, 0);
        if (varianceRef < 1) throw Error("reference patch lacks contrast");
        const out = [];
        for (const candidate of comparisons) {
          const B = await decode(candidate.png),
            expected = centre(candidate, B);
          let best = { score: -Infinity, point: null };
          for (let dy = -18; dy <= 18; dy++)
            for (let dx = -18; dx <= 18; dx++) {
              const q = patch(B, expected[0] + dx, expected[1] + dy);
              if (!q) continue;
              const mean = q.reduce((a, b) => a + b, 0) / q.length;
              let dot = 0,
                v = 0;
              for (let i = 0; i < q.length; i++) {
                const d = q[i] - mean;
                dot += (ref[i] - meanRef) * d;
                v += d * d;
              }
              const score = v > 0 ? dot / Math.sqrt(varianceRef * v) : -1;
              if (score > best.score) best = { score, point: [expected[0] + dx, expected[1] + dy] };
            }
          out.push({
            case: candidate.name,
            baseCenterPx: origin,
            predictedCenterPx: expected,
            matchedCenterPx: best.point,
            matchCorrelation: best.score,
            residualPx: best.point
              ? [best.point[0] - expected[0], best.point[1] - expected[1]]
              : null,
            method:
              "25x25 luminance patch, normalized correlation within 18 pixels; exploratory, no occlusion or uniqueness proof",
          });
        }
        return out;
      },
      { base, comparisons },
    );
    const result = {
      subject: "nightstand-top candidate",
      captures: "neutral and individual same-focus upright HDR frames",
      results,
    };
    fs.writeFileSync(
      path.join(folder, "movement-registration.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
