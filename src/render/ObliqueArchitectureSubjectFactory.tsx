import * as THREE from "three";
import type { ObliqueArchitecturePresentation } from "../scenes/presentation/obliqueArchitecture";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { createBuildingGeometry } from "./oblique-architecture/BuildingGeometry";
import { addElevations } from "./oblique-architecture/Elevations";
import { createMasonryMaterials } from "./oblique-architecture/MasonryMaterials";
import { createObliqueIndustrialEnvironment } from "./oblique-architecture/environment/ObliqueIndustrialEnvironment";

export type ObliqueArchitectureAssetRequest = Readonly<{
  presentation: ObliqueArchitecturePresentation;
}>;

export const createObliqueArchitectureGroup = (
  { presentation: { geometry } }: ObliqueArchitectureAssetRequest,
): THREE.Group => {
  const root = new THREE.Group();
  root.name = "oblique-architecture-subject";
  const material = createMasonryMaterials();
  root.userData.resources = material;
  const shapes = createBuildingGeometry(root);
  const { building: b, ground, buildingTopY: top } = geometry;
  const west = b.leftX;
  const width = b.rightX - west, length = b.farZ - b.nearZ;
  const cx = (west + b.rightX) / 2, cz = geometry.buildingCenter.z;
  const context = new THREE.Group();
  context.name = "oblique-architecture-context-structure";
  root.add(context);
  addElevations(root, geometry, shapes, material);

  // Front/rear rails own the corners. The long returns butt into their inner faces.
  function perimeter(name: string, mat: THREE.Material, y: number, height: number, projection: number, thickness: number) {
    const band = "oblique-architecture-" + name;
    const x = width / 2 + projection - thickness / 2;
    const z = length / 2 + projection - thickness / 2;
    for (const sign of [-1, 1]) {
      shapes.box(band, mat, [cx, y, cz + sign * z], [width + projection * 2, height, thickness], context);
      shapes.box(band, mat, [cx + sign * x, y, cz], [thickness, height, length + 2 * (projection - thickness)], context);
    }
  }
  const baseTop = geometry.windowRowCenters[0] - b.windowHeight / 2 - 48;
  // Return street-level trim on three elevations and stop either side of the loading door.
  function baseCourse(name: string, y: number, height: number, projection: number) {
    const depth = projection + 10;
    const meshName = "oblique-architecture-" + name;
    const overallWidth = width + 2 * projection;
    const gap = 985;
    shapes.box(meshName, material.stone, [cx, y, b.nearZ - projection + depth / 2], [overallWidth, height, depth], context);
    for (const sign of [-1, 1]) {
      shapes.box(meshName, material.stone, [cx + sign * (width / 2 + projection - depth / 2), y, cz],
        [depth, height, length + 2 * (projection - depth)], context);
      const outerX = sign < 0 ? west - projection : b.rightX + projection;
      const jambX = geometry.buildingCenter.x + sign * gap / 2;
      shapes.box(meshName, material.stone, [(outerX + jambX) / 2, y, b.farZ + projection - depth / 2],
        [Math.abs(outerX - jambX), height, depth], context);
    }
  }
  baseCourse("plinth", ground.y + 99, 98, 43);
  baseCourse("base-cap", baseTop - 25, 50, 42);
  for (const [i, y] of geometry.windowRowCenters.slice(1).entries()) {
    const bandY = y - b.windowHeight / 2 - 94;
    perimeter(`side-ledge-${i + 1}`, material.stone, bandY, 46, 21, 38);
  }

  // Alternating bonded corner stones connect the elevations; the west jamb
  // remains behind the ray to the nearest second-storey focus sample.
  for (const [end, z] of [b.nearZ, b.farZ].entries()) {
    const dz = end === 0 ? -1 : 1;
    for (const [side, x] of [west, b.rightX].entries()) {
      const dx = side === 0 ? -1 : 1;
      for (let i = 0, y = baseTop + 85; y + 80 < ground.y + b.height; y += 177, i++) {
        const frontWidth = i % 2 === 0 ? 166 : 110;
        const sideLength = i % 2 === 0 ? 125 : 199;
        shapes.box("oblique-architecture-corner", material.ashlar,
          [x - dx * (frontWidth / 2 - 8), y, z + dz * 5], [frontWidth, 167, 12], context);
        shapes.box("oblique-architecture-corner", material.ashlar,
          [x + dx * 4, y, z - dz * (sideLength / 2 + 1)], [8, 167, sideLength], context);
      }
    }
  }
  const corniceY = ground.y + b.height;
  perimeter("cornice-bed", material.stone, corniceY - 38, 76, 31, 95);
  perimeter("cornice-frieze", material.ashlar, corniceY + 55, 110, 22, 112);
  // Projecting blocks support the cornice shelf on every elevation.
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 27; i++) {
      shapes.box("oblique-architecture-modillions", material.stone,
        [cx + sign * (width / 2 + 40), corniceY + 76, b.nearZ + (i + 0.5) * length / 27],
        [44, 67, 73], context);
    }
    for (let i = 0; i < 9; i++) {
      shapes.box("oblique-architecture-modillions", material.stone,
        [west + (i + 0.5) * width / 9, corniceY + 76, cz + sign * (length / 2 + 40)],
        [73, 67, 44], context);
    }
  }
  const cornerReveal = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(84), toWorld(67), toWorld(100)), material.stone,
  );
  cornerReveal.name = "oblique-architecture-corner-reveal";
  cornerReveal.position.set(toWorld(west - 8), toWorld(corniceY + 76), toWorld(b.nearZ - 12));
  context.add(cornerReveal);
  perimeter("cornice-soffit", material.stone, corniceY + 131, 42, 72, 165);
  perimeter("cornice-crown", material.stone, corniceY + 172, 40, 85, 178);
  perimeter("parapet", material.brick, (top - 48 + corniceY + 192) / 2, top - 48 - corniceY - 192, 0, 130);
  perimeter("parapet-coping", material.stone, top - 24, 48, 30, 187);
  const roofY = corniceY + 158;
  shapes.box("oblique-architecture-roof", material.roof, [cx, roofY - 18, cz], [width - 174, 36, length - 174], context);
  for (let x = west + 360; x < b.rightX - 130; x += 390) {
    shapes.box("oblique-architecture-standing-seams", material.roof, [x, roofY + 6, cz], [12, 12, length - 254], context);
  }
  shapes.box("oblique-architecture-roof-hatch-curb", material.sash,
    [cx + 360, roofY + 45, b.farZ - 1040], [515, 90, 716], context);
  shapes.box("oblique-architecture-roof-hatch", material.roof,
    [cx + 360, roofY + 102, b.farZ - 1040], [560, 24, 758], context);

  shapes.box("oblique-architecture-ground", material.ground, [ground.centerX, ground.y - 5, ground.centerZ],
    [ground.width, 10, ground.farZ - ground.nearZ], context);
  shapes.box("oblique-architecture-sidewalk", material.paving, [cx, ground.y + 24, cz],
    [width + 820, 48, length + 910], context);
  geometry.focusTargets.forEach(target => {
    const probe = new THREE.Object3D();
    probe.name = "oblique-architecture-focus-" + target.id;
    const { x, y, z } = target.worldPosition;
    probe.position.set(toWorld(x), toWorld(y), toWorld(z));
    probe.userData = { focusTargetId: target.id, focusProbeWorldMm: { ...target.worldPosition } };
    root.add(probe);
  });
  shapes.finish();
  root.add(createObliqueIndustrialEnvironment(ground, material));
  return root;
};

export const disposeObliqueArchitectureGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};
