import { inflateSync } from "node:zlib";

const quantile = (sortedValues, probability) => {
  if (sortedValues.length === 0) return null;
  const index = (sortedValues.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;
  return sortedValues[lower] * (1 - fraction) + sortedValues[upper] * fraction;
};

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
};

const nextRandom = (state) => {
  let value = state.value >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.value = value >>> 0;
  return state.value / 0x1_0000_0000;
};

export const bootstrapMedianInterval = (
  values,
  { replicates = 2000, seed = 0x51f15e } = {},
) => {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    return { valid: false, rejection: "no finite row measurements" };
  }
  if (!Number.isInteger(replicates) || replicates < 100) {
    throw new RangeError("bootstrap needs at least 100 replicates");
  }
  const random = { value: seed >>> 0 || 1 };
  const draws = new Array(replicates);
  for (let replicate = 0; replicate < replicates; replicate += 1) {
    const sample = new Array(values.length);
    for (let index = 0; index < values.length; index += 1) {
      sample[index] = values[Math.floor(nextRandom(random) * values.length)];
    }
    draws[replicate] = median(sample);
  }
  draws.sort((a, b) => a - b);
  return {
    valid: true,
    estimate: median(values),
    lower95: quantile(draws, 0.025),
    upper95: quantile(draws, 0.975),
    replicateCount: replicates,
    rowCount: values.length,
  };
};

const crossing = (profile, threshold) => {
  for (let index = 1; index < profile.length; index += 1) {
    if (profile[index - 1] <= threshold && profile[index] >= threshold
      && profile[index] > profile[index - 1]) {
      return index - 1 + (threshold - profile[index - 1]) / (profile[index] - profile[index - 1]);
    }
  }
  return null;
};

const shiftCropByFractionalPixels = (rgba, width, height, offsetPx) => {
  const shifted = new Uint8Array(rgba.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.max(0, Math.min(width - 1, x + offsetPx));
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(width - 1, x0 + 1);
      const fraction = sourceX - x0;
      for (let channel = 0; channel < 4; channel += 1) {
        const a = rgba[(y * width + x0) * 4 + channel];
        const b = rgba[(y * width + x1) * 4 + channel];
        shifted[(y * width + x) * 4 + channel] = Math.round(a * (1 - fraction) + b * fraction);
      }
    }
  }
  return shifted;
};

/**
 * Measure each horizontal image row separately so the bootstrap samples the
 * available edge phases instead of collapsing them into one mean profile.
 * `rgba` is the cropped row-major crop, not a full-frame image.
 */
export const measureVerticalEdgeRows = (
  rgba,
  width,
  height,
  { replicates = 2000, seed = 0x51f15e, phaseBins = 4, minimumRowsPerPhaseBin = 2, phaseProbe = true } = {},
) => {
  if (!(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray)
    || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 8 || height < 3 || rgba.length !== width * height * 4) {
    return { valid: false, rejection: "invalid RGBA crop" };
  }
  const endpointWidth = Math.max(2, Math.floor(width / 5));
  const rows = [];
  let clippedPixels = 0;
  for (let y = 0; y < height; y += 1) {
    const profile = new Array(width);
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const luma = 0.2126 * rgba[offset] + 0.7152 * rgba[offset + 1] + 0.0722 * rgba[offset + 2];
      profile[x] = luma;
      if (luma <= 5 || luma >= 250) clippedPixels += 1;
    }
    const left = profile.slice(0, endpointWidth).reduce((sum, value) => sum + value, 0) / endpointWidth;
    const right = profile.slice(width - endpointWidth).reduce((sum, value) => sum + value, 0) / endpointWidth;
    const contrast = Math.abs(right - left);
    if (Math.min(left, right) <= 5 || Math.max(left, right) >= 250 || contrast < 12) continue;
    const direction = Math.sign(right - left);
    const normalized = profile.map((value) => ((value - left) * direction) / contrast);
    const p10 = crossing(normalized, 0.1);
    const p50 = crossing(normalized, 0.5);
    const p90 = crossing(normalized, 0.9);
    if (p10 === null || p50 === null || p90 === null || p10 >= p50 || p50 >= p90
      || p10 < endpointWidth - 1 || p90 > width - endpointWidth) continue;
    rows.push({ y, edgeX: p50, phase: p50 - Math.floor(p50), width10to90Px: p90 - p10, contrastLuma8: contrast });
  }
  const clippedFraction = clippedPixels / (width * height);
  if (clippedFraction > 0.1) return { valid: false, rejection: "dark or saturated crop", clippedFraction, rows };
  if (rows.length < Math.min(height, 6)) {
    return { valid: false, rejection: "too few valid row profiles", clippedFraction, rows };
  }

  const widths = rows.map((row) => row.width10to90Px);
  const interval = bootstrapMedianInterval(widths, { replicates, seed });
  const bins = Array.from({ length: phaseBins }, () => []);
  for (const row of rows) bins[Math.min(phaseBins - 1, Math.floor(row.phase * phaseBins))].push(row.width10to90Px);
  const supportedBinMedians = bins
    .filter((values) => values.length >= minimumRowsPerPhaseBin)
    .map((values) => median(values));
  const phaseCoverage = {
    binCount: phaseBins,
    supportedBinCount: supportedBinMedians.length,
    minimumRowsPerBin: minimumRowsPerPhaseBin,
    rowsPerBin: bins.map((values) => values.length),
    envelopePx: supportedBinMedians.length >= 2
      ? Math.max(...supportedBinMedians) - Math.min(...supportedBinMedians)
      : null,
    adequate: supportedBinMedians.length >= 2,
  };

  let phaseSweep = null;
  if (phaseProbe) {
    const offsets = Array.from({ length: 8 }, (_, index) => -0.5 + index / 8);
    const phaseWidths = [];
    for (const offsetPx of offsets) {
      const shifted = shiftCropByFractionalPixels(rgba, width, height, offsetPx);
      const phaseMeasurement = measureVerticalEdgeRows(shifted, width, height, {
        replicates: 100,
        seed: seed + Math.round((offsetPx + 0.5) * 1000),
        phaseBins,
        minimumRowsPerPhaseBin,
        phaseProbe: false,
      });
      if (phaseMeasurement.valid) phaseWidths.push({ offsetPx, width10to90Px: phaseMeasurement.width10to90Px });
    }
    phaseSweep = {
      method: "re-sample the captured display crop at eight fixed horizontal subpixel offsets using bilinear interpolation",
      sampleCount: phaseWidths.length,
      requiredSampleCount: 6,
      samples: phaseWidths,
      envelopePx: phaseWidths.length >= 6
        ? Math.max(...phaseWidths.map((sample) => sample.width10to90Px))
          - Math.min(...phaseWidths.map((sample) => sample.width10to90Px))
        : null,
      adequate: phaseWidths.length >= 6,
    };
  }

  return {
    valid: true,
    width10to90Px: interval.estimate,
    bootstrap95Px: [interval.lower95, interval.upper95],
    validRowCount: rows.length,
    clippedFraction,
    medianContrastLuma8: median(rows.map((row) => row.contrastLuma8)),
    edgePhaseRange: [Math.min(...rows.map((row) => row.phase)), Math.max(...rows.map((row) => row.phase))],
    phaseCoverage,
    phaseSweep,
    rows,
    uncertainty: {
      interpretation: "row-bootstrap interval is conditional on this raster; phase envelope is descriptive and does not include scene/capture variance",
      bootstrapReplicates: replicates,
      seed,
    },
  };
};

