import type { DerivedOpticsState, Vec3 } from "../types/optics";
import {
  focusFundamentalsPerspectiveReferencePoints,
  type FocusFundamentalsFrameReferencePoints,
} from "../scenes/focusFundamentalsTargets";
import { projectWorldPointToFilmPlaneGroundGlass } from "./groundGlassFilmPlaneProjection";

type ProjectedFrame = {
  topLeft: Vec3;
  topRight: Vec3;
  bottomLeft: Vec3;
  bottomRight: Vec3;
  widthMm: number;
  heightMm: number;
  centerMm: Vec3;
  allPointsVisible: boolean;
};

export type FocusFundamentalsPerspectiveMetric = {
  front: ProjectedFrame;
  back: ProjectedFrame;
  /** Projection scale-independent relationship between corresponding frame widths. */
  backToFrontWidthRatio: number;
};

/** Conservative regression floor selected below the observed production signal. */
export const focusFundamentalsMinimumFrontPerspectiveDelta = 0.001;

const distance = (a: Vec3, b: Vec3): number =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const midpoint = (a: Vec3, b: Vec3): Vec3 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

const projectFrame = (
  points: FocusFundamentalsFrameReferencePoints,
  opticsState: DerivedOpticsState,
): ProjectedFrame | null => {
  const projected = Object.fromEntries(
    Object.entries(points).map(([key, worldPoint]) => [
      key,
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: opticsState.lensCenterWorld,
        filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
      }),
    ]),
  ) as Record<keyof FocusFundamentalsFrameReferencePoints, ReturnType<typeof projectWorldPointToFilmPlaneGroundGlass>>;

  const topLeft = projected.topLeft.filmPointWorld;
  const topRight = projected.topRight.filmPointWorld;
  const bottomLeft = projected.bottomLeft.filmPointWorld;
  const bottomRight = projected.bottomRight.filmPointWorld;
  if (!topLeft || !topRight || !bottomLeft || !bottomRight) return null;

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    widthMm: distance(topLeft, topRight),
    heightMm: distance(topLeft, bottomLeft),
    centerMm: midpoint(topLeft, bottomRight),
    allPointsVisible:
      projected.topLeft.visible &&
      projected.topRight.visible &&
      projected.bottomLeft.visible &&
      projected.bottomRight.visible,
  };
};

/**
 * Project the canonical open-frame corners through the same resolved lens and
 * film plane used by the live Ground Glass RTT. A whole-image scale change
 * affects both widths equally and therefore cancels from the ratio.
 */
export const projectFocusFundamentalsPerspectiveMetric = (
  opticsState: DerivedOpticsState,
): FocusFundamentalsPerspectiveMetric | null => {
  const front = projectFrame(focusFundamentalsPerspectiveReferencePoints.front, opticsState);
  const back = projectFrame(focusFundamentalsPerspectiveReferencePoints.back, opticsState);
  if (!front || !back || !Number.isFinite(front.widthMm) || front.widthMm <= 0) return null;

  return {
    front,
    back,
    backToFrontWidthRatio: back.widthMm / front.widthMm,
  };
};
