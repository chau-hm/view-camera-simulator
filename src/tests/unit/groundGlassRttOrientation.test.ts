import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { mapPhysicalFilmUvToGroundGlassDisplayUv } from "../../render/groundGlassTargetProjection";
import {
  applyGroundGlassRttDisplayTransform,
  mapGroundGlassRttTextureUvToCanonicalFilmUv,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { calculateGroundGlassCoverageGain } from "../../core/optics/groundGlassCoverage";
import { resolvePhysicalLensCoverageRenderGeometry } from "../../render/imageCircleGeometry";
import { focusFundamentalsPerspectiveReferencePoints } from "../../scenes/focusFundamentalsTargets";
import { WORLD_SCALE } from "../../render/rttUtils";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

type Uv = { u: number; v: number };

const flip180 = ({ u, v }: Uv): Uv => ({ u: 1 - u, v: 1 - v });

const ASYMMETRIC_REFERENCE_POINTS = [
  { label: "A", sourceTextureUv: { u: 0.2, v: 0.2 } },
  { label: "B", sourceTextureUv: { u: 0.8, v: 0.2 } },
  { label: "C", sourceTextureUv: { u: 0.2, v: 0.8 } },
  { label: "D", sourceTextureUv: { u: 0.8, v: 0.8 } },
] as const;

describe("Ground Glass RTT orientation", () => {
  it("renders an asymmetric upright reference as a 180-degree Raw image", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      const rawDisplay = applyGroundGlassRttDisplayTransform(
        point.sourceTextureUv,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const uprightDisplay = applyGroundGlassRttDisplayTransform(
        point.sourceTextureUv,
        resolveGroundGlassRttDisplayTransform("upright"),
      );

      expect(rawDisplay, point.label).toEqual(flip180(point.sourceTextureUv));
      expect(uprightDisplay, point.label).toEqual(point.sourceTextureUv);
    }
  });

  it("keeps source-to-film coordinates separate from the Raw display flip", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      const physicalFilmUv = mapGroundGlassRttTextureUvToCanonicalFilmUv(
        point.sourceTextureUv,
      );
      const rawDisplayUv = applyGroundGlassRttDisplayTransform(
        point.sourceTextureUv,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      expect(physicalFilmUv, point.label).toEqual(point.sourceTextureUv);
      expect(rawDisplayUv, point.label).toEqual(flip180(physicalFilmUv));
    }
  });

  it("maps the configured RTT camera's source texel to its canonical film-local point", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      frontShiftMm: 20,
      frontRiseMm: 10,
      focusDistanceMm: 9000,
    };
    const optics = deriveOpticsState(cameraState, architectureRiseScene);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const configuration = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(configuration.ok).toBe(true);
    if (!configuration.ok) return;

    const localFilmPoint = { x: 17, y: -13 };
    const filmPointWorld = new THREE.Vector3(
      optics.filmCenterWorld.x + optics.rearStandardFrame.rightWorld.x * localFilmPoint.x +
        optics.rearStandardFrame.upWorld.x * localFilmPoint.y,
      optics.filmCenterWorld.y + optics.rearStandardFrame.rightWorld.y * localFilmPoint.x +
        optics.rearStandardFrame.upWorld.y * localFilmPoint.y,
      optics.filmCenterWorld.z + optics.rearStandardFrame.rightWorld.z * localFilmPoint.x +
        optics.rearStandardFrame.upWorld.z * localFilmPoint.y,
    );
    const virtualFilmPoint = new THREE.Vector3(
      optics.lensCenterWorld.x * 2 - filmPointWorld.x,
      optics.lensCenterWorld.y * 2 - filmPointWorld.y,
      optics.lensCenterWorld.z * 2 - filmPointWorld.z,
    ).multiplyScalar(WORLD_SCALE);
    const ndc = virtualFilmPoint.project(camera);
    const sourceTextureUv = { u: (ndc.x + 1) / 2, v: (ndc.y + 1) / 2 };
    const expectedFilmUv = {
      u: 0.5 + localFilmPoint.x / 127,
      v: 0.5 - localFilmPoint.y / 101.6,
    };

    expect(sourceTextureUv.u).toBeCloseTo(expectedFilmUv.u, 6);
    expect(sourceTextureUv.v).toBeCloseTo(expectedFilmUv.v, 6);
    expect(mapGroundGlassRttTextureUvToCanonicalFilmUv(sourceTextureUv).u)
      .toBeCloseTo(expectedFilmUv.u, 6);
    expect(mapGroundGlassRttTextureUvToCanonicalFilmUv(sourceTextureUv).v)
      .toBeCloseTo(expectedFilmUv.v, 6);
  });

  it("keeps an asymmetric Architecture Rise Shift on the same physical side in 3D and Raw coverage", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      frontShiftMm: 60,
      focusDistanceMm: 9000,
    };
    const optics = deriveOpticsState(cameraState, architectureRiseScene);
    const coverage = optics.groundGlassCoverage;
    expect(coverage.kind).toBe("parallel-circle");
    if (coverage.kind !== "parallel-circle") return;

    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage,
      rearStandardFrame: optics.rearStandardFrame,
    });
    expect(geometry?.kind).toBe("parallel-circle");
    if (geometry?.kind !== "parallel-circle") return;

    const worldAlongFilm = (xMm: number, yMm: number) => ({
      x: optics.filmCenterWorld.x + optics.rearStandardFrame.rightWorld.x * xMm +
        optics.rearStandardFrame.upWorld.x * yMm,
      y: optics.filmCenterWorld.y + optics.rearStandardFrame.rightWorld.y * xMm +
        optics.rearStandardFrame.upWorld.y * yMm,
      z: optics.filmCenterWorld.z + optics.rearStandardFrame.rightWorld.z * xMm +
        optics.rearStandardFrame.upWorld.z * yMm,
    });
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    const configuration = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(configuration.ok).toBe(true);
    if (!configuration.ok) return;

    const projectedFilmPoint = (xMm: number, yMm: number) => {
      const physicalPoint = worldAlongFilm(xMm, yMm);
      const virtualPoint = new THREE.Vector3(
        optics.lensCenterWorld.x * 2 - physicalPoint.x,
        optics.lensCenterWorld.y * 2 - physicalPoint.y,
        optics.lensCenterWorld.z * 2 - physicalPoint.z,
      ).multiplyScalar(WORLD_SCALE);
      const ndc = virtualPoint.project(camera);
      const sourceUv = mapGroundGlassRttTextureUvToCanonicalFilmUv({
        u: (ndc.x + 1) / 2,
        v: (ndc.y + 1) / 2,
      });
      return {
        xMm: (sourceUv.u - 0.5) * 127,
        yMm: (0.5 - sourceUv.v) * 101.6,
        // The Raw composite samples the source through the horizontal screen flip.
        rawScreenU: 1 - sourceUv.u,
      };
    };

    const positiveFilmEdge = projectedFilmPoint(63.5, 0);
    const negativeFilmEdge = projectedFilmPoint(-63.5, 0);
    expect(geometry.opticalAxisOffsetXMm).toBeCloseTo(coverage.opticalAxisOffsetXMm, 10);
    const centerDelta = {
      x: geometry.centerWorld.x - optics.rearStandardFrame.centerWorld.x,
      y: geometry.centerWorld.y - optics.rearStandardFrame.centerWorld.y,
      z: geometry.centerWorld.z - optics.rearStandardFrame.centerWorld.z,
    };
    const geometryCenterFilmX =
      centerDelta.x * optics.rearStandardFrame.rightWorld.x +
      centerDelta.y * optics.rearStandardFrame.rightWorld.y +
      centerDelta.z * optics.rearStandardFrame.rightWorld.z;
    expect(geometryCenterFilmX).toBeCloseTo(coverage.opticalAxisOffsetXMm, 8);
    expect(positiveFilmEdge.xMm).toBeGreaterThan(0);
    expect(negativeFilmEdge.xMm).toBeLessThan(0);
    expect(positiveFilmEdge.rawScreenU).toBeLessThan(0.5);
    expect(negativeFilmEdge.rawScreenU).toBeGreaterThan(0.5);
    expect(
      calculateGroundGlassCoverageGain(coverage, positiveFilmEdge.xMm, positiveFilmEdge.yMm),
    ).toBe(1);
    expect(
      calculateGroundGlassCoverageGain(coverage, negativeFilmEdge.xMm, negativeFilmEdge.yMm),
    ).toBe(0);
  });

  it("maps physical film points through the same display transform as the RTT", () => {
    for (const point of ASYMMETRIC_REFERENCE_POINTS) {
      const physicalFilmUv = mapGroundGlassRttTextureUvToCanonicalFilmUv(
        point.sourceTextureUv,
      );
      const rasterRawDisplay = applyGroundGlassRttDisplayTransform(
        point.sourceTextureUv,
        resolveGroundGlassRttDisplayTransform("raw"),
      );
      const rasterUprightDisplay = applyGroundGlassRttDisplayTransform(
        point.sourceTextureUv,
        resolveGroundGlassRttDisplayTransform("upright"),
      );
      const rawScreenUv = { u: rasterRawDisplay.u, v: 1 - rasterRawDisplay.v };
      const uprightScreenUv = { u: rasterUprightDisplay.u, v: 1 - rasterUprightDisplay.v };
      const projectedRawDisplay = mapPhysicalFilmUvToGroundGlassDisplayUv(
        physicalFilmUv,
        "raw",
      );
      const projectedUprightDisplay = mapPhysicalFilmUvToGroundGlassDisplayUv(
        physicalFilmUv,
        "upright",
      );

      expect(rawScreenUv.u, point.label).toBeCloseTo(projectedRawDisplay.u, 12);
      expect(rawScreenUv.v, point.label).toBeCloseTo(projectedRawDisplay.v, 12);
      expect(uprightScreenUv.u, point.label).toBeCloseTo(projectedUprightDisplay.u, 12);
      expect(uprightScreenUv.v, point.label).toBeCloseTo(projectedUprightDisplay.v, 12);
      expect(uprightScreenUv.u).toBeCloseTo(1 - rawScreenUv.u, 12);
      expect(uprightScreenUv.v).toBeCloseTo(1 - rawScreenUv.v, 12);
    }
  });

  it("maps the configured RTT camera and large frame through the display contract", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...focusFundamentalsTwoTargets.cameraPreset,
      activeSceneId: focusFundamentalsTwoTargets.id,
      focusMode: "finite" as const,
    };
    const optics = deriveOpticsState(cameraState, focusFundamentalsTwoTargets);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    const configuration = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(configuration.ok).toBe(true);
    if (!configuration.ok) return;

    for (const [surface, referencePoints] of Object.entries(
      focusFundamentalsPerspectiveReferencePoints,
    )) {
      for (const [label, worldPointMm] of Object.entries(referencePoints)) {
        const pointLabel = `${surface} ${label}`;
        const worldPoint = new THREE.Vector3(
          worldPointMm.x,
          worldPointMm.y,
          worldPointMm.z,
        ).multiplyScalar(WORLD_SCALE);
        const ndc = worldPoint.project(camera);
        const rttTextureUv = {
          u: (ndc.x + 1) / 2,
          v: (ndc.y + 1) / 2,
        };
        expect(rttTextureUv.u, pointLabel).toBeGreaterThan(0);
        expect(rttTextureUv.u, pointLabel).toBeLessThan(1);
        expect(rttTextureUv.v, pointLabel).toBeGreaterThan(0);
        expect(rttTextureUv.v, pointLabel).toBeLessThan(1);

        const physicalRawFilmUv = mapGroundGlassRttTextureUvToCanonicalFilmUv(
          rttTextureUv,
        );

        const renderedByMode = (previewMode: "raw" | "upright"): Uv => {
          const compositeSampleUv = applyGroundGlassRttDisplayTransform(
            rttTextureUv,
            resolveGroundGlassRttDisplayTransform(previewMode),
          );
          // WebGL texture V is bottom-origin; the visible Ground Glass
          // contract is expressed in top-origin display coordinates.
          return {
            u: compositeSampleUv.u,
            v: 1 - compositeSampleUv.v,
          };
        };

        const rawDisplayUv = renderedByMode("raw");
        const uprightDisplayUv = renderedByMode("upright");
        const projectedRawDisplay = mapPhysicalFilmUvToGroundGlassDisplayUv(
          physicalRawFilmUv,
          "raw",
        );
        const projectedUprightDisplay = mapPhysicalFilmUvToGroundGlassDisplayUv(
          physicalRawFilmUv,
          "upright",
        );

        expect(rawDisplayUv.u, pointLabel).toBeCloseTo(1 - physicalRawFilmUv.u, 6);
        expect(rawDisplayUv.v, pointLabel).toBeCloseTo(physicalRawFilmUv.v, 6);
        expect(uprightDisplayUv.u, pointLabel).toBeCloseTo(physicalRawFilmUv.u, 6);
        expect(uprightDisplayUv.v, pointLabel).toBeCloseTo(1 - physicalRawFilmUv.v, 6);
        expect(projectedRawDisplay.u, pointLabel).toBeCloseTo(rawDisplayUv.u, 6);
        expect(projectedRawDisplay.v, pointLabel).toBeCloseTo(rawDisplayUv.v, 6);
        expect(projectedUprightDisplay.u, pointLabel).toBeCloseTo(uprightDisplayUv.u, 6);
        expect(projectedUprightDisplay.v, pointLabel).toBeCloseTo(uprightDisplayUv.v, 6);
        expect(uprightDisplayUv.u, pointLabel).toBeCloseTo(1 - rawDisplayUv.u, 6);
        expect(uprightDisplayUv.v, pointLabel).toBeCloseTo(1 - rawDisplayUv.v, 6);
      }
    }
  });
});
