import * as THREE from "three";
import type { ArchitectureForegroundGroundGeometry } from "../../../scenes/architectureForegroundGeometry";
import { toWorld } from "../../rttUtils";
import { addCourtyardBuildings } from "./CourtyardBuildings";
import { addCourtyardGardens } from "./CourtyardGardens";
import { createCourtyardMaterials } from "./CourtyardMaterials";

function extendPaving(
  courtyard: THREE.Group, ground: ArchitectureForegroundGroundGeometry, paving: THREE.Material,
) {
  const canonicalEdge = ground.width / 2;
  const outerEdge = 12800;
  // The four extensions butt against the canonical plane and each other. The
  // original paving material receives the same UV at either side of a joint.
  const regions = [
    { id: "approach", west: -outerEdge, east: outerEdge, near: -4200, far: ground.nearZ },
    { id: "rear", west: -outerEdge, east: outerEdge, near: ground.farZ, far: 16400 },
    { id: "west", west: -outerEdge, east: -canonicalEdge, near: ground.nearZ, far: ground.farZ },
    { id: "east", west: canonicalEdge, east: outerEdge, near: ground.nearZ, far: ground.farZ },
  ];
  for (const { id, west, east, near, far } of regions) {
    const geometry = new THREE.PlaneGeometry(toWorld(east - west), toWorld(far - near));
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      const x = west + uv.getX(i) * (east - west);
      const z = far - uv.getY(i) * (far - near);
      uv.setXY(i, (x + canonicalEdge) / ground.width, (ground.farZ - z) / ground.depth);
    }
    const mesh = new THREE.Mesh(geometry, paving);
    mesh.name = "courtyard-ground-" + id;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(toWorld((west + east) / 2), toWorld(ground.y), toWorld((near + far) / 2));
    courtyard.add(mesh);
  }
}

export function createArchitectureForegroundCourtyard(
  ground: ArchitectureForegroundGroundGeometry, paving: THREE.Material,
): THREE.Group {
  const courtyard = new THREE.Group();
  courtyard.name = "architecture-foreground-courtyard-environment";
  const materials = createCourtyardMaterials();
  extendPaving(courtyard, ground, paving);
  addCourtyardBuildings(courtyard, materials, ground.y);
  addCourtyardGardens(courtyard, materials, ground.y);
  return courtyard;
}
