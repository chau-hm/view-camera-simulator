import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { InteriorCornerPresentation } from "../scenes/presentation/interiorCorner";
import { toWorld } from "./rttUtils";
import {
  createFocusFriendlyMaterial,
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";
import { createProceduralSurfaceMaterial } from "./ProceduralSurfaceMaterials";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import { resolveInteriorCornerMaterialVariationSeeds } from "../scenes/interiorCornerMaterialVariation";
import {
  resolveInteriorCornerPropVariationPlan,
  type InteriorCornerPropPalette,
  type InteriorCornerPropPlacement,
  type InteriorCornerPropVariationPlan,
} from "../scenes/interiorCornerPropVariation";

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

const createStandardMaterial = (color: string, roughness = 0.88, flatShading = false) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading });

const variationPaletteColors: Readonly<Record<InteriorCornerPropPalette, string>> = {
  clay: "#a97662",
  sage: "#738078",
  ochre: "#a58b63",
  slate: "#687c84",
  linen: "#c7bba5",
  charcoal: "#68655f",
  ivory: "#d0c8b8",
};

const rugPaletteColors: Readonly<Record<InteriorCornerPropPalette, readonly [string, string]>> = {
  clay: ["#b6a08c", "#9b806e"],
  sage: ["#aeb0a0", "#888f83"],
  ochre: ["#b6a184", "#927c65"],
  slate: ["#a6a69c", "#828783"],
  linen: ["#b7a995", "#9c8d79"],
  charcoal: ["#a6a096", "#817d74"],
  ivory: ["#bdb2a0", "#988a77"],
};

const createVariationPaletteMaterialResolver = () => {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  return (palette: InteriorCornerPropPalette, roughness: number, flatShading = false) => {
    const key = `${palette}:${roughness}:${flatShading}`;
    let material = materials.get(key);
    if (!material) {
      material = createStandardMaterial(variationPaletteColors[palette], roughness, flatShading);
      materials.set(key, material);
    }
    return material;
  };
};

type InteriorCornerGeometry = InteriorCornerPresentation["geometry"];
export type InteriorCornerAssetRequest = Readonly<{
  presentation: InteriorCornerPresentation;
  variationDescriptor?: SceneVariationDescriptor;
}>;

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
  geometry: InteriorCornerGeometry,
  root: THREE.Object3D,
  detail: InteriorCornerGeometry["wallDetails"][number],
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
  geometry: InteriorCornerGeometry,
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
  geometry: InteriorCornerGeometry,
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

