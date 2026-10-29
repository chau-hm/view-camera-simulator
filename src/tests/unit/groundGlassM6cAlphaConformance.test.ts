import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M6C_ALPHA_GATE_REVISION,
  GROUND_GLASS_M6C_MAX_ALPHA_ERROR,
  evaluateGroundGlassM6cAlphaConformance,
  isGroundGlassM6cBuildAuthorized,
  isGroundGlassM6cMaterialEquivalent,
  isGroundGlassM6cReadbackCurrent,
  isGroundGlassM6cTargetLifecycleComplete,
  type GroundGlassM6cAlphaSampleInput,
  type GroundGlassM6cReadbackIdentity,
} from "../../render/groundGlassM6cAlphaConformance";
import {
  GROUND_GLASS_M6C_ALPHA_MATRIX,
  createGroundGlassM6bCalibrationSource,
} from "../../render/groundGlassPhysicalOverlayConformance";

const identity: GroundGlassM6cReadbackIdentity = {
  requestId: "request-1",
  channelId: "channel-1",
  sceneId: "architecture-rise",
  rendererGenerationId: "generation-1",
  sourceDataFingerprint: "source-1",
  presentationStateFingerprint: "presentation-1",
  targetWidthPx: 512,
  targetHeightPx: 512,
  previewMode: "upright",
  inspectionWindow: { active: false, centerU: 0.5, centerV: 0.5, widthFraction: 1, heightFraction: 1 },
};

const bytes = (rgba: readonly number[]): readonly [number, number, number, number] =>
  rgba.map((value) => Math.max(0, Math.min(255, Math.round(value * 255)))) as [number, number, number, number];

const makeSample = (
  id: string,
  sourceRgba: readonly [number, number, number, number],
  actualRgba = sourceRgba,
  overrides: Partial<GroundGlassM6cAlphaSampleInput> = {},
): GroundGlassM6cAlphaSampleInput => ({
  id,
  sourceTexel: { x: 42, y: 84 },
  sourceUvTopOrigin: { u: 42.5 / 512, v: 84.5 / 512 },
  displayUvTopOrigin: { u: 0.4, v: 0.2 },
  sourceLinearRgba: sourceRgba,
  expectedFragmentRgba: sourceRgba,
  actualTargetBytes: bytes(actualRgba),
  sourceSampleIdentityMatches: true,
  materialEquivalent: true,
  ...overrides,
});

const evaluate = (samples: readonly GroundGlassM6cAlphaSampleInput[]) =>
  evaluateGroundGlassM6cAlphaConformance({
    status: "measured",
    identityCurrent: true,
    expectedSampleIds: samples.map((sample) => sample.id),
    samples,
  });

