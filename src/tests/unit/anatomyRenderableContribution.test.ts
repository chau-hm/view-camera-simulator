import { describe, expect, it } from "vitest";
import {
  anatomyMaskBounds,
  classifyAnatomyMaterialTransparency,
  combineAnatomyMasks,
  compareAnatomyDifferentialResponses,
  compareAnatomyImages,
  complementAnatomyMask,
  countAnatomyMaskPixels,
  deriveAnatomyDifferenceHeatmap,
  deriveAnatomyDifferentialResponseMask,
  deriveAnatomyObservedDifferentialMask,
  excludeAnatomyRenderables,
  findAnatomyTransparentOverlapCandidates,
  hasMixedAnatomyMaterialTransparencySlots,
  isAnatomyRendererGenerationCurrent,
  resolveAnatomyRenderableSelection,
  restoreAnatomyRenderables,
  type AnatomyRenderableSelectionRecord,
} from "../../render/anatomyRenderableContribution";

const opaque = { transparent: false, opacity: 1, alphaTest: 0, hasAlphaMap: false };
const partialOpaquePath = { ...opaque, opacity: 0.25 };
const transparent = { ...opaque, transparent: true, opacity: 0.42 };

const makeRecord = (
  id: string,
  name: string,
  role = "conceptual-camera/front-standard",
  cameraPart: string | null = "front-standard",
  materialSlots = [opaque],
  visible = true,
): AnatomyRenderableSelectionRecord<{ visible: boolean }> => ({
  id,
  name,
  role,
  cameraPart,
  visible,
  materialSlots,
  value: { visible },
});

const image = (pixels: readonly number[], width = 2, height = 1) => ({
  width,
  height,
  channels: 3,
  pixels,
});

