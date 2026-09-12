/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry, {
  architectureRiseSideWindowBays,
  architectureRiseWindowBays,
  referenceObjects,
} from "../scenes/architectureRiseGeometry";
import type { ReferenceObjectDef } from "../scenes/architectureRiseGeometry";
import {
  createFocusFriendlyMaterial,
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";
import { toWorld } from "./rttUtils";

type ArchitectureRiseResources = {
  box: THREE.BoxGeometry;
  ground: THREE.PlaneGeometry;
  building: THREE.MeshStandardMaterial;
  facade: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
  pavement: THREE.MeshStandardMaterial;
  groundMaterial: THREE.MeshStandardMaterial;
  reference: THREE.MeshStandardMaterial;
  referenceLight: THREE.MeshStandardMaterial;
  focusDark: THREE.MeshBasicMaterial;
  focusLight: THREE.MeshBasicMaterial;
  focusCrosshair: THREE.MeshBasicMaterial;
};

const standard = (
  color: THREE.ColorRepresentation,
  roughness = 0.86,
  metalness = 0,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const createResources = (): ArchitectureRiseResources => ({
  box: new THREE.BoxGeometry(1, 1, 1),
  ground: new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
  building: standard("#8798a6", 0.92, 0.04),
  facade: createFocusFriendlyMaterial({
    pattern: "fine-grid",
    primaryColor: "#b7c3c9",
    secondaryColor: "#a7b4bd",
    repeat: [7, 8],
    roughness: 0.9,
  }),
  roof: standard("#c7d1d7", 0.78),
  trim: standard("#e1e8eb", 0.72),
  glass: standard("#294b5d", 0.34, 0.12),
  recess: standard("#203847", 0.68),
  pavement: standard("#697b86", 0.97),
  groundMaterial: standard("#d2dce1", 0.99),
  reference: standard("#8799a5", 0.94),
  referenceLight: standard("#edf2f3", 0.97),
  focusDark: new THREE.MeshBasicMaterial({ color: "#172331" }),
  focusLight: new THREE.MeshBasicMaterial({ color: "#f5f8fa" }),
  focusCrosshair: new THREE.MeshBasicMaterial({
    color: "#ef4444",
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  }),
});

type BoxSpec = {
  name: string;
  size: readonly [number, number, number];
  position: readonly [number, number, number];
  material: THREE.Material;
  parent: THREE.Object3D;
};

const addBox = ({ name, size, position, material, parent }: BoxSpec): THREE.Mesh => {
  const resources = parent.userData.resources as ArchitectureRiseResources;
  const mesh = new THREE.Mesh(resources.box, material);
  mesh.name = name;
  mesh.scale.set(toWorld(size[0]), toWorld(size[1]), toWorld(size[2]));
  mesh.position.set(toWorld(position[0]), toWorld(position[1]), toWorld(position[2]));
  parent.add(mesh);
  return mesh;
};

const addWindowBay = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  bay: (typeof architectureRiseWindowBays)[number],
): void => {
  const windowGroup = new THREE.Group();
  windowGroup.name = `architecture-rise-facade-window-bay-${bay.id}`;
  windowGroup.userData.resources = resources;
  root.add(windowGroup);

  const frame = 34;
  const front = geometry.facade.frontFacadeZ;
  addBox({
    name: `${windowGroup.name}-recess`,
    size: [bay.width + 88, bay.height + 88, 52],
    position: [bay.x, bay.y, front - 24],
    material: resources.recess,
    parent: windowGroup,
  });
  addBox({
    name: `${windowGroup.name}-glazing`,
    size: [bay.width, bay.height, bay.depth],
    position: [bay.x, bay.y, front - 54],
    material: resources.glass,
    parent: windowGroup,
  });

  const frameDepth = 34;
  const framePieces: Array<{
    id: string;
    size: [number, number, number];
    offset: [number, number];
  }> = [
    { id: "top", size: [bay.width + frame * 2, frame, frameDepth], offset: [0, bay.height / 2 + frame / 2] },
    { id: "bottom", size: [bay.width + frame * 2, frame, frameDepth], offset: [0, -bay.height / 2 - frame / 2] },
    { id: "left", size: [frame, bay.height, frameDepth], offset: [-bay.width / 2 - frame / 2, 0] },
    { id: "right", size: [frame, bay.height, frameDepth], offset: [bay.width / 2 + frame / 2, 0] },
    { id: "mullion", size: [18, bay.height - 30, frameDepth], offset: [0, 0] },
    { id: "transom", size: [bay.width - 24, 18, frameDepth], offset: [0, 0] },
  ];
  framePieces.forEach(({ id, size, offset }) => {
    addBox({
      name: `${windowGroup.name}-${id}`,
      size,
      position: [bay.x + offset[0], bay.y + offset[1], front - 76],
      material: resources.trim,
      parent: windowGroup,
    });
  });
};

const addSideWindowBay = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  bay: (typeof architectureRiseSideWindowBays)[number],
): void => {
  const group = new THREE.Group();
  group.name = `architecture-rise-side-return-window-bay-${bay.id}`;
  group.userData.resources = resources;
  root.add(group);

  const sideX = bay.x;
  const sideZ = geometry.building.center.z + 220;
  const frame = 30;
  addBox({
    name: `${group.name}-recess`,
    size: [40, bay.height + 72, bay.width + 72],
    position: [sideX, bay.y, sideZ],
    material: resources.recess,
    parent: group,
  });
  addBox({
    name: `${group.name}-glazing`,
    size: [bay.depth, bay.height, bay.width],
    position: [sideX - 32, bay.y, sideZ],
    material: resources.glass,
    parent: group,
  });
  [
    { id: "top", size: [frame, frame, bay.width + frame * 2], offset: [0, bay.height / 2 + frame / 2, 0] },
    { id: "bottom", size: [frame, frame, bay.width + frame * 2], offset: [0, -bay.height / 2 - frame / 2, 0] },
    { id: "left", size: [frame, bay.height, frame], offset: [0, 0, -bay.width / 2 - frame / 2] },
    { id: "right", size: [frame, bay.height, frame], offset: [0, 0, bay.width / 2 + frame / 2] },
  ].forEach(({ id, size, offset }) => {
    addBox({
      name: `${group.name}-${id}`,
      size: size as [number, number, number],
      position: [sideX - 54 + offset[0], bay.y + offset[1], sideZ + offset[2]],
      material: resources.trim,
      parent: group,
    });
  });
};

