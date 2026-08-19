/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry from "../scenes/obliqueArchitectureGeometry";
import { toWorld } from "./rttUtils";

const createStandardMaterial = (color: string, roughness = 0.88) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const createBasicMaterial = (color: string) =>
  new THREE.MeshBasicMaterial({ color });

const addFacadeWindow = ({
  root,
  id,
  position,
  size,
  rotation,
  windowMaterial,
  frameMaterial,
}: {
  root: THREE.Group;
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  windowMaterial: THREE.MeshStandardMaterial;
  frameMaterial: THREE.MeshStandardMaterial;
}) => {
  const windowGroup = new THREE.Group();
  windowGroup.name = id;
  windowGroup.position.set(...position.map(toWorld) as [number, number, number]);
  if (rotation) windowGroup.rotation.set(...rotation);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(size[0]), toWorld(size[1]), toWorld(size[2])),
    windowMaterial,
  );
  panel.name = `${id}-glass`;
  windowGroup.add(panel);

  const frameThicknessMm = 34;
  const frameDepthMm = 16;
  const [widthMm, heightMm, depthMm] = size;
  const framePieces = [
    {
      name: "top-frame",
      dimensions: [widthMm + frameThicknessMm, frameThicknessMm, depthMm + frameDepthMm],
      offset: [0, heightMm / 2 + frameThicknessMm / 2, 0],
    },
    {
      name: "bottom-frame",
      dimensions: [widthMm + frameThicknessMm, frameThicknessMm, depthMm + frameDepthMm],
      offset: [0, -heightMm / 2 - frameThicknessMm / 2, 0],
    },
    {
      name: "left-frame",
      dimensions: [frameThicknessMm, heightMm, depthMm + frameDepthMm],
      offset: [-widthMm / 2 - frameThicknessMm / 2, 0, 0],
    },
    {
      name: "right-frame",
      dimensions: [frameThicknessMm, heightMm, depthMm + frameDepthMm],
      offset: [widthMm / 2 + frameThicknessMm / 2, 0, 0],
    },
  ] as const;

  framePieces.forEach(({ name, dimensions, offset }) => {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(dimensions[0]),
        toWorld(dimensions[1]),
        toWorld(dimensions[2]),
      ),
      frameMaterial,
    );
    frame.name = `${id}-${name}`;
    frame.position.set(...offset.map(toWorld) as [number, number, number]);
    windowGroup.add(frame);
  });

  root.add(windowGroup);
};

const addFocusProbe = (root: THREE.Group, target: (typeof geometry.focusTargets)[number]) => {
  const probe = new THREE.Object3D();
  probe.name = `oblique-architecture-focus-${target.id}`;
  probe.position.set(
    toWorld(target.worldPosition.x),
    toWorld(target.worldPosition.y),
    toWorld(target.worldPosition.z),
  );
  probe.userData = {
    focusTargetId: target.id,
    focusProbeWorldMm: { ...target.worldPosition },
  };
  root.add(probe);
};

