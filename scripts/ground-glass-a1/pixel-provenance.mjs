import { createHash } from "node:crypto";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");

// Nearest pixel at each cell centre, preserving WebGL's bottom-left raster origin.
export function deriveSample(source, width, height, sampleWidth = 32, sampleHeight = 32) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      !Number.isSafeInteger(sampleWidth) || !Number.isSafeInteger(sampleHeight) || sampleWidth < 1 || sampleHeight < 1 ||
      source.length !== width * height * 4) throw new Error("Invalid RGBA8 source dimensions");
  const sample = Buffer.alloc(sampleWidth * sampleHeight * 4);
  for (let y = 0; y < sampleHeight; y++) for (let x = 0; x < sampleWidth; x++) {
    const sx = Math.floor((x + 0.5) * width / sampleWidth);
    const sy = Math.floor((y + 0.5) * height / sampleHeight);
    sample.set(source.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (y * sampleWidth + x) * 4);
  }
  return sample;
}

export function makePixelProvenance(source, width, height, frameId) {
  const sample = deriveSample(source, width, height);
  return { sample, evidence: { frameId, sourceWidth: width, sourceHeight: height, format: "rgba8", origin: "bottom-left", operation: "cell-centre-nearest-32x32", sourceSha256: digest(source), sampleSha256: digest(sample) } };
}

export function evaluatePixelProvenance(source, sample, evidence, completedFrameId) {
  const issues = [];
  if (!evidence || !completedFrameId || evidence.frameId !== completedFrameId) issues.push("capture-transaction-mismatch");
  if (!evidence || evidence.format !== "rgba8" || evidence.origin !== "bottom-left" || evidence.operation !== "cell-centre-nearest-32x32") return [...issues, "invalid-source-description"];
  try {
    const derived = deriveSample(source, evidence.sourceWidth, evidence.sourceHeight);
    if (digest(source) !== evidence.sourceSha256 || digest(sample) !== evidence.sampleSha256 || !derived.equals(sample)) issues.push("pixel-provenance-mismatch");
  } catch { issues.push("invalid-source-description"); }
  return issues;
}
