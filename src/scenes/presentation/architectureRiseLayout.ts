import geometry from "../architectureRiseGeometry";

export type ArchitectureRiseFrontWindow = Readonly<{
  id: string;
  elevation: "front";
  centerXMm: number;
  centerYMm: number;
  openingWidthMm: number;
  openingHeightMm: number;
  glazingInsetMm: number;
  glazingDepthMm: number;
  trimWidthMm: number;
  frameWidthMm: number;
  mullionWidthMm: number;
  transomHeightMm: number;
}>;

export type ArchitectureRiseEastWindow = Readonly<{
  id: string;
  elevation: "east";
  centerYMm: number;
  centerZMm: number;
  openingWidthMm: number;
  openingHeightMm: number;
  glazingInsetMm: number;
  glazingDepthMm: number;
  trimWidthMm: number;
  frameWidthMm: number;
  mullionWidthMm: number;
}>;

export type ArchitectureRiseWindow = ArchitectureRiseFrontWindow | ArchitectureRiseEastWindow;

export type ArchitectureRiseDoor = Readonly<{
  id: string;
  centerXMm: number;
  centerYMm: number;
  openingWidthMm: number;
  openingHeightMm: number;
}>;

const front = geometry.facade.frontFacadeZ;
const mainLeft = geometry.building.center.x - geometry.building.width / 2;
const mainRight = geometry.building.center.x + geometry.building.width / 2;

const frontWindow = (
  id: string,
  centerXMm: number,
  centerYMm: number,
  openingWidthMm: number,
  openingHeightMm: number,
): ArchitectureRiseFrontWindow => ({
  id,
  elevation: "front",
  centerXMm,
  centerYMm,
  openingWidthMm,
  openingHeightMm,
  glazingInsetMm: 112,
  glazingDepthMm: 24,
  trimWidthMm: 72,
  frameWidthMm: 28,
  mullionWidthMm: 16,
  transomHeightMm: 16,
});

const eastWindow = (
  id: string,
  centerYMm: number,
  centerZMm: number,
  openingWidthMm: number,
  openingHeightMm: number,
): ArchitectureRiseEastWindow => ({
  id,
  elevation: "east",
  centerYMm,
  centerZMm,
  openingWidthMm,
  openingHeightMm,
  glazingInsetMm: 112,
  glazingDepthMm: 24,
  trimWidthMm: 56,
  frameWidthMm: 28,
  mullionWidthMm: 16,
});

/**
 * Rebuildable Architecture Rise presentation layout. The canonical facade,
 * focus targets, bounds and task regions remain owned by architectureRiseGeometry.
 */
export const ARCHITECTURE_RISE_PRESENTATION_LAYOUT = {
  mainFacade: {
    minXMm: mainLeft,
    maxXMm: mainRight,
    minYMm: geometry.facade.mainBodyBottomY,
    maxYMm: geometry.facade.mainBodyTopY,
    frontZMm: front,
    backZMm: geometry.facade.backFacadeZ,
  },
  serviceReturn: {
    minXMm: mainRight,
    maxXMm: 1900,
    minYMm: geometry.ground.y,
    maxYMm: 1800,
    minZMm: 9600,
    maxZMm: 10500,
  },
  windows: [
    frontWindow("ground-left", -900, -500, 420, 500),
    frontWindow("ground-right", 900, -500, 420, 500),
    frontWindow("middle-left", -900, 1600, 420, 330),
    frontWindow("middle-center", 0, 1600, 420, 330),
    frontWindow("middle-right", 900, 1600, 420, 330),
    frontWindow("top-left", -900, 2600, 420, 360),
    frontWindow("top-center", 0, 2600, 420, 360),
    eastWindow("service-east-lower", -400, 9825, 250, 460),
    eastWindow("service-east-upper", 900, 10275, 250, 460),
  ] satisfies readonly ArchitectureRiseWindow[],
  door: {
    id: "main-entry",
    centerXMm: 0,
    centerYMm: -500,
    openingWidthMm: 500,
    openingHeightMm: 1360,
  } satisfies ArchitectureRiseDoor,
} as const;

export type ArchitectureRisePresentationLayout = typeof ARCHITECTURE_RISE_PRESENTATION_LAYOUT;

export type ArchitectureRiseGlazingBoundsMm = Readonly<{
  minXMm: number;
  maxXMm: number;
  minYMm: number;
  maxYMm: number;
  minZMm: number;
  maxZMm: number;
}>;

export function getArchitectureRiseGlazingBoundsMm(
  window: ArchitectureRiseWindow,
): ArchitectureRiseGlazingBoundsMm {
  if (window.elevation === "front") {
    const centerZ = geometry.facade.frontFacadeZ + window.glazingInsetMm;
    return {
      minXMm: window.centerXMm - window.openingWidthMm / 2,
      maxXMm: window.centerXMm + window.openingWidthMm / 2,
      minYMm: window.centerYMm - window.openingHeightMm / 2,
      maxYMm: window.centerYMm + window.openingHeightMm / 2,
      minZMm: centerZ - window.glazingDepthMm / 2,
      maxZMm: centerZ + window.glazingDepthMm / 2,
    };
  }

  const eastFace = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm;
  const centerX = eastFace - window.glazingInsetMm;
  return {
    minXMm: centerX - window.glazingDepthMm / 2,
    maxXMm: centerX + window.glazingDepthMm / 2,
    minYMm: window.centerYMm - window.openingHeightMm / 2,
    maxYMm: window.centerYMm + window.openingHeightMm / 2,
    minZMm: window.centerZMm - window.openingWidthMm / 2,
    maxZMm: window.centerZMm + window.openingWidthMm / 2,
  };
}