export const createObliqueArchitectureGroup = (): THREE.Group => {
  const root = new THREE.Group();
  root.name = "oblique-architecture-subject";

  const buildingMaterial = createStandardMaterial("#8fa3b6", 0.9);
  const frontFacadeMaterial = createStandardMaterial("#a9bbca", 0.9);
  const sideFacadeMaterial = createStandardMaterial("#71879a", 0.92);
  const parapetMaterial = createStandardMaterial("#d4dee7", 0.82);
  const cornerMaterial = createStandardMaterial("#e2e8f0", 0.8);
  const frameMaterial = createStandardMaterial("#dbeafe", 0.82);
  const windowMaterial = createStandardMaterial("#17324b", 0.54);
  const groundMaterial = createStandardMaterial("#e6eef7", 1);
  const roofMaterial = createBasicMaterial("#64748b");

  const building = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width),
      toWorld(geometry.building.height),
      toWorld(geometry.building.farZ - geometry.building.nearZ),
    ),
    buildingMaterial,
  );
  building.name = "oblique-architecture-building";
  building.position.set(
    toWorld(geometry.buildingCenter.x),
    toWorld(geometry.buildingCenter.y),
    toWorld(geometry.buildingCenter.z),
  );
  root.add(building);

  const frontFacade = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width - 140),
      toWorld(geometry.building.height - 180),
      toWorld(14),
    ),
    frontFacadeMaterial,
  );
  frontFacade.name = "oblique-architecture-front-facade";
  frontFacade.position.set(
    toWorld(geometry.buildingCenter.x),
    toWorld(geometry.buildingCenter.y),
    toWorld(geometry.building.nearZ - 7),
  );
  root.add(frontFacade);

  const targetFacade = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(14),
      toWorld(geometry.building.height - 180),
      toWorld(geometry.building.farZ - geometry.building.nearZ - 140),
    ),
    sideFacadeMaterial,
  );
  targetFacade.name = "oblique-architecture-target-facade";
  targetFacade.position.set(
    toWorld(geometry.facade.targetPlaneX - 7),
    toWorld(geometry.buildingCenter.y),
    toWorld(geometry.buildingCenter.z),
  );
  root.add(targetFacade);

  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width + 100),
      toWorld(geometry.building.parapetHeight),
      toWorld(geometry.building.farZ - geometry.building.nearZ + 100),
    ),
    parapetMaterial,
  );
  parapet.name = "oblique-architecture-parapet";
  parapet.position.set(
    toWorld(geometry.buildingCenter.x),
    toWorld(geometry.ground.y + geometry.building.height + geometry.building.parapetHeight / 2),
    toWorld(geometry.buildingCenter.z),
  );
  root.add(parapet);

  const corner = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(110), toWorld(geometry.building.height + 120), toWorld(110)),
    cornerMaterial,
  );
  corner.name = "oblique-architecture-corner";
  corner.position.set(
    toWorld(geometry.building.leftX - 10),
    toWorld(geometry.ground.y + geometry.building.height / 2),
    toWorld(geometry.building.nearZ - 10),
  );
  root.add(corner);

  geometry.frontWindowColumnCenters.forEach((x, column) => {
    geometry.windowRowCenters.forEach((y, row) => {
      addFacadeWindow({
        root,
        id: `oblique-architecture-front-window-${row + 1}-${column + 1}`,
        position: [x, y, geometry.building.nearZ - 22],
        size: [geometry.building.frontWindowWidth, geometry.building.windowHeight, 24],
        windowMaterial,
        frameMaterial,
      });
    });
  });

  geometry.sideWindowColumnCenters.forEach((z, column) => {
    geometry.windowRowCenters.forEach((y, row) => {
      addFacadeWindow({
        root,
        id: `oblique-architecture-side-window-${row + 1}-${column + 1}`,
        position: [geometry.building.leftX - 22, y, z],
        size: [24, geometry.building.windowHeight, geometry.building.sideWindowWidth],
        rotation: [0, 0, 0],
        windowMaterial,
        frameMaterial,
      });
    });
  });

  const roofLine = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width + 180),
      toWorld(24),
      toWorld(geometry.building.farZ - geometry.building.nearZ + 180),
    ),
    roofMaterial,
  );
  roofLine.name = "oblique-architecture-roof-line";
  roofLine.position.set(
    toWorld(geometry.buildingCenter.x),
    toWorld(geometry.buildingTopY + 12),
    toWorld(geometry.buildingCenter.z),
  );
  root.add(roofLine);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.farZ - geometry.ground.nearZ)),
    groundMaterial,
  );
  ground.name = "oblique-architecture-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(
    toWorld(geometry.ground.centerX),
    toWorld(geometry.ground.y),
    toWorld(geometry.ground.centerZ),
  );
  root.add(ground);

  geometry.focusTargets.forEach((target) => addFocusProbe(root, target));
  return root;
};

export const disposeObliqueArchitectureGroup = (group: THREE.Group): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometryResource) => geometryResource.dispose());
  materials.forEach((material) => material.dispose());
};

/** React Three Fiber boundary backed by the same group factory used by RTT. */
export const ObliqueArchitectureSubject: React.FC = () => {
  const group = useMemo(() => createObliqueArchitectureGroup(), []);

  useEffect(
    () => () => {
      disposeObliqueArchitectureGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