describe("M6C alpha conformance contract", () => {
  it("uses the fixed RGBA8 gate and source matrix including zero, partial, and opaque alpha", () => {
    expect(GROUND_GLASS_M6C_ALPHA_GATE_REVISION).toBe("m6c-alpha-rgba8-r1");
    expect(GROUND_GLASS_M6C_MAX_ALPHA_ERROR).toBeCloseTo(2 / 255, 12);
    expect(GROUND_GLASS_M6C_ALPHA_MATRIX.map(({ id }) => id)).toHaveLength(15);
    expect(GROUND_GLASS_M6C_ALPHA_MATRIX.slice(0, 8).map(({ rgba }) => rgba[3])).toEqual([
      0, 0.01, 0.25, 0.35, 0.5, 0.75, 0.99, 1,
    ]);
    const source = createGroundGlassM6bCalibrationSource({ includeAlphaMatrix: true, previewMode: "raw" });
    expect(source.alphaSamples).toHaveLength(15);
    expect(source.alphaSamples.every((sample) => {
      const offset = (sample.sourceTexelPx.y * source.widthPx + sample.sourceTexelPx.x) * 4;
      return [0, 1, 2, 3].every((channel) => source.rgba[offset + channel] === sample.linearRgba[channel]);
    })).toBe(true);
    expect(createGroundGlassM6bCalibrationSource().alphaSamples).toHaveLength(0);
  });

  it("passes a complete, independent source-alpha and RGB observation matrix", () => {
    const samples = [
      makeSample("zero", [0.6, 0.3, 0.1, 0]),
      makeSample("partial", [0.9, 0.2, 0.05, 0.35]),
      makeSample("opaque", [0.05, 0.4, 0.95, 1]),
    ];
    const result = evaluate(samples);
    expect(result.status).toBe("measured");
    expect(result.alphaDecision).toBe("alpha-preservation-conformant");
    expect(result.rgbDecision).toBe("rgb-regression-passed");
    expect(result.maximumAlphaError).toBeLessThanOrEqual(2 / 255);
    expect(result.supportedSampleCount).toBe(3);
    expect(result.unavailableSampleCount).toBe(0);
  });

  it("rejects alpha forcibly set to one or zero", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const forcedOne = evaluate([makeSample("partial", source, [0.2, 0.4, 0.6, 1])]);
    const forcedZero = evaluate([makeSample("partial", source, [0.2, 0.4, 0.6, 0])]);
    expect(forcedOne.alphaDecision).toBe("alpha-observable-contract-different");
    expect(forcedZero.alphaDecision).toBe("alpha-failed");
    expect(forcedOne.maximumAlphaError).toBeGreaterThan(2 / 255);
    expect(forcedZero.maximumAlphaError).toBeGreaterThan(2 / 255);
  });

  it.each([
    { label: "throughput", gain: 0.5 },
    { label: "natural illumination", gain: 0.64 },
    { label: "coverage", gain: 0 },
  ])("rejects alpha multiplied by $label", ({ gain }) => {
    const source = [0.4, 0.2, 0.1, 0.75] as const;
    const result = evaluate([makeSample("alpha", source, [0.4, 0.2, 0.1, source[3] * gain])]);
    expect(result.alphaDecision).toBe("alpha-failed");
  });

  it("does not let an altered CPU expectation redefine the source-alpha contract", () => {
    const source = [0.4, 0.2, 0.1, 0.75] as const;
    const alteredReference = makeSample("mutated-reference-alpha", source, [0.4, 0.2, 0.1, 0.375], {
      expectedFragmentRgba: [0.4, 0.2, 0.1, 0.375],
    });
    const result = evaluate([alteredReference]);
    expect(result.status).toBe("failed");
    expect(result.failedConditions).toContain("reference-alpha-contract-mismatch");
  });

  it("detects premultiplication, unpremultiplication, channel swaps, inversion, and ignored source alpha", () => {
    const source = [0.8, 0.2, 0.1, 0.5] as const;
    const premultiplied = evaluate([makeSample("premultiplied-rgb", source, [0.4, 0.1, 0.05, 0.5])]);
    const straightTreatedAsPremultiplied = evaluate([makeSample("straight-as-premultiplied", [0.4, 0.1, 0.05, 0.5], [0.8, 0.2, 0.1, 0.5])]);
    const swapped = evaluate([makeSample("channel-swap", source, [0.5, 0.8, 0.2, 0.1])]);
    const inverted = evaluate([makeSample("inverted", [0.8, 0.2, 0.1, 0.25], [0.8, 0.2, 0.1, 0.75])]);
    const ignored = evaluate([makeSample("ignored-upload-alpha", source, [0.8, 0.2, 0.1, 1], {
      sourceSampleIdentityMatches: false,
    })]);
    expect(premultiplied.rgbDecision).toBe("rgb-regression-failed");
    expect(straightTreatedAsPremultiplied.rgbDecision).toBe("rgb-regression-failed");
    expect(swapped.failedConditions).toContain("alpha-preservation-limit-exceeded");
    expect(inverted.alphaDecision).toBe("alpha-failed");
    expect(ignored.failedConditions).toContain("source-sample-identity-mismatch");
  });

  it("fails closed when clear-alpha contamination changes stored alpha", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const result = evaluate([makeSample("clear-contaminated", source, [0.2, 0.4, 0.6, 1])]);
    expect(result.status).toBe("failed");
    expect(result.alphaDecision).toBe("alpha-observable-contract-different");
    expect(result.maximumAlphaError).toBeGreaterThan(0.6);
  });

  it("treats readback bytes as RGBA8 codes and rejects wrong normalization or channel order", () => {
    const source = [0.25, 0.5, 0.75, 0.35] as const;
    const correct = makeSample("rgba8", source);
    const wrongOrder = makeSample("wrong-order", source, [0.35, 0.25, 0.5, 0.75]);
    const bytesTreatedAsFloats = makeSample("wrong-normalization", source, [1 / 255, 1 / 255, 1 / 255, 1 / 255]);
    expect(evaluate([correct]).status).toBe("measured");
    expect(evaluate([wrongOrder]).status).toBe("failed");
    expect(evaluate([bytesTreatedAsFloats]).alphaDecision).toBe("alpha-failed");
  });

  it("rejects one-texel identity mutations and material-state substitutions", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const shiftedTexel = evaluate([makeSample("shifted", source, source, { sourceSampleIdentityMatches: false })]);
    const alternateMaterial = evaluate([makeSample("alternate", source, source, { materialEquivalent: false })]);
    expect(shiftedTexel.failedConditions).toContain("source-sample-identity-mismatch");
    expect(alternateMaterial.failedConditions).toContain("presentation-material-equivalence-failed");
  });

  it("fails closed when material-equivalence evidence is absent", () => {
    const { materialEquivalent, ...withoutMaterialEvidence } =
      makeSample("missing-material-evidence", [0.2, 0.4, 0.6, 0.35]);
    expect(materialEquivalent).toBe(true);
    const result = evaluate([withoutMaterialEvidence as unknown as GroundGlassM6cAlphaSampleInput]);
    expect(result.status).toBe("failed");
    expect(result.failedConditions).toContain("presentation-material-equivalence-failed");
  });

  it("rejects incomplete, duplicate, nonfinite, and unavailable observations", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    expect(evaluateGroundGlassM6cAlphaConformance({
      status: "measured", identityCurrent: true, expectedSampleIds: ["a", "b"], samples: [makeSample("a", source)],
    }).alphaDecision).toBe("alpha-failed");
    expect(evaluate([makeSample("a", source), makeSample("a", source)]).failedConditions).toContain("duplicate-sample-id");
    expect(evaluate([makeSample("nan", source, [0.2, 0.4, Number.NaN, 0.35])]).status).toBe("failed");
    const unsupported = evaluateGroundGlassM6cAlphaConformance({
      status: "unsupported", identityCurrent: true, expectedSampleIds: ["a"], samples: [],
    });
    expect(unsupported.status).toBe("unsupported");
    expect(unsupported.maximumAlphaError).toBeNull();
    expect(unsupported.unavailableSampleCount).toBe(1);
  });

  it("rejects a nonfinite expected stored-alpha metric", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const result = evaluateGroundGlassM6cAlphaConformance({
      status: "measured",
      identityCurrent: true,
      expectedSampleIds: ["sample"],
      samples: [makeSample("sample", source)],
      expectedStoredAlpha: () => Number.NaN,
    });
    expect(result.status).toBe("failed");
    expect(result.alphaDecision).toBe("alpha-failed");
    expect(result.maximumAlphaError).toBeNull();
    expect(result.failedConditions).toContain("invalid-expected-stored-alpha");
  });

  it("keeps alpha and RGB decisions independent so alpha cannot hide an RGB regression", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const result = evaluate([makeSample("rgb-mutated", source, [0.9, 0.1, 0.2, 0.35])]);
    expect(result.alphaDecision).toBe("alpha-preservation-conformant");
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.status).toBe("failed");
  });

  it("binds evidence freshness to request, channel, scene, generation, fingerprints, size, preview, and crop", () => {
    expect(isGroundGlassM6cReadbackCurrent(identity, { ...identity })).toBe(true);
    const staleVariants: readonly GroundGlassM6cReadbackIdentity[] = [
      { ...identity, requestId: "request-2" },
      { ...identity, channelId: "channel-2" },
      { ...identity, sceneId: "other-scene" },
      { ...identity, rendererGenerationId: "generation-2" },
      { ...identity, sourceDataFingerprint: "source-2" },
      { ...identity, presentationStateFingerprint: "presentation-2" },
      { ...identity, targetWidthPx: 640 },
      { ...identity, targetHeightPx: 480 },
      { ...identity, previewMode: "raw" },
      { ...identity, inspectionWindow: { ...identity.inspectionWindow, active: true } },
    ];
    expect(staleVariants.every((candidate) => !isGroundGlassM6cReadbackCurrent(identity, candidate))).toBe(true);
  });

  it("requires every development, feature-flag, fixture, and scene gate", () => {
    const all = {
      developmentBuild: true,
      rawPilotFlag: true,
      m6PresentationFlag: true,
      testSeamFlag: true,
      explicitFixtureControl: true,
      exactRegisteredScene: true,
    };
    expect(isGroundGlassM6cBuildAuthorized(all)).toBe(true);
    for (const key of Object.keys(all) as (keyof typeof all)[]) {
      expect(isGroundGlassM6cBuildAuthorized({ ...all, [key]: false })).toBe(false);
    }
  });

  it("requires exact actual M6 material equivalence and confirms owned-target cleanup", () => {
    const material = {
      samePresentationMaterialInstance: true,
      transparent: false,
      opacity: 1,
      blending: "normal" as const,
      alphaTest: 0,
      premultipliedAlpha: false,
      colorWrite: true,
    };
    expect(isGroundGlassM6cMaterialEquivalent(material)).toBe(true);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, transparent: true })).toBe(false);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, samePresentationMaterialInstance: false })).toBe(false);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, blending: "none" })).toBe(false);
    expect(isGroundGlassM6cTargetLifecycleComplete({
      allocated: true, disposed: true, previousRenderTargetRestored: true, outstandingCaptureCount: 0,
    })).toBe(true);
    expect(isGroundGlassM6cTargetLifecycleComplete({
      allocated: true, disposed: false, previousRenderTargetRestored: true, outstandingCaptureCount: 0,
    })).toBe(false);
  });
});