/**
 * A conservative description of a Raw/Processed comparison. A positive
 * result means only that the display-space edge-width medians separate beyond
 * the declared pixel/phase floor; it is not a claim of calibrated CoC.
 */
export const compareEdgeMetrics = (
  raw,
  processed,
  { minimumResolvableDifferencePx = 0.25 } = {},
) => {
  if (!raw?.valid || !processed?.valid) {
    return { status: "INCONCLUSIVE_INVALID_MEASUREMENT" };
  }
  const delta = processed.width10to90Px - raw.width10to90Px;
  const rawInterval = raw.bootstrap95Px;
  const processedInterval = processed.bootstrap95Px;
  const bootstrapDeltaIntervalPx = [
    processedInterval[0] - rawInterval[1],
    processedInterval[1] - rawInterval[0],
  ];
  const phaseEnvelopePx = raw.phaseSweep?.envelopePx === null || processed.phaseSweep?.envelopePx === null
    ? null
    : (raw.phaseSweep.envelopePx + processed.phaseSweep.envelopePx) / 2;
  if (phaseEnvelopePx === null || !raw.phaseSweep?.adequate || !processed.phaseSweep?.adequate) {
    return {
      status: "INCONCLUSIVE_PHASE_COVERAGE",
      deltaPx: delta,
      bootstrapDeltaIntervalPx,
      phaseEnvelopePx,
      minimumResolvableDifferencePx,
    };
  }
  const marginPx = phaseEnvelopePx + minimumResolvableDifferencePx;
  if (bootstrapDeltaIntervalPx[0] > marginPx) {
    return {
      status: "PROCESSED_EDGE_SPREAD_RESOLVED",
      deltaPx: delta,
      bootstrapDeltaIntervalPx,
      phaseEnvelopePx,
      minimumResolvableDifferencePx,
    };
  }
  if (bootstrapDeltaIntervalPx[1] < -marginPx) {
    return {
      status: "PROCESSED_EDGE_NARROWER_RESOLVED",
      deltaPx: delta,
      bootstrapDeltaIntervalPx,
      phaseEnvelopePx,
      minimumResolvableDifferencePx,
    };
  }
  return {
    status: "INCONCLUSIVE_WITHIN_PIXEL_PHASE_TOLERANCE",
    deltaPx: delta,
    bootstrapDeltaIntervalPx,
    phaseEnvelopePx,
    minimumResolvableDifferencePx,
  };
};