const addFacadeFineDetail = (root: THREE.Group, resources: ArchitectureRiseResources): void => {
  const detailGroup = new THREE.Group();
  detailGroup.name = "architecture-rise-facade-fine-detail";
  detailGroup.userData.resources = resources;
  geometry.getArchitectureFacadeFineDetailPieces().forEach((piece) => {
    const material =
      piece.role === "panel"
        ? resources.focusDark
        : piece.role === "frame"
          ? resources.focusLight
          : resources.focusCrosshair;
    addBox({
      name: piece.id,
      size: [piece.width, piece.height, piece.depth],
      position: [piece.x, piece.y, piece.z],
      material,
      parent: detailGroup,
    });
  });
  root.add(detailGroup);
};

const addFocusChart = (root: THREE.Group, resources: ArchitectureRiseResources): void => {
  const focusGroup = new THREE.Group();
  focusGroup.name = "architecture-rise-focus-chart";
  focusGroup.userData.resources = resources;
  geometry.getArchitectureFocusChartCells().forEach((cell) => {
    addBox({
      name: cell.id,
      size: [cell.width, cell.height, cell.depth],
      position: [cell.x, cell.y, cell.z],
      material: cell.dark ? resources.focusDark : resources.focusLight,
      parent: focusGroup,
    });
  });
  geometry.getArchitectureFocusChartBars().forEach((bar) => {
    const mesh = addBox({
      name: `architecture-focus-crosshair-${bar.id}`,
      size: [bar.width, bar.height, bar.depth],
      position: [bar.x, bar.y, bar.z],
      material: resources.focusCrosshair,
      parent: focusGroup,
    });
    mesh.renderOrder = 1000;
  });
  root.add(focusGroup);
};

