/** Renderer-independent dimensions for the Architecture Rise presentation layer. */
export type ArchitectureRiseDetailStyle = Readonly<{
  masonry: Readonly<{
    brickLengthMm: number;
    brickHeightMm: number;
    mortarJointMm: number;
    tileBrickPitches: number;
    tileCourses: number;
    seed: number;
    quietZoneMarginMm: number;
  }>;
  base: Readonly<{
    heightAboveGroundMm: number;
    blockCourseHeightMm: number;
    blockWidthMm: number;
    jointWidthMm: number;
  }>;
  window: Readonly<{
    outerSillProjectionMm: number;
    outerSillThicknessMm: number;
    outerLintelProjectionMm: number;
    outerLintelThicknessMm: number;
    sillBracketWidthMm: number;
    sillBracketHeightMm: number;
    sillBracketDepthMm: number;
    surroundReliefMm: number;
    keystoneWidthMm: number;
  }>;
  cornice: Readonly<{
    bandHeightMm: number;
    projectionMm: number;
    bracketWidthMm: number;
    bracketHeightMm: number;
    bracketDepthMm: number;
    bracketSpacingMm: number;
    bracketCornerClearanceMm: number;
    parapetCourseHeightMm: number;
  }>;
}>;
