export type GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: number;
  displayBlurScale: number;
};

const DEFAULT_DOF_VISUAL_SETTINGS: GroundGlassDofVisualSettings = {
  maximumBlurRadiusPx: 60,
  displayBlurScale: 1,
};

const TABLE_TILT_DOF_VISUAL_SETTINGS: GroundGlassDofVisualSettings = {
  // The physical CoC still comes from the shared optics state. This display
  // calibration makes its small pixel footprint legible on Table Tilt detail.
  maximumBlurRadiusPx: 42,
  displayBlurScale: 3.2,
};

export const getGroundGlassDofVisualSettings = (
  sceneId?: string,
): GroundGlassDofVisualSettings =>
  sceneId === "table-tilt"
    ? TABLE_TILT_DOF_VISUAL_SETTINGS
    : DEFAULT_DOF_VISUAL_SETTINGS;
