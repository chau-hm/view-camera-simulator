import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

const geometry = [
  { id: "near", xMm: -40, yMm: 5, surfaceZMm: 390 },
  { id: "middle", xMm: 0, yMm: 5, surfaceZMm: 400 },
  { id: "far", xMm: 40, yMm: 5, surfaceZMm: 410 },
];
const focalLengthMm = 150;
const sampledFilmWidthMm = 127;
const detailAnnulusMm = { inner: 3.5, outer: 7.0 };
const faceDiskRadiusMm = 8.45;
const nearBlackLinearLuma = 0.01;
const clippedLinearLuma = 0.95;

const fail = (message) => {
  throw new Error(message);
};

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const decodePng = (buffer) => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) fail("input is not a PNG file");

  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const imageData = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    fail(`unsupported PNG format: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const decoded = inflateSync(Buffer.concat(imageData));
  if (decoded.length !== (stride + 1) * height) fail("PNG scanline data has an unexpected length");

  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = decoded[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = decoded[sourceOffset + x];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const above = y > 0 ? pixels[rowOffset + x - stride] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[rowOffset + x - stride - bytesPerPixel]
        : 0;
      if (filter === 0) pixels[rowOffset + x] = value;
      else if (filter === 1) pixels[rowOffset + x] = (value + left) & 255;
      else if (filter === 2) pixels[rowOffset + x] = (value + above) & 255;
      else if (filter === 3) pixels[rowOffset + x] = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) pixels[rowOffset + x] = (value + paeth(left, above, upperLeft)) & 255;
      else fail(`unsupported PNG filter ${filter}`);
    }
    sourceOffset += stride;
  }

  const linearLuma = new Float32Array(width * height);
  const toLinear = (channel) => {
    const encoded = channel / 255;
    return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  };
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    const red = toLinear(pixels[offset]);
    const green = toLinear(pixels[offset + 1]);
    const blue = toLinear(pixels[offset + 2]);
    linearLuma[index] = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  return { width, height, linearLuma };
};

const summarize = (values) => {
  if (values.length === 0) fail("metric region has no pixels");
  const sorted = values.toSorted((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(fraction * (sorted.length - 1)))];
  return {
    pixels: values.length,
    mean: Number(mean.toFixed(5)),
    p10: Number(percentile(0.1).toFixed(5)),
    median: Number(percentile(0.5).toFixed(5)),
    p90: Number(percentile(0.9).toFixed(5)),
    standardDeviation: Number(Math.sqrt(variance).toFixed(5)),
  };
};

const extractRegion = (image, predicate) => {
  const values = [];
  let nearBlack = 0;
  let clipped = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const value = image.linearLuma[y * image.width + x];
      if (!predicate(x, y)) continue;
      values.push(value);
      if (value < nearBlackLinearLuma) nearBlack += 1;
      if (value >= clippedLinearLuma) clipped += 1;
    }
  }
  return {
    ...summarize(values),
    nearBlackFraction: Number((nearBlack / values.length).toFixed(5)),
    clippedFraction: Number((clipped / values.length).toFixed(5)),
  };
};

const edgeContrast = (image, inRegion) => {
  let total = 0;
  let count = 0;
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      if (!inRegion(x, y) || !inRegion(x - 1, y) || !inRegion(x + 1, y) ||
        !inRegion(x, y - 1) || !inRegion(x, y + 1)) continue;
      const left = image.linearLuma[y * image.width + x - 1];
      const right = image.linearLuma[y * image.width + x + 1];
      const top = image.linearLuma[(y - 1) * image.width + x];
      const bottom = image.linearLuma[(y + 1) * image.width + x];
      total += Math.hypot(right - left, bottom - top) / 2;
      count += 1;
    }
  }
  return { meanLumaGradient: Number((total / count).toFixed(5)), pixels: count };
};

const round = (value) => Number(value.toFixed(3));

const run = async () => {
  const manifestPath = process.argv[2];
  if (!manifestPath) fail("usage: node scripts/render-quality/rq3d-macro-image-metrics.mjs <before/states.json|after/states.json>");
  const absoluteManifestPath = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(absoluteManifestPath, "utf8"));
  const imageRoot = dirname(absoluteManifestPath);
  const measured = [];

  for (const state of manifest.groundGlassStates) {
    const imagePath = resolve(imageRoot, state.image.path);
    const png = await readFile(imagePath);
    const imageSha256 = createHash("sha256").update(png).digest("hex");
    if (state.image.sha256 && imageSha256 !== state.image.sha256) {
      fail(`${state.stateId}: SHA-256 does not match the state manifest`);
    }
    const image = decodePng(png);
    if (image.width !== state.image.width || image.height !== state.image.height) {
      fail(`${state.stateId}: manifest dimensions disagree with PNG dimensions`);
    }

    const scalePxPerMm = image.width / sampledFilmWidthMm;
    const stations = geometry.map((station) => {
      const magnification = focalLengthMm / (station.surfaceZMm - focalLengthMm);
      const centerX = image.width / 2 + station.xMm * magnification * scalePxPerMm;
      const centerY = image.height / 2 + station.yMm * magnification * scalePxPerMm;
      const innerRadius = detailAnnulusMm.inner * magnification * scalePxPerMm;
      const outerRadius = detailAnnulusMm.outer * magnification * scalePxPerMm;
      const faceRadius = faceDiskRadiusMm * magnification * scalePxPerMm;
      const annulus = (x, y) => {
        const distance = Math.hypot(x - centerX, y - centerY);
        return distance >= innerRadius && distance <= outerRadius;
      };
      const face = (x, y) => Math.hypot(x - centerX, y - centerY) <= faceRadius;
      const detail = extractRegion(image, annulus);
      const faceStats = summarize(Array.from(image.linearLuma).filter((_, index) => {
        const x = index % image.width;
        const y = Math.floor(index / image.width);
        return face(x, y);
      }));
      return {
        stationId: station.id,
        geometryMm: { x: station.xMm, y: station.yMm, surfaceZ: station.surfaceZMm },
        roiCenterPx: { x: round(centerX), y: round(centerY) },
        detailAnnulusPx: { innerRadius: round(innerRadius), outerRadius: round(outerRadius) },
        faceDiskRadiusPx: round(faceRadius),
        detailLuma: detail,
        faceMeanLuma: faceStats.mean,
        detailP10ToP90Range: Number((detail.p90 - detail.p10).toFixed(5)),
        detailRmsContrast: Number((detail.standardDeviation / Math.max(detail.mean, 1e-5)).toFixed(5)),
        edgeContrast: edgeContrast(image, annulus),
      };
    });

    const background = extractRegion(image, (x, y) => x >= 75 && x < image.width - 75 && y >= 55 && y < 110);
    measured.push({
      stateId: state.stateId,
      focusDistanceMm: state.focusDistanceMm,
      apertureFNumber: state.apertureFNumber,
      sourceCommit: state.sourceCommit,
      image: state.image,
      stationMetrics: stations,
      backgroundReference: {
        roiPx: { x: 75, y: 55, width: image.width - 150, height: 55 },
        ...background,
      },
      backgroundSubjectSeparation: stations.map((station) => ({
        stationId: station.stationId,
        backgroundMinusFaceLuma: Number((background.mean - station.faceMeanLuma).toFixed(5)),
      })),
    });
  }

  process.stdout.write(`${JSON.stringify({
    schemaVersion: "rq3d-macro-luminance-metrics-v1",
    method: {
      luminance: "linear Rec.709 luminance decoded from the PNG sRGB values",
      stationCenters: "perspective projection of the canonical focus-zone centers using f=150 mm, source distance 390/400/410 mm, sampled film width 127 mm, and the captured 450 px width",
      detailRegion: "annulus from 3.5 mm to 7.0 mm radius on each canonical station face",
      faceRegion: "disk through the 8.45 mm face-trim radius",
      backgroundRegion: "x=75..374, y=55..109 in the 450x360 capture",
      edgeContrast: "mean centered luminance-gradient magnitude in the detail annulus; it mixes material contrast and optical blur and is not a standalone physical-sharpness measure",
      thresholds: { nearBlackLinearLuma: nearBlackLinearLuma, clippedLinearLuma: clippedLinearLuma },
      limitations: "ROI metrics are image diagnostics; focus ranking is validated separately by the existing public scene/teaching tests.",
    },
    captures: measured,
  }, null, 2)}\n`);
};

await run();
