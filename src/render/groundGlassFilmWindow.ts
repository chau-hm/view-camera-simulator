import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import { resolveGroundGlassInspectionFilmWindowMm } from "./groundGlassInspectionWindow";

/** Canonical physical film crop shared by all spatial Ground Glass effects. */
export type GroundGlassFilmWindow = Readonly<{
  centerXMm: number;
  centerYMm: number;
  widthMm: number;
  heightMm: number;
}>;

export const resolveGroundGlassFilmWindow = (input: {
  filmWidthMm: number;
  filmHeightMm: number;
  inspectionWindow: GroundGlassInspectionWindow;
}): GroundGlassFilmWindow =>
  resolveGroundGlassInspectionFilmWindowMm(input);
