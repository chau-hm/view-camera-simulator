import type { Vec3 } from "../types/optics";
import { toWorld } from "./rttUtils";

export type WorldIlluminationCategory = "artificial" | "natural";

export type WorldIlluminationPointSource = Readonly<{
  id: string;
  category: WorldIlluminationCategory;
  kind: "point";
  color: string;
  intensity: number;
  positionMm: Readonly<Vec3>;
  distanceMm: number;
  decay: number;
  castsShadow: boolean;
}>;

export type WorldIlluminationDirectionalSource = Readonly<{
  id: string;
  category: WorldIlluminationCategory;
  kind: "directional";
  color: string;
  intensity: number;
  positionMm: Readonly<Vec3>;
  targetMm: Readonly<Vec3>;
  castsShadow: boolean;
}>;

export type WorldIlluminationSource =
  | WorldIlluminationPointSource
  | WorldIlluminationDirectionalSource;

export type WorldProceduralSkyGroundEnvironment = Readonly<{
  id: string;
  kind: "procedural-sky-ground";
  zenithColor: string;
  skyHorizonColor: string;
  groundHorizonColor: string;
  nadirColor: string;
  intensity: number;
}>;

export type ResolvedWorldIllumination = Readonly<{
  sources: readonly WorldIlluminationSource[];
  environment?: WorldProceduralSkyGroundEnvironment;
}>;

export const EMPTY_WORLD_ILLUMINATION: ResolvedWorldIllumination = Object.freeze({
  sources: Object.freeze([]),
});

export const worldIlluminationPointToWorld = (
  source: WorldIlluminationPointSource,
) => ({
  color: source.color,
  intensity: source.intensity,
  distance: toWorld(source.distanceMm),
  decay: source.decay,
  position: [
    toWorld(source.positionMm.x),
    toWorld(source.positionMm.y),
    toWorld(source.positionMm.z),
  ] as [number, number, number],
  castShadow: source.castsShadow,
});

export const worldIlluminationDirectionalToWorld = (
  source: WorldIlluminationDirectionalSource,
) => ({
  color: source.color,
  intensity: source.intensity,
  position: [
    toWorld(source.positionMm.x),
    toWorld(source.positionMm.y),
    toWorld(source.positionMm.z),
  ] as [number, number, number],
  target: [
    toWorld(source.targetMm.x),
    toWorld(source.targetMm.y),
    toWorld(source.targetMm.z),
  ] as [number, number, number],
  castShadow: source.castsShadow,
});