const addArchitectureContext = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
): void => {
  const context = new THREE.Group();
  context.name = "architecture-rise-context-structure";
  context.userData.resources = resources;
  root.add(context);

  const sideMass = addBox({
    name: "architecture-rise-side-return",
    size: [520, 3000, 760],
    position: [1900, geometry.ground.y + 1500, geometry.building.center.z + 220],
    material: resources.building,
    parent: context,
  });
  sideMass.castShadow = true;
  architectureRiseSideWindowBays.forEach((bay) => addSideWindowBay(context, resources, bay));

  [0, 1, 2, 3].forEach((index) => {
    addBox({
      name: `architecture-rise-side-return-pilaster-${index + 1}`,
      size: [52, 3000, 44],
      position: [1620, geometry.ground.y + 1500, geometry.building.center.z - 150 + index * 250],
      material: resources.trim,
      parent: context,
    });
  });

  const entryX = -880;
  const entryZ = geometry.facade.frontFacadeZ - 42;
  const entryGroup = new THREE.Group();
  entryGroup.name = "architecture-rise-entry-recess";
  entryGroup.userData.resources = resources;
  context.add(entryGroup);
  addBox({
    name: "architecture-rise-entry-recess-panel",
    size: [480, 1120, 26],
    position: [entryX, geometry.ground.y + 1320, entryZ],
    material: resources.recess,
    parent: entryGroup,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-entry-recess-jamb-${sign < 0 ? "left" : "right"}`,
      size: [72, 1200, 90],
      position: [entryX + sign * 290, geometry.ground.y + 1360, entryZ - 20],
      material: resources.trim,
      parent: entryGroup,
    }),
  );
  addBox({
    name: "architecture-rise-entry-recess-lintel",
    size: [652, 72, 90],
    position: [entryX, geometry.ground.y + 2000, entryZ - 20],
    material: resources.trim,
    parent: entryGroup,
  });
  addBox({
    name: "architecture-rise-entry-canopy",
    size: [780, 72, 300],
    position: [entryX, geometry.ground.y + 2160, entryZ + 90],
    material: resources.roof,
    parent: entryGroup,
  });
  addBox({
    name: "architecture-rise-entry-threshold",
    size: [620, 34, 230],
    position: [entryX, geometry.ground.y + 18, entryZ - 80],
    material: resources.trim,
    parent: entryGroup,
  });
  addBox({
    name: "architecture-rise-building-plinth",
    size: [3500, 180, 260],
    position: [0, geometry.ground.y + 90, geometry.facade.frontFacadeZ - 180],
    material: resources.trim,
    parent: context,
  });
};

const addStreetContext = (root: THREE.Group, resources: ArchitectureRiseResources): void => {
  const street = new THREE.Group();
  street.name = "architecture-rise-street-context";
  street.userData.resources = resources;
  root.add(street);
  addBox({
    name: "architecture-rise-sidewalk-slab",
    size: [geometry.streetContext.sidewalkWidth, 80, geometry.streetContext.sidewalkDepth],
    position: [0, geometry.ground.y + 40, geometry.streetContext.sidewalkCenterZ],
    material: resources.groundMaterial,
    parent: street,
  });
  addBox({
    name: "architecture-rise-street-curb",
    size: [geometry.streetContext.curbWidth, 180, 220],
    position: [0, geometry.ground.y + 90, geometry.streetContext.curbCenterZ],
    material: resources.trim,
    parent: street,
  });
  [2300, 3500, 4700, 6000, 6900].forEach((z, index) =>
    addBox({
      name: `architecture-rise-pavement-cross-seam-${index + 1}`,
      size: [geometry.streetContext.sidewalkWidth, 10, 18],
      position: [0, geometry.ground.y + 86, z],
      material: resources.pavement,
      parent: street,
    }),
  );
  [-2400, -1200, 0, 1200, 2400].forEach((x, index) =>
    addBox({
      name: `architecture-rise-pavement-longitudinal-seam-${index + 1}`,
      size: [18, 10, geometry.streetContext.sidewalkDepth],
      position: [x, geometry.ground.y + 86, geometry.streetContext.sidewalkCenterZ],
      material: resources.pavement,
      parent: street,
    }),
  );
  addBox({
    name: "architecture-rise-foreground-planter",
    size: [340, 560, 340],
    position: [geometry.streetContext.foregroundPlanterX, geometry.ground.y + 280, geometry.streetContext.foregroundPlanterZ],
    material: resources.recess,
    parent: street,
  });
  addBox({
    name: "architecture-rise-foreground-planter-cap",
    size: [410, 36, 410],
    position: [geometry.streetContext.foregroundPlanterX, geometry.ground.y + 566, geometry.streetContext.foregroundPlanterZ],
    material: resources.trim,
    parent: street,
  });
  addBox({
    name: "architecture-rise-pavement-near-seam",
    size: [4200, 10, 18],
    position: [0, geometry.ground.y + 5, 6900],
    material: resources.pavement,
    parent: street,
  });
};

const addReferenceObjects = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
): void => {
  referenceObjects.forEach((def: ReferenceObjectDef) => {
    const group = new THREE.Group();
    group.name = `architecture-rise-reference-${def.id}`;
    group.userData.resources = resources;
    root.add(group);
    addBox({
      name: def.id,
      size: [def.width, def.height, def.depth],
      position: [def.x, geometry.ground.y + def.height / 2, def.z],
      material: resources.reference,
      parent: group,
    });
    const frontZ = def.z - def.depth / 2 - 4;
    if (def.detail === "vertical-stripes") {
      const stripeW = Math.min(80, def.width * 0.22);
      [-1, 0, 1].forEach((index) =>
        addBox({
          name: `${def.id}-stripe-${index + 2}`,
          size: [stripeW, def.height * 0.7, 10],
          position: [def.x + index * (stripeW * 1.5), geometry.ground.y + def.height * 0.35, frontZ],
          material: resources.referenceLight,
          parent: group,
        }),
      );
    } else if (def.detail === "horizontal-bands") {
      const bandH = Math.min(80, def.height * 0.18);
      [-1, 1].forEach((index) =>
        addBox({
          name: `${def.id}-band-${index < 0 ? "lower" : "upper"}`,
          size: [def.width * 0.92, bandH, 10],
          position: [def.x, geometry.ground.y + def.height * 0.5 + index * (bandH + 20) / 2, frontZ],
          material: resources.referenceLight,
          parent: group,
        }),
      );
    } else if (def.detail === "checker") {
      const panelW = Math.min(320, def.width * 0.9);
      const panelH = Math.min(320, def.height * 0.9);
      const cellW = panelW / 4;
      const cellH = panelH / 4;
      for (let cx = 0; cx < 4; cx += 1) {
        for (let cy = 0; cy < 4; cy += 1) {
          addBox({
            name: `${def.id}-checker-${cx + 1}-${cy + 1}`,
            size: [cellW, cellH, 10],
            position: [
              def.x - panelW / 2 + cx * cellW + cellW / 2,
              geometry.ground.y + def.height * 0.5 - panelH / 2 + cy * cellH + cellH / 2,
              frontZ,
            ],
            material: (cx + cy) % 2 === 0 ? resources.recess : resources.referenceLight,
            parent: group,
          });
        }
      }
    }
  });
};

export function createArchitectureRiseGroup(): THREE.Group {
  const resources = createResources();
  const root = new THREE.Group();
  root.name = "architecture-rise-subject";
  root.userData.resources = resources;

  addBox({
    name: "architecture-rise-building-mass",
    size: [geometry.building.width, geometry.building.height, geometry.building.depth],
    position: [geometry.building.center.x, geometry.building.center.y, geometry.building.center.z],
    material: resources.building,
    parent: root,
  });
  addBox({
    name: "architecture-rise-primary-facade",
    size: [geometry.building.width - 120, geometry.building.height - 120, 20],
    position: [geometry.building.center.x, geometry.building.center.y, geometry.facade.frontFacadeZ - 10],
    material: resources.facade,
    parent: root,
  });

  const parapet = addBox({
    name: "architecture-rise-roof-parapet",
    size: [geometry.building.width + 80, geometry.building.topHeight, geometry.building.depth + 80],
    position: [geometry.building.center.x, geometry.facade.mainBodyTopY + geometry.building.topHeight / 2, geometry.building.center.z],
    material: resources.roof,
    parent: root,
  });
  parapet.castShadow = true;
  addBox({
    name: "architecture-rise-roof-coping-front",
    size: [geometry.building.width + 220, 70, 120],
    position: [0, geometry.facade.parapetTopY + 35, geometry.facade.frontFacadeZ - 80],
    material: resources.trim,
    parent: root,
  });
  addBox({
    name: "architecture-rise-roof-coping-back",
    size: [geometry.building.width + 220, 70, 120],
    position: [0, geometry.facade.parapetTopY + 35, geometry.facade.backFacadeZ + 80],
    material: resources.trim,
    parent: root,
  });
  addBox({
    name: "architecture-rise-roof-service-block",
    size: [420, 220, 360],
    position: [700, geometry.facade.parapetTopY + 110, geometry.building.center.z + 120],
    material: resources.recess,
    parent: root,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-roof-service-fin-${sign < 0 ? "left" : "right"}`,
      size: [24, 180, 280],
      position: [700 + sign * 85, geometry.facade.parapetTopY + 310, geometry.building.center.z + 120],
      material: resources.trim,
      parent: root,
    }),
  );

  const divisions = geometry.building.facadeVerticalDivisionCount;
  for (let index = 0; index < divisions; index += 1) {
    const x = -geometry.building.width / 2 + (index / (divisions - 1)) * geometry.building.width;
    addBox({
      name: `architecture-rise-facade-pilaster-${index + 1}`,
      size: [geometry.mullionWidthMm, geometry.building.height - 80, geometry.facadeDetailThicknessMm],
      position: [x, geometry.building.center.y, geometry.facade.frontFacadeZ - geometry.facadeDetailThicknessMm / 2 - geometry.facadeDetailSmallGapMm],
      material: resources.trim,
      parent: root,
    });
  }
  const floors = geometry.building.facadeHorizontalDivisionCount;
  for (let index = 0; index < floors; index += 1) {
    const y = geometry.facade.mainBodyBottomY + ((index + 0.5) / floors) * geometry.building.height;
    addBox({
      name: `architecture-rise-facade-floor-band-${index + 1}`,
      size: [geometry.building.width + 40, geometry.horizontalStripeHeightMm, geometry.facadeDetailThicknessMm],
      position: [0, y, geometry.facade.frontFacadeZ - geometry.facadeDetailThicknessMm / 2 - geometry.facadeDetailSmallGapMm],
      material: resources.trim,
      parent: root,
    });
  }

  architectureRiseWindowBays.forEach((bay) => addWindowBay(root, resources, bay));
  addFocusChart(root, resources);
  addFacadeFineDetail(root, resources);
  addArchitectureContext(root, resources);
  addStreetContext(root, resources);

  const ground = new THREE.Mesh(resources.ground, resources.groundMaterial);
  ground.name = "architecture-rise-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, toWorld(geometry.ground.y), toWorld(geometry.ground.centerZ));
  root.add(ground);
  addReferenceObjects(root, resources);

  return root;
}

export const disposeArchitectureRiseGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};

/** Viewport and RTT intentionally render the same owned subject graph. */
export const ArchitectureRiseSubject: React.FC = () => {
  const group = useMemo(() => createArchitectureRiseGroup(), []);

  useEffect(
    () => () => {
      disposeArchitectureRiseGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
