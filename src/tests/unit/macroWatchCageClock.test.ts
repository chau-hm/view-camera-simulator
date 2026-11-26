import { describe, expect, it } from "vitest";
import { CAGE_REVOLUTION_SECONDS } from "../../render/assets/tourbillon-watch/watch.mjs";
import {
  getMacroWatchCageAngle,
  macroWatchCageAngleAt,
  shouldFreezeMacroWatchCageForCapture,
} from "../../render/macroWatchCageClock";

describe("Macro Bellows tourbillon cage clock", () => {
  it("freezes only an explicit development capture query", () => {
    expect(shouldFreezeMacroWatchCageForCapture("?macroWatchCage=static", true)).toBe(true);
    expect(shouldFreezeMacroWatchCageForCapture("?macroWatchCage=static", false)).toBe(false);
    expect(shouldFreezeMacroWatchCageForCapture("?macroWatchCage=auto", true)).toBe(false);
  });

  it("starts at phase zero and completes one revolution every sixty seconds", () => {
    expect(CAGE_REVOLUTION_SECONDS).toBe(60);
    expect(getMacroWatchCageAngle(10_001, 10_000)).toBeCloseTo(0, 12);
    expect(getMacroWatchCageAngle(10_001, 25_000)).toBeCloseTo(-Math.PI / 2, 12);
    expect(getMacroWatchCageAngle(10_001, 40_000)).toBeCloseTo(-Math.PI, 12);
    expect(getMacroWatchCageAngle(10_001, 70_000)).toBeCloseTo(0, 12);
  });

  it("derives the same phase from absolute time without frame-delta accumulation", () => {
    const firstSample = macroWatchCageAngleAt(16_000, 1_000);
    const repeatedSample = macroWatchCageAngleAt(16_000, 1_000);
    expect(firstSample).toBeCloseTo(repeatedSample, 15);
    expect(firstSample).toBeCloseTo(-Math.PI / 2, 12);
    expect(macroWatchCageAngleAt(31_000, 1_000)).toBeCloseTo(-Math.PI, 12);
  });

  it("shares one epoch across renderers and ignores a stale reset generation", () => {
    expect(getMacroWatchCageAngle(10_002, 100_000)).toBeCloseTo(0, 12);
    const observerAngle = getMacroWatchCageAngle(10_002, 115_000);
    const groundGlassAngle = getMacroWatchCageAngle(10_002, 115_000);
    expect(observerAngle).toBeCloseTo(-Math.PI / 2, 12);
    expect(groundGlassAngle).toBe(observerAngle);
    expect(getMacroWatchCageAngle(10_001, 130_000)).toBeCloseTo(-Math.PI, 12);
    expect(getMacroWatchCageAngle(10_002, 130_000)).toBeCloseTo(-Math.PI, 12);
    expect(getMacroWatchCageAngle(10_003, 130_000)).toBeCloseTo(0, 12);
  });
});
