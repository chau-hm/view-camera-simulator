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

const evaluate = (
  samples: readonly GroundGlassM6cAlphaSampleInput[],
  expectedSampleIds: readonly string[] = samples.map((sample) => sample.id),
  expectedStoredAlpha?: (sample: GroundGlassM6cAlphaSampleInput) => number,
) =>
  evaluateGroundGlassM6cAlphaConformance({
    status: "measured",
    identityCurrent: true,
    expectedSampleIds,
    samples,
    ...(expectedStoredAlpha ? { expectedStoredAlpha } : {}),
  });

describe("M6C alpha conformance contract", () => {
  it("uses the fixed RGBA8 gate and source matrix including zero, partial, and opaque alpha", () => {
    expect(GROUND_GLASS_M6C_ALPHA_GATE_REVISION).toBe("m6c-alpha-rgba8-r2");
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
    const forcedOne = evaluate([makeSample("partial", source, [0.2, 0.4, 0.6, 1])], undefined, () => 1);
    const forcedZero = evaluate([makeSample("partial", source, [0.2, 0.4, 0.6, 0])]);
    expect(forcedOne.alphaDecision).toBe("alpha-observable-contract-different");
    expect(forcedZero.alphaDecision).toBe("alpha-failed");
    expect(forcedOne.maximumAlphaError).toBe(0);
    expect(forcedOne.maximumSourceAlphaPreservationError).toBeGreaterThan(2 / 255);
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

  it("separates an observed opaque material output from source-alpha preservation", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const result = evaluate([makeSample("opaque-material-output", source, [0.2, 0.4, 0.6, 1])], undefined, () => 1);
    expect(result.status).toBe("failed");
    expect(result.alphaDecision).toBe("alpha-observable-contract-different");
    expect(result.maximumAlphaError).toBe(0);
    expect(result.maximumSourceAlphaPreservationError).toBeGreaterThan(0.6);
    expect(result.rgbDecision).toBe("rgb-regression-passed");
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

  it("fails RGB qualification for a missing required sample even when measured RGB error is zero", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const result = evaluate([makeSample("a", source)], ["a", "b"]);
    expect(result.maximumRgbError).toBe(0);
    expect(result.rgbRmse).toBe(0);
    expect(result.supportedSampleCount).toBe(1);
    expect(result.unavailableSampleCount).toBe(1);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("missing-sample");
    expect(result.failedConditions).toContain("rgb-evidence-incomplete-or-invalid");
  });

  it("rejects duplicate actual sample IDs without discarding their measured RGB diagnostic", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const result = evaluate([makeSample("a", source), makeSample("a", source)], ["a"]);
    expect(result.maximumRgbError).toBe(0);
    expect(result.supportedSampleCount).toBe(2);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("duplicate-sample-id");
  });

  it("rejects duplicate expected IDs rather than counting one observation twice", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const result = evaluate([makeSample("a", source)], ["a", "a"]);
    expect(result.maximumRgbError).toBe(0);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("duplicate-expected-sample-id");
    expect(result.invalidComparisonCount).toBeGreaterThan(0);
  });

  it("rejects an empty expected sample inventory", () => {
    const result = evaluate([], []);
    expect(result.maximumRgbError).toBeNull();
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("empty-expected-sample-inventory");
  });

  it("rejects unexpected sample IDs", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const result = evaluate([makeSample("unexpected", source)], ["a"]);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("unexpected-sample-id");
    expect(result.failedConditions).toContain("missing-sample");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects nonfinite source RGB input %s while preserving an unqualified result",
    (invalidChannel) => {
      const invalidSource = [invalidChannel, 0.4, 0.6, 1] as const;
      const result = evaluate([makeSample("invalid-source", invalidSource, [0.2, 0.4, 0.6, 1])]);
      expect(result.rgbDecision).toBe("rgb-regression-failed");
      expect(result.failedConditions).toContain("invalid-sample-value");
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects nonfinite expected RGB input %s",
    (invalidChannel) => {
      const source = [0.2, 0.4, 0.6, 1] as const;
      const result = evaluate([makeSample("invalid-reference", source, source, {
        expectedFragmentRgba: [invalidChannel, 0.4, 0.6, 1],
      })]);
      expect(result.rgbDecision).toBe("rgb-regression-failed");
      expect(result.failedConditions).toContain("invalid-sample-value");
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 256, -1, 1.5])(
    "rejects invalid target byte %s",
    (invalidByte) => {
      const source = [0.2, 0.4, 0.6, 1] as const;
      const result = evaluate([makeSample("invalid-target", source, source, {
        actualTargetBytes: [invalidByte, 102, 153, 255],
      })]);
      expect(result.rgbDecision).toBe("rgb-regression-failed");
      expect(result.failedConditions).toContain("invalid-sample-value");
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 1.01])(
    "rejects invalid expected stored alpha %s",
    (invalidAlpha) => {
      const source = [0.2, 0.4, 0.6, 1] as const;
      const result = evaluate([makeSample("invalid-alpha-expectation", source)], ["invalid-alpha-expectation"], () => invalidAlpha);
      expect(result.maximumRgbError).toBe(0);
      expect(result.rgbDecision).toBe("rgb-regression-failed");
      expect(result.failedConditions).toContain("invalid-expected-stored-alpha");
    },
  );

  it("rejects a source sample identity mismatch while retaining the numerical RGB error", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const result = evaluate([makeSample("wrong-texel", source, source, { sourceSampleIdentityMatches: false })]);
    expect(result.maximumRgbError).toBe(0);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("source-sample-identity-mismatch");
  });

  it("rejects substituted presentation material evidence while retaining RGB diagnostics", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const result = evaluate([makeSample("substituted-material", source, source, { materialEquivalent: false })]);
    expect(result.maximumRgbError).toBe(0);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("presentation-material-equivalence-failed");
  });

  it("rejects missing material-equivalence evidence", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const { materialEquivalent: _materialEquivalent, ...withoutMaterialEvidence } = makeSample("no-material", source);
    expect(_materialEquivalent).toBe(true);
    const result = evaluate([withoutMaterialEvidence as unknown as GroundGlassM6cAlphaSampleInput]);
    expect(result.maximumRgbError).toBe(0);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("presentation-material-equivalence-failed");
  });

  it("rejects nonfinite or invalid sample coordinates", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const invalidTexel = makeSample("invalid-texel", source, source, { sourceTexel: { x: Number.NaN, y: 4 } });
    const invalidUv = makeSample("invalid-uv", source, source, { displayUvTopOrigin: { u: Number.POSITIVE_INFINITY, v: 0.4 } });
    for (const result of [evaluate([invalidTexel]), evaluate([invalidUv])]) {
      expect(result.rgbDecision).toBe("rgb-regression-failed");
      expect(result.failedConditions).toContain("invalid-sample-value");
    }
  });

  it("fails RGB above the fixed threshold and passes exactly at the threshold", () => {
    const source = [0.5, 0.5, 0.5, 1] as const;
    const expectedByte = Math.round(0.5 * 255);
    const above = evaluate([makeSample("rgb-above-limit", source, source, {
      actualTargetBytes: [expectedByte + 5, expectedByte, expectedByte, 255],
    })]);
    const boundary = evaluate([makeSample("rgb-at-limit", source, source, {
      actualTargetBytes: [expectedByte + 4, expectedByte, expectedByte, 255],
    })]);
    expect(above.maximumRgbError).toBeGreaterThan(4 / 255);
    expect(above.rgbDecision).toBe("rgb-regression-failed");
    expect(boundary.maximumRgbError).toBe(4 / 255);
    expect(boundary.rgbDecision).toBe("rgb-regression-passed");
  });

  it("allows independently valid RGB when the declared source-alpha preservation contract differs", () => {
    const source = [0.2, 0.4, 0.6, 0.35] as const;
    const result = evaluate([makeSample("opaque-output", source, [0.2, 0.4, 0.6, 1])], undefined, () => 1);
    expect(result.status).toBe("failed");
    expect(result.alphaDecision).toBe("alpha-observable-contract-different");
    expect(result.maximumSourceAlphaPreservationError).toBeGreaterThan(0.6);
    expect(result.maximumRgbError).toBe(0);
    expect(result.rgbDecision).toBe("rgb-regression-passed");
  });

  it("does not promote RGB when measured target alpha violates its valid storage expectation", () => {
    const source = [0.5, 0.4, 0.6, 0.35] as const;
    const result = evaluate([makeSample("wrong-stored-alpha", source, [0.5, 0.4, 0.6, 128 / 255])], undefined, () => 1);
    expect(result.maximumRgbError).toBe(0);
    expect(result.maximumAlphaError).toBeGreaterThan(2 / 255);
    expect(result.rgbDecision).toBe("rgb-regression-failed");
    expect(result.failedConditions).toContain("target-storage-evidence-invalid");
  });

  it("keeps RGB passing across a complete opaque target matrix with varied source alpha", () => {
    const samples = [0, 0.35, 1].map((alpha, index) => {
      const source = [0.2, 0.4, 0.6, alpha] as const;
      return makeSample(`opaque-${index}`, source, [0.2, 0.4, 0.6, 1]);
    });
    const result = evaluate(samples, samples.map(({ id }) => id), () => 1);
    expect(result.alphaDecision).toBe("alpha-observable-contract-different");
    expect(result.maximumSourceAlphaPreservationError).toBe(1);
    expect(result.rgbDecision).toBe("rgb-regression-passed");
  });

  it("rejects unsupported, stale-status, and no-longer-current captures for RGB qualification", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const sample = makeSample("a", source);
    const unsupported = evaluateGroundGlassM6cAlphaConformance({
      status: "unsupported", identityCurrent: true, expectedSampleIds: ["a"], samples: [sample],
    });
    const staleStatus = evaluateGroundGlassM6cAlphaConformance({
      status: "stale", identityCurrent: true, expectedSampleIds: ["a"], samples: [sample],
    });
    const retiredIdentity = evaluateGroundGlassM6cAlphaConformance({
      status: "measured", identityCurrent: false, expectedSampleIds: ["a"], samples: [sample],
    });
    for (const result of [unsupported, staleStatus, retiredIdentity]) {
      expect(result.rgbDecision).toBe("rgb-regression-failed");
      expect(result.maximumRgbError).toBeNull();
    }
    expect(unsupported.status).toBe("unsupported");
    expect(staleStatus.status).toBe("stale");
    expect(retiredIdentity.status).toBe("stale");
  });

  it("reproduces the reviewed false-positive case using the real evaluator", () => {
    const source = [0.2, 0.4, 0.6, 1] as const;
    const reviewedFalsePositive = evaluate([makeSample("a", source)], ["a", "b"]);
    expect(reviewedFalsePositive.maximumRgbError).toBe(0);
    expect(reviewedFalsePositive.rgbDecision).toBe("rgb-regression-failed");
    expect(reviewedFalsePositive.unavailableSampleCount).toBe(1);
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
      toneMapped: false,
    };
    expect(isGroundGlassM6cMaterialEquivalent(material)).toBe(true);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, transparent: true })).toBe(false);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, samePresentationMaterialInstance: false })).toBe(false);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, blending: "none" })).toBe(false);
    expect(isGroundGlassM6cMaterialEquivalent({ ...material, toneMapped: true })).toBe(false);
    expect(isGroundGlassM6cTargetLifecycleComplete({
      allocated: true, disposed: true, previousRenderTargetRestored: true, outstandingCaptureCount: 0,
    })).toBe(true);
    expect(isGroundGlassM6cTargetLifecycleComplete({
      allocated: true, disposed: false, previousRenderTargetRestored: true, outstandingCaptureCount: 0,
    })).toBe(false);
  });
});
