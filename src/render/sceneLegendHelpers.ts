export type VisibleLegendInput = {
  showFocusPlane: boolean;
  showDofRegion: boolean;
  showOpticalGeometry: boolean;
  hasFiniteImageCircle: boolean;
  isInfinityFocus: boolean;
  hasFiniteFarPlane: boolean;
};

export function getVisibleSceneLegendKeys(input: VisibleLegendInput): string[] {
  const keys: string[] = [];
  if (input.showOpticalGeometry) {
    keys.push("film", "lens", "fov", "axis");
    if (input.hasFiniteImageCircle) keys.push("imageCircle");
  }
  if (input.showFocusPlane) {
    keys.push("focus");
  }
  if (input.showDofRegion) {
    keys.push("nearDof");
    if (input.hasFiniteFarPlane) keys.push("farDof");
  }
  return keys;
}
