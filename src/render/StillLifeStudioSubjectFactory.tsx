import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { StillLifeStudioPresentation } from "../scenes/presentation/stillLifeStudio";
import type {
  StillLifeObjectPlacement,
  StillLifePalette,
} from "../scenes/stillLifeStudioVariation";
import { resolveStillLifeStudioPlan } from "../scenes/stillLifeStudioVariation";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { createProceduralSurfaceMaterial } from "./ProceduralSurfaceMaterials";

export type StillLifeStudioAssetRequest = Readonly<{
  presentation: StillLifeStudioPresentation;
  variationDescriptor?: SceneVariationDescriptor;
}>;

const paletteColors: Readonly<Record<StillLifePalette, string>> = {
  clay: "#9b6854",
  sage: "#727d70",
  ochre: "#aa8856",
  slate: "#617078",
  linen: "#c5bba8",
  charcoal: "#5f5d57",
};

const createPlainMaterial = (
  color: THREE.ColorRepresentation,
  roughness: number,
  flatShading = false,
): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({
  color,
  roughness,
  metalness: 0,
  flatShading,
});

const addBox = (
  root: THREE.Object3D,
  name: string,
  sizeMm: { width: number; height: number; depth: number },
  centerMm: { x: number; y: number; z: number },
  material: THREE.Material,
  shadows: { cast?: boolean; receive?: boolean } = {},
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(sizeMm.width),
      toWorld(sizeMm.height),
      toWorld(sizeMm.depth),
    ),
    material,
  );
  mesh.name = name;
  mesh.position.set(toWorld(centerMm.x), toWorld(centerMm.y), toWorld(centerMm.z));
  mesh.castShadow = shadows.cast ?? true;
  mesh.receiveShadow = shadows.receive ?? true;
  root.add(mesh);
  return mesh;
};

const createVesselGeometry = (
  dimensions: StillLifeObjectPlacement["dimensionsMm"],
  variant: StillLifeObjectPlacement["variant"],
): THREE.LatheGeometry => {
  const radius = toWorld(dimensions.width / 2);
  const halfHeight = toWorld(dimensions.height / 2);
  const narrowNeck = variant === "narrow-neck";
  const neckRadius = radius * (narrowNeck ? 0.3 : 0.48);
  const outer: THREE.Vector2[] = [
    new THREE.Vector2(radius * 0.34, -halfHeight),
    new THREE.Vector2(radius * 0.48, -halfHeight * 0.91),
    new THREE.Vector2(radius * 0.84, -halfHeight * 0.58),
    new THREE.Vector2(radius * 0.98, -halfHeight * 0.22),
    new THREE.Vector2(radius * 0.86, halfHeight * 0.12),
    new THREE.Vector2(radius * 0.56, halfHeight * 0.33),
    new THREE.Vector2(neckRadius, halfHeight * 0.39),
    new THREE.Vector2(neckRadius, halfHeight * 0.86),
    new THREE.Vector2(neckRadius * 1.12, halfHeight * 0.93),
    new THREE.Vector2(neckRadius, halfHeight),
  ];
  const wall = radius * 0.08;
  const inner: THREE.Vector2[] = [
    new THREE.Vector2(Math.max(0, neckRadius - wall), halfHeight),
    new THREE.Vector2(Math.max(0, neckRadius - wall), halfHeight * 0.76),
    new THREE.Vector2(radius * 0.42, halfHeight * 0.24),
    new THREE.Vector2(radius * 0.72, -halfHeight * 0.2),
    new THREE.Vector2(radius * 0.68, -halfHeight * 0.48),
    new THREE.Vector2(radius * 0.38, -halfHeight * 0.77),
    new THREE.Vector2(0, -halfHeight * 0.77),
  ];
  return new THREE.LatheGeometry([...outer, ...inner], 24);
};