describe("Anatomy renderable contribution evidence", () => {
  it("classifies opacity and alpha flags without equating partial opacity with transparent blending", () => {
    expect(classifyAnatomyMaterialTransparency(opaque)).toEqual(["T0"]);
    expect(classifyAnatomyMaterialTransparency(partialOpaquePath)).toEqual(["T0", "T2"]);
    expect(classifyAnatomyMaterialTransparency(transparent)).toEqual(["T1", "T2"]);
    expect(classifyAnatomyMaterialTransparency({
      ...opaque,
      alphaTest: 0.5,
      hasAlphaMap: true,
    })).toEqual(["T0", "T3"]);
  });

  it("detects mixed transparency semantics across material slots", () => {
    expect(hasMixedAnatomyMaterialTransparencySlots([opaque, opaque])).toBe(false);
    expect(hasMixedAnatomyMaterialTransparencySlots([opaque, transparent])).toBe(true);
  });

  it("groups semantic parts and selects duplicate names by unique renderable identity", () => {
    const first = makeRecord("uuid-1", "frame-bar");
    const second = makeRecord("uuid-2", "frame-bar", "conceptual-camera/lens", "lens", [transparent]);
    const records = [first, second];

    const part = resolveAnatomyRenderableSelection(records, {
      kind: "camera-part",
      cameraPart: "lens",
    });
    expect(part.ok && part.records.map((record) => record.id)).toEqual(["uuid-2"]);

    const exact = resolveAnatomyRenderableSelection(records, {
      kind: "renderable-ids",
      renderableIds: ["uuid-2"],
    });
    expect(exact.ok && exact.records.map((record) => record.name)).toEqual(["frame-bar"]);
    expect(exact.ok && exact.records[0]?.id).toBe("uuid-2");
  });

  it("selects explicit transparent materials but excludes partial opacity on the opaque path", () => {
    const records = [
      makeRecord("opaque", "opaque", "conceptual-camera/front-standard", "front-standard", [partialOpaquePath]),
      makeRecord("transparent", "glass", "conceptual-camera/lens", "lens", [transparent]),
    ];
    const result = resolveAnatomyRenderableSelection(records, { kind: "explicit-transparent" });
    expect(result.ok && result.records.map((record) => record.id)).toEqual(["transparent"]);
  });

  it("supports role grouping and dimmed-part selection", () => {
    const records = [
      makeRecord("front", "front", "conceptual-camera/front-standard", "front-standard"),
      makeRecord("lens", "lens", "conceptual-camera/lens", "lens"),
      makeRecord("target", "target", "registered-target-subject", null),
    ];
    const conceptual = resolveAnatomyRenderableSelection(records, { kind: "conceptual-camera" });
    const dimmed = resolveAnatomyRenderableSelection(records, {
      kind: "dimmed-camera-parts",
      selectedCameraParts: ["front-standard"],
    });
    expect(conceptual.ok && conceptual.records.map((record) => record.id)).toEqual(["front", "lens"]);
    expect(dimmed.ok && dimmed.records.map((record) => record.id)).toEqual(["lens"]);
  });

  it("fails closed for empty, ambiguous, stale, or malformed selections", () => {
    const records = [makeRecord("one", "same"), makeRecord("two", "same")];
    expect(resolveAnatomyRenderableSelection(records, { kind: "renderable-ids", renderableIds: [] }))
      .toEqual({ ok: false, reason: "empty-selection" });
    expect(resolveAnatomyRenderableSelection(records, { kind: "renderable-ids", renderableIds: ["missing"] }))
      .toEqual({ ok: false, reason: "stale-renderable-id" });
    expect(resolveAnatomyRenderableSelection(records, { kind: "renderable-ids", renderableIds: ["one", "one"] }))
      .toEqual({ ok: false, reason: "duplicate-renderable-id" });
    expect(resolveAnatomyRenderableSelection([records[0]!, records[0]!], { kind: "all-renderables" }))
      .toEqual({ ok: false, reason: "duplicate-renderable-id" });
    expect(resolveAnatomyRenderableSelection(records, { kind: "semantic-role", role: "  " }))
      .toEqual({ ok: false, reason: "invalid-selector" });
    expect(resolveAnatomyRenderableSelection(records, { kind: "semantic-role", role: "unmatched" }))
      .toEqual({ ok: false, reason: "empty-selection" });
  });

  it("restores each renderable's exact original local visibility", () => {
    const visible = { visible: true };
    const hidden = { visible: false };
    const snapshots = excludeAnatomyRenderables([
      { id: "visible", value: visible },
      { id: "hidden", value: hidden },
    ]);
    expect([visible.visible, hidden.visible]).toEqual([false, false]);
    restoreAnatomyRenderables(snapshots);
    expect([visible.visible, hidden.visible]).toEqual([true, false]);
    expect(() => excludeAnatomyRenderables([])).toThrow("empty Anatomy renderable selection");
  });

  it("rejects old renderer generations without treating equality as a new mount", () => {
    expect(isAnatomyRendererGenerationCurrent(4, 4)).toBe(true);
    expect(isAnatomyRendererGenerationCurrent(3, 4)).toBe(false);
    expect(isAnatomyRendererGenerationCurrent(Number.NaN, 4)).toBe(false);
  });

  it("reports projected overlap candidates without claiming exact silhouette intersection", () => {
    const overlap = findAnatomyTransparentOverlapCandidates([
      { id: "glass-a", visible: true, materialSlots: [transparent], projectedBounds: { left: 0.1, top: 0.1, right: 0.5, bottom: 0.5 } },
      { id: "glass-b", visible: true, materialSlots: [transparent], projectedBounds: { left: 0.4, top: 0.2, right: 0.8, bottom: 0.6 } },
      { id: "opaque", visible: true, materialSlots: [opaque], projectedBounds: { left: 0, top: 0, right: 1, bottom: 1 } },
    ]);
    expect(overlap).toHaveLength(1);
    expect(overlap[0]).toMatchObject({
      firstId: "glass-a",
      secondId: "glass-b",
      projectedIntersection: { left: 0.4, top: 0.2, right: 0.5, bottom: 0.5 },
    });
    expect(overlap[0]?.intersectionArea).toBeCloseTo(0.03);
  });

  it("creates measurable masks from different images and permits zero only for independent identical images", () => {
    const first = image([10, 20, 30, 40, 50, 60]);
    const same = image([10, 20, 30, 40, 50, 60]);
    const changed = image([10, 20, 30, 90, 50, 60]);
    const changedMask = deriveAnatomyObservedDifferentialMask(first, changed, 8);
    const sameMask = deriveAnatomyObservedDifferentialMask(first, same, 8);

    expect(countAnatomyMaskPixels(changedMask)).toBe(1);
    expect(anatomyMaskBounds(changedMask)).toEqual({ left: 1, top: 0, right: 2, bottom: 1 });
    expect(compareAnatomyImages(first, changed).meanAbsoluteRgbDifference).toBeGreaterThan(0);
    expect(compareAnatomyImages(first, changed).changedPixelCount).toBe(1);
    expect(compareAnatomyImages(first, same)).toMatchObject({
      meanAbsoluteRgbDifference: 0,
      changedPixelCount: 0,
      changedPixelFraction: 0,
    });
    expect(countAnatomyMaskPixels(sameMask)).toBe(0);
  });

  it("creates a reproducible per-pixel RGB difference heatmap and rejects incompatible frames", () => {
    const first = image([10, 20, 30, 40, 50, 60]);
    const changed = image([10, 20, 30, 90, 50, 60]);

    expect(deriveAnatomyDifferenceHeatmap(first, first)).toMatchObject({
      width: 2,
      height: 1,
      channels: 4,
      pixels: new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]),
    });
    expect(deriveAnatomyDifferenceHeatmap(first, changed).pixels).toEqual(
      new Uint8Array([0, 0, 0, 255, 50, 50, 50, 255]),
    );
    expect(() => deriveAnatomyDifferenceHeatmap(first, image([0, 0, 0], 1, 1)))
      .toThrow("incompatible dimensions or channels");
  });

  it("keeps foreground and background masks disjoint and reports mask sample counts", () => {
    const foreground = deriveAnatomyObservedDifferentialMask(
      image([10, 20, 30, 40, 50, 60]),
      image([10, 20, 30, 40, 50, 60]),
    );
    const background = complementAnatomyMask(foreground);
    const overlap = combineAnatomyMasks(foreground, background, "intersection");
    const union = combineAnatomyMasks(foreground, background, "union");
    expect(countAnatomyMaskPixels(overlap)).toBe(0);
    expect(countAnatomyMaskPixels(union)).toBe(2);
    expect(compareAnatomyImages(image([10, 20, 30, 40, 50, 60]), image([20, 20, 30, 40, 50, 60]), background))
      .toMatchObject({ sampleCount: 2, meanAbsoluteRgbDifference: 10 / 6 });
  });

  it("measures signed cross-renderer response differences for controlled exclusions", () => {
    const referenceFull = image([100, 100, 100, 100, 100, 100]);
    const referenceExcluded = image([40, 40, 40, 100, 100, 100]);
    const candidateFull = image([100, 100, 100, 100, 100, 100]);
    const candidateExcluded = image([70, 70, 70, 100, 100, 100]);
    const response = compareAnatomyDifferentialResponses(
      referenceFull,
      referenceExcluded,
      candidateFull,
      candidateExcluded,
    );
    expect(response.sampleCount).toBe(2);
    expect(response.meanAbsoluteRgbDifference).toBe(15);
    expect(response.perChannelMeanAbsoluteDifference).toEqual([15, 15, 15]);
    expect(response.meanSignedLuminanceDifference).toBeCloseTo(15);
    expect(countAnatomyMaskPixels(deriveAnatomyDifferentialResponseMask(
      referenceFull,
      referenceExcluded,
      candidateFull,
      candidateExcluded,
    ))).toBe(1);
    expect(countAnatomyMaskPixels(deriveAnatomyDifferentialResponseMask(
      referenceFull,
      referenceExcluded,
      referenceFull,
      referenceExcluded,
    ))).toBe(0);
  });

  it("rejects missing, incompatible, or zero-area evidence rather than returning zero metrics", () => {
    const first = image([10, 20, 30, 40, 50, 60]);
    expect(() => compareAnatomyImages(first, image([10, 20, 30], 1, 1))).toThrow("incompatible dimensions");
    expect(() => compareAnatomyImages(first, { ...first, pixels: [1] })).toThrow("incomplete");
    expect(() => compareAnatomyImages(first, first, { width: 2, height: 1, pixels: new Uint8Array(2) }))
      .toThrow("empty mask");
    expect(() => compareAnatomyImages(first, first, { width: 1, height: 2, pixels: new Uint8Array([1, 1]) }))
      .toThrow("mask dimensions");
  });
});
