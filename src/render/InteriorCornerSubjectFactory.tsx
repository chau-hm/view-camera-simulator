/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry from "../scenes/interiorCornerGeometry";
import { toWorld } from "./rttUtils";
import {
  createFocusFriendlyMaterial,
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";

type InteriorCornerMaterials = {
  wall: THREE.Material;
  ceiling: THREE.Material;
  floor: THREE.Material;
  trim: THREE.Material;
  wood: THREE.Material;
  artwork: THREE.Material;
  artworkAccent: THREE.Material;
  fabric: THREE.Material;
  rug: THREE.Material;
  metal: THREE.Material;
};

const createStandardMaterial = (color: string, roughness = 0.88) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const addBox = ({
  root,
  name,
  size,
  position,
  material,
}: {
  root: THREE.Object3D;
  name: string;
  size: [number, number, number];
  position: [number, number, number];
  material: THREE.Material;
}): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(size[0]), toWorld(size[1]), toWorld(size[2])),
    material,
  );
  mesh.name = name;
  mesh.position.set(toWorld(position[0]), toWorld(position[1]), toWorld(position[2]));
  root.add(mesh);
  return mesh;
};

const addSideArtwork = (
  root: THREE.Object3D,
  detail: (typeof geometry.wallDetails)[number],
  materials: InteriorCornerMaterials,
) => {
  const group = new THREE.Group();
  group.name = `interior-corner-wall-detail-${detail.id}`;
  root.add(group);

  const x = geometry.room.interiorSideSurfaceX - 18;
  const frame = 34;
  const depth = 38;
  const frameMaterial = materials.wood;
  const artworkWidth = detail.width;
  const artworkHeight = detail.height;

  addBox({
    root: group,
    name: `${detail.id}-artwork`,
    size: [depth, artworkHeight, artworkWidth],
    position: [x, detail.y, detail.z],
    material: materials.artwork,
  });
  addBox({
    root: group,
    name: `${detail.id}-frame-top`,
    size: [depth + 16, frame, artworkWidth + frame],
    position: [x - 4, detail.y + artworkHeight / 2 + frame / 2, detail.z],
    material: frameMaterial,
  });
  addBox({
    root: group,
    name: `${detail.id}-frame-bottom`,
    size: [depth + 16, frame, artworkWidth + frame],
    position: [x - 4, detail.y - artworkHeight / 2 - frame / 2, detail.z],
    material: frameMaterial,
  });
  addBox({
    root: group,
    name: `${detail.id}-frame-near-edge`,
    size: [depth + 16, artworkHeight, frame],
    position: [x - 4, detail.y, detail.z - artworkWidth / 2 - frame / 2],
    material: frameMaterial,
  });
  addBox({
    root: group,
    name: `${detail.id}-frame-far-edge`,
    size: [depth + 16, artworkHeight, frame],
    position: [x - 4, detail.y, detail.z + artworkWidth / 2 + frame / 2],
    material: frameMaterial,
  });

  const accentHeight = artworkHeight * 0.68;
  addBox({
    root: group,
    name: `${detail.id}-artwork-accent`,
    size: [depth + 8, accentHeight, 28],
    position: [x - 22, detail.y, detail.z - artworkWidth * 0.16],
    material: materials.artworkAccent,
  });
  addBox({
    root: group,
    name: `${detail.id}-artwork-line`,
    size: [depth + 10, artworkHeight * 0.06, artworkWidth * 0.72],
    position: [x - 24, detail.y + artworkHeight * 0.2, detail.z + artworkWidth * 0.08],
    material: materials.artworkAccent,
  });
};

