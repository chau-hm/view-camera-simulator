import type { ProjectionData } from "../../types/optics";

export const calculateGroundGlassProjection = (
  assistModeEnabled: boolean,
): ProjectionData => ({
  invertHorizontal: !assistModeEnabled,
  invertVertical: !assistModeEnabled,
  assistModeEnabled,
});
