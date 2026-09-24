export type VisibleLegendInput = {
  showFocusPlane: boolean;
  showDofRegion: boolean;
  showOpticalGeometry: boolean;
  finiteCoverageKind: "parallel-circle" | "nonparallel-conic" | null;
  isInfinityFocus: boolean;
  hasFiniteFarPlane: boolean;
};

export function getVisibleSceneLegendKeys(input: VisibleLegendInput): string[] {
  const keys: string[] = [];
  if (input.showOpticalGeometry) {
    keys.push("film", "lens", "fov", "axis");
    if (input.finiteCoverageKind === "parallel-circle") keys.push("imageCircle");
    if (input.finiteCoverageKind === "nonparallel-conic") keys.push("coverageFootprint");
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
