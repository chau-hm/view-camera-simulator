import * as THREE from "three";
import { addUrbanBuildings } from "./UrbanBuildings";
import { createUrbanMaterials } from "./UrbanMaterials";
import { addStreetFurniture, addUrbanStreet } from "./UrbanStreet";

export function createArchitectureRiseUrbanEnvironment(groundY: number, groundTint: THREE.Color): THREE.Group {
  const environment = new THREE.Group();
  environment.name = "architecture-rise-urban-environment";
  const materials = createUrbanMaterials(groundTint);
  addUrbanStreet(environment, materials, groundY);
  addUrbanBuildings(environment, materials, groundY);
  addStreetFurniture(environment, materials, groundY);
  return environment;
}