const addBackArtwork = (
  root: THREE.Object3D,
  materials: InteriorCornerMaterials,
) => {
  const group = new THREE.Group();
  group.name = "interior-corner-rear-wall-artwork";
  root.add(group);

  const z = geometry.room.interiorBackSurfaceZ - 22;
  const x = -520;
  const y = 2350;
  const width = 1550;
  const height = 1050;
  const frame = 42;
  const depth = 42;

  addBox({
    root: group,
    name: "interior-corner-rear-artwork-panel",
    size: [width, height, depth],
    position: [x, y, z],
    material: materials.artwork,
  });
  addBox({
    root: group,
    name: "interior-corner-rear-artwork-top-frame",
    size: [width + frame, frame, depth + 16],
    position: [x, y + height / 2 + frame / 2, z - 4],
    material: materials.wood,
  });
  addBox({
    root: group,
    name: "interior-corner-rear-artwork-bottom-frame",
    size: [width + frame, frame, depth + 16],
    position: [x, y - height / 2 - frame / 2, z - 4],
    material: materials.wood,
  });
  addBox({
    root: group,
    name: "interior-corner-rear-artwork-left-frame",
    size: [frame, height, depth + 16],
    position: [x - width / 2 - frame / 2, y, z - 4],
    material: materials.wood,
  });
  addBox({
    root: group,
    name: "interior-corner-rear-artwork-right-frame",
    size: [frame, height, depth + 16],
    position: [x + width / 2 + frame / 2, y, z - 4],
    material: materials.wood,
  });
  addBox({
    root: group,
    name: "interior-corner-rear-artwork-accent",
    size: [width * 0.64, height * 0.12, depth + 10],
    position: [x, y + height * 0.12, z - 26],
    material: materials.artworkAccent,
  });
};

const addSideWallMoulding = (
  root: THREE.Object3D,
  materials: InteriorCornerMaterials,
) => {
  const x = geometry.room.interiorSideSurfaceX - 62;
  const panelHeight = 2280;
  const panelBottom = geometry.room.floorY + 560;
  const panelCenters = [3500, 6800, 9300];

  panelCenters.forEach((z, index) => {
    const panelWidth = index === 0 ? 1300 : 1120;
    const rail = 26;
    addBox({
      root,
      name: `interior-corner-side-panel-${index + 1}-near-rail`,
      size: [32, panelHeight, rail],
      position: [x, panelBottom + panelHeight / 2, z - panelWidth / 2],
      material: materials.trim,
    });
    addBox({
      root,
      name: `interior-corner-side-panel-${index + 1}-far-rail`,
      size: [32, panelHeight, rail],
      position: [x, panelBottom + panelHeight / 2, z + panelWidth / 2],
      material: materials.trim,
    });
    addBox({
      root,
      name: `interior-corner-side-panel-${index + 1}-top-rail`,
      size: [32, rail, panelWidth + rail],
      position: [x, panelBottom + panelHeight, z],
      material: materials.trim,
    });
    addBox({
      root,
      name: `interior-corner-side-panel-${index + 1}-bottom-rail`,
      size: [32, rail, panelWidth + rail],
      position: [x, panelBottom, z],
      material: materials.trim,
    });
  });
};

const addFocusProbes = (root: THREE.Object3D) => {
  geometry.focusTargets.forEach((target) => {
    const probe = new THREE.Object3D();
    probe.name = `interior-corner-focus-${target.id}`;
    probe.position.set(
      toWorld(target.worldPosition.x),
      toWorld(target.worldPosition.y),
      toWorld(target.worldPosition.z),
    );
    probe.userData.focusTargetId = target.id;
    probe.userData.focusProbeWorldMm = { ...target.worldPosition };
    root.add(probe);
  });
};

const addInteriorLocalLight = (root: THREE.Group): void => {
  // Keep the practical light in the shared subject group so viewport and RTT
  // receive the same restrained interior contribution.
  const light = new THREE.PointLight("#fff1d6", 5, 7.5, 2);
  light.name = "interior-corner-local-light";
  light.position.set(
    toWorld(420),
    toWorld(geometry.room.floorY + 1310),
    toWorld(8300),
  );
  root.add(light);
};

