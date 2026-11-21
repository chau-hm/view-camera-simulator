import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../../scenes/presentation/architectureRise";
import type { ArchitectureRiseWallOpening } from "./ArchitectureRiseMasonry";
import type { ArchitectureRiseWindowFactory } from "./ArchitectureRiseWindowDetails";

type RearOpening = ArchitectureRiseWallOpening & { use: "room" | "stair" | "door" };

export function getArchitectureRiseRearOpenings(layout: ArchitectureRisePresentation["layout"]): RearOpening[] {
  const { minXMm, maxXMm, minYMm } = layout.mainFacade;
  const halfBayOffset = (maxXMm - minXMm) / 4;
  const center = (minXMm + maxXMm) / 2;
  const roomX = center - halfBayOffset;
  const stairX = center + halfBayOffset;
  const floors = layout.windows.filter(window => window.elevation === "front" && window.id.endsWith("-left"));
  const rooms: RearOpening[] = floors.map(window => {
    const upperStorey = window.id === "top-left";
    // Keep the top room's sill on the established storey. Shorten the head
    // so that a full brick course can bear between its lintel and the cornice.
    const height = upperStorey ? window.openingHeightMm + 40 : window.id === "ground-left" ? 620 : 520;
    return {
      id: `room-${window.id.split("-")[0]}`, use: "room",
      centerHorizontalMm: roomX,
      centerVerticalMm: upperStorey ? window.centerYMm - (520 - height) / 2 : window.centerYMm,
      widthMm: 680, heightMm: height,
    };
  });
  // The stair shares the service-entry bay. Its landings fall between the occupied floors.
  const stairs: RearOpening[] = floors.slice(1).map((floor, index) => ({
    id: `stair-${index === 0 ? "lower" : "upper"}`,
    use: "stair",
    centerHorizontalMm: stairX,
    centerVerticalMm: (floors[index]!.centerYMm + floor.centerYMm) / 2,
    widthMm: 380,
    heightMm: 520,
  }));
  return [...rooms, ...stairs, {
    id: "service-door", use: "door",
    centerHorizontalMm: stairX, centerVerticalMm: minYMm + 650, widthMm: 480, heightMm: 1300,
  }];
}

export function addArchitectureRiseRearJoinery(options: {
  parent: THREE.Group;
  openings: readonly RearOpening[];
  rearZMm: number;
  materials: Readonly<{ glass: THREE.Material; timber: THREE.Material; stone: THREE.Material }>;
  addBox: ArchitectureRiseWindowFactory;
}): void {
  const { parent, openings, rearZMm, materials, addBox } = options;
  for (const opening of openings) {
    const { centerHorizontalMm: x, centerVerticalMm: y, widthMm: width, heightMm: height } = opening;
    const name = `architecture-rise-rear-${opening.id}`;
    const bottom = y - height / 2;
    const top = y + height / 2;
    // The exposed stone projects 6 mm into the clear opening. The masonry
    // still bears behind it, with no overlapping horizontal finish faces.
    const revealLip = 6;
    addBox({
      name: `${name}-lintel`, size: [width + 156, 80, 116],
      position: [x, top + 40 - revealLip, rearZMm - 22], material: materials.stone, parent,
    });

    if (opening.use === "door") {
      addBox({
        name: `${name}-leaf`, size: [width + 2, height + 2, 38],
        position: [x, y, rearZMm - 120], material: materials.timber, parent,
      });
      // The inner edge of the threshold meets the set-back leaf.
      addBox({
        name: `${name}-threshold`, size: [width + 88, 40, 256],
        position: [x, bottom + 20, rearZMm + 22], material: materials.stone, parent,
      });
      addBox({
        name: `${name}-upper-panel`, size: [width - 94, height * 0.37, 18],
        position: [x, y + height * 0.23, rearZMm - 96], material: materials.timber, parent,
      });
      continue;
    }

    // Each aperture has its own pane behind the masonry. A 1 mm seat on every
    // edge seals the joint. The exposed brick in the wall thickness is the reveal.
    addBox({
      name: `${name}-glazing`, size: [width + 2, height + 2, 24],
      position: [x, y, rearZMm - 112], material: materials.glass, parent,
    });
    addBox({
      name: `${name}-sill`, size: [width + 104, 60, 140],
      position: [x, bottom - 30 + revealLip, rearZMm - 10], material: materials.stone, parent,
    });
    addBox({
      name: `${name}-transom`, size: [width, 26, 22],
      position: [x, bottom + height * 0.4, rearZMm - 94], material: materials.timber, parent,
    });
    if (opening.use === "room") {
      addBox({
        name: `${name}-mullion`, size: [28, height, 18],
        position: [x, y, rearZMm - 95], material: materials.timber, parent,
      });
    }
  }
}
