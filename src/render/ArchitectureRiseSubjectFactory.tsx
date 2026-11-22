import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../scenes/presentation/architectureRise";
import {
  ARCHITECTURE_RISE_PRESENTATION_LAYOUT,
  type ArchitectureRiseEastWindow,
  type ArchitectureRiseFrontWindow,
  type ArchitectureRiseWindow,
} from "../scenes/presentation/architectureRiseLayout";
import type { ArchitectureRiseDetailStyle } from "./architecture-rise/ArchitectureRiseDetailConfig";
import { createArchitectureRiseBrickMaterial } from "./architecture-rise/ArchitectureRiseBrickMaterial";
import {
  addArchitectureRiseCorniceBrackets,
  addArchitectureRiseCorniceProfile,
  createArchitectureRiseCorniceBracketGeometry,
} from "./architecture-rise/ArchitectureRiseCornice";
import { addArchitectureRiseEntrance } from "./architecture-rise/ArchitectureRiseEntrance";
import {
  addArchitectureRiseCornerQuoins,
  addArchitectureRiseStoneBaseJoints,
  collectCanonicalFacadeQuietZones,
  createWorldAlignedBrickBoxGeometry,
  isInsideArchitectureRiseQuietZone,
  type ArchitectureRiseMmBounds,
  type ArchitectureRiseWallOpening,
} from "./architecture-rise/ArchitectureRiseMasonry";
import { addArchitectureRiseWindowAssembly } from "./architecture-rise/ArchitectureRiseWindowDetails";
import {
  addArchitectureRiseRearJoinery,
  getArchitectureRiseRearOpenings,
} from "./architecture-rise/ArchitectureRiseRearElevation";
import {
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";
import { createProceduralSurfaceMaterial } from "./ProceduralSurfaceMaterials";
import { toWorld } from "./rttUtils";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import {
  resolveArchitectureRiseMaterialVariation,
  type ArchitectureRiseMaterialVariation,
} from "../scenes/architectureRiseMaterialVariation";

type ArchitectureRiseResources = {
  box: THREE.BoxGeometry;
  ground: THREE.PlaneGeometry;
  facade: THREE.MeshStandardMaterial;
  quietFacade: THREE.MeshStandardMaterial;
  base: THREE.MeshStandardMaterial;
  stoneJoint: THREE.MeshStandardMaterial;
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
  corniceBracketGeometry: THREE.BufferGeometry;
  adaptedOutputMaterials: Set<THREE.Material>;
};

/** Stable, bounded controls for later Architecture Rise appearance experiments. */
export const ARCHITECTURE_RISE_DETAIL_STYLE: ArchitectureRiseDetailStyle = {
  masonry: {
    brickLengthMm: 220,
    brickHeightMm: 68,
    mortarJointMm: 8,
    tileBrickPitches: 8,
    tileCourses: 8,
    seed: 3472,
    quietZoneMarginMm: 100,
  },
  base: {
    heightAboveGroundMm: 1520,
    blockCourseHeightMm: 240,
    blockWidthMm: 540,
    jointWidthMm: 12,
  },
  window: {
    outerSillProjectionMm: 44,
    outerSillThicknessMm: 26,
    outerLintelProjectionMm: 38,
    outerLintelThicknessMm: 24,
    sillBracketWidthMm: 44,
    sillBracketHeightMm: 48,
    sillBracketDepthMm: 84,
    surroundReliefMm: 38,
    keystoneWidthMm: 44,
  },
  cornice: {
    bandHeightMm: 120,
    projectionMm: 280,
    bracketWidthMm: 92,
    bracketHeightMm: 150,
    bracketDepthMm: 158,
    bracketSpacingMm: 210,
    bracketCornerClearanceMm: 110,
    parapetCourseHeightMm: 110,
  },
};

const standard = (
  color: THREE.ColorRepresentation,
  roughness = 0.86,
  metalness = 0,
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const createResources = (
  geometry: ArchitectureRisePresentation["geometry"],
  style: ArchitectureRiseDetailStyle,
  variation?: ArchitectureRiseMaterialVariation,
): ArchitectureRiseResources => ({
  box: new THREE.BoxGeometry(1, 1, 1),
  ground: new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
  facade: createArchitectureRiseBrickMaterial(style.masonry, variation?.brick),
  quietFacade: standard(variation?.quietFacadeColor ?? "#98553f", 0.94),
  base: createProceduralSurfaceMaterial({
    color: variation?.base.color ?? "#c2b299",
    pattern: "limestone",
    repeat: variation?.base.repeat ?? [5, 4],
    roughness: variation?.base.roughness ?? 0.92,
    normalStrength: variation?.base.normalStrength ?? 0.2,
    ...(variation ? { variationSeed: variation.base.variationSeed } : {}),
  }),
  stoneJoint: standard(variation?.mortarJointColor ?? "#9b8b75", 0.97),
  door: createProceduralSurfaceMaterial({
    color: variation?.door.color ?? "#50352b",
    pattern: "wood",
    repeat: variation?.door.repeat ?? [1, 2],
    roughness: variation?.door.roughness ?? 0.86,
    normalStrength: variation?.door.normalStrength ?? 0.14,
    ...(variation ? { variationSeed: variation.door.variationSeed } : {}),
  }),
  roof: createProceduralSurfaceMaterial({
    color: variation?.roof.color ?? "#c7b9a2",
    pattern: "cut-stone",
    repeat: variation?.roof.repeat ?? [1, 1],
    roughness: variation?.roof.roughness ?? 0.9,
    normalStrength: variation?.roof.normalStrength ?? 0.18,
    ...(variation ? { variationSeed: variation.roof.variationSeed } : {}),
  }),
  trim: createProceduralSurfaceMaterial({
    color: variation?.trim.color ?? "#e5dac5",
    pattern: "cut-stone",
    repeat: variation?.trim.repeat ?? [1, 1],
    roughness: variation?.trim.roughness ?? 0.78,
    normalStrength: variation?.trim.normalStrength ?? 0.09,
    ...(variation ? { variationSeed: variation.trim.variationSeed } : {}),
  }),
  glass: standard("#233b43", 0.3, 0.12),
  recess: standard("#101c22", 0.68),
  pavement: standard(variation?.pavementColor ?? "#696c68", 0.94),
  sidewalk: createProceduralSurfaceMaterial({
    color: variation?.sidewalk.color ?? "#9b988e",
    pattern: "concrete",
    repeat: variation?.sidewalk.repeat ?? [12, 10],
    roughness: variation?.sidewalk.roughness ?? 0.96,
    normalStrength: variation?.sidewalk.normalStrength ?? 0.14,
    ...(variation ? { variationSeed: variation.sidewalk.variationSeed } : {}),
  }),
  groundMaterial: standard(variation?.groundColor ?? "#9a9c95", 0.97),
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
  corniceBracketGeometry: createArchitectureRiseCorniceBracketGeometry(style.cornice),
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
    openings: readonly ArchitectureRiseWallOpening[];
    horizontalAxis: "x" | "z";
    primaryMeshName?: string;
    baseStoneTopMm?: number;
    quietZones?: readonly ArchitectureRiseMmBounds[];
    brickStyle?: ArchitectureRiseDetailStyle["masonry"];
  },
): void => {
  const horizontalEdges = new Set([options.horizontalMinMm, options.horizontalMaxMm]);
  options.openings.forEach((opening) => {
    horizontalEdges.add(opening.centerHorizontalMm - opening.widthMm / 2);
    horizontalEdges.add(opening.centerHorizontalMm + opening.widthMm / 2);
  });
  if (options.horizontalAxis === "x") {
    options.quietZones?.forEach((zone) => {
      if (zone.minXMm > options.horizontalMinMm && zone.minXMm < options.horizontalMaxMm) {
        horizontalEdges.add(zone.minXMm);
      }
      if (zone.maxXMm > options.horizontalMinMm && zone.maxXMm < options.horizontalMaxMm) {
        horizontalEdges.add(zone.maxXMm);
      }
    });
  }
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
    if (options.horizontalAxis === "x") {
      options.quietZones?.forEach((zone) => {
        if (horizontalCenter < zone.minXMm || horizontalCenter > zone.maxXMm) return;
        if (zone.minYMm > options.verticalMinMm && zone.minYMm < options.verticalMaxMm) {
          verticalEdges.add(zone.minYMm);
        }
        if (zone.maxYMm > options.verticalMinMm && zone.maxYMm < options.verticalMaxMm) {
          verticalEdges.add(zone.maxYMm);
        }
      });
    }
    if (
      options.baseStoneTopMm !== undefined &&
      options.baseStoneTopMm > options.verticalMinMm &&
      options.baseStoneTopMm < options.verticalMaxMm
    ) {
      verticalEdges.add(options.baseStoneTopMm);
    }
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
      const isBaseStone = options.baseStoneTopMm !== undefined && verticalCenter < options.baseStoneTopMm;
      const position: [number, number, number] = options.horizontalAxis === "x"
        ? [horizontalCenter, verticalCenter, depthCenter]
        : [depthCenter, verticalCenter, horizontalCenter];
      const size: [number, number, number] = options.horizontalAxis === "x"
        ? [horizontalSize, verticalSize, depth]
        : [depth, verticalSize, horizontalSize];
      const meshName = sectionIndex === 0 && options.primaryMeshName
        ? options.primaryMeshName
        : `${options.name}-segment-${sectionIndex + 1}`;
      const isQuiet = !isBaseStone && options.horizontalAxis === "x" && isInsideArchitectureRiseQuietZone(
        horizontalCenter,
        verticalCenter,
        options.quietZones ?? [],
      );
      const isBrick = !isBaseStone && !isQuiet;
      const material = isBaseStone ? resources.base : isQuiet ? resources.quietFacade : resources.facade;
      let mesh: THREE.Mesh;
      if (isBrick) {
        if (!options.brickStyle) throw new Error("Brick facade segments require physical masonry style data");
        const brickGeometry = createWorldAlignedBrickBoxGeometry(size, position, options.brickStyle, options.horizontalAxis);
        mesh = new THREE.Mesh(brickGeometry, material);
        mesh.name = meshName;
        mesh.position.set(toWorld(position[0]), toWorld(position[1]), toWorld(position[2]));
        root.add(mesh);
      } else {
        mesh = addBox({ name: meshName, size, position, material, parent: root });
      }
      mesh.userData.architectureRole = isBaseStone ? "stone-base" : isQuiet ? "protected-quiet-facade" : "brick-facade";
      mesh.userData.worldMmBounds = {
        minHorizontal: horizontalMin,
        maxHorizontal: horizontalMax,
        minVertical: verticalMin,
        maxVertical: verticalMax,
        axis: options.horizontalAxis,
      };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      sectionIndex += 1;
    }
  }
};

