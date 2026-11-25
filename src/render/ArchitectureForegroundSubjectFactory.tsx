import * as THREE from "three";
import type { ArchitectureForegroundPresentation } from "../scenes/presentation/architectureForeground";
import { createBuildingMaterials, createPavingMaterials } from "./architecture-foreground/BuildingMaterials";
import { addElevations } from "./architecture-foreground/Elevations";
import { addRoofline } from "./architecture-foreground/Roofline";
import { createArchitectureForegroundCourtyard } from "./architecture-foreground/environment/ArchitectureForegroundCourtyard";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";

type ArchitectureForegroundGeometry = ArchitectureForegroundPresentation["geometry"];
export type ArchitectureForegroundAssetRequest = Readonly<{
  presentation: ArchitectureForegroundPresentation;
}>;

const addForecourtStructure = (
  root: THREE.Group,
  groundMaterial: THREE.Material,
  trimMaterial: THREE.Material,
  geometry: ArchitectureForegroundGeometry,
): void => {
  const group = new THREE.Group();
  group.name = "architecture-foreground-forecourt-structure";

  const curbHeight = toWorld(150);
  const curbDepth = toWorld(220);
  // The return stones fill the ends of the original near curb. Butt the
  // center span against them so their coplanar tops never overlap.
  const nearCurb = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(4780), curbHeight, curbDepth), trimMaterial,
  );
  nearCurb.name = "architecture-foreground-forecourt-near-curb";
  nearCurb.position.set(0, toWorld(geometry.ground.y + 75), toWorld(3300));
  group.add(nearCurb);

  const buildingCurb = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(4056), curbHeight, curbDepth), trimMaterial,
  );
  buildingCurb.name = "architecture-foreground-forecourt-building-curb";
  buildingCurb.position.set(0, toWorld(geometry.ground.y + 75), toWorld(8600));
  group.add(buildingCurb);

  const returnGeometry = new THREE.BoxGeometry(toWorld(220), toWorld(150), toWorld(820));
  [-1, 1].forEach((sign) => {
    const returnPiece = new THREE.Mesh(returnGeometry, groundMaterial);
    returnPiece.name = `architecture-foreground-forecourt-return-${sign < 0 ? "left" : "right"}`;
    returnPiece.position.set(
      toWorld(sign * 2500),
      toWorld(geometry.ground.y + 75),
      toWorld(3300),
    );
    group.add(returnPiece);
  });

  root.add(group);
};

export const createArchitectureForegroundGroup = (
  { presentation: { geometry } }: ArchitectureForegroundAssetRequest,
): THREE.Group => {
  const root = new THREE.Group();
  root.name = "architecture-foreground-subject";
  const materials = createBuildingMaterials();
  addElevations(root, geometry, materials);
  addRoofline(root, geometry, materials);

  const { paving, curb, returns } = createPavingMaterials(geometry.ground);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
    paving,
  );
  ground.name = "architecture-foreground-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, toWorld(geometry.ground.y), toWorld(geometry.ground.centerZ));
  root.add(ground);
  addForecourtStructure(root, returns, curb, geometry);
  root.add(createArchitectureForegroundCourtyard(geometry.ground, paving));
  return root;
};

export const disposeArchitectureForegroundGroup = (group: THREE.Group): void => {
  disposeTeachingSubjectResources(group);
};
