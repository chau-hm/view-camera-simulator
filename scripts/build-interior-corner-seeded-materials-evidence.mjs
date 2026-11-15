import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const repositoryRoot = process.cwd();
const rawDirectory = path.resolve(
  process.argv[2] ?? "docs/render-quality/.interior-corner-seeded-materials-runs/current",
);
const evidenceDirectory = path.resolve(
  process.argv[3] ?? "docs/render-quality/evidence/interior-corner-seeded-materials",
);

const observerFiles = [
  ["observer-ordinary-size-canonical-lesson.png", "Canonical lesson Observe · 514 × 411"],
  ["observer-ordinary-size-seed-284719.png", "Free Practice · seed 284719 · schema v1"],
  ["observer-ordinary-size-seed-4294967295.png", "Free Practice · seed 4294967295 · schema v1"],
];
const replayFiles = [
  ["observer-seed-284719.png", "Seed 284719 · direct entry"],
  ["observer-direct-replay-284719.png", "Seed 284719 · direct URL replay"],
  ["observer-reload-284719.png", "Seed 284719 · page reload"],
  ["observer-back-restored-284719.png", "Seed 284719 · browser Back"],
];
const matrixFiles = [];
for (const focus of [5800, 8000, 10400]) {
  for (const aperture of [5.6, 11, 22]) {
    matrixFiles.push([
      `ground-glass-seed-284719-focus-${focus}-f-${aperture}.png`,
      `Seed 284719 · focus ${focus} mm · f/${aperture}`,
    ]);
  }
}
const secondSeedFiles = [
  ["ground-glass-seed-4294967295-upright.png", "Seed 4294967295 · Upright"],
  ["ground-glass-seed-4294967295-raw.png", "Seed 4294967295 · Raw"],
  ["ground-glass-seed-4294967295-front-rise.png", "Seed 4294967295 · Front Rise 33 mm"],
  ["ground-glass-seed-4294967295-front-swing.png", "Seed 4294967295 · Front Swing 3.6°"],
];
const sheets = [
  ["observer-material-variants-ordinary-size.png", observerFiles, 3],
  ["observer-seed-replay-identity.png", replayFiles, 2],
  ["ground-glass-seed-284719-nine-state-matrix.png", matrixFiles, 3],
  ["ground-glass-seed-4294967295-states.png", secondSeedFiles, 2],
];

const readData = (files) => Promise.all(files.map(async ([file, label]) => ({
  file,
  label,
  dataUrl: `data:image/png;base64,${(await readFile(path.join(rawDirectory, file))).toString("base64")}`,
})));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 2200, height: 1900 },
  deviceScaleFactor: 1,
});
await mkdir(evidenceDirectory, { recursive: true });

const contactSheets = [];
for (const [filename, files, columns] of sheets) {
  const items = await readData(files);
  const cards = items.map((item) => (
    `<article class="card"><div class="label">${item.label}</div>` +
    `<img src="${item.dataUrl}" alt="${item.label}"></article>`
  )).join("");
  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\"><style>",
    "*{box-sizing:border-box}body{margin:0;padding:14px;background:#0e1822;color:#eef4f8;",
    "font:14px/1.35 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}",
    `#sheet{display:grid;grid-template-columns:repeat(${columns},max-content);gap:12px;width:max-content}`,
    ".card{background:#162331;border:1px solid #435668;border-radius:8px;padding:8px;width:max-content}",
    ".label{min-height:20px;margin:0 0 8px;font-weight:600;white-space:nowrap}",
    "img{display:block;max-width:none;height:auto}",
    "</style></head><body><main id=\"sheet\">",
    cards,
    "</main></body></html>",
  ].join("");
  await page.setContent(html);
  await page.evaluate(() => Promise.all([...document.images].map((image) => image.decode())));
  const sheet = page.locator("#sheet");
  const bounds = await sheet.boundingBox();
  if (!bounds) throw new Error(`Contact sheet has no dimensions: ${filename}`);
  await sheet.screenshot({ path: path.join(evidenceDirectory, filename) });
  contactSheets.push({
    path: path.relative(repositoryRoot, path.join(evidenceDirectory, filename)),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
    panels: files.map(([file, label]) => ({ file, label })),
  });
}