const addInteriorFurnitureStructure = (
  root: THREE.Group,
  materials: InteriorCornerMaterials,
): void => {
  const structure = new THREE.Group();
  structure.name = "interior-corner-furniture-structure";

  const consoleLegGeometry = new THREE.BoxGeometry(toWorld(80), toWorld(1), toWorld(80));
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((zSign) => {
      const leg = new THREE.Mesh(consoleLegGeometry, materials.wood);
      leg.name = `interior-corner-console-leg-${xSign < 0 ? "left" : "right"}-${zSign < 0 ? "near" : "far"}`;
      leg.scale.y = toWorld(480);
      leg.position.set(
        toWorld(-1050 + xSign * 760),
        toWorld(geometry.room.floorY + 240),
        toWorld(9850 + zSign * 150),
      );
      structure.add(leg);
    });
  });

  addBox({
    root: structure,
    name: "interior-corner-console-lower-shelf",
    size: [1400, 50, 300],
    position: [-1050, geometry.room.floorY + 185, 9850],
    material: materials.wood,
  });

  const benchLegGeometry = new THREE.BoxGeometry(toWorld(72), toWorld(260), toWorld(72));
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((zSign) => {
      const leg = new THREE.Mesh(benchLegGeometry, materials.wood);
      leg.name = `interior-corner-bench-leg-${xSign < 0 ? "left" : "right"}-${zSign < 0 ? "near" : "far"}`;
      leg.position.set(
        toWorld(-850 + xSign * 720),
        toWorld(geometry.room.floorY + 130),
        toWorld(6500 + zSign * 190),
      );
      structure.add(leg);
    });
  });

  const floorJointMaterial = materials.trim;
  const floorJointGeometry = new THREE.BoxGeometry(
    toWorld(geometry.room.width - 220),
    toWorld(8),
    toWorld(14),
  );
  [3300, 4700, 6100, 7500, 8900, 10300].forEach((z, index) => {
    const joint = new THREE.Mesh(floorJointGeometry, floorJointMaterial);
    joint.name = `interior-corner-floor-joint-${index + 1}`;
    joint.position.set(
      0,
      toWorld(geometry.room.floorY + 4),
      toWorld(z),
    );
    structure.add(joint);
  });

  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(toWorld(85), toWorld(110), toWorld(260), 16),
    materials.artworkAccent,
  );
  vase.name = "interior-corner-console-vase";
  vase.position.set(toWorld(-1050), toWorld(geometry.room.floorY + 820), toWorld(9850));
  structure.add(vase);

  const finial = new THREE.Mesh(
    new THREE.CylinderGeometry(toWorld(32), toWorld(42), toWorld(90), 12),
    materials.metal,
  );
  finial.name = "interior-corner-lamp-finial";
  finial.position.set(toWorld(420), toWorld(geometry.room.floorY + 1495), toWorld(8300));
  structure.add(finial);

  root.add(structure);
};

