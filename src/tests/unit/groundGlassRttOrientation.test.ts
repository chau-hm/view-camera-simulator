import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { mapGroundGlassUvToDisplayUv } from "../../render/groundGlassTargetProjection";
import {
  applyGroundGlassRttDisplayTransform,
  resolveGroundGlassRttDisplayTransform,
} from "../../render/groundGlassRttOrientation";
import { WORLD_SCALE } from "../../render/rttUtils";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const ASYMMETRIC_POINTS_MM = [
  { x: -24, y: 22, z: 400 },
  { x: 24, y: 22, z: 400 },
  { x: -24, y: -22, z: 400 },
  { x: 24, y: -22, z: 400 },
] as const;

describe("Ground Glass RTT orientation", () => {
  it("uses complementary per-axis transforms for Raw and Upright output", () => {
    expect(resolveGroundGlassRttDisplayTransform("raw")).toEqual({
      flipDisplayX: false,
      flipDisplayY: true,
    });
    expect(resolveGroundGlassRttDisplayTransform("upright")).toEqual({
      flipDisplayX: true,
      flipDisplayY: false,
    });
  });

  it("matches the configured RTT camera against physical-film display projection on both axes", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...macroDepthOfFieldScene.cameraPreset,
      activeSceneId: macroDepthOfFieldScene.id,
      focusMode: "finite" as const,
    };
    const optics = deriveOpticsState(cameraState, macroDepthOfFieldScene);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    const configuration = configureGroundGlassCamera(camera, optics, 0.01, 1000);
    expect(configuration.ok).toBe(true);
    if (!configuration.ok) return;

    for (const previewMode of ["raw", "upright"] as const) {
      const transform = resolveGroundGlassRttDisplayTransform(previewMode);
      for (const pointMm of ASYMMETRIC_POINTS_MM) {
        const worldPoint = new THREE.Vector3(pointMm.x, pointMm.y, pointMm.z).multiplyScalar(WORLD_SCALE);
        const ndc = worldPoint.clone().project(camera);
        // Three.js NDC y is measured from the bottom of the render target,
        // while canonical Ground Glass display UV uses v=0 at the top. Keep
        // the texture-space source UV independent, then convert the composite
        // quad's bottom-origin screen coordinate back to display space.
        const rttTextureUv = {
          u: (ndc.x + 1) / 2,
          v: (ndc.y + 1) / 2,
        };
        expect(Math.abs(rttTextureUv.u - 0.5)).toBeGreaterThan(0.001);
        expect(Math.abs(rttTextureUv.v - 0.5)).toBeGreaterThan(0.001);
        const compositeScreenUv = applyGroundGlassRttDisplayTransform(rttTextureUv, transform);
        const renderedDisplayUv = {
          u: compositeScreenUv.u,
          v: 1 - compositeScreenUv.v,
        };
        const physicalFilmProjection = projectWorldPointToFilmPlaneGroundGlass({
          worldPoint: pointMm,
          lensCenterWorld: optics.lensCenterWorld,
          filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
        });
        expect(physicalFilmProjection.visible).toBe(true);
        const canonicalDisplayUv = mapGroundGlassUvToDisplayUv(
          {
            u: physicalFilmProjection.uRaw,
            v: physicalFilmProjection.vRaw,
          },
          previewMode,
        );

        expect(renderedDisplayUv.u).toBeCloseTo(canonicalDisplayUv.u, 6);
        expect(renderedDisplayUv.v).toBeCloseTo(canonicalDisplayUv.v, 6);
      }
    }
  });
});
