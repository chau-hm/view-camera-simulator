import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_B1_FALLBACK_REASON,
  GROUND_GLASS_B1_MAX_FINITE_HALF,
  GROUND_GLASS_B1_SELECTED_PATH,
  compositeGroundGlassB1ResearchReference,
  groundGlassB1FallbackReasonName,
  reconstructGroundGlassB1Reference,
  type GroundGlassB1FallbackReason,
  type GroundGlassB1ReferenceInput,
} from "../../render/webgpu/groundGlassB1Reference";

const source = { widthPx: 4, heightPx: 4 };
const gather = { widthPx: 2, heightPx: 2 };

type MutableGroundGlassB1TestInput = Omit<
  GroundGlassB1ReferenceInput,
  "observedSelectedGatherIds" | "observedSelectedCenterSourceIds" | "observedGatherCenterSourceIds"
> & {
  observedSelectedGatherIds: Float32Array;
  observedSelectedCenterSourceIds: Float32Array;
  observedGatherCenterSourceIds: Float32Array;
};

const reasonName = (reasonCode: number | undefined): string =>
  groundGlassB1FallbackReasonName(reasonCode as GroundGlassB1FallbackReason);

const makeInput = (): MutableGroundGlassB1TestInput => {
  const sourcePixels = source.widthPx * source.heightPx;
  const gatherPixels = gather.widthPx * gather.heightPx;
  const sourceRgba = new Float32Array(sourcePixels * 4);
  const gatherFarRgba = new Float32Array(gatherPixels * 4);
  const physicalRgba = new Float32Array(sourcePixels * 4);
  const validity = new Uint8Array(sourcePixels).fill(1);
  const observedSelectedGatherIds = new Float32Array(sourcePixels * 2);
  const observedSelectedCenterSourceIds = new Float32Array(sourcePixels * 2);
  const observedGatherCenterSourceIds = new Float32Array(gatherPixels * 2);

  for (let y = 0; y < source.heightPx; y += 1) {
    for (let x = 0; x < source.widthPx; x += 1) {
      const pixel = y * source.widthPx + x;
      sourceRgba.set([0.01 + pixel / 100, 0.02 + pixel / 100, 0.03 + pixel / 100, 0.5 + pixel / 100], pixel * 4);
      physicalRgba.set([1, 0.4, 0.2, 0.25], pixel * 4);
      const gx = Math.floor(((x + 0.5) / source.widthPx) * gather.widthPx);
      const gy = Math.floor(((y + 0.5) / source.heightPx) * gather.heightPx);
      observedSelectedGatherIds.set([gx, gy], pixel * 2);
    }
  }
  for (let gy = 0; gy < gather.heightPx; gy += 1) {
    for (let gx = 0; gx < gather.widthPx; gx += 1) {
      const gatherPixel = gy * gather.widthPx + gx;
      const center: readonly [number, number] = [
        Math.floor(((gx + 0.5) / gather.widthPx) * source.widthPx),
        Math.floor(((gy + 0.5) / gather.heightPx) * source.heightPx),
      ];
      observedGatherCenterSourceIds.set(center, gatherPixel * 2);
      gatherFarRgba.set([0.6 + gx / 10, 0.2 + gy / 10, 0.1, 1], gatherPixel * 4);
    }
  }
  for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
    const [gx, gy] = observedSelectedGatherIds.slice(pixel * 2, pixel * 2 + 2);
    const centerOffset = (gy * gather.widthPx + gx) * 2;
    observedSelectedCenterSourceIds.set(observedGatherCenterSourceIds.slice(centerOffset, centerOffset + 2), pixel * 2);
  }

  return {
    source,
    gather,
    sourceRgba,
    gatherFarRgba,
    physicalRgba,
    validity,
    observedSelectedGatherIds,
    observedSelectedCenterSourceIds,
    observedGatherCenterSourceIds,
  };
};

