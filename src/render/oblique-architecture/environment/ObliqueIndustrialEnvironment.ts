import * as THREE from "three";
import type { ObliqueArchitectureGroundGeometry } from "../../../scenes/obliqueArchitectureGeometry";
import type { MasonryMaterials } from "../MasonryMaterials";
import { addIndustrialBuildings } from "./IndustrialBuildings";
import { createIndustrialMaterials } from "./IndustrialMaterials";
import { addIndustrialFurniture, addIndustrialStreet } from "./IndustrialStreet";

export function createObliqueIndustrialEnvironment(ground: ObliqueArchitectureGroundGeometry, masonry: MasonryMaterials) {
  const district = new THREE.Group();
  district.name = "oblique-architecture-industrial-environment";
  const materials = createIndustrialMaterials(masonry);
  addIndustrialStreet(district, materials, ground);
  addIndustrialBuildings(district, materials, ground.y);
  addIndustrialFurniture(district, materials, ground.y);
  return district;
}