const addFocusProbes = (geometry: InteriorCornerGeometry, root: THREE.Object3D) => {
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

const addInteriorCornerVariationProps = (
  root: THREE.Group,
  plan: InteriorCornerPropVariationPlan,
  rugMaterial: THREE.Material,
): void => {
  const propsRoot = new THREE.Group();
  propsRoot.name = "interior-corner-seeded-props";
  root.add(propsRoot);
  const paletteMaterial = createVariationPaletteMaterialResolver();

  const addPlannedMesh = (
    prop: InteriorCornerPropPlacement,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    options: { castShadow?: boolean; receiveShadow?: boolean; scale?: readonly [number, number, number] } = {},
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `interior-corner-${prop.id}`;
    mesh.position.set(
      toWorld(prop.positionMm.x),
      toWorld(prop.positionMm.y),
      toWorld(prop.positionMm.z),
    );
    if ("rotationYDeg" in prop) mesh.rotation.y = (prop.rotationYDeg * Math.PI) / 180;
    if (options.scale) mesh.scale.set(...options.scale);
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    propsRoot.add(mesh);
    return mesh;
  };

  plan.props.forEach((prop) => {
    if (prop.kind === "vase") {
      addPlannedMesh(
        prop,
        new THREE.CylinderGeometry(
          toWorld(prop.topRadiusMm),
          toWorld(prop.baseRadiusMm),
          toWorld(prop.heightMm),
          18,
        ),
        paletteMaterial(prop.palette, 0.72),
      );
      return;
    }
    if (prop.kind === "book") {
      addPlannedMesh(
        prop,
        new THREE.BoxGeometry(
          toWorld(prop.dimensionsMm.width),
          toWorld(prop.dimensionsMm.height),
          toWorld(prop.dimensionsMm.depth),
        ),
        paletteMaterial(prop.palette, 0.86),
      );
      return;
    }
    if (prop.kind === "sculpture") {
      const geometry = prop.shape === "orb"
        ? new THREE.SphereGeometry(toWorld(1), 16, 12)
        : new THREE.DodecahedronGeometry(toWorld(1), 0);
      addPlannedMesh(
        prop,
        geometry,
        paletteMaterial(prop.palette, 0.68, prop.shape === "faceted"),
        {
          scale: [
            prop.dimensionsMm.width / 2,
            prop.dimensionsMm.height / 2,
            prop.dimensionsMm.depth / 2,
          ],
        },
      );
      return;
    }
    if (prop.kind === "cushion") {
      addPlannedMesh(
        prop,
        new RoundedBoxGeometry(
          toWorld(prop.dimensionsMm.width),
          toWorld(prop.dimensionsMm.height),
          toWorld(prop.dimensionsMm.depth),
          3,
          toWorld(Math.min(prop.dimensionsMm.width, prop.dimensionsMm.height, prop.dimensionsMm.depth) * 0.18),
        ),
        paletteMaterial(prop.palette, 0.96),
      );
      return;
    }

    const rugGroup = new THREE.Group();
    rugGroup.name = "interior-corner-rug-arrangement";
    rugGroup.position.set(
      toWorld(prop.positionMm.x),
      toWorld(prop.positionMm.y),
      toWorld(prop.positionMm.z),
    );
    rugGroup.rotation.y = (prop.rotationYDeg * Math.PI) / 180;
    propsRoot.add(rugGroup);
    const rug = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(prop.dimensionsMm.width),
        toWorld(prop.dimensionsMm.height),
        toWorld(prop.dimensionsMm.depth),
      ),
      rugMaterial,
    );
    rug.name = "interior-corner-rug";
    rug.receiveShadow = true;
    rugGroup.add(rug);

    const addPatternStrip = (
      name: string,
      size: [number, number, number],
      position: [number, number, number],
    ) => {
      const strip = addBox({
        root: rugGroup,
        name: `interior-corner-rug-${name}`,
        size,
        position,
        material: paletteMaterial(prop.palette, 0.98),
      });
      strip.receiveShadow = true;
    };
    const width = prop.dimensionsMm.width;
    const depth = prop.dimensionsMm.depth;
    const stripHeight = 6;
    const surfaceY = prop.dimensionsMm.height / 2 + stripHeight / 2;
    if (prop.pattern === "bordered") {
      const inset = 150;
      const rail = 28;
      addPatternStrip("border-near", [width - inset * 2, stripHeight, rail], [0, surfaceY, -depth / 2 + inset]);
      addPatternStrip("border-far", [width - inset * 2, stripHeight, rail], [0, surfaceY, depth / 2 - inset]);
      addPatternStrip("border-left", [rail, stripHeight, depth - inset * 2], [-width / 2 + inset, surfaceY, 0]);
      addPatternStrip("border-right", [rail, stripHeight, depth - inset * 2], [width / 2 - inset, surfaceY, 0]);
    } else if (prop.pattern === "striped") {
      [-520, 0, 520].forEach((z, index) => {
        addPatternStrip(`stripe-${index + 1}`, [width - 280, stripHeight, 74], [0, surfaceY, z]);
      });
    }
  });
};