describe("Ground Glass Phase H B1 CPU reference", () => {
  it("maps top-origin pixel centers, consumes observed center provenance, and selects the far gather", () => {
    const input = makeInput();
    const destination = 0;
    const result = reconstructGroundGlassB1Reference(input);
    expect([...result.expectedGatherIds.slice(destination * 2, destination * 2 + 2)]).toEqual([0, 0]);
    expect([...result.selectedGatherIds.slice(destination * 2, destination * 2 + 2)]).toEqual([0, 0]);
    expect([...result.selectedCenterSourceIds.slice(destination * 2, destination * 2 + 2)]).toEqual([1, 1]);
    expect([...result.farRgba.slice(destination * 4, destination * 4 + 4)])
      .toEqual([...input.gatherFarRgba.slice(0, 4)]);
    expect(result.eligible[destination]).toBe(1);
    expect(result.selectedPath[destination]).toBe(GROUND_GLASS_B1_SELECTED_PATH.farGather);
    expect(result.fallbackReason[destination]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted);
  });

  it("uses the GPU-observed one-pixel-shifted center instead of a nominal center formula", () => {
    const input = makeInput();
    // For gather [0,0], nominal center is [1,1]; native provenance says [0,1].
    input.observedGatherCenterSourceIds.set([0, 1], 0);
    input.observedSelectedCenterSourceIds.set([0, 1], 0);
    input.validity[1 * source.widthPx + 1] = 4;
    input.physicalRgba[(1 * source.widthPx + 1) * 4] = -1;
    const result = reconstructGroundGlassB1Reference(input);
    expect([...result.selectedCenterSourceIds.slice(0, 2)]).toEqual([0, 1]);
    expect(result.eligible[0]).toBe(1);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted);
  });

  it("reports nominal mapping disagreement while following an eligible GPU-selected center", () => {
    const input = makeInput();
    // Source [0,0] nominally selects [0,0], while native GPU evidence selects [1,0].
    input.observedSelectedGatherIds.set([1, 0], 0);
    // The selected-center pass reports the actual center of observed gather [1,0].
    input.observedSelectedCenterSourceIds.set([3, 1], 0);
    const result = reconstructGroundGlassB1Reference(input);
    expect([...result.expectedGatherIds.slice(0, 2)]).toEqual([0, 0]);
    expect([...result.selectedGatherIds.slice(0, 2)]).toEqual([1, 0]);
    expect(result.nominalMappingMatches[0]).toBe(0);
    expect(result.counts.nominalMappingMismatch).toBe(1);
    expect([...result.selectedCenterSourceIds.slice(0, 2)]).toEqual([3, 1]);
    expect(result.eligible[0]).toBe(1);
    expect(result.selectedPath[0]).toBe(GROUND_GLASS_B1_SELECTED_PATH.farGather);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted);
    expect(reasonName(result.fallbackReason[0])).toBe("far-gather-accepted");
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.gatherFarRgba.slice(4, 8)]);
  });

  it("rejects an in-bounds but mismatched selected-center provenance identity", () => {
    const input = makeInput();
    input.observedSelectedCenterSourceIds.set([0, 1], 0);
    const result = reconstructGroundGlassB1Reference(input);
    expect([...result.selectedCenterSourceIds.slice(0, 2)]).toEqual([0, 1]);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch);
    expect(reasonName(result.fallbackReason[0])).toBe("selected-center-provenance-mismatch");
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);
  });

  it("records swapped X/Y mapping separately when actual selected-center provenance is coherent", () => {
    const input = makeInput();
    const destination = 2 * source.widthPx;
    // Source (0,2) maps to gather (0,1); the axis-swapped identity (1,0) is in bounds.
    input.observedSelectedGatherIds.set([1, 0], destination * 2);
    input.observedSelectedCenterSourceIds.set([3, 1], destination * 2);
    const result = reconstructGroundGlassB1Reference(input);
    expect([...result.expectedGatherIds.slice(destination * 2, destination * 2 + 2)]).toEqual([0, 1]);
    expect(result.nominalMappingMatches[destination]).toBe(0);
    expect(result.fallbackReason[destination]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted);
    expect(result.selectedPath[destination]).toBe(GROUND_GLASS_B1_SELECTED_PATH.farGather);
    expect([...result.farRgba.slice(destination * 4, destination * 4 + 4)])
      .toEqual([...input.gatherFarRgba.slice(4, 8)]);
  });

  it("requires positive far-side CoC and rejects the opposite sign", () => {
    const input = makeInput();
    const selectedCenter = input.observedGatherCenterSourceIds.slice(0, 2);
    const centerIndex = selectedCenter[1]! * source.widthPx + selectedCenter[0]!;
    input.physicalRgba[centerIndex * 4] = -0.8;
    const result = reconstructGroundGlassB1Reference(input);
    expect(result.eligible[0]).toBe(0);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible);
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);
  });

  it("accepts the exact positive binary16 maximum and the largest representable value below it", () => {
    for (const coc of [GROUND_GLASS_B1_MAX_FINITE_HALF, 65472]) {
      const input = makeInput();
      const [centerX, centerY] = input.observedGatherCenterSourceIds.slice(0, 2);
      const centerOffset = (centerY! * source.widthPx + centerX!) * 4;
      input.physicalRgba[centerOffset] = coc;

      const result = reconstructGroundGlassB1Reference(input);
      expect(result.eligible[0], `CoC ${coc} should be binary16-representable and far-side`).toBe(1);
      expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted);
      expect([...result.farRgba.slice(0, 4)]).toEqual([...input.gatherFarRgba.slice(0, 4)]);
    }
  });

  it("keeps negative maximum binary16 CoC representable but not far-eligible", () => {
    const input = makeInput();
    const [centerX, centerY] = input.observedGatherCenterSourceIds.slice(0, 2);
    input.physicalRgba[(centerY! * source.widthPx + centerX!) * 4] = -GROUND_GLASS_B1_MAX_FINITE_HALF;

    const result = reconstructGroundGlassB1Reference(input);
    expect(result.eligible[0]).toBe(0);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible);
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);
  });

  it("rejects out-of-range and non-finite physical CoC while preserving validity-code authority", () => {
    for (const coc of [65505, -65505, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const input = makeInput();
      const [centerX, centerY] = input.observedGatherCenterSourceIds.slice(0, 2);
      input.physicalRgba[(centerY! * source.widthPx + centerX!) * 4] = coc;
      const result = reconstructGroundGlassB1Reference(input);
      expect(result.eligible[0], `CoC ${String(coc)} must fail closed`).toBe(0);
      expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter);
    }

    const unrepresentableM4 = makeInput();
    const [centerX, centerY] = unrepresentableM4.observedGatherCenterSourceIds.slice(0, 2);
    const centerIndex = centerY! * source.widthPx + centerX!;
    unrepresentableM4.physicalRgba[centerIndex * 4] = GROUND_GLASS_B1_MAX_FINITE_HALF;
    unrepresentableM4.validity[centerIndex] = 2;
    const rejected = reconstructGroundGlassB1Reference(unrepresentableM4);
    expect(rejected.eligible[0]).toBe(0);
    expect(rejected.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter);
  });

  it("accepts exact RGBA16F maxima but rejects any unusable required gather channel", () => {
    const maximumGather = makeInput();
    maximumGather.gatherFarRgba.set([
      GROUND_GLASS_B1_MAX_FINITE_HALF,
      -GROUND_GLASS_B1_MAX_FINITE_HALF,
      GROUND_GLASS_B1_MAX_FINITE_HALF,
      GROUND_GLASS_B1_MAX_FINITE_HALF,
    ], 0);
    const accepted = reconstructGroundGlassB1Reference(maximumGather);
    expect(accepted.eligible[0]).toBe(1);
    expect(accepted.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted);

    for (let channel = 0; channel < 4; channel += 1) {
      for (const invalid of [65505, -65505, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const input = makeInput();
        input.gatherFarRgba[channel] = invalid;
        const result = reconstructGroundGlassB1Reference(input);
        expect(result.eligible[0], `channel ${channel}, value ${String(invalid)} must be rejected`).toBe(0);
        expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData);
        expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);
      }
    }
  });

  it("fails closed for validity code 4 rather than treating it as valid near/far data", () => {
    const input = makeInput();
    const [centerX, centerY] = input.observedGatherCenterSourceIds.slice(0, 2);
    input.validity[centerY! * source.widthPx + centerX!] = 4;
    const result = reconstructGroundGlassB1Reference(input);
    expect(result.eligible[0]).toBe(0);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter);
    expect(reasonName(result.fallbackReason[0])).toBe("invalid-or-unresolved-center");
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);
  });

  it("uses only the selected center and does not repair B1 with a neighboring far texel", () => {
    const input = makeInput();
    const destination = 2;
    // Source [2,0] selects gather [1,0]; its left gather neighbor remains far.
    const [selectedCenterX, selectedCenterY] = input.observedSelectedCenterSourceIds.slice(destination * 2, destination * 2 + 2);
    const selectedCenterIndex = selectedCenterY! * source.widthPx + selectedCenterX!;
    input.physicalRgba[selectedCenterIndex * 4] = -1;
    const result = reconstructGroundGlassB1Reference(input);
    expect(result.fallbackReason[destination]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible);
    expect([...result.farRgba.slice(destination * 4, destination * 4 + 4)])
      .toEqual([...input.sourceRgba.slice(destination * 4, destination * 4 + 4)]);
  });

  it("falls back to the exact destination source RGBA when selected gather data is unusable", () => {
    const input = makeInput();
    input.gatherFarRgba[0] = Number.NaN;
    const result = reconstructGroundGlassB1Reference(input);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData);
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);
  });

  it("reports missing and out-of-bounds provenance as source fallback", () => {
    const input = makeInput();
    input.observedSelectedCenterSourceIds.set([-1, 0], 0);
    const result = reconstructGroundGlassB1Reference(input);
    expect(result.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance);
    expect([...result.farRgba.slice(0, 4)]).toEqual([...input.sourceRgba.slice(0, 4)]);

    const outOfBoundsGather = makeInput();
    outOfBoundsGather.observedSelectedGatherIds.set([gather.widthPx, 0], 0);
    const invalidSelection = reconstructGroundGlassB1Reference(outOfBoundsGather);
    expect(invalidSelection.nominalMappingMatches[0]).toBe(0);
    expect(invalidSelection.fallbackReason[0]).toBe(GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance);
    expect([...invalidSelection.farRgba.slice(0, 4)]).toEqual([...outOfBoundsGather.sourceRgba.slice(0, 4)]);
  });

  it("validates structural buffers and source-color fallback integrity", () => {
    const input = makeInput();
    expect(() => reconstructGroundGlassB1Reference({ ...input, validity: new Uint8Array(2) })).toThrow(/buffers/);
    const noFallback = { ...input, sourceRgba: input.sourceRgba.slice() };
    noFallback.sourceRgba[0] = Number.NaN;
    expect(() => reconstructGroundGlassB1Reference(noFallback)).toThrow(/source-color fallback/);
  });

  it("composites the B1 far result with unchanged near RGB and coverage alpha", () => {
    const far = new Float32Array([0, 0, 1, 1, 1, 0, 0, 1]);
    const near = new Float32Array([1, 0, 0, 0.25, 0, 1, 0, 0.75]);
    const before = near.slice();
    const result = compositeGroundGlassB1ResearchReference(
      far, { widthPx: 2, heightPx: 1 }, near, { widthPx: 2, heightPx: 1 },
    );
    expect([...result]).toEqual([0.25, 0, 0.75, 1, 0.25, 0.75, 0, 1]);
    expect(near).toEqual(before);
    expect(() => compositeGroundGlassB1ResearchReference(
      far, { widthPx: 2, heightPx: 1 }, near.slice(0, 4), { widthPx: 2, heightPx: 1 },
    )).toThrow(/dimensions/);
  });

  it("upsamples near coverage to source pixels using the GPU target's nearest filtering", () => {
    const far = new Float32Array([
      0, 0, 1, 1,
      0, 0, 1, 1,
      1, 0, 0, 1,
      1, 0, 0, 1,
    ]);
    const near = new Float32Array([0, 1, 0, 0.5, 1, 1, 0, 0.25]);
    const result = compositeGroundGlassB1ResearchReference(
      far, { widthPx: 2, heightPx: 2 }, near, { widthPx: 1, heightPx: 2 },
    );
    expect([...result]).toEqual([
      0, 0.5, 0.5, 1,
      0, 0.5, 0.5, 1,
      1, 0.25, 0, 1,
      1, 0.25, 0, 1,
    ]);
  });
});