/** Exact first noncentral offset used by the current WebGL GLSL proposal rule. */
export const firstWebGlNearProposalRadiusPx = (maximumRadiusPx, sampleCount) => {
  if (!Number.isFinite(maximumRadiusPx) || maximumRadiusPx < 0
    || !Number.isInteger(sampleCount) || sampleCount <= 0) {
    throw new RangeError("proposal radius and sample count must be finite and positive");
  }
  return maximumRadiusPx * Math.sqrt(0.5 / sampleCount);
};

const paeth = (left, above, upperLeft) => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
};

/** Decode the non-interlaced, 8-bit RGB/RGBA PNGs written by the capture harness. */
export const decodePngRgba = (pngBytes) => {
  if (!(pngBytes instanceof Uint8Array) || pngBytes.length < 33) throw new Error("PNG input is incomplete");
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => pngBytes[index] === value)) throw new Error("PNG signature is invalid");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const compressed = [];
  while (offset + 12 <= pngBytes.length) {
    const length = new DataView(pngBytes.buffer, pngBytes.byteOffset + offset, 4).getUint32(0, false);
    const type = String.fromCharCode(...pngBytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > pngBytes.length) throw new Error("PNG chunk exceeds the input length");
    if (type === "IHDR") {
      const header = new DataView(pngBytes.buffer, pngBytes.byteOffset + dataStart, length);
      width = header.getUint32(0, false);
      height = header.getUint32(4, false);
      bitDepth = pngBytes[dataStart + 8];
      colorType = pngBytes[dataStart + 9];
      interlace = pngBytes[dataStart + 12];
    } else if (type === "IDAT") {
      compressed.push(pngBytes.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1
    || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error("Only non-interlaced 8-bit RGB/RGBA PNGs are supported");
  }
  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const inflated = inflateSync(Buffer.concat(compressed));
  if (inflated.length !== (rowBytes + 1) * height) throw new Error("PNG decompressed pixel length is inconsistent");
  const pixels = new Uint8Array(width * height * 4);
  let inputOffset = 0;
  const previous = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const row = new Uint8Array(rowBytes);
    for (let x = 0; x < rowBytes; x += 1) {
      const source = inflated[inputOffset++];
      const left = x >= channels ? row[x - channels] : 0;
      const above = previous[x];
      const upperLeft = x >= channels ? previous[x - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = above;
      else if (filter === 3) predictor = Math.floor((left + above) / 2);
      else if (filter === 4) predictor = paeth(left, above, upperLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG row filter ${filter}`);
      row[x] = (source + predictor) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = x * channels;
      const targetOffset = (y * width + x) * 4;
      pixels[targetOffset] = row[sourceOffset];
      pixels[targetOffset + 1] = row[sourceOffset + 1];
      pixels[targetOffset + 2] = row[sourceOffset + 2];
      pixels[targetOffset + 3] = channels === 4 ? row[sourceOffset + 3] : 255;
    }
    previous.set(row);
  }
  return { width, height, rgba: pixels };
};

/** Bilinear resampling at output pixel centers, matching a 2D canvas drawImage on the CSS grid. */
export const resizeRgbaBilinear = (image, outputWidth, outputHeight) => {
  const { width, height, rgba } = image;
  if (!Number.isInteger(outputWidth) || outputWidth < 1 || !Number.isInteger(outputHeight) || outputHeight < 1
    || rgba.length !== width * height * 4) throw new RangeError("invalid RGBA resize dimensions");
  if (width === outputWidth && height === outputHeight) return { width, height, rgba: new Uint8Array(rgba) };
  const output = new Uint8Array(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y += 1) {
    const sourceY = Math.max(0, Math.min(height - 1, (y + 0.5) * height / outputHeight - 0.5));
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = sourceY - y0;
    for (let x = 0; x < outputWidth; x += 1) {
      const sourceX = Math.max(0, Math.min(width - 1, (x + 0.5) * width / outputWidth - 0.5));
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = sourceX - x0;
      const targetOffset = (y * outputWidth + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const a = rgba[(y0 * width + x0) * 4 + channel];
        const b = rgba[(y0 * width + x1) * 4 + channel];
        const c = rgba[(y1 * width + x0) * 4 + channel];
        const d = rgba[(y1 * width + x1) * 4 + channel];
        const top = a * (1 - fx) + b * fx;
        const bottom = c * (1 - fx) + d * fx;
        output[targetOffset + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return { width: outputWidth, height: outputHeight, rgba: output };
};

export const cropRgba = (image, roi) => {
  if (!Number.isInteger(roi.x) || !Number.isInteger(roi.y) || !Number.isInteger(roi.width) || !Number.isInteger(roi.height)
    || roi.x < 0 || roi.y < 0 || roi.width < 1 || roi.height < 1
    || roi.x + roi.width > image.width || roi.y + roi.height > image.height) {
    throw new RangeError("crop ROI is outside the image");
  }
  const pixels = new Uint8Array(roi.width * roi.height * 4);
  for (let y = 0; y < roi.height; y += 1) {
    const sourceStart = ((roi.y + y) * image.width + roi.x) * 4;
    const destinationStart = y * roi.width * 4;
    pixels.set(image.rgba.subarray(sourceStart, sourceStart + roi.width * 4), destinationStart);
  }
  return pixels;
};