export const createInteriorCornerGroup = (): THREE.Group => {
  const root = new THREE.Group();
  root.name = "interior-corner-subject";

  const materials: InteriorCornerMaterials = {
    wall: createFocusFriendlyMaterial({
      pattern: "fine-grid",
      primaryColor: "#d8d2c5",
      secondaryColor: "#cfc7b8",
      repeat: [4, 6],
      roughness: 0.96,
    }),
    ceiling: createStandardMaterial("#e8e3d9", 0.98),
    floor: createStandardMaterial("#8e7963", 0.94),
    trim: createStandardMaterial("#f0ece3", 0.84),
    wood: createFocusFriendlyMaterial({
      pattern: "linear-grain",
      primaryColor: "#594c40",
      secondaryColor: "#765f4d",
      repeat: [2, 10],
      roughness: 0.76,
    }),
    artwork: createStandardMaterial("#66808a", 0.72),
    artworkAccent: createStandardMaterial("#c48b62", 0.7),
    fabric: createFocusFriendlyMaterial({
      pattern: "subtle-checker",
      primaryColor: "#6d7b78",
      secondaryColor: "#788782",
      repeat: [8, 8],
      roughness: 0.98,
    }),
    rug: createStandardMaterial("#b7a995", 1),
    metal: createStandardMaterial("#7f8b88", 0.42),
  };

  addBox({
    root,
    name: "interior-corner-floor",
    size: [geometry.room.width, 80, geometry.room.depth],
    position: [0, geometry.room.floorY - 40, geometry.room.nearZ + geometry.room.depth / 2],
    material: materials.floor,
  });
  addBox({
    root,
    name: "interior-corner-back-wall",
    size: [geometry.room.width, geometry.room.height, geometry.room.wallThickness],
    position: [0, geometry.room.floorY + geometry.room.height / 2, geometry.room.backWallZ],
    material: materials.wall,
  });
  addBox({
    root,
    name: "interior-corner-receding-side-wall",
    size: [geometry.room.wallThickness, geometry.room.height, geometry.room.depth],
    position: [
      geometry.room.sideWallX,
      geometry.room.floorY + geometry.room.height / 2,
      geometry.room.nearZ + geometry.room.depth / 2,
    ],
    material: materials.wall,
  });
  addBox({
    root,
    name: "interior-corner-room-corner",
    size: [220, geometry.room.height + 120, 220],
    position: [geometry.room.sideWallX - 80, geometry.room.floorY + geometry.room.height / 2, geometry.room.backWallZ - 80],
    material: materials.trim,
  });
  addBox({
    root,
    name: "interior-corner-ceiling",
    size: [geometry.room.width, 120, geometry.room.depth],
    position: [0, geometry.room.ceilingY + 60, geometry.room.nearZ + geometry.room.depth / 2],
    material: materials.ceiling,
  });

  addBox({
    root,
    name: "interior-corner-back-cornice",
    size: [geometry.room.width + 100, 280, 150],
    position: [0, geometry.room.ceilingY - 180, geometry.room.backWallZ - 110],
    material: materials.trim,
  });
  addBox({
    root,
    name: "interior-corner-side-cornice",
    size: [150, 280, geometry.room.depth + 100],
    position: [geometry.room.sideWallX - 110, geometry.room.ceilingY - 180, geometry.room.nearZ + geometry.room.depth / 2],
    material: materials.trim,
  });
  addBox({
    root,
    name: "interior-corner-back-baseboard",
    size: [geometry.room.width, 180, 120],
    position: [0, geometry.room.floorY + 90, geometry.room.backWallZ - 110],
    material: materials.trim,
  });
  addBox({
    root,
    name: "interior-corner-side-baseboard",
    size: [120, 180, geometry.room.depth],
    position: [geometry.room.sideWallX - 110, geometry.room.floorY + 90, geometry.room.nearZ + geometry.room.depth / 2],
    material: materials.trim,
  });

  addSideWallMoulding(root, materials);
  geometry.wallDetails.forEach((detail) => addSideArtwork(root, detail, materials));
  addBackArtwork(root, materials);

  addBox({
    root,
    name: "interior-corner-rug",
    size: [2200, 24, 3300],
    position: [180, geometry.room.floorY + 12, 5900],
    material: materials.rug,
  });
  addBox({
    root,
    name: "interior-corner-console",
    size: [1700, 620, 420],
    position: [-1050, geometry.room.floorY + 310, 9850],
    material: materials.wood,
  });
  addBox({
    root,
    name: "interior-corner-console-top",
    size: [1850, 70, 500],
    position: [-1050, geometry.room.floorY + 655, 9850],
    material: materials.trim,
  });
  addBox({
    root,
    name: "interior-corner-bench-seat",
    size: [1750, 420, 560],
    position: [-850, geometry.room.floorY + 430, 6500],
    material: materials.fabric,
  });
  addBox({
    root,
    name: "interior-corner-bench-back",
    size: [1750, 900, 120],
    position: [-850, geometry.room.floorY + 980, 6750],
    material: materials.fabric,
  });
  addBox({
    root,
    name: "interior-corner-lamp-stand",
    size: [55, 1150, 55],
    position: [420, geometry.room.floorY + 575, 8300],
    material: materials.metal,
  });
  addBox({
    root,
    name: "interior-corner-lamp-shade",
    size: [320, 280, 320],
    position: [420, geometry.room.floorY + 1310, 8300],
    material: materials.artworkAccent,
  });

  addInteriorFurnitureStructure(root, materials);
  addInteriorLocalLight(root);
  addFocusProbes(root);
  return root;
};

export const disposeInteriorCornerGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};

/** React Three Fiber boundary backed by the same group factory used by RTT. */
export const InteriorCornerSubject: React.FC = () => {
  const group = useMemo(() => createInteriorCornerGroup(), []);

  useEffect(
    () => () => {
      disposeInteriorCornerGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
