import { describe, expect, it, beforeEach } from "vitest";
import { createGroundGlassRenderSanityStateKey } from "../../render/groundGlassRenderSanityKey";
import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import type { DerivedOpticsState } from "../../types/optics";

function buildOptics(overrides: Partial<ReturnType<typeof useAppStore.getState>['camera']> = {}): DerivedOpticsState {
  const base = useAppStore.getState().camera;
  return deriveOpticsState({ ...base, ...overrides }, understandingCameraMovementsScene);
}

function makeKey(optics: DerivedOpticsState, overrides: Partial<Parameters<typeof createGroundGlassRenderSanityStateKey>[0]> = {}) {
  return createGroundGlassRenderSanityStateKey({
    resourceGeneration: 1,
    sceneId: "understanding-camera-movements",
    previewMode: "raw",
    rawDebug: false,
    zoomEnabled: false,
    aperture: 11,
    internalWidthPx: 640,
    internalHeightPx: 480,
    opticsState: optics,
    ...overrides,
  });
}

describe("groundGlassRenderSanityKey", () => {
  beforeEach(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  it("identical optics produce identical keys", () => {
    const o1 = buildOptics();
    const o2 = buildOptics();
    expect(makeKey(o1)).toBe(makeKey(o2));
  });

  it("Front Rise changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ frontRiseMm: 20 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("Rear Rise changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ rearRiseMm: 20 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("Front Tilt changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ frontTiltDeg: 5 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("Rear Tilt changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ rearTiltDeg: 5 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("changing aperture changes the key", () => {
    const o = buildOptics();
    expect(makeKey(o)).not.toBe(makeKey(o, { aperture: 22 }));
  });

  it("changing dimensions changes the key", () => {
    const o = buildOptics();
    expect(makeKey(o)).not.toBe(makeKey(o, { internalWidthPx: 320 }));
  });

  it("null focus/DOF planes serialize deterministically", () => {
    const o = buildOptics();
    const key1 = makeKey(o);
    const key2 = makeKey(o);
    expect(key1).toBe(key2);
    // All keys must be finite strings without NaN or Infinity
    expect(key1).not.toContain("NaN");
    expect(key1).not.toContain("Infinity");
  });

  it("all key values are finite numbers", () => {
    const o = buildOptics();
    const key = makeKey(o);
    expect(key).not.toContain("NaN");
    expect(key).not.toContain("Infinity");
    // Split by | for top-level, then : for vec, and , for matrix entries
    for (const part of key.split("|")) {
      // Each part may be a single value or contain : and , delimiters
      const tokens = part.split(/[:,]/);
      for (const token of tokens) {
        if (token === "null" || token === "no-scene" || token === "empty" || token === "understanding-camera-movements") continue;
        if (token === "raw" || token === "0" || token === "1") continue;
        if (token === "") continue;
        const num = Number(token);
        expect(Number.isFinite(num), `token "${token}" from part "${part}" is not finite`).toBe(true);
      }
    }
  });
});
