import { describe, expect, it } from "vitest";
import {
  getPreferredSubjectGeometryView,
  MOVEMENT_VIEW_EPSILON_DEG,
} from "../../components/geometry/getPreferredSubjectGeometryView";

const preferredView = (sceneId: string, tiltDeg: number, swingDeg: number) =>
  getPreferredSubjectGeometryView({ sceneId, tiltDeg, swingDeg });

describe("getPreferredSubjectGeometryView", () => {
  it.each([
    ["tilt dominant", 5, 0, "side"],
    ["swing dominant", 0, 5, "top"],
    ["zero movement", 0, 0, "side"],
    ["equal movement", 5, 5, "side"],
    ["floating-point tie", 5, 5 + MOVEMENT_VIEW_EPSILON_DEG / 2, "side"],
  ] as const)("uses the Table Tilt default for %s", (_label, tiltDeg, swingDeg, expected) => {
    expect(preferredView("table-tilt", tiltDeg, swingDeg)).toBe(expected);
  });

  it.each([
    ["swing dominant", 0, 5, "top"],
    ["tilt dominant", 5, 0, "side"],
    ["zero movement", 0, 0, "top"],
    ["equal movement", 5, 5, "top"],
    ["floating-point tie", 5 + MOVEMENT_VIEW_EPSILON_DEG / 2, 5, "top"],
  ] as const)("uses the Shelf Swing default for %s", (_label, tiltDeg, swingDeg, expected) => {
    expect(preferredView("shelf-swing", tiltDeg, swingDeg)).toBe(expected);
  });

  it.each([
    ["architecture-rise", "side"],
    ["focus-fundamentals-two-targets", "side"],
    ["unknown-scene", "side"],
  ] as const)("uses the expected zero-movement default for %s", (sceneId, expected) => {
    expect(preferredView(sceneId, 0, 0)).toBe(expected);
  });
});
