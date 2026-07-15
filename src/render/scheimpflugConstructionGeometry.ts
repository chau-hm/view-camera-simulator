import type { Bounds3, DerivedOpticsState, Line3, Plane, Vec3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import { deriveScheimpflugConstruction } from "../core/optics/scheimpflugConstruction";
import {
  createScenePlaneOverlayGeometry,
  type ScenePlaneOverlayGeometry,
} from "./scenePlaneOverlayGeometry";

export type ScheimpflugConstructionGeometry = {
  bounds: Bounds3;
  filmPlane: ScenePlaneOverlayGeometry;
  lensPlane: ScenePlaneOverlayGeometry;
  focusPlane: ScenePlaneOverlayGeometry;
  commonLine: { start: Vec3; end: Vec3 };
};

const expandedConstructionBounds = (
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): Bounds3 => {
  const points = [
    opticsState.filmPlane.point,
    opticsState.lensPlane.point,
    opticsState.focusPlane?.point,
    deriveScheimpflugConstruction({
      filmPlane: opticsState.filmPlane,
      lensPlane: opticsState.lensPlane,
      focusPlane: opticsState.focusPlane,
    }).commonLine?.point,
  ].filter((point): point is Vec3 => Boolean(point));
  const marginMm = 300;
  return {
    min: {
      x: Math.min(scene.bounds.min.x, ...points.map((point) => point.x)) - marginMm,
      y: Math.min(scene.bounds.min.y, ...points.map((point) => point.y)) - marginMm,
      z: Math.min(scene.bounds.min.z, ...points.map((point) => point.z)) - marginMm,
    },
    max: {
      x: Math.max(scene.bounds.max.x, ...points.map((point) => point.x)) + marginMm,
      y: Math.max(scene.bounds.max.y, ...points.map((point) => point.y)) + marginMm,
      z: Math.max(scene.bounds.max.z, ...points.map((point) => point.z)) + marginMm,
    },
  };
};

export const clipInfiniteLineToBounds = (
  line: Line3,
  bounds: Bounds3,
): { start: Vec3; end: Vec3 } | null => {
  let minimumT = Number.NEGATIVE_INFINITY;
  let maximumT = Number.POSITIVE_INFINITY;
  const epsilon = 1e-10;

  const clipAxis = (
    origin: number,
    direction: number,
    minimum: number,
    maximum: number,
  ) => {
    if (Math.abs(direction) < epsilon) return origin >= minimum && origin <= maximum;
    let nearT = (minimum - origin) / direction;
    let farT = (maximum - origin) / direction;
    if (nearT > farT) [nearT, farT] = [farT, nearT];
    minimumT = Math.max(minimumT, nearT);
    maximumT = Math.min(maximumT, farT);
    return minimumT <= maximumT;
  };

  if (!clipAxis(line.point.x, line.direction.x, bounds.min.x, bounds.max.x)) return null;
  if (!clipAxis(line.point.y, line.direction.y, bounds.min.y, bounds.max.y)) return null;
  if (!clipAxis(line.point.z, line.direction.z, bounds.min.z, bounds.max.z)) return null;
  if (!Number.isFinite(minimumT) || !Number.isFinite(maximumT)) return null;

  const pointAt = (t: number): Vec3 => ({
    x: line.point.x + line.direction.x * t,
    y: line.point.y + line.direction.y * t,
    z: line.point.z + line.direction.z * t,
  });
  return { start: pointAt(minimumT), end: pointAt(maximumT) };
};

const createExtendedPlane = (plane: Plane, bounds: Bounds3) =>
  createScenePlaneOverlayGeometry(plane, bounds, { extendToPlanePoint: false });

/**
 * Finite display geometry for the infinite Scheimpflug construction. The
 * planes and common line come only from DerivedOpticsState; scene bounds merely
 * clip their display to a navigable teaching volume.
 */
export const createScheimpflugConstructionGeometry = (
  opticsState: DerivedOpticsState,
  scene: SceneDefinition,
): ScheimpflugConstructionGeometry | null => {
  const construction = deriveScheimpflugConstruction({
    filmPlane: opticsState.filmPlane,
    lensPlane: opticsState.lensPlane,
    focusPlane: opticsState.focusPlane,
  });
  if (!opticsState.focusPlane || !construction.isValid || !construction.commonLine) return null;
  const bounds = expandedConstructionBounds(scene, opticsState);
  const filmPlane = createExtendedPlane(opticsState.filmPlane, bounds);
  const lensPlane = createExtendedPlane(opticsState.lensPlane, bounds);
  const focusPlane = createExtendedPlane(opticsState.focusPlane, bounds);
  const commonLine = clipInfiniteLineToBounds(construction.commonLine, bounds);
  if (!filmPlane || !lensPlane || !focusPlane || !commonLine) return null;
  return { bounds, filmPlane, lensPlane, focusPlane, commonLine };
};