const addInteriorFurnitureStructure = (
  geometry: InteriorCornerGeometry,
  root: THREE.Group,
  materials: InteriorCornerMaterials,
  keepCanonicalVase: boolean,
): void => {
  const structure = new THREE.Group();
  structure.name = "interior-corner-furniture-structure";

  const consoleLegGeometry = new THREE.BoxGeometry(toWorld(80), toWorld(480), toWorld(80));
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((zSign) => {
      const leg = new THREE.Mesh(consoleLegGeometry, materials.wood);
      leg.name = `interior-corner-console-leg-${xSign < 0 ? "left" : "right"}-${zSign < 0 ? "near" : "far"}`;
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

  if (keepCanonicalVase) {
    const vase = new THREE.Mesh(
      new THREE.CylinderGeometry(toWorld(85), toWorld(110), toWorld(260), 16),
      materials.artworkAccent,
    );
    vase.name = "interior-corner-console-vase";
    const consoleSupport = geometry.furnitureSupportSurfacesMm.consoleTop;
    vase.position.set(
      toWorld(consoleSupport.center.x),
      toWorld(consoleSupport.topY + 130),
      toWorld(consoleSupport.center.z),
    );
    structure.add(vase);
  }

  const finial = new THREE.Mesh(
    new THREE.CylinderGeometry(toWorld(32), toWorld(42), toWorld(90), 12),
    materials.metal,
  );
  finial.name = "interior-corner-lamp-finial";
  finial.position.set(toWorld(420), toWorld(geometry.room.floorY + 1495), toWorld(8300));
  structure.add(finial);

  root.add(structure);
};

export const createInteriorCornerGroup = (
  request: InteriorCornerAssetRequest,
): THREE.Group => {
  const { geometry } = request.presentation;
  const propVariationPlan = resolveInteriorCornerPropVariationPlan(request.variationDescriptor);
  const plannedRug = propVariationPlan?.props.find((prop) => prop.kind === "rug");
  const rugColors = plannedRug
    ? rugPaletteColors[plannedRug.palette]
    : ["#b7a995", "#9c8d79"] as const;
  const variationSeeds = resolveInteriorCornerMaterialVariationSeeds(
    request.variationDescriptor,
  );
  const root = new THREE.Group();
  root.name = "interior-corner-subject";

  const materials: InteriorCornerMaterials = {
    wall: createProceduralSurfaceMaterial({
      color: "#d8d2c5",
      pattern: "plaster",
      repeat: [3, 5],
      roughness: 0.96,
      normalStrength: 0.18,
      variationSeed: variationSeeds?.wall,
    }),
    ceiling: createProceduralSurfaceMaterial({
      color: "#e8e3d9",
      pattern: "plaster",
      repeat: [2, 3],
      roughness: 0.98,
      normalStrength: 0.1,
      variationSeed: variationSeeds?.ceiling,
    }),
    floor: createProceduralSurfaceMaterial({
      color: "#8e7963",
      pattern: "wood",
      repeat: [0.8, 1.7],
      roughness: 0.985,
      normalStrength: 0.035,
      variationSeed: variationSeeds?.floor,
    }),
    trim: createProceduralSurfaceMaterial({
      color: "#f0ece3",
      pattern: "plaster",
      repeat: [2, 4],
      roughness: 0.84,
      normalStrength: 0.1,
      variationSeed: variationSeeds?.trim,
    }),
    wood: createProceduralSurfaceMaterial({
      color: "#665244",
      pattern: "wood",
      repeat: [1.8, 7],
      roughness: 0.8,
      normalStrength: 0.18,
      variationSeed: variationSeeds?.wood,
    }),
    artwork: createProceduralSurfaceMaterial({
      color: "#66808a",
      pattern: "paper",
      repeat: [1, 1],
      roughness: 0.96,
      normalStrength: 0.035,
      variationSeed: variationSeeds?.artwork,
    }),
    artworkAccent: createStandardMaterial("#c48b62", 0.7),
    fabric: createProceduralSurfaceMaterial({
      color: "#6d7b78",
      pattern: "fabric",
      repeat: [0.5, 0.5],
      roughness: 0.98,
      normalStrength: 0.18,
      variationSeed: variationSeeds?.fabric,
    }),
    rug: createFocusFriendlyMaterial({
      pattern: "subtle-checker",
      primaryColor: rugColors[0],
      secondaryColor: rugColors[1],
      repeat: [10, 10],
      roughness: 1,
    }),
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

  addSideWallMoulding(geometry, root, materials);
  geometry.wallDetails.forEach((detail) =>
    addSideArtwork(geometry, root, detail, materials),
  );
  addBackArtwork(geometry, root, materials);

  const { consoleTop, benchSeat, rug } = geometry.furnitureSupportSurfacesMm;

  if (!propVariationPlan) {
    addBox({
      root,
      name: "interior-corner-rug",
      size: [rug.size.x, rug.size.y, rug.size.z],
      position: [rug.center.x, rug.center.y, rug.center.z],
      material: materials.rug,
    });
  }
  addBox({
    root,
    name: "interior-corner-console",
    // Keep the original footprint and upper surface, but leave an open
    // underframe so the added legs and shelf remain visible in the subject.
    size: [1700, 260, 420],
    position: [-1050, geometry.room.floorY + 490, 9850],
    material: materials.wood,
  });
  addBox({
    root,
    name: "interior-corner-console-top",
    size: [consoleTop.size.x, consoleTop.size.y, consoleTop.size.z],
    position: [consoleTop.center.x, consoleTop.center.y, consoleTop.center.z],
    material: materials.trim,
  });
  addBox({
    root,
    name: "interior-corner-bench-seat",
    size: [benchSeat.size.x, benchSeat.size.y, benchSeat.size.z],
    position: [benchSeat.center.x, benchSeat.center.y, benchSeat.center.z],
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

  addInteriorFurnitureStructure(geometry, root, materials, !propVariationPlan);
  if (propVariationPlan) {
    addInteriorCornerVariationProps(root, propVariationPlan, materials.rug);
  }
  addFocusProbes(geometry, root);
  return root;
};

export const disposeInteriorCornerGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};