const addWindow = (
  root: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
  window: ArchitectureRiseWindow,
  style: ArchitectureRiseDetailStyle,
): void => {
  const group = addArchitectureRiseWindowAssembly({
    root,
    window,
    frontFacadeZMm: geometry.facade.frontFacadeZ,
    eastFacadeXMm: ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn.maxXMm,
    materials: { glass: resources.glass, trim: resources.trim },
    style: style.window,
    addBox,
  });
  group.userData.resources = resources;
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
  style: ArchitectureRiseDetailStyle,
): void => {
  const context = new THREE.Group();
  context.name = "architecture-rise-context-details";
  context.userData.resources = resources;
  root.add(context);

  const front = geometry.facade.frontFacadeZ;
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
    verticalMaxMm: serviceReturn.maxYMm - 72,
    depthMinMm: serviceReturn.minXMm,
    depthMaxMm: serviceReturn.maxXMm,
    openings: wingOpenings,
    horizontalAxis: "z",
    primaryMeshName: "architecture-rise-side-return",
    baseStoneTopMm: serviceReturn.minYMm + 240,
    brickStyle: style.masonry,
  });
  const wingWidth = serviceReturn.maxXMm - serviceReturn.minXMm;
  const wingDepth = serviceReturn.maxZMm - serviceReturn.minZMm;
  const wingCenterX = (serviceReturn.minXMm + serviceReturn.maxXMm) / 2;
  const wingCenterZ = (serviceReturn.minZMm + serviceReturn.maxZMm) / 2;
  addBox({
    name: "architecture-rise-service-return-roof",
    size: [wingWidth, 36, wingDepth],
    position: [wingCenterX, serviceReturn.maxYMm - 54, wingCenterZ],
    material: resources.pavement, parent: returnGroup,
  });
  const copingWidth = 48;
  for (const sign of [-1, 1]) {
    addBox({
      name: `architecture-rise-service-roof-coping-${sign < 0 ? "front" : "back"}`,
      size: [wingWidth, 36, copingWidth],
      position: [wingCenterX, serviceReturn.maxYMm - 18, wingCenterZ + sign * (wingDepth - copingWidth) / 2],
      material: resources.roof, parent: returnGroup,
    });
    addBox({
      name: `architecture-rise-service-roof-coping-${sign < 0 ? "west" : "east"}`,
      size: [copingWidth, 36, wingDepth - 2 * copingWidth],
      position: [wingCenterX + sign * (wingWidth - copingWidth) / 2, serviceReturn.maxYMm - 18, wingCenterZ],
      material: resources.roof, parent: returnGroup,
    });
  }
  eastWindows.forEach((window) => addWindow(returnGroup, resources, geometry, window, style));

  const entryGroup = addArchitectureRiseEntrance({
    parent: context,
    door: layout.door,
    groundYmm: geometry.ground.y,
    frontFacadeZmm: geometry.facade.frontFacadeZ,
    materials: { door: resources.door, stone: resources.trim, base: resources.base, glass: resources.glass },
    addBox,
  });
  entryGroup.userData.resources = resources;
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
  detailStyle?: ArchitectureRiseDetailStyle;
  variationDescriptor?: SceneVariationDescriptor;
}>;

