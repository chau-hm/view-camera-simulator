import { mirrorShiftScene } from "../definitions/mirror-shift";
import { mirrorShiftGeometry } from "../mirrorShiftGeometry";

/** Canonical renderer-neutral geometry consumed by the Mirror Shift asset. */
export type MirrorShiftPresentation = Readonly<{
  sceneId: typeof mirrorShiftScene.id;
  geometry: typeof mirrorShiftGeometry;
}>;

export const MIRROR_SHIFT_PRESENTATION: MirrorShiftPresentation = Object.freeze({
  sceneId: mirrorShiftScene.id,
  geometry: mirrorShiftGeometry,
});
