import { describe, expect, it } from "vitest";
import { planeFromPointNormal } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolvePhysicalImageCircleCoverageRays, resolvePhysicalImageCircleRenderGeometry } from "../../render/imageCircleGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { StandardFrame } from "../../types/optics";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const frame = (overrides: Partial<StandardFrame> = {}): StandardFrame => ({
  centerWorld: { x: 10, y: 20, z: -150 },
  rightWorld: { x: 1, y: 0, z: 0 },
  upWorld: { x: 0, y: 1, z: 0 },
  normalWorld: { x: 0, y: 0, z: 1 },
  plane: planeFromPointNormal(
    { x: 10, y: 20, z: -150 },
    { x: 0, y: 0, z: 1 },
  ),
  ...overrides,
});

const finiteCoverage = (radiusMm = 100) => ({
  kind: "parallel-circle" as const,
  imageCircleRadiusMm: radiusMm,
  opticalAxisOffsetXMm: 12,
  opticalAxisOffsetYMm: -8,
});

describe("physical 3D Image Circle render geometry", () => {
  it("resolves the centre in the canonical rear-standard basis", () => {
    const geometry = resolvePhysicalImageCircleRenderGeometry({
      coverage: finiteCoverage(),
      rearStandardFrame: frame(),
    });

    expect(geometry?.centerWorld).toEqual({ x: 22, y: 12, z: -150 });
    expect(geometry?.radiusMm).toBe(100);
    expect(geometry?.opticalAxisOffsetXMm).toBe(12);
    expect(geometry?.opticalAxisOffsetYMm).toBe(-8);
  });

  it("keeps every perimeter point on the physical image plane and at the canonical radius", () => {
    const geometry = resolvePhysicalImageCircleRenderGeometry({
      coverage: finiteCoverage(108.98),
      rearStandardFrame: frame(),
    });

    expect(geometry?.perimeterWorld).toHaveLength(72);
    geometry?.perimeterWorld.forEach((point) => {
      expect(point.z).toBeCloseTo(-150, 10);
      expect(Math.hypot(
        point.x - geometry.centerWorld.x,
        point.y - geometry.centerWorld.y,
        point.z - geometry.centerWorld.z,
      )).toBeCloseTo(geometry.radiusMm, 10);
    });
  });

  it("uses deterministic sparse coverage-ray endpoints from the same perimeter", () => {
    const geometry = resolvePhysicalImageCircleRenderGeometry({
      coverage: finiteCoverage(),
      rearStandardFrame: frame(),
    });
    const lensCenterWorld = { x: 10, y: 20, z: 0 };
    const rays = resolvePhysicalImageCircleCoverageRays({ geometry, lensCenterWorld });

    expect(rays).toHaveLength(12);
    rays.forEach((ray) => {
      expect(ray.startWorld).toEqual(lensCenterWorld);
      expect(geometry?.perimeterWorld).toContainEqual(ray.endWorld);
      expect(Math.hypot(
        ray.endWorld.x - (geometry?.centerWorld.x ?? 0),
        ray.endWorld.y - (geometry?.centerWorld.y ?? 0),
        ray.endWorld.z - (geometry?.centerWorld.z ?? 0),
      )).toBeCloseTo(100, 10);
    });
  });

  it("does not fabricate geometry for unbounded, neutral, or invalid coverage", () => {
    expect(resolvePhysicalImageCircleRenderGeometry({
      coverage: { kind: "unbounded" },
      rearStandardFrame: frame(),
    })).toBeNull();
    expect(resolvePhysicalImageCircleRenderGeometry({
      coverage: { kind: "neutral", reason: "invalid-geometry" },
      rearStandardFrame: frame(),
    })).toBeNull();
    expect(resolvePhysicalImageCircleRenderGeometry({
      coverage: { ...finiteCoverage(), imageCircleRadiusMm: Number.NaN },
      rearStandardFrame: frame(),
    })).toBeNull();
    expect(resolvePhysicalImageCircleRenderGeometry({
      coverage: finiteCoverage(),
      rearStandardFrame: frame({
        normalWorld: { x: Number.NaN, y: 0, z: 1 },
      }),
    })).toBeNull();
  });

  it("follows canonical Rise and Shift offsets rather than raw control values", () => {
    const optics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...architectureRiseScene.cameraPreset,
        frontRiseMm: 20,
        frontShiftMm: 18,
        focusDistanceMm: 12000,
        activeSceneId: architectureRiseScene.id,
      },
      architectureRiseScene,
    );
    const geometry = resolvePhysicalImageCircleRenderGeometry({
      coverage: optics.groundGlassCoverage,
      rearStandardFrame: optics.rearStandardFrame,
    });

    expect(geometry).not.toBeNull();
    if (!geometry) return;
    expect(geometry?.opticalAxisOffsetXMm).toBeCloseTo(
      optics.groundGlassCoverage.kind === "parallel-circle"
        ? optics.groundGlassCoverage.opticalAxisOffsetXMm
        : Number.NaN,
      10,
    );
    expect(geometry?.opticalAxisOffsetYMm).toBeCloseTo(
      optics.groundGlassCoverage.kind === "parallel-circle"
        ? optics.groundGlassCoverage.opticalAxisOffsetYMm
        : Number.NaN,
      10,
    );
    expect(geometry?.centerWorld.x - optics.rearStandardFrame.centerWorld.x).toBeCloseTo(18, 8);
    expect(geometry?.centerWorld.y - optics.rearStandardFrame.centerWorld.y).toBeCloseTo(20, 8);
  });

  it("keeps a larger canonical angular radius visible without renderer-side recalculation", () => {
    const smaller = resolvePhysicalImageCircleRenderGeometry({
      coverage: finiteCoverage(90),
      rearStandardFrame: frame(),
    });
    const larger = resolvePhysicalImageCircleRenderGeometry({
      coverage: finiteCoverage(180),
      rearStandardFrame: frame(),
    });

    expect(smaller?.radiusMm).toBe(90);
    expect(larger?.radiusMm).toBe(180);
    expect((larger?.perimeterWorld[0].x ?? 0) - (larger?.centerWorld.x ?? 0))
      .toBeGreaterThan((smaller?.perimeterWorld[0].x ?? 0) - (smaller?.centerWorld.x ?? 0));
  });
});
