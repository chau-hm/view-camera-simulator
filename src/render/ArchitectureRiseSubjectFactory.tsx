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
  addArchitectureRiseParapetPierCaps,
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
} from "./architecture-rise/ArchitectureRiseMasonry";
import { addArchitectureRiseWindowAssembly } from "./architecture-rise/ArchitectureRiseWindowDetails";
import {
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";
import { createProceduralSurfaceMaterial } from "./ProceduralSurfaceMaterials";
import { toWorld } from "./rttUtils";

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
    heightAboveGroundMm: 420,
    blockCourseHeightMm: 140,
    blockWidthMm: 420,
    jointWidthMm: 8,
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
    bracketWidthMm: 76,
    bracketHeightMm: 70,
    bracketDepthMm: 124,
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
): ArchitectureRiseResources => ({
  box: new THREE.BoxGeometry(1, 1, 1),
  ground: new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
  facade: createArchitectureRiseBrickMaterial(style.masonry),
  quietFacade: standard("#98553f", 0.94),
  base: createProceduralSurfaceMaterial({
    color: "#d6c8ae",
    pattern: "limestone",
    repeat: [5, 4],
    roughness: 0.92,
    normalStrength: 0.2,
  }),
  stoneJoint: standard("#9b8b75", 0.97),
  door: createProceduralSurfaceMaterial({
    color: "#50352b",
    pattern: "wood",
    repeat: [1, 2],
    roughness: 0.86,
    normalStrength: 0.14,
  }),
  roof: createProceduralSurfaceMaterial({
    color: "#c7b9a2",
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
      const isBaseStone = verticalCenter < (options.baseStoneTopMm ?? 0);
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
    verticalMaxMm: serviceReturn.maxYMm,
    depthMinMm: serviceReturn.minXMm,
    depthMaxMm: serviceReturn.maxXMm,
    openings: wingOpenings,
    horizontalAxis: "z",
    primaryMeshName: "architecture-rise-side-return",
    brickStyle: style.masonry,
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
  eastWindows.forEach((window) => addWindow(returnGroup, resources, geometry, window, style));

  const entryGroup = addArchitectureRiseEntrance({
    parent: context,
    door: layout.door,
    groundYmm: geometry.ground.y,
    frontFacadeZmm: geometry.facade.frontFacadeZ,
    materials: { door: resources.door, stone: resources.trim, base: resources.base },
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
}>;

export function createArchitectureRiseGroup(
  request: ArchitectureRiseAssetRequest,
): THREE.Group {
  const { presentation } = request;
  const { geometry } = presentation;
  const { layout } = presentation;
  const style = request.detailStyle ?? ARCHITECTURE_RISE_DETAIL_STYLE;
  const resources = createResources(geometry, style);
  const root = new THREE.Group();
  root.name = "architecture-rise-subject";
  root.userData.resources = resources;
  const front = geometry.facade.frontFacadeZ;
  const frontWindows = layout.windows.filter((window): window is ArchitectureRiseFrontWindow =>
    window.elevation === "front",
  );
  const lowestWindowSillY = Math.min(...frontWindows.map((window) =>
    window.centerYMm - window.openingHeightMm / 2,
  ));
  const baseStoneTopY = Math.min(
    geometry.ground.y + style.base.heightAboveGroundMm,
    lowestWindowSillY - style.window.outerSillThicknessMm - 8,
  );
  const facadeQuietZones = collectCanonicalFacadeQuietZones(
    geometry.getArchitectureFocusChartCells,
    geometry.getArchitectureFocusChartBars,
    geometry.getArchitectureFacadeFineDetailPieces,
    style.masonry.quietZoneMarginMm,
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
    baseStoneTopMm: baseStoneTopY,
    quietZones: facadeQuietZones,
    brickStyle: style.masonry,
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
  const cornice = {
    width: geometry.building.width,
    height: style.cornice.bandHeightMm,
    depth: style.cornice.projectionMm,
  };
  addBox({
    name: "architecture-rise-cornice-front",
    size: [cornice.width, cornice.height, cornice.depth],
    position: [0, corniceY, front + 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  addBox({
    name: "architecture-rise-cornice-underband",
    size: [cornice.width + 60, 30, cornice.depth + 40],
    position: [0, corniceY - cornice.height / 2 - 15, front + 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-cornice-underband-return-${sign < 0 ? "west" : "east"}`,
      size: [cornice.depth + 40, 30, geometry.building.depth + 40],
      position: [
        sign * (halfWidth + 30 - (cornice.depth + 40) / 2),
        corniceY - cornice.height / 2 - 15,
        geometry.building.center.z,
      ],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );
  addBox({
    name: "architecture-rise-cornice-underband-back",
    size: [cornice.width + 60, 30, 100],
    position: [0, corniceY - cornice.height / 2 - 15, geometry.facade.backFacadeZ + 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  addBox({
    name: "architecture-rise-cornice-cap",
    size: [cornice.width + 120, 32, cornice.depth + 60],
    position: [0, corniceY + cornice.height / 2 + 16, front + 20],
    material: resources.trim,
    parent: masonryDetail,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-cornice-cap-return-${sign < 0 ? "west" : "east"}`,
      size: [cornice.depth + 60, 32, geometry.building.depth + 60],
      position: [
        sign * (halfWidth + 60 - (cornice.depth + 60) / 2),
        corniceY + cornice.height / 2 + 16,
        geometry.building.center.z,
      ],
      material: resources.trim,
      parent: masonryDetail,
    }),
  );
  addBox({
    name: "architecture-rise-cornice-cap-back",
    size: [cornice.width + 120, 32, 120],
    position: [0, corniceY + cornice.height / 2 + 16, geometry.facade.backFacadeZ + 40],
    material: resources.trim,
    parent: masonryDetail,
  });
  [-1, 1].forEach((sign) =>
    addBox({
      name: `architecture-rise-cornice-return-${sign < 0 ? "west" : "east"}`,
      size: [cornice.depth, cornice.height, geometry.building.depth + 32],
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
  addArchitectureRiseCorniceBrackets({
    parent: masonryDetail,
    frontFacadeZMm: front,
    facadeWidthMm: geometry.building.width,
    corniceCenterYMm: corniceY,
    layout,
    style,
    material: resources.trim,
    bracketGeometry: resources.corniceBracketGeometry,
    corniceDepthMm: cornice.depth,
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
  addArchitectureRiseParapetPierCaps({
    parent: masonryDetail,
    addBox,
    facadeWidthMm: geometry.building.width,
    parapetTopYMm: geometry.facade.parapetTopY,
    frontFacadeZMm: front,
    material: resources.trim,
    style: style.cornice,
  });

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
  const stringCourseY = baseStoneTopY;
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
  addArchitectureRiseStoneBaseJoints({
    parent: masonryDetail,
    addBox,
    layout,
    groundYmm: geometry.ground.y,
    baseTopYmm: baseStoneTopY,
    facadeFrontZmm: layout.mainFacade.frontZMm,
    facadeBackZmm: layout.mainFacade.backZMm,
    facadeWidthMm: geometry.building.width,
    material: resources.stoneJoint,
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