const createBowlGeometry = (
  dimensions: StillLifeObjectPlacement["dimensionsMm"],
  variant: StillLifeObjectPlacement["variant"],
): THREE.LatheGeometry => {
  const radius = toWorld(dimensions.width / 2);
  const halfHeight = toWorld(dimensions.height / 2);
  const deep = variant === "deep-bowl";
  const bottomRadius = radius * 0.25;
  const wall = radius * 0.07;
  return new THREE.LatheGeometry([
    new THREE.Vector2(bottomRadius, -halfHeight),
    new THREE.Vector2(radius * 0.54, -halfHeight * 0.78),
    new THREE.Vector2(radius * 0.84, -halfHeight * 0.22),
    new THREE.Vector2(radius, halfHeight * (deep ? 0.78 : 0.9)),
    new THREE.Vector2(radius * 0.96, halfHeight),
    new THREE.Vector2(radius - wall, halfHeight),
    new THREE.Vector2(radius * 0.77, halfHeight * (deep ? 0.62 : 0.7)),
    new THREE.Vector2(radius * 0.5, -halfHeight * 0.48),
    new THREE.Vector2(bottomRadius * 0.6, -halfHeight * 0.72),
  ], 28);
};

type ObjectMaterials = Readonly<{
  body: THREE.Material;
  pages: THREE.Material;
}>;

const createObjectMaterials = (placement: StillLifeObjectPlacement): ObjectMaterials => {
  const color = paletteColors[placement.palette];
  const body = placement.family === "wooden-form"
    ? createProceduralSurfaceMaterial({
        color,
        pattern: "wood",
        repeat: [2.6, 2.3],
        roughness: 0.78,
        normalStrength: 0.1,
        variationSeed: placement.surfaceVariationSeed,
      })
    : createPlainMaterial(color, placement.family === "vessel" || placement.family === "bowl" ? 0.58 : 0.82);
  const pages = placement.family === "books"
    ? createProceduralSurfaceMaterial({
        color: placement.palette === "charcoal" ? "#c9c1ae" : "#d2c8b5",
        pattern: "paper",
        repeat: [1.8, 1.4],
        roughness: 0.94,
        normalStrength: 0.055,
        variationSeed: placement.surfaceVariationSeed,
      })
    : body;
  return { body, pages };
};

