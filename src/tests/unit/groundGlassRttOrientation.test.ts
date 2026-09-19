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

type Uv = { u: number; v: number };

const flip180 = ({ u, v }: Uv): Uv => ({ u: 1 - u, v: 1 - v });

const ASYMMETRIC_UPRIGHT_REFERENCE = [
  { label: "A", upright: { u: 0.2, v: 0.2 } },
  { label: "B", upright: { u: 0.8, v: 0.2 } },
  { label: "C", upright: { u: 0.2, v: 0.8 } },
  { label: "D", upright: { u: 0.8, v: 0.8 } },
] as const;

const filmUvToWorldPoint = (
  optics: ReturnType<typeof deriveOpticsState>,
  filmUv: Uv,
): { x: number; y: number; z: number } => {
  const film = optics.filmPlaneCornersWorld;
  const lens = optics.lensCenterWorld;
  const filmPoint = {
    x: film.topLeft.x + (film.topRight.x - film.topLeft.x) * filmUv.u +
      (film.bottomLeft.x - film.topLeft.x) * filmUv.v,
    y: film.topLeft.y + (film.topRight.y - film.topLeft.y) * filmUv.u +
      (film.bottomLeft.y - film.topLeft.y) * filmUv.v,
    z: film.topLeft.z + (film.topRight.z - film.topLeft.z) * filmUv.u +
      (film.bottomLeft.z - film.topLeft.z) * filmUv.v,
  };

  // Extend the lens-to-film ray back into the object side. This produces an
  // asymmetric reference point whose physical film projection is exactly the
  // requested raw coordinate without replacing the real configured camera.
  return {
    x: lens.x + (lens.x - filmPoint.x) * 4,
    y: lens.y + (lens.y - filmPoint.y) * 4,
    z: lens.z + (lens.z - filmPoint.z) * 4,
  };
};

describe("Ground Glass RTT orientation", () => {
  it("maps an asymmetric upright reference through the configured RTT camera", () => {
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

    for (const point of ASYMMETRIC_UPRIGHT_REFERENCE) {
      const expectedRawDisplay = flip180(point.upright);
      const worldPointMm = filmUvToWorldPoint(optics, expectedRawDisplay);
      const physicalFilmProjection = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: worldPointMm,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });
      expect(physicalFilmProjection.visible, point.label).toBe(true);

      // The configured camera is the source-of-truth boundary under test:
      // its texture U/V must already describe the physical raw film point,
      // rather than an assumed upright reference image.
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
      expect(rttTextureUv.u, point.label).toBeCloseTo(expectedRawDisplay.u, 6);
      expect(rttTextureUv.v, point.label).toBeCloseTo(expectedRawDisplay.v, 6);

      const renderedByMode = (previewMode: "raw" | "upright"): Uv => {
        const compositeSampleUv = applyGroundGlassRttDisplayTransform(
          rttTextureUv,
          resolveGroundGlassRttDisplayTransform(previewMode),
        );
        // The fullscreen composite is rendered in bottom-origin WebGL
        // coordinates; convert its sampled V back to top-origin display UV.
        return {
          u: compositeSampleUv.u,
          v: 1 - compositeSampleUv.v,
        };
      };

      const rawDisplayUv = renderedByMode("raw");
      const uprightDisplayUv = renderedByMode("upright");
      expect(rawDisplayUv.u, `${point.label} raw`).toBeCloseTo(expectedRawDisplay.u, 6);
      expect(rawDisplayUv.v, `${point.label} raw`).toBeCloseTo(expectedRawDisplay.v, 6);
      expect(uprightDisplayUv.u, `${point.label} upright`).toBeCloseTo(point.upright.u, 6);
      expect(uprightDisplayUv.v, `${point.label} upright`).toBeCloseTo(point.upright.v, 6);

      // The overlay projection consumes the same physical-film point, so it
      // must agree with the raster at both display modes.
      for (const previewMode of ["raw", "upright"] as const) {
        const canonicalDisplayUv = mapGroundGlassUvToDisplayUv(
          {
            u: physicalFilmProjection.uRaw,
            v: physicalFilmProjection.vRaw,
          },
          previewMode,
        );
        const renderedDisplayUv = renderedByMode(previewMode);
        expect(renderedDisplayUv.u, `${point.label} ${previewMode} target`).toBeCloseTo(
          canonicalDisplayUv.u,
          6,
        );
        expect(renderedDisplayUv.v, `${point.label} ${previewMode} target`).toBeCloseTo(
          canonicalDisplayUv.v,
          6,
        );
      }

      expect(uprightDisplayUv.u, `${point.label} complement u`).toBeCloseTo(
        1 - rawDisplayUv.u,
        6,
      );
      expect(uprightDisplayUv.v, `${point.label} complement v`).toBeCloseTo(
        1 - rawDisplayUv.v,
        6,
      );
    }
  });
});
