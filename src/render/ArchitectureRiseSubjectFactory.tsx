import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../scenes/presentation/architectureRise";
import {
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
  sidewalk: THREE.MeshStandardMaterial;
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

const SURFACE_TEXTURE_SIZE = 128;

type SurfacePattern = "limestone" | "cut-stone" | "concrete";

type SurfaceMaterialOptions = {
  color: THREE.ColorRepresentation;
  pattern: SurfacePattern;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
};

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const hashNoise = (x: number, y: number, seed: number): number => {
  let value = Math.imul(x + seed * 17, 374761393) + Math.imul(y + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
};

const tileableNoise = (x: number, y: number, cellSize: number, seed: number): number => {
  const cellCount = SURFACE_TEXTURE_SIZE / cellSize;
  const gridX = x / cellSize;
  const gridY = y / cellSize;
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = (x0 + 1) % cellCount;
  const y1 = (y0 + 1) % cellCount;
  const fade = (value: number) => value * value * (3 - 2 * value);
  const mix = (start: number, end: number, amount: number) => start + (end - start) * amount;
  const tx = fade(gridX - x0);
  const ty = fade(gridY - y0);
  const top = mix(hashNoise(x0, y0, seed), hashNoise(x1, y0, seed), tx);
  const bottom = mix(hashNoise(x0, y1, seed), hashNoise(x1, y1, seed), tx);
  return mix(top, bottom, ty);
};

const createSurfaceTexture = (
  data: Uint8Array,
  repeat: readonly [number, number],
  color: boolean,
): THREE.DataTexture => {
  const texture = new THREE.DataTexture(
    data,
    SURFACE_TEXTURE_SIZE,
    SURFACE_TEXTURE_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Deterministic, subject-owned surface maps. The restrained color and normal
 * changes describe finish only; the existing meshes remain the source of all
 * façade and teaching geometry.
 */
const createSurfaceMaterial = ({
  color,
  pattern,
  repeat,
  roughness,
  normalStrength,
}: SurfaceMaterialOptions): THREE.MeshStandardMaterial => {
  const base = new THREE.Color(color).convertLinearToSRGB();
  const baseRgb: [number, number, number] = [
    base.r * 255,
    base.g * 255,
    base.b * 255,
  ];
  const pixelCount = SURFACE_TEXTURE_SIZE * SURFACE_TEXTURE_SIZE;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughnessMap = new Uint8Array(pixelCount * 4);
  const normalMap = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);
  const twoPi = Math.PI * 2;
  const isLimestone = pattern === "limestone";

  const surfaceSample = (x: number, y: number) => {
    const wave =
      Math.sin(twoPi * (2 * x + 3 * y) / SURFACE_TEXTURE_SIZE + 0.8) * 0.42 +
      Math.sin(twoPi * (5 * x - y) / SURFACE_TEXTURE_SIZE + 2.1) * 0.27 +
      Math.sin(twoPi * (3 * x + 6 * y) / SURFACE_TEXTURE_SIZE + 4.3) * 0.2;
    const broadNoise = tileableNoise(x, y, 16, isLimestone ? 13 : 29) - 0.5;
    const fineNoise = tileableNoise(x, y, 4, isLimestone ? 41 : 53) - 0.5;
    let joint = false;
    let blockTint = 0;
    let relief = wave * 0.045 + broadNoise * 0.055 + fineNoise * 0.02;

    if (isLimestone) {
      const course = Math.floor(y / 64);
      const stagger = (course % 2) * 32;
      const shiftedX = (x + stagger) % SURFACE_TEXTURE_SIZE;
      const verticalDistance = Math.min(shiftedX % 64, 64 - (shiftedX % 64));
      const horizontalDistance = Math.min(y % 64, 64 - (y % 64));
      joint = verticalDistance < 2 || horizontalDistance < 2;
      // Let adjacent limestone blocks read at the pilot's normal viewport
      // size while keeping the variation subordinate to the teaching marks.
      blockTint =
        (hashNoise(Math.floor(shiftedX / 64), course, 67) - 0.5) * 14;
      if (joint) relief -= 0.13;
    } else if (pattern === "cut-stone") {
      relief *= 0.62;
    } else {
      relief *= 0.48;
    }

    const variation = wave * (isLimestone ? 4.2 : pattern === "concrete" ? 3.4 : 2.8) + broadNoise * 5.5;
    return { joint, blockTint, relief, variation };
  };

  for (let y = 0; y < SURFACE_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < SURFACE_TEXTURE_SIZE; x += 1) {
      const index = y * SURFACE_TEXTURE_SIZE + x;
      const offset = index * 4;
      const { joint, blockTint, relief, variation } = surfaceSample(x, y);
      const jointTone = joint ? -15 : 0;
      const channels = [
        baseRgb[0] + blockTint + variation * 1.06 + jointTone,
        baseRgb[1] + blockTint * 0.82 + variation * 0.94 + jointTone,
        baseRgb[2] + blockTint * 0.58 + variation * 0.78 + jointTone,
      ];
      albedo[offset] = clampByte(channels[0]);
      albedo[offset + 1] = clampByte(channels[1]);
      albedo[offset + 2] = clampByte(channels[2]);
      albedo[offset + 3] = 255;

      const roughnessValue = pattern === "cut-stone" ? 224 : pattern === "concrete" ? 236 : 239;
      roughnessMap[offset] = clampByte(roughnessValue + variation * 1.3 + (joint ? 8 : 0));
      roughnessMap[offset + 1] = roughnessMap[offset];
      roughnessMap[offset + 2] = roughnessMap[offset];
      roughnessMap[offset + 3] = 255;
      heights[index] = relief;
    }
  }

  for (let y = 0; y < SURFACE_TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < SURFACE_TEXTURE_SIZE; x += 1) {
      const index = y * SURFACE_TEXTURE_SIZE + x;
      const offset = index * 4;
      const left = y * SURFACE_TEXTURE_SIZE + (x + SURFACE_TEXTURE_SIZE - 1) % SURFACE_TEXTURE_SIZE;
      const right = y * SURFACE_TEXTURE_SIZE + (x + 1) % SURFACE_TEXTURE_SIZE;
      const up = ((y + SURFACE_TEXTURE_SIZE - 1) % SURFACE_TEXTURE_SIZE) * SURFACE_TEXTURE_SIZE + x;
      const down = ((y + 1) % SURFACE_TEXTURE_SIZE) * SURFACE_TEXTURE_SIZE + x;
      const dx = (heights[right] - heights[left]) * 220;
      const dy = (heights[down] - heights[up]) * 220;
      normalMap[offset] = clampByte(128 - dx);
      normalMap[offset + 1] = clampByte(128 - dy);
      normalMap[offset + 2] = 255;
      normalMap[offset + 3] = 255;
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: createSurfaceTexture(albedo, repeat, true),
    roughnessMap: createSurfaceTexture(roughnessMap, repeat, false),
    normalMap: createSurfaceTexture(normalMap, repeat, false),
    roughness,
    metalness: 0,
  });
  material.normalScale.set(normalStrength, normalStrength);
  return material;
};

const createResources = (
  geometry: ArchitectureRisePresentation["geometry"],
): ArchitectureRiseResources => ({
  box: new THREE.BoxGeometry(1, 1, 1),
  ground: new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
  building: standard("#918779", 0.94),
  facade: createSurfaceMaterial({
    color: "#d7c19c",
    pattern: "limestone",
    repeat: [3, 3],
    roughness: 0.94,
    normalStrength: 0.3,
  }),
  roof: createSurfaceMaterial({
    color: "#969994",
    pattern: "cut-stone",
    repeat: [1, 1],
    roughness: 0.92,
    normalStrength: 0.14,
  }),
  trim: createSurfaceMaterial({
    color: "#f3e8d2",
    pattern: "cut-stone",
    repeat: [1, 1],
    roughness: 0.82,
    normalStrength: 0.12,
  }),
  glass: standard("#182d37", 0.24, 0.08),
  recess: standard("#101c22", 0.68),
  pavement: standard("#73766f", 0.98),
  sidewalk: createSurfaceMaterial({
    color: "#a6a397",
    pattern: "concrete",
    repeat: [10, 8],
    roughness: 0.98,
    normalStrength: 0.1,
  }),
  groundMaterial: standard("#c4c4bb", 0.99),
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
  sillDetail: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
  bay: ArchitectureRisePresentation["geometry"]["architectureRiseWindowBays"][number],
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

  // Shallow stone sills give the openings a construction detail without
  // changing the canonical glazing, frame, or facade placements.
  addBox({
    name: `${windowGroup.name}-stone-sill`,
    size: [bay.width + 88, 28, 48],
    position: [bay.x, bay.y - bay.height / 2 - frame - 14, front - 76],
    material: resources.trim,
    parent: sillDetail,
  });
};

const addSideWindowBay = (
  root: THREE.Group,
  sillDetail: THREE.Group,
  resources: ArchitectureRiseResources,
  geometry: ArchitectureRisePresentation["geometry"],
  bay: ArchitectureRisePresentation["geometry"]["architectureRiseSideWindowBays"][number],
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
  addBox({
    name: `${group.name}-stone-sill`,
    size: [42, 24, bay.width + 72],
    position: [sideX - 54, bay.y - bay.height / 2 - frame - 12, sideZ],
    material: resources.trim,
    parent: sillDetail,
  });
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
): void => {
  const context = new THREE.Group();
  context.name = "architecture-rise-context-structure";
  context.userData.resources = resources;
  root.add(context);

  const sideWindowSillDetail = new THREE.Group();
  sideWindowSillDetail.name = "architecture-rise-side-window-sill-detail";
  sideWindowSillDetail.userData.resources = resources;
  context.add(sideWindowSillDetail);

  const sideMass = addBox({
    name: "architecture-rise-side-return",
    size: [520, 3000, 760],
    position: [1900, geometry.ground.y + 1500, geometry.building.center.z + 220],
    material: resources.building,
    parent: context,
  });
  sideMass.castShadow = true;
  geometry.architectureRiseSideWindowBays.forEach((bay) =>
    addSideWindowBay(context, sideWindowSillDetail, resources, geometry, bay),
  );

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
  const resources = createResources(geometry);
  const root = new THREE.Group();
  root.name = "architecture-rise-subject";
  root.userData.resources = resources;
  const primaryFacadePlacement = geometry.getArchitectureRisePrimaryFacadePlacement();

  addBox({
    name: "architecture-rise-building-mass",
    size: [geometry.building.width, geometry.building.height, geometry.building.depth],
    position: [geometry.building.center.x, geometry.building.center.y, geometry.building.center.z],
    material: resources.building,
    parent: root,
  });
  addBox({
    name: "architecture-rise-primary-facade",
    size: [geometry.building.width - 120, geometry.building.height - 120, primaryFacadePlacement.depth],
    position: [geometry.building.center.x, geometry.building.center.y, primaryFacadePlacement.centerZ],
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

  const frontWindowSillDetail = new THREE.Group();
  frontWindowSillDetail.name = "architecture-rise-front-window-sill-detail";
  frontWindowSillDetail.userData.resources = resources;
  root.add(frontWindowSillDetail);
  geometry.architectureRiseWindowBays.forEach((bay) =>
    addWindowBay(root, frontWindowSillDetail, resources, geometry, bay),
  );
  addFocusChart(root, resources, geometry);
  addFacadeFineDetail(root, resources, geometry);
  addArchitectureContext(root, resources, geometry);
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
  disposeTeachingSubjectResources(group);
};
