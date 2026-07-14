export const SCENE_OVERLAY_INLINE_MIN_WIDTH_PX = 620;

export type SceneOverlayPresentation = "inline" | "collapsed";

export const getSceneOverlayPresentation = (widthPx: number): SceneOverlayPresentation =>
  widthPx >= SCENE_OVERLAY_INLINE_MIN_WIDTH_PX ? "inline" : "collapsed";
