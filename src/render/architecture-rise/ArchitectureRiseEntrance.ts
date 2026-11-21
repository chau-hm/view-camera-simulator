import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../../scenes/presentation/architectureRise";
import type { ArchitectureRiseWindowFactory } from "./ArchitectureRiseWindowDetails";
import { toWorld } from "../rttUtils";

export function addArchitectureRiseEntrance(options: {
  parent: THREE.Group;
  door: ArchitectureRisePresentation["layout"]["door"];
  groundYmm: number;
  frontFacadeZmm: number;
  materials: Readonly<{ door: THREE.Material; stone: THREE.Material; base: THREE.Material; glass: THREE.Material }>;
  addBox: ArchitectureRiseWindowFactory;
}): THREE.Group {
  const { parent, door, groundYmm, frontFacadeZmm: front, materials, addBox } = options;
  const group = new THREE.Group();
  group.name = "architecture-rise-entry-assembly";
  group.userData.architectureRole = "masonry-entrance-assembly";
  group.userData.resources = parent.userData.resources;
  parent.add(group);

  const doorWidth = door.openingWidthMm;
  const radius = doorWidth / 2;
  const doorHeight = door.openingHeightMm - radius;
  const doorZ = front + 84;
  const openingTop = door.centerYMm + door.openingHeightMm / 2;
  const springY = openingTop - radius;
  const leafCenterY = springY - doorHeight / 2;
  const surroundDepth = 78;
  const surroundZ = front - surroundDepth / 2 + 10;
  addBox({
    name: "architecture-rise-entry-door-leaf",
    size: [doorWidth, doorHeight, 36],
    position: [door.centerXMm, leafCenterY, doorZ],
    material: materials.door,
    parent: group,
  });
  [-1, 1].forEach((sign) => addBox({
    name: `architecture-rise-entry-door-stile-${sign < 0 ? "left" : "right"}`,
    size: [38, doorHeight, 18],
    position: [door.centerXMm + sign * (doorWidth / 2 - 19), leafCenterY, doorZ - 23],
    material: materials.door,
    parent: group,
  }));
  [-1, 1].forEach((sign) => addBox({
    name: `architecture-rise-entry-door-panel-${sign < 0 ? "lower" : "upper"}`,
    size: [doorWidth - 92, doorHeight * 0.32, 20],
    position: [door.centerXMm, leafCenterY + sign * doorHeight * 0.24, doorZ - 22],
    material: materials.door,
    parent: group,
  }));

  [-1, 1].forEach((sign) => addBox({
    name: `architecture-rise-entry-stone-jamb-${sign < 0 ? "left" : "right"}`,
    size: [72, doorHeight, surroundDepth],
    position: [door.centerXMm + sign * (door.openingWidthMm / 2 + 36), leafCenterY, surroundZ],
    material: materials.stone,
    parent: group,
  }));
  // The head fills the rectangular wall opening above the semicircular fanlight.
  // Its soffit extends from the face of the portal to the glass rebate.
  const inner = toWorld(radius);
  const outer = toWorld(radius + 72);
  const head = new THREE.Shape();
  head.moveTo(-outer, 0);
  head.lineTo(-inner, 0);
  head.absarc(0, 0, inner, Math.PI, 0, true);
  head.lineTo(outer, 0);
  head.lineTo(outer, outer);
  head.lineTo(-outer, outer);
  head.closePath();
  const lintel = new THREE.Mesh(new THREE.ExtrudeGeometry(head, {
    depth: toWorld(164), bevelEnabled: false, curveSegments: 12,
  }), materials.base);
  lintel.name = "architecture-rise-entry-stone-lintel";
  lintel.position.set(toWorld(door.centerXMm), toWorld(springY), toWorld(front - 60));
  group.add(lintel);

  const stones: THREE.Shape[] = [];
  const count = 7;
  const jointAngle = 0.012;
  for (let i = 0; i < count; i++) {
    const start = i * Math.PI / count + (i > 0 ? jointAngle : 0);
    const end = (i + 1) * Math.PI / count - (i < count - 1 ? jointAngle : 0);
    const crown = i === (count - 1) / 2 ? outer + toWorld(18) : outer;
    const voussoir = new THREE.Shape();
    voussoir.absarc(0, 0, inner, start, end, false);
    voussoir.absarc(0, 0, crown, end, start, true);
    voussoir.closePath();
    stones.push(voussoir);
  }
  const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(stones, {
    depth: toWorld(38), bevelEnabled: false, curveSegments: 3,
  }), materials.stone);
  arch.name = "architecture-rise-entry-arch-stones";
  arch.position.set(toWorld(door.centerXMm), toWorld(springY), toWorld(front - 82));
  group.add(arch);

  addBox({
    name: "architecture-rise-entry-fanlight",
    size: [doorWidth, radius, 22],
    position: [door.centerXMm, springY + radius / 2, front + 109],
    material: materials.glass, parent: group,
  });
  addBox({
    name: "architecture-rise-entry-transom",
    size: [doorWidth, 40, 84],
    position: [door.centerXMm, springY, front + 79],
    material: materials.door, parent: group,
  });
  for (const angle of [-Math.PI / 4, 0, Math.PI / 4]) {
    const spoke = addBox({
      name: `architecture-rise-entry-fanlight-bar-${Math.sign(angle)}`,
      size: [14, radius + 2, 18],
      position: [door.centerXMm + radius / 2 * Math.sin(angle), springY + radius / 2 * Math.cos(angle), front + 96],
      material: materials.door, parent: group,
    });
    spoke.rotation.z = -angle;
  }
  addBox({
    name: "architecture-rise-entry-stone-lintel-cap",
    size: [door.openingWidthMm + 220, 32, surroundDepth + 48],
    position: [door.centerXMm, openingTop + 88, surroundZ - 24],
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
    surround: "voussoir-arch-with-recessed-fanlight",
    thresholdAndStep: "connected",
    openingId: door.id,
  };
  return group;
}
