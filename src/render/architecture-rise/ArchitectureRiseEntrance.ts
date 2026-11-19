import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../../scenes/presentation/architectureRise";
import type { ArchitectureRiseWindowFactory } from "./ArchitectureRiseWindowDetails";

export function addArchitectureRiseEntrance(options: {
  parent: THREE.Group;
  door: ArchitectureRisePresentation["layout"]["door"];
  groundYmm: number;
  frontFacadeZmm: number;
  materials: Readonly<{ door: THREE.Material; stone: THREE.Material; base: THREE.Material }>;
  addBox: ArchitectureRiseWindowFactory;
}): THREE.Group {
  const { parent, door, groundYmm, frontFacadeZmm: front, materials, addBox } = options;
  const group = new THREE.Group();
  group.name = "architecture-rise-entry-assembly";
  group.userData.architectureRole = "masonry-entrance-assembly";
  group.userData.resources = parent.userData.resources;
  parent.add(group);

  const doorWidth = door.openingWidthMm - 40;
  const doorHeight = door.openingHeightMm - 40;
  const doorZ = front + 84;
  const openingTop = door.centerYMm + door.openingHeightMm / 2;
  const surroundDepth = 78;
  const surroundZ = front - surroundDepth / 2 + 10;
  addBox({
    name: "architecture-rise-entry-door-leaf",
    size: [doorWidth, doorHeight, 36],
    position: [door.centerXMm, door.centerYMm, doorZ],
    material: materials.door,
    parent: group,
  });
  [-1, 1].forEach((sign) => addBox({
    name: `architecture-rise-entry-door-stile-${sign < 0 ? "left" : "right"}`,
    size: [20, doorHeight - 24, 14],
    position: [door.centerXMm + sign * (doorWidth / 2 - 28), door.centerYMm, doorZ - 22],
    material: materials.stone,
    parent: group,
  }));
  [-1, 1].forEach((sign) => addBox({
    name: `architecture-rise-entry-door-panel-${sign < 0 ? "lower" : "upper"}`,
    size: [doorWidth - 92, doorHeight * 0.32, 20],
    position: [door.centerXMm, door.centerYMm + sign * doorHeight * 0.24, doorZ - 18],
    material: materials.door,
    parent: group,
  }));

  [-1, 1].forEach((sign) => addBox({
    name: `architecture-rise-entry-stone-jamb-${sign < 0 ? "left" : "right"}`,
    size: [72, door.openingHeightMm, surroundDepth],
    position: [door.centerXMm + sign * (door.openingWidthMm / 2 + 36), door.centerYMm, surroundZ],
    material: materials.stone,
    parent: group,
  }));
  addBox({
    name: "architecture-rise-entry-stone-lintel",
    size: [door.openingWidthMm + 144, 72, surroundDepth],
    position: [door.centerXMm, openingTop + 36, surroundZ],
    material: materials.stone,
    parent: group,
  });
  addBox({
    name: "architecture-rise-entry-stone-lintel-cap",
    size: [door.openingWidthMm + 220, 32, surroundDepth + 48],
    position: [door.centerXMm, openingTop + 88, surroundZ - 24],
    material: materials.stone,
    parent: group,
  });
  addBox({
    name: "architecture-rise-entry-stone-keystone",
    size: [96, 82, surroundDepth + 54],
    position: [door.centerXMm, openingTop + 38, surroundZ - 27],
    material: materials.stone,
    parent: group,
  });
  [-1, 1].forEach((sign) => {
    const pilasterX = door.centerXMm + sign * (door.openingWidthMm / 2 + 72 + 45);
    addBox({
      name: `architecture-rise-entry-engaged-pilaster-${sign < 0 ? "left" : "right"}`,
      size: [90, door.openingHeightMm, 62],
      position: [pilasterX, door.centerYMm, front - 42],
      material: materials.stone,
      parent: group,
    });
    addBox({
      name: `architecture-rise-entry-pilaster-cap-${sign < 0 ? "left" : "right"}`,
      size: [132, 48, 108],
      position: [pilasterX, openingTop + 24, front - 44],
      material: materials.stone,
      parent: group,
    });
    addBox({
      name: `architecture-rise-entry-stone-jamb-plinth-${sign < 0 ? "left" : "right"}`,
      size: [96, 168, 124],
      position: [door.centerXMm + sign * (door.openingWidthMm / 2 + 56), groundYmm + 166, front - 62],
      material: materials.base,
      parent: group,
    });
  });
  addBox({
    name: "architecture-rise-entry-threshold",
    size: [door.openingWidthMm + 120, 34, 220],
    position: [door.centerXMm, groundYmm + 17, front - 76],
    material: materials.stone,
    parent: group,
  });
  addBox({
    name: "architecture-rise-entry-step",
    size: [door.openingWidthMm + 210, 82, 360],
    position: [door.centerXMm, groundYmm + 41, front - 230],
    material: materials.base,
    parent: group,
  });
  group.userData.entryStyle = {
    surround: "engaged-stone-pilasters-with-layered-lintel",
    thresholdAndStep: "connected",
    openingId: door.id,
  };
  return group;
}
