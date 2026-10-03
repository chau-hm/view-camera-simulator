import { INTERIOR_CORNER_PRESENTATION } from "../presentation/interiorCorner";
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

export const resolveSceneWorldIllumination = (
  sceneId: string,
): ResolvedWorldIllumination =>
  sceneId === "interior-corner"
    ? INTERIOR_CORNER_WORLD_ILLUMINATION
    : EMPTY_WORLD_ILLUMINATION;