const addObject = (root: THREE.Group, placement: StillLifeObjectPlacement): void => {
  const objectGroup = new THREE.Group();
  objectGroup.name = `still-life-studio-object-${placement.id}`;
  objectGroup.position.set(
    toWorld(placement.positionMm.x),
    toWorld(placement.positionMm.y),
    toWorld(placement.positionMm.z),
  );
  objectGroup.rotation.y = (placement.rotationYDeg * Math.PI) / 180;
  objectGroup.userData.stillLifePlacement = placement;
  root.add(objectGroup);

  const { dimensionsMm, variant } = placement;
  const materials = createObjectMaterials(placement);
  const objectName = `still-life-studio-${placement.id}`;

  if (placement.family === "vessel") {
    const vessel = new THREE.Mesh(createVesselGeometry(dimensionsMm, variant), materials.body);
    vessel.name = `${objectName}-vessel`;
    vessel.castShadow = true;
    vessel.receiveShadow = true;
    objectGroup.add(vessel);
    const foot = new THREE.Mesh(
      new THREE.TorusGeometry(toWorld(dimensionsMm.width * 0.18), toWorld(8), 6, 24),
      materials.body,
    );
    foot.name = `${objectName}-foot`;
    foot.rotation.x = Math.PI / 2;
    foot.position.y = toWorld(-dimensionsMm.height / 2 + 12);
    foot.castShadow = true;
    foot.receiveShadow = true;
    objectGroup.add(foot);
    return;
  }

  if (placement.family === "bowl") {
    const bowl = new THREE.Mesh(createBowlGeometry(dimensionsMm, variant), materials.body);
    bowl.name = `${objectName}-bowl`;
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    objectGroup.add(bowl);
    return;
  }

  if (placement.family === "books") {
    const count = variant === "three-book-stack" ? 3 : 2;
    const layerHeight = dimensionsMm.height / count;
    const coverThickness = Math.min(12, layerHeight * 0.13);
    for (let index = 0; index < count; index += 1) {
      const centerY = -dimensionsMm.height / 2 + layerHeight * (index + 0.5);
      const offsetX = index % 2 === 0 ? -toWorld(8) : toWorld(8);
      const bookWidth = dimensionsMm.width - 16 - index * 6;
      const bookDepth = dimensionsMm.depth - index * 8;
      const page = new THREE.Mesh(
        new RoundedBoxGeometry(
          toWorld(bookWidth - 12),
          toWorld(layerHeight - coverThickness * 2),
          toWorld(bookDepth - 10),
          2,
          toWorld(3),
        ),
        materials.pages,
      );
      page.name = `${objectName}-book-${index + 1}-pages`;
      page.position.set(offsetX, toWorld(centerY), 0);
      page.castShadow = true;
      page.receiveShadow = true;
      objectGroup.add(page);

      for (const [surface, sign] of [["bottom", -1], ["top", 1]] as const) {
        const cover = new THREE.Mesh(
          new RoundedBoxGeometry(
            toWorld(bookWidth),
            toWorld(coverThickness),
            toWorld(bookDepth),
            2,
            toWorld(3),
          ),
          materials.body,
        );
        cover.name = `${objectName}-book-${index + 1}-${surface}-cover`;
        cover.position.set(
          offsetX,
          toWorld(centerY + sign * (layerHeight / 2 - coverThickness / 2)),
          0,
        );
        cover.castShadow = true;
        cover.receiveShadow = true;
        objectGroup.add(cover);
      }
    }
    return;
  }

  if (variant === "rounded-block") {
    const block = new THREE.Mesh(
      new RoundedBoxGeometry(
        toWorld(dimensionsMm.width),
        toWorld(dimensionsMm.height),
        toWorld(dimensionsMm.depth),
        3,
        toWorld(Math.min(dimensionsMm.width, dimensionsMm.height, dimensionsMm.depth) * 0.035),
      ),
      materials.body,
    );
    block.name = `${objectName}-rounded-wood-block`;
    block.castShadow = true;
    block.receiveShadow = true;
    objectGroup.add(block);
    return;
  }

  const bottomHeight = dimensionsMm.height * 0.42;
  const middleHeight = dimensionsMm.height * 0.31;
  const topHeight = dimensionsMm.height - bottomHeight - middleHeight;
  const steps = [
    { name: "base", width: 1, depth: 1, height: bottomHeight, bottom: -dimensionsMm.height / 2 },
    { name: "middle", width: 0.74, depth: 0.74, height: middleHeight, bottom: -dimensionsMm.height / 2 + bottomHeight },
    { name: "top", width: 0.5, depth: 0.5, height: topHeight, bottom: -dimensionsMm.height / 2 + bottomHeight + middleHeight },
  ];
  steps.forEach((step) => {
    const block = new THREE.Mesh(
      new RoundedBoxGeometry(
        toWorld(dimensionsMm.width * step.width),
        toWorld(step.height),
        toWorld(dimensionsMm.depth * step.depth),
        3,
        toWorld(Math.min(dimensionsMm.width, dimensionsMm.depth, step.height) * 0.025),
      ),
      materials.body,
    );
    block.name = `${objectName}-stepped-wood-${step.name}`;
    block.position.y = toWorld(step.bottom + step.height / 2);
    block.castShadow = true;
    block.receiveShadow = true;
    objectGroup.add(block);
  });
};

const addFocusReferences = (
  root: THREE.Group,
  presentation: StillLifeStudioPresentation,
  tileMaterial: THREE.Material,
  markMaterial: THREE.Material,
): void => {
  presentation.geometry.stillLifeStudioFocusReferences.forEach((reference) => {
    const tileDimensions = presentation.geometry.stillLifeStudioFocusTileDimensionsMm;
    const tileCenterYmm = presentation.geometry.stillLifeStudioTable.topYmm + tileDimensions.height / 2;
    const tileFrontZmm = reference.z - tileDimensions.depth / 2;
    const focusGroup = new THREE.Group();
    focusGroup.name = `still-life-studio-focus-reference-${reference.id}`;
    root.add(focusGroup);
    addBox(
      focusGroup,
      `still-life-studio-focus-tile-${reference.id}`,
      tileDimensions,
      { x: reference.x, y: tileCenterYmm, z: reference.z },
      tileMaterial,
      { cast: false },
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(toWorld(22), toWorld(27), 24),
      markMaterial,
    );
    ring.name = `still-life-studio-focus-mark-${reference.id}`;
    ring.rotation.y = Math.PI;
    ring.position.set(toWorld(reference.x), toWorld(tileCenterYmm), toWorld(tileFrontZmm - 0.15));
    ring.castShadow = false;
    ring.receiveShadow = false;
    focusGroup.add(ring);

    const target = presentation.geometry.stillLifeStudioFocusTargets.find(
      (candidate) => candidate.id === reference.id,
    );
    if (!target) return;
    const probe = new THREE.Object3D();
    probe.name = `still-life-studio-focus-${reference.id}`;
    probe.position.set(
      toWorld(target.worldPosition.x),
      toWorld(target.worldPosition.y),
      toWorld(target.worldPosition.z),
    );
    probe.userData.focusTargetId = target.id;
    probe.userData.focusProbeWorldMm = { ...target.worldPosition };
    focusGroup.add(probe);
  });
};

