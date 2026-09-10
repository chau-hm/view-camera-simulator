import { describe, expect, it } from "vitest";
import {
  createFocusDistributionLayout,
  mapFocusDistributionSlotToDisplayPosition,
} from "../../components/simulator/focusDistributionLayout";
import { mapGroundGlassUvToDisplayUv } from "../../render/groundGlassTargetProjection";

const canonicalTargets = [
  "near-left",
  "near-centre",
  "near-right",
  "middle",
  "far-left",
  "far-centre",
  "far-right",
].map((id, index) => ({
  id,
  sharpnessPercent: index * 10,
  status: index === 3 ? "sharp" : "soft",
}));

const rowIds = (row: readonly { target?: { id: string } }[]) =>
  row.map((cell) => cell.target?.id);

describe("focus distribution layout", () => {
  it("keeps the canonical seven targets in their upright spatial positions", () => {
    const layout = createFocusDistributionLayout("oblique-tabletop", canonicalTargets, "upright");

    expect(rowIds(layout.rows[0])).toEqual(["near-left", "near-centre", "near-right"]);
    expect(rowIds(layout.rows[1])).toEqual([undefined, "middle", undefined]);
    expect(rowIds(layout.rows[2])).toEqual(["far-left", "far-centre", "far-right"]);
  });

  it("uses the Ground Glass raw inversion for the displayed spatial positions", () => {
    const layout = createFocusDistributionLayout("oblique-tabletop", canonicalTargets, "raw");

    expect(rowIds(layout.rows[0])).toEqual(["far-right", "far-centre", "far-left"]);
    expect(rowIds(layout.rows[1])).toEqual([undefined, "middle", undefined]);
    expect(rowIds(layout.rows[2])).toEqual(["near-right", "near-centre", "near-left"]);

    const expectedRaw = mapGroundGlassUvToDisplayUv({ u: 0, v: 0 }, "raw");
    expect(mapFocusDistributionSlotToDisplayPosition("near-left", "raw")).toEqual({
      rowIndex: Math.round(expectedRaw.v * 2),
      columnIndex: Math.round(expectedRaw.u * 2),
    });
  });

  it("keeps partial target data sparse and does not fabricate missing positions", () => {
    const layout = createFocusDistributionLayout(
      "oblique-tabletop",
      [canonicalTargets[0], canonicalTargets[3], canonicalTargets[6]],
      "upright",
    );

    expect(rowIds(layout.rows[0])).toEqual(["near-left", undefined, undefined]);
    expect(rowIds(layout.rows[1])).toEqual([undefined, "middle", undefined]);
    expect(rowIds(layout.rows[2])).toEqual([undefined, undefined, "far-right"]);
    expect(layout.unplaced).toHaveLength(0);
  });

  it("keeps an unrecognized target available without assigning it a false position", () => {
    const layout = createFocusDistributionLayout(
      "oblique-tabletop",
      [{ id: "future-target", sharpnessPercent: 42, status: "acceptable" }],
      "upright",
    );

    expect(layout.rows.flat().every((cell) => !cell.target)).toBe(true);
    expect(layout.unplaced.map((target) => target.id)).toEqual(["future-target"]);
  });
});
