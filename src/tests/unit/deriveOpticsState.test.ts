import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { SceneDefinition } from "../../types/scene";

describe("deriveOpticsState", () => {
  it("returns computed optics state for valid inputs", () => {
    const result = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    expect(result.diagnostics.fallbackApplied).toBe(false);
    expect(result.diagnostics.isParallelLensFilm).toBe(true);
    expect(result.diagnostics.focusPlaneModel).toBe("parallel");
  });

  it("changes only lens center Y when rise changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const raised = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontRiseMm: 24,
      },
      architectureRiseScene,
    );

    expect(raised.lensCenterWorld.x).toBeCloseTo(base.lensCenterWorld.x, 8);
    expect(raised.lensCenterWorld.z).toBeCloseTo(base.lensCenterWorld.z, 8);
    expect(raised.lensCenterWorld.y).toBeCloseTo(base.lensCenterWorld.y + 24, 8);
  });

  it("changes lens normal when tilt changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const tilted = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontTiltDeg: 4,
      },
      architectureRiseScene,
    );

    expect(tilted.lensNormalWorld).not.toEqual(base.lensNormalWorld);
  });

  it("changes lens normal when swing changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const swung = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontSwingDeg: 4,
      },
      architectureRiseScene,
    );

    expect(swung.lensNormalWorld).not.toEqual(base.lensNormalWorld);
  });

  it("keeps focus plane parallel to film for zero tilt and swing", () => {
    const result = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    expect(result.focusPlane!.normal).toEqual(result.filmPlane.normal);
  });

  it("changes focus plane direction when tilt changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const tilted = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontTiltDeg: 6,
      },
      architectureRiseScene,
    );

    expect(tilted.focusPlane!.normal).not.toEqual(base.focusPlane!.normal);
  });

  it("changes focus plane direction when swing changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const swung = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontSwingDeg: 6,
      },
      architectureRiseScene,
    );

    expect(swung.focusPlane!.normal).not.toEqual(base.focusPlane!.normal);
  });

  it("keeps focus plane direction unchanged across aperture changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const widerDof = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        aperture: 32,
      },
      architectureRiseScene,
    );

    expect(widerDof.focusPlane!.normal).toEqual(base.focusPlane!.normal);
    expect(widerDof.depthOfFieldFarPlane!.distance).toBeGreaterThan(
      base.depthOfFieldFarPlane!.distance,
    );
  });

  it("widens DOF at f/32 versus f/5.6", () => {
    const narrowDof = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        aperture: 5.6,
      },
      architectureRiseScene,
    );
    const wideDof = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        aperture: 32,
      },
      architectureRiseScene,
    );

    const narrowWidth =
      narrowDof.depthOfFieldFarPlane!.distance - narrowDof.depthOfFieldNearPlane!.distance;
    const wideWidth =
      wideDof.depthOfFieldFarPlane!.distance - wideDof.depthOfFieldNearPlane!.distance;
    expect(wideWidth).toBeGreaterThan(narrowWidth);
  });

  it("keeps sharpness score bounded between 0 and 1", () => {
    const result = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    for (const target of result.focusTargets) {
      expect(target.sharpness).toBeGreaterThanOrEqual(0);
      expect(target.sharpness).toBeLessThanOrEqual(1);
    }
  });

  it("returns near-perfect sharpness for target on focus plane", () => {
    const baseState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const focusPoint = baseState.focusPointWorld;
    const customScene: SceneDefinition = {
      ...architectureRiseScene,
      focusTargets: [
        {
          id: "focus-point-target",
          label: "Focus point",
          worldPosition: focusPoint,
          weight: 1,
        },
      ],
    };

    const result = deriveOpticsState(DEFAULT_CAMERA_STATE, customScene);
    expect(result.focusTargets[0].sharpness).toBeGreaterThanOrEqual(0.99);
  });

  it("decreases score as distance to focus plane increases", () => {
    const baseState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const focusPoint = baseState.focusPointWorld;
    const customScene: SceneDefinition = {
      ...architectureRiseScene,
      focusTargets: [
        {
          id: "near-focus",
          label: "Near focus",
          worldPosition: focusPoint,
          weight: 1,
        },
        {
          id: "far-focus",
          label: "Far from focus",
          worldPosition: {
            x: focusPoint.x,
            y: focusPoint.y,
            z: focusPoint.z + 200,
          },
          weight: 1,
        },
      ],
    };

    const result = deriveOpticsState(DEFAULT_CAMERA_STATE, customScene);
    expect(result.focusTargets[0].distanceToFocusPlaneMm).toBeLessThan(
      result.focusTargets[1].distanceToFocusPlaneMm,
    );
    expect(result.focusTargets[0].sharpness).toBeGreaterThan(result.focusTargets[1].sharpness);
  });

  it("changes off-axis projection vertical shift when rise changes", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const raised = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontRiseMm: 20,
      },
      architectureRiseScene,
    );

    expect(raised.offAxisProjectionMatrix).not.toEqual(base.offAxisProjectionMatrix);
    expect(base.offAxisProjectionMatrix[9]).toBeCloseTo(0, 8);
    expect(raised.offAxisProjectionMatrix[9]).toBeLessThan(base.offAxisProjectionMatrix[9]);
  });

  it("falls back to parallel focus plane model for near-parallel tilt", () => {
    const result = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontTiltDeg: 0.01,
      },
      architectureRiseScene,
    );
    expect(result.diagnostics.fallbackApplied).toBe(false);
    expect(result.diagnostics.isParallelLensFilm).toBe(true);
    expect(result.diagnostics.focusPlaneModel).toBe("parallel");
    expect(Number.isFinite(result.focusPlane!.distance)).toBe(true);
  });

  it("falls back safely on invalid focus distance", () => {
    const result = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        focusDistanceMm: -1,
      },
      architectureRiseScene,
    );
    expect(result.diagnostics.fallbackApplied).toBe(true);
    expect(result.diagnostics.errorMessage).toBe("Invalid focus distance");
  });
});