export const createStillLifeStudioGroup = (
  request: StillLifeStudioAssetRequest,
): THREE.Group => {
  const { geometry } = request.presentation;
  const plan = resolveStillLifeStudioPlan(request.variationDescriptor);
  const root = new THREE.Group();
  root.name = "still-life-studio-subject";
  root.userData.sceneVariationPlan = plan;

  const floorMaterial = createProceduralSurfaceMaterial({
    color: "#aaa69d",
    pattern: "concrete",
    repeat: [7, 8],
    roughness: 0.94,
    normalStrength: 0.035,
    variationSeed: 0x219f4d31,
  });
  const tableMaterial = createProceduralSurfaceMaterial({
    color: "#7b6049",
    pattern: "wood",
    repeat: [2, 2.6],
    roughness: 0.78,
    normalStrength: 0.085,
    variationSeed: 0x419f8c13,
  });
  const backdropMaterial = createProceduralSurfaceMaterial({
    color: "#b5ab9b",
    pattern: "plaster",
    repeat: [2.4, 2.1],
    roughness: 0.96,
    normalStrength: 0.04,
    variationSeed: 0x0f1a7c29,
  });
  const tileMaterial = createPlainMaterial("#b5aa96", 0.82);
  const markMaterial = createPlainMaterial("#6f675d", 0.9);

  addBox(
    root,
    "still-life-studio-floor",
    {
      width: geometry.stillLifeStudioFloor.sizeMm.width,
      height: geometry.stillLifeStudioFloor.sizeMm.height,
      depth: geometry.stillLifeStudioFloor.sizeMm.depth,
    },
    geometry.stillLifeStudioFloor.centerMm,
    floorMaterial,
    { cast: false },
  );
  addBox(
    root,
    "still-life-studio-table-top",
    {
      width: geometry.stillLifeStudioTable.sizeMm.width,
      height: geometry.stillLifeStudioTable.sizeMm.height,
      depth: geometry.stillLifeStudioTable.sizeMm.depth,
    },
    geometry.stillLifeStudioTable.centerMm,
    tableMaterial,
  );

  const legHeightMm = 745;
  const legGeometry = new THREE.BoxGeometry(toWorld(100), toWorld(legHeightMm), toWorld(100));
  [
    { x: -1320, z: 2580 },
    { x: 1320, z: 2580 },
    { x: -1320, z: 5620 },
    { x: 1320, z: 5620 },
  ].forEach((position, index) => {
    const leg = new THREE.Mesh(legGeometry, tableMaterial);
    leg.name = `still-life-studio-table-leg-${index + 1}`;
    const legCenterYmm = geometry.stillLifeStudioTable.topYmm
      - geometry.stillLifeStudioTable.sizeMm.height
      - legHeightMm / 2;
    leg.position.set(toWorld(position.x), toWorld(legCenterYmm), toWorld(position.z));
    leg.castShadow = true;
    leg.receiveShadow = true;
    root.add(leg);
  });

  addBox(
    root,
    "still-life-studio-backdrop",
    {
      width: geometry.stillLifeStudioBackdrop.sizeMm.width,
      height: geometry.stillLifeStudioBackdrop.sizeMm.height,
      depth: geometry.stillLifeStudioBackdrop.sizeMm.depth,
    },
    geometry.stillLifeStudioBackdrop.centerMm,
    backdropMaterial,
    { cast: false },
  );

  addFocusReferences(root, request.presentation, tileMaterial, markMaterial);
  plan.objects.forEach((placement) => addObject(root, placement));
  return root;
};

export const disposeStillLifeStudioGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};
