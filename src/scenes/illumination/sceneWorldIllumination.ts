import { INTERIOR_CORNER_PRESENTATION } from "../presentation/interiorCorner";
import { ARCHITECTURE_RISE_PRESENTATION } from "../presentation/architectureRise";
import {
  EMPTY_WORLD_ILLUMINATION,
  type ResolvedWorldIllumination,
} from "../../render/worldIlluminationContract";
import { MACRO_BELLOWS_EXTENSION_PRESENTATION } from "../presentation/macroBellowsExtension";

const interiorCornerSource = Object.freeze({
  id: "interior-corner-local-light",
  category: "artificial" as const,
  kind: "point" as const,
  color: "#fff1d6",
  intensity: 5,
  positionMm: Object.freeze({
    x: 420,
    y: INTERIOR_CORNER_PRESENTATION.geometry.room.floorY + 1310,
    z: 8300,
  }),
  distanceMm: 7500,
  decay: 2,
  castsShadow: false,
});

const INTERIOR_CORNER_WORLD_ILLUMINATION: ResolvedWorldIllumination = Object.freeze({
  sources: Object.freeze([interiorCornerSource]),
});

const architectureRiseFacadeTargetMm = Object.freeze({
  x: ARCHITECTURE_RISE_PRESENTATION.geometry.building.center.x,
  y: ARCHITECTURE_RISE_PRESENTATION.geometry.building.center.y,
  z: ARCHITECTURE_RISE_PRESENTATION.geometry.facade.frontFacadeZ,
});

const architectureRiseDaylightSource = Object.freeze({
  id: "architecture-rise-daylight",
  category: "natural" as const,
  kind: "directional" as const,
  color: "#fff8ee",
  intensity: 1,
  // Directional-light endpoints are a render-space ray definition, not a model
  // of the Sun's astronomical distance.
  positionMm: Object.freeze({
    x: architectureRiseFacadeTargetMm.x - 6000,
    y: architectureRiseFacadeTargetMm.y + 8000,
    z: architectureRiseFacadeTargetMm.z - 9000,
  }),
  targetMm: architectureRiseFacadeTargetMm,
  castsShadow: false,
});

const architectureRiseEnvironment = Object.freeze({
  id: "architecture-rise-procedural-daylight-environment",
  kind: "procedural-sky-ground" as const,
  zenithColor: "#f2f2ee",
  skyHorizonColor: "#737d80",
  groundHorizonColor: "#686b65",
  nadirColor: "#3f4540",
  intensity: 0.72,
});

const ARCHITECTURE_RISE_WORLD_ILLUMINATION: ResolvedWorldIllumination = Object.freeze({
  sources: Object.freeze([architectureRiseDaylightSource]),
  environment: architectureRiseEnvironment,
});

const watchStudioTargetMm =
  MACRO_BELLOWS_EXTENSION_PRESENTATION.geometry.MACRO_BELLOWS_WATCH.dialDatumMm;
const watchStudioSource = (
  id: string,
  color: string,
  intensity: number,
  offsetMm: Readonly<{ x: number; y: number; z: number }>,
) => Object.freeze({
  id,
  category: "artificial" as const,
  kind: "directional" as const,
  color,
  intensity,
  positionMm: Object.freeze({
    x: watchStudioTargetMm.x + offsetMm.x,
    y: watchStudioTargetMm.y + offsetMm.y,
    z: watchStudioTargetMm.z + offsetMm.z,
  }),
  targetMm: watchStudioTargetMm,
  castsShadow: false,
});

const watchStudioFill = watchStudioSource(
  "macro-bellows-watch-studio-fill",
  "#e7f4ff",
  0.47,
  { x: -20, y: -18, z: -23 },
);
const watchStudioBack = watchStudioSource(
  "macro-bellows-watch-studio-back",
  "#ffefe1",
  1.66,
  { x: -13, y: -9, z: 37 },
);
const watchStudioEnvironment = Object.freeze({
  id: "macro-bellows-watch-procedural-softbox-environment",
  kind: "procedural-softbox" as const,
  intensity: 0.76,
  baseLinearColor: [0.105, 0.105, 0.105] as const,
  cards: Object.freeze([
    Object.freeze({
      direction: [-0.52, 0.65, 0.72] as const,
      horizontalHalfAngleRad: 0.55,
      verticalHalfAngleRad: 0.25,
      intensity: 4.5,
      tintLinearRgb: [1, 0.95, 0.87] as const,
    }),
    Object.freeze({
      direction: [0.62, -0.12, 0.79] as const,
      horizontalHalfAngleRad: 0.29,
      verticalHalfAngleRad: 0.55,
      intensity: 2.6,
      tintLinearRgb: [0.86, 0.94, 1] as const,
    }),
    Object.freeze({
      direction: [0.57, 0.46, -0.67] as const,
      horizontalHalfAngleRad: 0.39,
      verticalHalfAngleRad: 0.3,
      intensity: 4,
      tintLinearRgb: [1, 0.91, 0.79] as const,
    }),
    Object.freeze({
      direction: [-0.62, -0.2, -0.77] as const,
      horizontalHalfAngleRad: 0.45,
      verticalHalfAngleRad: 0.48,
      intensity: 2.3,
      tintLinearRgb: [0.86, 0.94, 1] as const,
    }),
    Object.freeze({
      direction: [0.05, -1, 0.06] as const,
      horizontalHalfAngleRad: 0.65,
      verticalHalfAngleRad: 0.4,
      intensity: 0.72,
      tintLinearRgb: [1, 0.93, 0.84] as const,
    }),
  ]),
});

const MACRO_BELLOWS_WATCH_WORLD_ILLUMINATION: ResolvedWorldIllumination = Object.freeze({
  sources: Object.freeze([watchStudioFill, watchStudioBack]),
  environment: watchStudioEnvironment,
});

export const resolveSceneWorldIllumination = (
  sceneId: string,
): ResolvedWorldIllumination =>
  sceneId === "interior-corner"
    ? INTERIOR_CORNER_WORLD_ILLUMINATION
    : sceneId === "architecture-rise"
      ? ARCHITECTURE_RISE_WORLD_ILLUMINATION
      : sceneId === "macro-bellows-extension"
        ? MACRO_BELLOWS_WATCH_WORLD_ILLUMINATION
        : EMPTY_WORLD_ILLUMINATION;
