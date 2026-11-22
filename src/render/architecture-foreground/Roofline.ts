import * as THREE from "three";
import type { ArchitectureForegroundPresentation } from "../../scenes/presentation/architectureForeground";
import { toWorld } from "../rttUtils";
import { createBuildingGeometry } from "./BuildingGeometry";
import type { BuildingMaterials } from "./BuildingMaterials";

type Layout = ArchitectureForegroundPresentation["geometry"];

export function addRoofline(root: THREE.Group, layout: Layout, materials: BuildingMaterials) {
  const { building, facade, ground, windowRowCenters } = layout;
  const { x, z } = building.center;
  const { width, depth } = building;
  const base = facade.parapetBottomY;
  const top = facade.parapetTopY;
  const shapes = createBuildingGeometry(root);

  function ring(
    name: string, material: THREE.Material, y: number, height: number, projection: number, thickness: number,
  ) {
    for (const side of [-1, 1]) {
      shapes.box(name, material, [x, y, z + side * (depth / 2 + projection - thickness / 2)],
        [width + projection * 2, height, thickness]);
      shapes.box(name, material, [x + side * (width / 2 + projection - thickness / 2), y, z],
        [thickness, height, depth + projection * 2 - thickness * 2]);
    }
  }

  ring("plinth", materials.stone, ground.y + 69, 138, 29, 63);
  ring("plinth-cap", materials.trim, ground.y + 142, 20, 38, 67);
  const baseTop = windowRowCenters[0] + building.windowHeight / 2 + 86;
  ring("belt-course", materials.trim, baseTop + 7, 52, 39, 68);
  ring("belt-course-edge", materials.cap, baseTop + 33, 13, 49, 72);

  ring("cornice-neck", materials.trim, base - 243, 42, 28, 68);
  ring("cornice-bed", materials.trim, base - 126, 47, 47, 90);
  ring("cornice-fascia", materials.cap, base - 49, 45, 71, 115);
  ring("cornice-crown", materials.trim, base - 14, 26, 78, 130);
  for (const side of [-1, 1]) {
    for (let u = -width / 2 + 101; u < width / 2; u += 182) {
      shapes.box("cornice-dentils", materials.trim, [x + u, base - 92, z + side * (depth / 2 + 24)], [67, 63, 81]);
    }
    for (let u = -depth / 2 + 137; u < depth / 2 - 90; u += 182) {
      shapes.box("cornice-dentils", materials.trim, [x + side * (width / 2 + 24), base - 92, z + u], [81, 63, 67]);
    }
  }

  shapes.box("roof", materials.roof, [x, base + 1, z], [width - 67, 48, depth - 67]);
  ring("parapet-plinth", materials.trim, base + 45, 90, 22, 138);
  ring("parapet-coping", materials.cap, top - 24, 48, 34, 158);

  const balusterHeight = top - 48 - (base + 90);
  const profile = [
    [32, 0], [36, 3], [36, 9], [23, 18], [16, 45], [30, 68], [29, 82], [18, 93], [30, 99], [30, 100],
  ].map(([radius, percent]) => new THREE.Vector2(toWorld(radius), toWorld(balusterHeight * percent / 100)));
  const baluster = new THREE.LatheGeometry(profile, 8);
  function railing(runsAlongX: boolean, fixed: number, piers: number[]) {
    const position = (u: number, y: number) => runsAlongX ? [u, y, fixed] as const : [fixed, y, u] as const;
    for (const u of runsAlongX ? piers : []) {
      shapes.box("parapet-piers", materials.trim, position(u, (top - 48 + base + 90) / 2), [132, balusterHeight, 132]);
      shapes.box("parapet-pier-caps", materials.cap, position(u, top - 42), [164, 32, 164]);
    }
    for (let index = 1; index < piers.length; index++) {
      const low = piers[index - 1] + 110;
      const high = piers[index] - 110;
      const count = Math.round((high - low) / 116) + 1;
      for (let balusterIndex = 0; balusterIndex < count; balusterIndex++) {
        const u = THREE.MathUtils.lerp(low, high, balusterIndex / (count - 1));
        const center = position(u, base + 90);
        shapes.add("parapet-balusters", materials.trim, baluster.clone()
          .translate(toWorld(center[0]), toWorld(center[1]), toWorld(center[2])));
      }
    }
  }
  const cornersX = [x - width / 2 + 66, x + width / 2 - 66];
  const cornersZ = [z - depth / 2 + 66, z + depth / 2 - 66];
  const frontPiers = [cornersX[0], x - width / 4, x, x + width / 4, cornersX[1]];
  for (const fixed of cornersZ) railing(true, fixed, frontPiers);
  for (const fixed of cornersX) railing(false, fixed, cornersZ);
  baluster.dispose();
  shapes.finish();
}
