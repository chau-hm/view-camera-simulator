import { describe, expect, it } from "vitest";
import {
  compareRgba,
  compositeFarAndNear,
  gatherTexelForSourcePixelCenter,
  nearestTexelAtTopUv,
  reconstructFarToSourceGrid,
  referenceFarGatherTarget,
  sourcePixelAtGatherPixelCenter,
} from "../e2e/fixtures/ground-glass-webgpu-far-reconstruction-cases";

describe("Ground Glass WebGPU far reconstruction reference", () => {
  it("maps normalized top-origin nearest sampling with texel intervals and clamped UVs", () => {
    expect(nearestTexelAtTopUv([0, 0], { widthPx: 5, heightPx: 3 })).toEqual([0, 0]);
    expect(nearestTexelAtTopUv([1, 1], { widthPx: 5, heightPx: 3 })).toEqual([4, 2]);
    expect(nearestTexelAtTopUv([0.5, 0.5], { widthPx: 4, heightPx: 2 })).toEqual([2, 1]);
    expect(nearestTexelAtTopUv([0.25, 0.5], { widthPx: 4, heightPx: 2 })).toEqual([1, 1]);
    expect(nearestTexelAtTopUv([-2, 3], { widthPx: 5, heightPx: 3 })).toEqual([0, 2]);
  });

  it("maps full-resolution source centers onto half-resolution texels without a half-texel shift", () => {
    const source = { widthPx: 128, heightPx: 96 };
    const gather = { widthPx: 64, heightPx: 48 };
    expect(gatherTexelForSourcePixelCenter([0, 0], source, gather)).toEqual([0, 0]);
    expect(gatherTexelForSourcePixelCenter([1, 1], source, gather)).toEqual([0, 0]);
    expect(gatherTexelForSourcePixelCenter([2, 2], source, gather)).toEqual([1, 1]);
    expect(gatherTexelForSourcePixelCenter([127, 95], source, gather)).toEqual([63, 47]);
    expect(sourcePixelAtGatherPixelCenter([0, 0], gather, source)).toEqual([1, 1]);
    expect(sourcePixelAtGatherPixelCenter([63, 47], gather, source)).toEqual([127, 95]);
    // This is the nominal interval-based CPU mapping. Native ID targets separately record the actual selected texel.
    expect(gatherTexelForSourcePixelCenter([1, 0], source, gather)[0]).toBe(0);
    expect(nearestTexelAtTopUv([(1.5) / source.widthPx, 0.5 / source.heightPx], gather)[0]).toBe(0);
    // The incorrect x*scale + 0.5 rule is the off-by-half-texel mutation.
    expect(Math.floor(1 * gather.widthPx / source.widthPx + 0.5)).toBe(1);
  });

  it("recomputes a non-vacuous low-resolution far gather from source inputs", () => {
    const source = { widthPx: 4, heightPx: 2 };
    const gather = { widthPx: 2, heightPx: 1 };
    const colors = new Float32Array(4 * 2 * 4);
    const physical = new Float32Array(4 * 2 * 4);
    const validity = new Uint8Array(4 * 2).fill(1);
    const worldAndDepth = new Float32Array(4 * 2 * 4);
    for (let y = 0; y < source.heightPx; y += 1) {
      for (let x = 0; x < source.widthPx; x += 1) {
        const pixel = y * source.widthPx + x;
        const offset = pixel * 4;
        colors.set([x / 4, y / 2, 0.25, 1], offset);
        physical.set([1, 0, 0, 0], offset);
        worldAndDepth.set([0, 0, 500, 0.5], offset);
      }
    }
    const reference = referenceFarGatherTarget({
      source,
      gather,
      film: { widthMm: 36, heightMm: 24 },
      sampleCount: 16,
      maximumCoCRadiusPx: 12,
      cameraZMm: 0,
      colors,
      physical,
      validity,
      worldAndDepth,
    });
    expect(reference.validFarCenterCount).toBe(2);
    expect(reference.centerSourcePixels).toEqual(new Int16Array([1, 1, 3, 1]));
    expect([...reference.rgba.slice(0, 4)]).toEqual([0.25, 0.5, 0.25, 1]);
    expect([...reference.rgba.slice(4, 8)]).toEqual([0.75, 0.5, 0.25, 1]);
  });

  it("uses a compatible far gather center and falls back to source color otherwise", () => {
    const source = { widthPx: 4, heightPx: 1 };
    const gather = { widthPx: 2, heightPx: 1 };
    const colors = new Float32Array([
      1, 0, 0, 1,
      0, 0, 1, 1,
      0, 0, 1, 1,
      0, 1, 0, 1,
    ]);
    const physical = new Float32Array([
      -1, 0, 0, 0,
      -1, 0, 0, 0,
      1, 0, 0, 0,
      1, 0, 0, 0,
    ]);
    const validity = new Uint8Array([1, 1, 1, 1]);
    const gatherFar = new Float32Array([
      1, 0, 0, 1,
      0, 1, 0, 1,
    ]);
    const reconstruction = reconstructFarToSourceGrid({ source, gather, gatherFar, colors, physical, validity });
    expect([...reconstruction.candidateAccepted]).toEqual([0, 0, 1, 1]);
    expect([...reconstruction.baselineFar.slice(0, 4)]).toEqual([1, 0, 0, 1]);
    expect([...reconstruction.compatibleFar.slice(0, 4)]).toEqual([1, 0, 0, 1]);
    expect([...reconstruction.compatibleFar.slice(4, 8)]).toEqual([0, 0, 1, 1]);
    expect([...reconstruction.compatibleFar.slice(8, 12)]).toEqual([0, 1, 0, 1]);

    validity[3] = 4;
    const unresolved = reconstructFarToSourceGrid({ source, gather, gatherFar, colors, physical, validity });
    expect(unresolved.candidateAccepted[3]).toBe(0);
    expect([...unresolved.compatibleFar.slice(12, 16)]).toEqual([0, 1, 0, 1]);
  });

  it("keeps near alpha composition independent and reports RGB comparisons", () => {
    const far = new Float32Array([0, 0, 1, 1, 1, 0, 0, 1]);
    const near = new Float32Array([1, 0, 0, 0.25, 0, 1, 0, 1]);
    const output = compositeFarAndNear(far, near);
    expect([...output]).toEqual([0.25, 0, 0.75, 1, 0, 1, 0, 1]);
    expect(compareRgba(output, new Float32Array([0.25, 0, 0.75, 1, 0, 1, 0, 1]))).toMatchObject({
      maxRgbError: 0,
      meanRgbError: 0,
      samples: 6,
    });
    expect(() => compareRgba(new Float32Array(3), new Float32Array(3))).toThrow(RangeError);
  });
});
