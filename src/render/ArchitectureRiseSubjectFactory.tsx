import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../scenes/presentation/architectureRise";
import {
  ARCHITECTURE_RISE_PRESENTATION_LAYOUT,
  getArchitectureRiseGlazingBoundsMm,
  type ArchitectureRiseEastWindow,
  type ArchitectureRiseFrontWindow,
  type ArchitectureRiseWindow,
} from "../scenes/presentation/architectureRiseLayout";
import {
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";
import { createProceduralSurfaceMaterial } from "./ProceduralSurfaceMaterials";
import { toWorld } from "./rttUtils";

type ArchitectureRiseResources = {
  box: THREE.BoxGeometry;
  ground: THREE.PlaneGeometry;
  facade: THREE.MeshStandardMaterial;
  base: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
  pavement: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  groundMaterial: THREE.MeshStandardMaterial;
  reference: THREE.MeshStandardMaterial;
  referenceLight: THREE.MeshStandardMaterial;
  focusDark: THREE.MeshBasicMaterial;
  focusLight: THREE.MeshBasicMaterial;
  focusCrosshair: THREE.MeshBasicMaterial;
  adaptedOutputMaterials: Set<THREE.Material>;
};

const standard = (
  color: THREE.ColorRepresentation,
  roughness = 0.86,
  metalness = 0,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const createResources = (
  geometry: ArchitectureRisePresentation["geometry"],
): ArchitectureRiseResources => ({
  box: new THREE.BoxGeometry(1, 1, 1),
  ground: new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
  facade: createProceduralSurfaceMaterial({
    color: "#a65e46",
    pattern: "limestone",
    repeat: [5, 8],
    roughness: 0.9,
    normalStrength: 0.24,
  }),
  base: createProceduralSurfaceMaterial({
    color: "#d6c8ae",
    pattern: "limestone",
    repeat: [5, 4],
    roughness: 0.92,
    normalStrength: 0.2,
  }),
  door: createProceduralSurfaceMaterial({
    color: "#50352b",
    pattern: "wood",
    repeat: [1, 2],
    roughness: 0.86,
    normalStrength: 0.14,
  }),
  roof: createProceduralSurfaceMaterial({
    color: "#8c9693",
    pattern: "cut-stone",
    repeat: [1, 1],
    roughness: 0.9,
    normalStrength: 0.18,
  }),
  trim: createProceduralSurfaceMaterial({
    color: "#e5dac5",
    pattern: "cut-stone",
    repeat: [1, 1],
    roughness: 0.78,
    normalStrength: 0.09,
  }),
  glass: standard("#233b43", 0.3, 0.12),
  recess: standard("#101c22", 0.68),
  pavement: standard("#696c68", 0.94),
  sidewalk: createProceduralSurfaceMaterial({
    color: "#9b988e",
    pattern: "concrete",
    repeat: [12, 10],
    roughness: 0.96,
    normalStrength: 0.14,
  }),
  groundMaterial: standard("#9a9c95", 0.97),
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
  adaptedOutputMaterials: new Set<THREE.Material>(),
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

type FacadeOpening = Readonly<{
  id: string;
  centerHorizontalMm: number;
  centerVerticalMm: number;
  widthMm: number;
  heightMm: number;
}>;

const addSegmentedWall = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  options: {
    name: string;
    horizontalMinMm: number;
    horizontalMaxMm: number;
    verticalMinMm: number;
    verticalMaxMm: number;
    depthMinMm: number;
    depthMaxMm: number;
    openings: readonly FacadeOpening[];
    horizontalAxis: "x" | "z";
    primaryMeshName?: string;
  },
): void => {
  const horizontalEdges = new Set([options.horizontalMinMm, options.horizontalMaxMm]);
  options.openings.forEach((opening) => {
    horizontalEdges.add(opening.centerHorizontalMm - opening.widthMm / 2);
    horizontalEdges.add(opening.centerHorizontalMm + opening.widthMm / 2);
  });
  const sortedHorizontalEdges = [...horizontalEdges].sort((a, b) => a - b);
  let sectionIndex = 0;
  for (let horizontalIndex = 0; horizontalIndex < sortedHorizontalEdges.length - 1; horizontalIndex += 1) {
    const horizontalMin = sortedHorizontalEdges[horizontalIndex];
    const horizontalMax = sortedHorizontalEdges[horizontalIndex + 1];
    const horizontalCenter = (horizontalMin + horizontalMax) / 2;
    const active = options.openings.filter((opening) =>
      horizontalCenter > opening.centerHorizontalMm - opening.widthMm / 2 &&
      horizontalCenter < opening.centerHorizontalMm + opening.widthMm / 2,
    );
    const verticalEdges = new Set([options.verticalMinMm, options.verticalMaxMm]);
    active.forEach((opening) => {
      verticalEdges.add(opening.centerVerticalMm - opening.heightMm / 2);
      verticalEdges.add(opening.centerVerticalMm + opening.heightMm / 2);
    });
    const sortedVerticalEdges = [...verticalEdges].sort((a, b) => a - b);
    for (let verticalIndex = 0; verticalIndex < sortedVerticalEdges.length - 1; verticalIndex += 1) {
      const verticalMin = sortedVerticalEdges[verticalIndex];
      const verticalMax = sortedVerticalEdges[verticalIndex + 1];
      const verticalCenter = (verticalMin + verticalMax) / 2;
      if (active.some((opening) =>
        verticalCenter > opening.centerVerticalMm - opening.heightMm / 2 &&
        verticalCenter < opening.centerVerticalMm + opening.heightMm / 2,
      )) continue;

      const depth = options.depthMaxMm - options.depthMinMm;
      const depthCenter = (options.depthMaxMm + options.depthMinMm) / 2;
      const horizontalSize = horizontalMax - horizontalMin;
      const verticalSize = verticalMax - verticalMin;
      const isBaseStone = verticalCenter < 0;
      const position: [number, number, number] = options.horizontalAxis === "x"
        ? [horizontalCenter, verticalCenter, depthCenter]
        : [depthCenter, verticalCenter, horizontalCenter];
      const size: [number, number, number] = options.horizontalAxis === "x"
        ? [horizontalSize, verticalSize, depth]
        : [depth, verticalSize, horizontalSize];
      const mesh = addBox({
        name: sectionIndex === 0 && options.primaryMeshName
          ? options.primaryMeshName
          : `${options.name}-segment-${sectionIndex + 1}`,
        size,
        position,
        material: isBaseStone ? resources.base : resources.facade,
        parent: root,
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sectionIndex += 1;
    }
  }
};

const addFrontWindow = (
  parent: THREE.Group,
  resources: ArchitectureRiseResources,
  front: number,
  window: ArchitectureRiseFrontWindow,
): void => {
  const name = `architecture-rise-window-${window.id}`;
  const z = front + window.glazingInsetMm;
  const glassWidth = window.openingWidthMm - 36;
  const glassHeight = window.openingHeightMm - 36;
  const revealDepth = window.glazingInsetMm - window.glazingDepthMm / 2;

  addBox({
    name: `${name}-glazing`,
    size: [glassWidth, glassHeight, window.glazingDepthMm],
    position: [window.centerXMm, window.centerYMm, z],
    material: resources.glass,
    parent,
  });
  [-1, 1].forEach((sign) => {
    addBox({
      name: `${name}-reveal-jamb-${sign < 0 ? "left" : "right"}`,
      size: [18, window.openingHeightMm, revealDepth],
      position: [window.centerXMm + sign * (window.openingWidthMm / 2 - 9), window.centerYMm, front + revealDepth / 2],
      material: resources.trim,
      parent,
    });
  });
  [-1, 1].forEach((sign) => {
    addBox({
      name: `${name}-reveal-head-${sign < 0 ? "lower" : "upper"}`,
      size: [window.openingWidthMm - 36, 18, revealDepth],
      position: [window.centerXMm, window.centerYMm + sign * (window.openingHeightMm / 2 - 9), front + revealDepth / 2],
      material: resources.trim,
      parent,
    });
  });

  const frameZ = z - window.glazingDepthMm / 2 - 4;
  const frameDepth = 18;
  const stoneDepth = 56;
  const stoneZ = front - stoneDepth / 2 + 12;
  [-1, 1].forEach((sign) => {
    addBox({
      name: `${name}-stone-jamb-${sign < 0 ? "left" : "right"}`,
      size: [window.trimWidthMm, window.openingHeightMm, stoneDepth],
      position: [window.centerXMm + sign * (window.openingWidthMm / 2 + window.trimWidthMm / 2), window.centerYMm, stoneZ],
      material: resources.trim,
      parent,
    });
  });
  [
    { id: "lintel", sign: 1 },
    { id: "sill", sign: -1 },
  ].forEach(({ id, sign }) =>
    addBox({
      name: `${name}-stone-${id}`,
      size: [window.openingWidthMm + 2 * window.trimWidthMm, window.trimWidthMm, stoneDepth],
      position: [window.centerXMm, window.centerYMm + sign * (window.openingHeightMm / 2 + window.trimWidthMm / 2), stoneZ],
      material: resources.trim,
      parent,
    }),
  );
  addBox({
    name: `${name}-mullion`,
    size: [window.mullionWidthMm, glassHeight, frameDepth],
    position: [window.centerXMm, window.centerYMm, frameZ],
    material: resources.trim,
    parent,
  });
  addBox({
    name: `${name}-transom`,
    size: [glassWidth, window.transomHeightMm, frameDepth],
    position: [window.centerXMm, window.centerYMm + glassHeight * 0.2, frameZ],
    material: resources.trim,
    parent,
  });
};

const addEastWindow = (
  parent: THREE.Group,
  resources: ArchitectureRiseResources,
  eastFace: number,
  window: ArchitectureRiseEastWindow,
): void => {
  const name = `architecture-rise-window-${window.id}`;
  const x = eastFace - window.glazingInsetMm;
  const glassWidth = window.openingWidthMm - 36;
  const glassHeight = window.openingHeightMm - 36;
  const revealDepth = window.glazingInsetMm - window.glazingDepthMm / 2;
  addBox({
    name: `${name}-glazing`,
    size: [window.glazingDepthMm, glassHeight, glassWidth],
    position: [x, window.centerYMm, window.centerZMm],
    material: resources.glass,
    parent,
  });
  [-1, 1].forEach((sign) => {
    addBox({
      name: `${name}-reveal-jamb-${sign < 0 ? "near" : "far"}`,
      size: [revealDepth, window.openingHeightMm, 18],
      position: [eastFace - revealDepth / 2, window.centerYMm, window.centerZMm + sign * (window.openingWidthMm / 2 - 9)],
      material: resources.trim,
      parent,
    });
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `${name}-reveal-${sign < 0 ? "sill" : "head"}`,
      size: [revealDepth, 18, glassWidth],
      position: [eastFace - revealDepth / 2, window.centerYMm + sign * (window.openingHeightMm / 2 - 9), window.centerZMm],
      material: resources.trim,
      parent,
    }),
  );
  const stoneDepth = 56;
  const stoneX = eastFace + stoneDepth / 2 - 12;
  [-1, 1].forEach((sign) =>
    addBox({
      name: `${name}-stone-jamb-${sign < 0 ? "near" : "far"}`,
      size: [stoneDepth, window.openingHeightMm, window.trimWidthMm],
      position: [stoneX, window.centerYMm, window.centerZMm + sign * (window.openingWidthMm / 2 + window.trimWidthMm / 2)],
      material: resources.trim,
      parent,
    }),
  );
  [-1, 1].forEach((sign) =>
    addBox({
      name: `${name}-stone-${sign < 0 ? "sill" : "lintel"}`,
      size: [stoneDepth, window.trimWidthMm, window.openingWidthMm + 2 * window.trimWidthMm],
      position: [stoneX, window.centerYMm + sign * (window.openingHeightMm / 2 + window.trimWidthMm / 2), window.centerZMm],
      material: resources.trim,
      parent,
    }),
  );
  const mullionDepthMm = 18;
  const mullionEngagementMm = 4;
  const glassExteriorXmm = x + window.glazingDepthMm / 2;
  const mullionCenterXmm = glassExteriorXmm + mullionDepthMm / 2 - mullionEngagementMm;
  addBox({
    name: `${name}-mullion`,
    size: [mullionDepthMm, glassHeight, window.mullionWidthMm],
    position: [mullionCenterXmm, window.centerYMm, window.centerZMm],
    material: resources.trim,
    parent,
  });
};

const addWindow = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
  window: ArchitectureRiseWindow,
): void => {
  const group = new THREE.Group();
  group.name = `architecture-rise-window-${window.id}`;
  group.userData.resources = resources;
  group.userData.glazingBoundsMm = getArchitectureRiseGlazingBoundsMm(window);
  root.add(group);
  if (window.elevation === "front") {
    addFrontWindow(group, resources, geometry.facade.frontFacadeZ, window);
  } else {
    addEastWindow(group, resources, ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm, window);
  }
};

const addFacadeFineDetail = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
): void => {
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

const addFocusChart = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
): void => {
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
  geometry: ArchitectureRisePresentation["geometry"],
  layout: ArchitectureRisePresentation["layout"],
): void => {
  const context = new THREE.Group();
  context.name = "architecture-rise-context-details";
  context.userData.resources = resources;
  root.add(context);

  const { serviceReturn } = layout;
  const eastWindows = layout.windows.filter((window): window is ArchitectureRiseEastWindow =>
    window.elevation === "east",
  );
  const wingOpenings = eastWindows.map((window) => ({
    id: window.id,
    centerHorizontalMm: window.centerZMm,
    centerVerticalMm: window.centerYMm,
    widthMm: window.openingWidthMm,
    heightMm: window.openingHeightMm,
  }));
  const returnGroup = new THREE.Group();
  returnGroup.name = "architecture-rise-attached-service-return";
  returnGroup.userData.resources = resources;
  context.add(returnGroup);
  addSegmentedWall(returnGroup, resources, {
    name: "architecture-rise-service-return-wall",
    horizontalMinMm: serviceReturn.minZMm,
    horizontalMaxMm: serviceReturn.maxZMm,
    verticalMinMm: serviceReturn.minYMm,
    verticalMaxMm: serviceReturn.maxYMm,
    depthMinMm: serviceReturn.minXMm,
    depthMaxMm: serviceReturn.maxXMm,
    openings: wingOpenings,
    horizontalAxis: "z",
    primaryMeshName: "architecture-rise-side-return",
  });
  addBox({
    name: "architecture-rise-service-return-roof",
    size: [serviceReturn.maxXMm - serviceReturn.minXMm, 72, serviceReturn.maxZMm - serviceReturn.minZMm],
    position: [
      (serviceReturn.minXMm + serviceReturn.maxXMm) / 2,
      serviceReturn.maxYMm - 36,
      (serviceReturn.minZMm + serviceReturn.maxZMm) / 2,
    ],
    material: resources.roof,
    parent: returnGroup,
  });
  eastWindows.forEach((window) => addWindow(returnGroup, resources, geometry, window));

  const entry = layout.door;
  const entryGroup = new THREE.Group();
  entryGroup.name = "architecture-rise-entry-assembly";
  entryGroup.userData.resources = resources;
  context.add(entryGroup);
  const front = geometry.facade.frontFacadeZ;
  const doorWidth = entry.openingWidthMm - 40;
  const doorHeight = entry.openingHeightMm - 40;
  const doorZ = front + 84;
  addBox({
    name: "architecture-rise-entry-door-leaf",
    size: [doorWidth, doorHeight, 36],
    position: [entry.centerXMm, entry.centerYMm, doorZ],
    material: resources.door,
    parent: entryGroup,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-entry-door-stile-${sign < 0 ? "left" : "right"}`,
      size: [20, doorHeight - 24, 14],
      position: [entry.centerXMm + sign * (doorWidth / 2 - 28), entry.centerYMm, doorZ - 22],
      material: resources.trim,
      parent: entryGroup,
    }),
  );
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-entry-door-panel-${sign < 0 ? "lower" : "upper"}`,
      size: [doorWidth - 92, doorHeight * 0.32, 20],
      position: [entry.centerXMm, entry.centerYMm + sign * doorHeight * 0.24, doorZ - 18],
      material: resources.door,
      parent: entryGroup,
    }),
  );
  const surroundDepth = 78;
  const surroundZ = front - surroundDepth / 2 + 10;
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-entry-stone-jamb-${sign < 0 ? "left" : "right"}`,
      size: [72, entry.openingHeightMm, surroundDepth],
      position: [entry.centerXMm + sign * (entry.openingWidthMm / 2 + 36), entry.centerYMm, surroundZ],
      material: resources.trim,
      parent: entryGroup,
    }),
  );
  addBox({
    name: "architecture-rise-entry-stone-lintel",
    size: [entry.openingWidthMm + 144, 72, surroundDepth],
    position: [entry.centerXMm, entry.centerYMm + entry.openingHeightMm / 2 + 36, surroundZ],
    material: resources.trim,
    parent: entryGroup,
  });
  addBox({
    name: "architecture-rise-entry-threshold",
    size: [entry.openingWidthMm + 120, 34, 220],
    position: [entry.centerXMm, geometry.ground.y + 17, front - 76],
    material: resources.trim,
    parent: entryGroup,
  });
  addBox({
    name: "architecture-rise-entry-step",
    size: [entry.openingWidthMm + 210, 82, 360],
    position: [entry.centerXMm, geometry.ground.y + 41, front - 230],
    material: resources.base,
    parent: entryGroup,
  });
  addBox({
    name: "architecture-rise-building-plinth",
    size: [geometry.building.width + 120, 68, 220],
    position: [geometry.building.center.x, geometry.ground.y + 34, front - 92],
    material: resources.trim,
    parent: context,
  });
};

const addStreetContext = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
): void => {
  const street = new THREE.Group();
  street.name = "architecture-rise-street-context";
  street.userData.resources = resources;
  root.add(street);
  addBox({
    name: "architecture-rise-sidewalk-slab",
    size: [geometry.streetContext.sidewalkWidth, 80, geometry.streetContext.sidewalkDepth],
    position: [0, geometry.ground.y + 40, geometry.streetContext.sidewalkCenterZ],
    material: resources.sidewalk,
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

  const sign = geometry.streetContext.streetSign;
  const streetSign = new THREE.Group();
  streetSign.name = "architecture-rise-street-sign";
  streetSign.userData.resources = resources;
  street.add(streetSign);

  const supportSurfaceY = geometry.ground.y;
  const panelBottomY = sign.panelCenterY - sign.panelHeight / 2;
  const postHeight = panelBottomY - supportSurfaceY + 60;
  addBox({
    name: "architecture-rise-street-sign-post",
    size: [sign.postWidth, postHeight, sign.postWidth],
    position: [sign.x, supportSurfaceY + postHeight / 2, sign.z],
    material: resources.reference,
    parent: streetSign,
  });
  addBox({
    name: "architecture-rise-street-sign-panel",
    size: [sign.panelWidth, sign.panelHeight, sign.panelDepth],
    position: [sign.x, sign.panelCenterY, sign.z],
    material: resources.reference,
    parent: streetSign,
  });

  const signFaces = [
    {
      side: "front",
      centerZ: sign.z - (sign.panelDepth + sign.faceDepth) / 2 - 2,
      inscriptionOffset: -1,
    },
    {
      side: "back",
      centerZ: sign.z + (sign.panelDepth + sign.faceDepth) / 2 + 2,
      inscriptionOffset: 1,
    },
  ] as const;
  signFaces.forEach(({ side, centerZ, inscriptionOffset }) => {
    addBox({
      name: `architecture-rise-street-sign-face-${side}`,
      size: [sign.faceWidth, sign.faceHeight, sign.faceDepth],
      position: [sign.x, sign.panelCenterY, centerZ],
      material: resources.referenceLight,
      parent: streetSign,
    });
    sign.inscriptionWidths.forEach((width, index) => {
      const stripeDepth = 6;
      const stripeCenterZ = centerZ +
        inscriptionOffset * (sign.faceDepth / 2 + 3 + stripeDepth / 2);
      addBox({
        name: `architecture-rise-street-sign-inscription-${side}-${index + 1}`,
        size: [width, 20, stripeDepth],
        position: [sign.x, sign.panelCenterY + 70 - index * 48, stripeCenterZ],
        material: resources.recess,
        parent: streetSign,
      });
    });
  });
};

const addReferenceObjects = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
  referenceObjects: ArchitectureRisePresentation["referenceObjects"],
): void => {
  referenceObjects.forEach((def) => {
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

export type ArchitectureRiseAssetRequest = Readonly<{
  presentation: ArchitectureRisePresentation;
}>;

export function createArchitectureRiseGroup(
  request: ArchitectureRiseAssetRequest,
): THREE.Group {
  const { presentation } = request;
  const { geometry } = presentation;
  const { layout } = presentation;
  const resources = createResources(geometry);
  const root = new THREE.Group();
  root.name = "architecture-rise-subject";
  root.userData.resources = resources;
  const front = geometry.facade.frontFacadeZ;
  const frontWindows = layout.windows.filter((window): window is ArchitectureRiseFrontWindow =>
    window.elevation === "front",
  );
  const mainOpenings: FacadeOpening[] = [
    ...frontWindows.map((window) => ({
      id: window.id,
      centerHorizontalMm: window.centerXMm,
      centerVerticalMm: window.centerYMm,
      widthMm: window.openingWidthMm,
      heightMm: window.openingHeightMm,
    })),
    {
      id: layout.door.id,
      centerHorizontalMm: layout.door.centerXMm,
      centerVerticalMm: layout.door.centerYMm,
      widthMm: layout.door.openingWidthMm,
      heightMm: layout.door.openingHeightMm,
    },
  ];
  const mainFacadeShell = new THREE.Group();
  mainFacadeShell.name = "architecture-rise-main-facade-shell";
  mainFacadeShell.userData.resources = resources;
  root.add(mainFacadeShell);
  addSegmentedWall(mainFacadeShell, resources, {
    name: "architecture-rise-main-facade-wall",
    horizontalMinMm: layout.mainFacade.minXMm,
    horizontalMaxMm: layout.mainFacade.maxXMm,
    verticalMinMm: layout.mainFacade.minYMm,
    verticalMaxMm: layout.mainFacade.maxYMm,
    depthMinMm: layout.mainFacade.frontZMm,
    depthMaxMm: layout.mainFacade.backZMm,
    openings: mainOpenings,
    horizontalAxis: "x",
    primaryMeshName: "architecture-rise-primary-facade",
  });

  const parapet = addBox({
    name: "architecture-rise-roof-parapet",
    size: [geometry.building.width, geometry.building.topHeight, geometry.building.depth],
    position: [geometry.building.center.x, geometry.facade.mainBodyTopY + geometry.building.topHeight / 2, geometry.building.center.z],
    material: resources.roof,
    parent: root,
  });
  parapet.castShadow = true;
  parapet.receiveShadow = true;

  const masonryDetail = new THREE.Group();
  masonryDetail.name = "architecture-rise-masonry-relief";
  masonryDetail.userData.resources = resources;
  root.add(masonryDetail);
  const halfWidth = geometry.building.width / 2;
  const corniceY = geometry.facade.mainBodyTopY - 20;
  const cornice = { width: geometry.building.width, height: 120, depth: 280 };
  addBox({
    name: "architecture-rise-cornice-front",
    size: [cornice.width, cornice.height, cornice.depth],
    position: [0, corniceY, front + 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-cornice-return-${sign < 0 ? "west" : "east"}`,
      size: [cornice.depth, cornice.height, geometry.building.depth],
      position: [sign * (halfWidth - cornice.depth / 2), corniceY, geometry.building.center.z],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );
  addBox({
    name: "architecture-rise-cornice-back",
    size: [cornice.width, cornice.height, 80],
    position: [0, corniceY, geometry.facade.backFacadeZ + 40],
    material: resources.trim,
    parent: masonryDetail,
  });

  const parapetCenterY = geometry.facade.mainBodyTopY + geometry.building.topHeight / 2;
  [-1, 1].forEach((sign) => {
    const panelX = sign * geometry.building.width / 4;
    const panelWidth = geometry.building.width / 2 - 240;
    const panelHeight = geometry.building.topHeight - 210;
    const panelZ = front - 24;
    [-1, 1].forEach((edge) => {
      addBox({
        name: `architecture-rise-parapet-panel-${sign}-horizontal-${edge}`,
        size: [panelWidth, 22, 42],
        position: [panelX, parapetCenterY + edge * panelHeight / 2, panelZ],
        material: resources.trim,
        parent: masonryDetail,
      });
      addBox({
        name: `architecture-rise-parapet-panel-${sign}-vertical-${edge}`,
        size: [22, panelHeight, 42],
        position: [panelX + edge * panelWidth / 2, parapetCenterY, panelZ],
        material: resources.trim,
        parent: masonryDetail,
      });
    });
  });

  const copingY = geometry.facade.parapetTopY - 30;
  addBox({
    name: "architecture-rise-roof-coping-front",
    size: [geometry.building.width + 80, 60, 100],
    position: [0, copingY, front - 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  addBox({
    name: "architecture-rise-roof-coping-back",
    size: [geometry.building.width + 80, 60, 100],
    position: [0, copingY, geometry.facade.backFacadeZ + 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-roof-coping-return-${sign}`,
      size: [100, 60, geometry.building.depth + 40],
      position: [sign * halfWidth, copingY, geometry.building.center.z],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );

  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-facade-corner-pilaster-${sign < 0 ? "left" : "right"}`,
      size: [80, geometry.building.height, 58],
      position: [sign * (halfWidth - 40), geometry.building.center.y, front - 20],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );
  const stringCourseY = 240;
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-base-string-course-${sign < 0 ? "left" : "right"}`,
      size: [halfWidth - layout.door.openingWidthMm / 2, 28, 64],
      position: [sign * (halfWidth + layout.door.openingWidthMm / 2) / 2, stringCourseY, front - 28],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );
  addBox({
    name: "architecture-rise-base-foot",
    size: [geometry.building.width + 120, 48, 240],
    position: [0, geometry.ground.y + 24, front - 110],
    material: resources.trim,
    parent: masonryDetail,
  });

  frontWindows.forEach((window) => addWindow(root, resources, geometry, window));
  addFocusChart(root, resources, geometry);
  addFacadeFineDetail(root, resources, geometry);
  addArchitectureContext(root, resources, geometry, layout);
  addStreetContext(root, resources, geometry);

  const ground = new THREE.Mesh(resources.ground, resources.groundMaterial);
  ground.name = "architecture-rise-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, toWorld(geometry.ground.y), toWorld(geometry.ground.centerZ));
  root.add(ground);
  addReferenceObjects(root, resources, geometry, presentation.referenceObjects);

  return root;
}

export const disposeArchitectureRiseGroup = (group: THREE.Group): void => {
  const resources = group.userData.resources as ArchitectureRiseResources | undefined;
  disposeTeachingSubjectResources(group, resources?.adaptedOutputMaterials);
  resources?.adaptedOutputMaterials.clear();
};
