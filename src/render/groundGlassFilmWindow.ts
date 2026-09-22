import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import { resolveGroundGlassInspectionFilmWindowMm } from "./groundGlassInspectionWindow";

/** Physical Raw-film crop shared by all spatial Ground Glass effects. */
export type GroundGlassFilmWindowUniformState = Readonly<{
  centerXMm: number;
  centerYMm: number;
  widthMm: number;
  heightMm: number;
}>;

export const resolveGroundGlassFilmWindowUniformState = (input: {
  filmWidthMm: number;
  filmHeightMm: number;
  inspectionWindow: GroundGlassInspectionWindow;
}): GroundGlassFilmWindowUniformState =>
  resolveGroundGlassInspectionFilmWindowMm(input);
