import { describe, expect, it } from "vitest";
import {
  getPreferredSubjectGeometryView,
  MOVEMENT_VIEW_EPSILON_DEG,
  type SubjectGeometryView,
} from "../../components/geometry/getPreferredSubjectGeometryView";

const preferredView = (defaultView: SubjectGeometryView, tiltDeg: number, swingDeg: number) =>
  getPreferredSubjectGeometryView({ defaultView, tiltDeg, swingDeg });

describe("getPreferredSubjectGeometryView", () => {
  it.each([
    ["side", "zero movement", 0, 0, "side"],
    ["side", "equal movement", 5, 5, "side"],
    ["side", "floating-point tie", 5, 5 + MOVEMENT_VIEW_EPSILON_DEG / 2, "side"],
    ["side", "tilt dominant", 5, 0, "side"],
    ["side", "swing dominant", 0, 5, "top"],
    ["top", "zero movement", 0, 0, "top"],
    ["top", "equal movement", 5, 5, "top"],
    ["top", "floating-point tie", 5 + MOVEMENT_VIEW_EPSILON_DEG / 2, 5, "top"],
    ["top", "tilt dominant", 5, 0, "side"],
    ["top", "swing dominant", 0, 5, "top"],
  ] as const)("uses the %s default for %s", (defaultView, _label, tiltDeg, swingDeg, expected) => {
    expect(preferredView(defaultView, tiltDeg, swingDeg)).toBe(expected);
  });
});