export function createArchitectureRiseGroup(
  request: ArchitectureRiseAssetRequest,
): THREE.Group {
  const { presentation } = request;
  const { geometry } = presentation;
  const { layout } = presentation;
  const style = request.detailStyle ?? ARCHITECTURE_RISE_DETAIL_STYLE;
  const materialVariation = resolveArchitectureRiseMaterialVariation(request.variationDescriptor);
  const resources = createResources(geometry, style, materialVariation);
  const root = new THREE.Group();
  root.name = "architecture-rise-subject";
  root.userData.resources = resources;
  const front = geometry.facade.frontFacadeZ;
  const frontWindows = layout.windows.filter((window): window is ArchitectureRiseFrontWindow =>
    window.elevation === "front",
  );
  const facadeQuietZones = collectCanonicalFacadeQuietZones(
    geometry.getArchitectureFocusChartCells,
    geometry.getArchitectureFocusChartBars,
    geometry.getArchitectureFacadeFineDetailPieces,
    style.masonry.quietZoneMarginMm,
  );
  const baseStoneTopY = Math.min(geometry.ground.y + style.base.heightAboveGroundMm,
    ...facadeQuietZones.map(zone => zone.minYMm - 80));
  const mainOpenings: ArchitectureRiseWallOpening[] = [
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
  const facade = layout.mainFacade;
  const wallThickness = 160;
  addSegmentedWall(mainFacadeShell, resources, {
    name: "architecture-rise-main-facade-wall",
    horizontalMinMm: layout.mainFacade.minXMm,
    horizontalMaxMm: layout.mainFacade.maxXMm,
    verticalMinMm: layout.mainFacade.minYMm,
    verticalMaxMm: layout.mainFacade.maxYMm,
    depthMinMm: layout.mainFacade.frontZMm,
    depthMaxMm: facade.frontZMm + wallThickness,
    openings: mainOpenings,
    horizontalAxis: "x",
    primaryMeshName: "architecture-rise-primary-facade",
    baseStoneTopMm: baseStoneTopY,
    quietZones: facadeQuietZones,
    brickStyle: style.masonry,
  });

  for (const east of [false, true]) {
    addSegmentedWall(mainFacadeShell, resources, {
      name: `architecture-rise-${east ? "east" : "west"}-flank`,
      horizontalMinMm: facade.frontZMm + wallThickness,
      horizontalMaxMm: facade.backZMm - wallThickness,
      verticalMinMm: facade.minYMm,
      verticalMaxMm: facade.maxYMm,
      depthMinMm: east ? facade.maxXMm - wallThickness : facade.minXMm,
      depthMaxMm: east ? facade.maxXMm : facade.minXMm + wallThickness,
      openings: [], horizontalAxis: "z",
      baseStoneTopMm: baseStoneTopY, brickStyle: style.masonry,
    });
  }
  const rearWall = new THREE.Group();
  rearWall.name = "architecture-rise-rear-wall";
  rearWall.userData.resources = resources;
  root.add(rearWall);
  const rearOpenings = getArchitectureRiseRearOpenings(layout);
  addSegmentedWall(rearWall, resources, {
    name: "architecture-rise-rear-wall",
    horizontalMinMm: facade.minXMm, horizontalMaxMm: facade.maxXMm,
    verticalMinMm: facade.minYMm, verticalMaxMm: facade.maxYMm,
    depthMinMm: facade.backZMm - wallThickness, depthMaxMm: facade.backZMm,
    openings: rearOpenings, horizontalAxis: "x",
    baseStoneTopMm: baseStoneTopY, brickStyle: style.masonry,
  });
  addArchitectureRiseRearJoinery({
    parent: root, openings: rearOpenings, rearZMm: facade.backZMm, addBox,
    materials: { stone: resources.roof, timber: resources.door, glass: resources.glass },
  });

  const copingHeight = 60;
  const wallHeight = geometry.building.topHeight - copingHeight;
  const parapetCenterY = geometry.facade.mainBodyTopY + wallHeight / 2;
  const parapetThickness = 160;
  const panelInset = 98;
  const parapetDepth = geometry.building.depth - 2 * parapetThickness;
  for (const rear of [false, true]) {
    const parapet = addBox({
      name: rear ? "architecture-rise-roof-parapet-rear" : "architecture-rise-roof-parapet",
      size: [geometry.building.width, wallHeight, rear ? parapetThickness : parapetThickness - panelInset],
      position: [0, parapetCenterY, rear ? facade.backZMm - parapetThickness / 2 : front + (parapetThickness + panelInset) / 2],
      material: resources.roof, parent: root,
    });
    parapet.castShadow = true;
    parapet.receiveShadow = true;
  }
  for (const side of [-1, 1]) {
    addBox({
      name: `architecture-rise-roof-parapet-${side < 0 ? "west" : "east"}`,
      size: [parapetThickness, wallHeight, parapetDepth],
      position: [side * (geometry.building.width - parapetThickness) / 2, parapetCenterY, geometry.building.center.z],
      material: resources.roof, parent: root,
    });
  }
  const deck = addBox({
    name: "architecture-rise-roof-deck",
    size: [geometry.building.width - 2 * parapetThickness, 80, parapetDepth],
    position: [0, geometry.facade.mainBodyTopY + geometry.building.topHeight / 2 - 40, geometry.building.center.z],
    material: resources.pavement, parent: root,
  });
  deck.receiveShadow = true;

  const masonryDetail = new THREE.Group();
  masonryDetail.name = "architecture-rise-masonry-relief";
  masonryDetail.userData.resources = resources;
  root.add(masonryDetail);
  const halfWidth = geometry.building.width / 2;
  const corniceY = geometry.facade.mainBodyTopY - 20;
  const bedY = corniceY - style.cornice.bandHeightMm / 2 - 30;
  const friezeY = bedY + 48;
  const soffitY = friezeY + style.cornice.bracketHeightMm;
  const reach = style.cornice.projectionMm * 0.62;
  const corniceTopY = soffitY + 70;
  addArchitectureRiseCorniceProfile({
    parent: masonryDetail, facade, material: resources.trim,
    names: ["architecture-rise-cornice-underband", "architecture-rise-cornice-underband-return-west",
      "architecture-rise-cornice-underband-back", "architecture-rise-cornice-underband-return-east"],
    profile: [[bedY, -10], [bedY, 27], [bedY + 12, 42], [bedY + 24, 42],
      [bedY + 34, 59], [friezeY, 59], [friezeY, 26]],
  });
  // A recessed frieze sits behind the pale projecting corbels under the corona.
  addArchitectureRiseCorniceProfile({
    parent: masonryDetail, facade, material: resources.stoneJoint,
    names: ["architecture-rise-cornice-front", "architecture-rise-cornice-return-west",
      "architecture-rise-cornice-back", "architecture-rise-cornice-return-east"],
    profile: [[friezeY, 26], [soffitY, 26]],
  });
  addArchitectureRiseCorniceProfile({
    parent: masonryDetail, facade, material: resources.trim,
    names: ["architecture-rise-cornice-cap", "architecture-rise-cornice-cap-return-west",
      "architecture-rise-cornice-cap-back", "architecture-rise-cornice-cap-return-east"],
    profile: [[soffitY, 26], [soffitY, reach], [soffitY + 27, reach],
      [soffitY + 44, reach + 18], [soffitY + 58, reach + 18], [corniceTopY, reach - 2],
      [corniceTopY, -panelInset]],
  });
  addArchitectureRiseCorniceBrackets({
    parent: masonryDetail,
    frontFacadeZMm: front,
    facadeWidthMm: geometry.building.width,
    corniceCenterYMm: corniceY, soffitYMm: soffitY,
    layout, style, material: resources.trim, bracketGeometry: resources.corniceBracketGeometry,
  });

  const wallTopY = geometry.facade.parapetTopY - copingHeight;
  const panelBottomY = corniceTopY;
  const railHeight = style.cornice.parapetCourseHeightMm * 0.7;
  for (const upper of [false, true]) {
    addBox({
      name: `architecture-rise-parapet-${upper ? "upper" : "lower"}-rail`,
      size: [geometry.building.width, railHeight, panelInset],
      position: [0, upper ? wallTopY - railHeight / 2 : panelBottomY + railHeight / 2, front + panelInset / 2],
      material: resources.trim, parent: masonryDetail,
    });
  }
  for (const pier of [-1, 0, 1]) {
    const width = pier === 0 ? 150 : 184;
    addBox({
      name: `architecture-rise-parapet-panel-pier-${pier}`,
      size: [width, wallTopY - panelBottomY - 2 * railHeight, panelInset],
      position: [pier * (geometry.building.width - width) / 2, (wallTopY + panelBottomY) / 2, front + panelInset / 2],
      material: resources.trim, parent: masonryDetail,
    });
  }

  // The coping overhangs both faces of the parapet. The long pieces own the
  // corner squares, so each exposed roof point has a single top surface.
  const copingOut = 35;
  const copingIn = 12;
  const copingDepth = copingOut + parapetThickness + copingIn;
  const copingY = wallTopY + copingHeight / 2;
  for (const rear of [false, true]) {
    addBox({
      name: `architecture-rise-roof-coping-${rear ? "back" : "front"}`,
      size: [geometry.building.width + 2 * copingOut, copingHeight, copingDepth],
      position: [0, copingY, rear ? facade.backZMm + copingOut - copingDepth / 2 : front - copingOut + copingDepth / 2],
      material: resources.trim, parent: masonryDetail,
    });
  }
  for (const sign of [-1, 1]) {
    addBox({
      name: `architecture-rise-roof-coping-return-${sign}`,
      size: [copingDepth, copingHeight, geometry.building.depth - 2 * (parapetThickness + copingIn)],
      position: [sign * (halfWidth + copingOut - copingDepth / 2), copingY, geometry.building.center.z],
      material: resources.trim, parent: masonryDetail,
    });
  }
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-facade-corner-pilaster-${sign < 0 ? "left" : "right"}`,
      size: [80, geometry.building.height, 58],
      position: [sign * (halfWidth - 40), geometry.building.center.y, front - 20],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );
  addArchitectureRiseCornerQuoins({
    parent: masonryDetail,
    addBox,
    geometry,
    facadeFrontZmm: front,
    baseTopYmm: baseStoneTopY,
    material: resources.trim,
    style: style.base,
  });
  addBox({
    name: "architecture-rise-base-foot",
    size: [geometry.building.width + 120, 48, 240],
    position: [0, geometry.ground.y + 24, front - 110],
    material: resources.trim,
    parent: masonryDetail,
  });
  addArchitectureRiseStoneBaseJoints({
    parent: masonryDetail,
    addBox,
    facade, frontOpenings: mainOpenings, rearOpenings,
    baseTopYmm: baseStoneTopY,
    material: resources.stoneJoint,
    trim: resources.trim,
    style: style.base,
  });

  frontWindows.forEach((window) => addWindow(root, resources, geometry, window, style));
  addFocusChart(root, resources, geometry);
  addFacadeFineDetail(root, resources, geometry);
  addArchitectureContext(root, resources, geometry, layout, style);
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