const comparisonFiles = [
  ["observer-ordinary-size-canonical-lesson.png", "canonical"],
  ["observer-ordinary-size-seed-284719.png", "seed-284719"],
  ["observer-ordinary-size-seed-4294967295.png", "seed-4294967295"],
  ["observer-seed-284719.png", "seed-284719-450"],
  ["observer-direct-replay-284719.png", "direct-replay-450"],
  ["observer-reload-284719.png", "reload-450"],
  ["observer-back-restored-284719.png", "back-450"],
];
const comparisonData = await readData(comparisonFiles);
const pixelComparisons = await page.evaluate(async (entries) => {
  const decoded = await Promise.all(entries.map(async (entry) => {
    const image = new Image();
    image.src = entry.dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.drawImage(image, 0, 0);
    return {
      label: entry.label,
      width: image.width,
      height: image.height,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
    };
  }));
  const find = (label) => decoded.find((image) => image.label === label);
  const compare = (aLabel, bLabel) => {
    const a = find(aLabel);
    const b = find(bLabel);
    if (!a || !b) throw new Error(`Missing pixel comparison input: ${aLabel}, ${bLabel}`);
    if (a.width !== b.width || a.height !== b.height) {
      return { a: aLabel, b: bLabel, dimensionsMatch: false };
    }
    let changedPixels = 0;
    let sumOfPerPixelMaximumChannelDelta = 0;
    let maxChannelDelta = 0;
    for (let index = 0; index < a.pixels.length; index += 4) {
      const delta = Math.max(
        Math.abs(a.pixels[index] - b.pixels[index]),
        Math.abs(a.pixels[index + 1] - b.pixels[index + 1]),
        Math.abs(a.pixels[index + 2] - b.pixels[index + 2]),
      );
      if (delta > 0) changedPixels += 1;
      sumOfPerPixelMaximumChannelDelta += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);
    }
    const totalPixels = a.width * a.height;
    return {
      a: aLabel,
      b: bLabel,
      dimensions: { width: a.width, height: a.height },
      changedPixels,
      totalPixels,
      changedPercent: Number((changedPixels / totalPixels * 100).toFixed(4)),
      meanOfPerPixelMaximumChannelDelta: Number((sumOfPerPixelMaximumChannelDelta / totalPixels).toFixed(4)),
      maxChannelDelta,
    };
  };
  return [
    compare("canonical", "seed-284719"),
    compare("canonical", "seed-4294967295"),
    compare("seed-284719", "seed-4294967295"),
    compare("seed-284719-450", "direct-replay-450"),
    compare("seed-284719-450", "reload-450"),
    compare("seed-284719-450", "back-450"),
  ];
}, comparisonData);

const captureFiles = [...observerFiles, ...replayFiles, ...matrixFiles, ...secondSeedFiles];
const captureHashes = {};
for (const [file] of captureFiles) {
  captureHashes[file] = createHash("sha256")
    .update(await readFile(path.join(rawDirectory, file)))
    .digest("hex");
}
const report = {
  source: "Real Playwright Chromium canvas screenshots; contact sheets preserve each panel at native CSS-pixel scale.",
  browser: "Chromium headless, DPR 1",
  ordinaryObserver: {
    viewport: "1440 × 1000",
    pngSize: "514 × 411",
    files: observerFiles.map(([file, label]) => ({ file, label, sha256: captureHashes[file] })),
  },
  pixelComparisons,
  contactSheets,
  rawCaptureDirectory: "docs/render-quality/.interior-corner-seeded-materials-runs/current (git-ignored)",
};
await writeFile(
  path.join(evidenceDirectory, "visual-comparison.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
await browser.close();
console.log(JSON.stringify({ contactSheets, pixelComparisons }, null, 2));
