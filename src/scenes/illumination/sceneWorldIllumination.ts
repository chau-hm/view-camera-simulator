import { INTERIOR_CORNER_PRESENTATION } from "../presentation/interiorCorner";
import { ARCHITECTURE_RISE_PRESENTATION } from "../presentation/architectureRise";
import {
  EMPTY_WORLD_ILLUMINATION,
  type ResolvedWorldIllumination,
} from "../../render/worldIlluminationContract";

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
  intensity: 0.8,
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

const ARCHITECTURE_RISE_WORLD_ILLUMINATION: ResolvedWorldIllumination = Object.freeze({
  sources: Object.freeze([architectureRiseDaylightSource]),
});

export const resolveSceneWorldIllumination = (
  sceneId: string,
): ResolvedWorldIllumination =>
  sceneId === "interior-corner"
    ? INTERIOR_CORNER_WORLD_ILLUMINATION
    : sceneId === "architecture-rise"
      ? ARCHITECTURE_RISE_WORLD_ILLUMINATION
      : EMPTY_WORLD_ILLUMINATION;
