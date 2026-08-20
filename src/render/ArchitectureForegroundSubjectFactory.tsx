/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry from "../scenes/architectureForegroundGeometry";
import { toWorld } from "./rttUtils";

const createStandardMaterial = (color: string, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const addWindow = ({
  root,
  window,
  panelGeometry,
  frameGeometry,
  windowMaterial,
  frameMaterial,
}: {
  root: THREE.Group;
  window: ReturnType<typeof geometry.getWindows>[number];
  panelGeometry: THREE.BoxGeometry;
  frameGeometry: THREE.BoxGeometry;
  windowMaterial: THREE.Material;
  frameMaterial: THREE.Material;
}) => {
  const group = new THREE.Group();
  group.name = `architecture-foreground-${window.id}`;

  const panel = new THREE.Mesh(panelGeometry, windowMaterial);
  panel.name = `${window.id}-glass`;
  panel.position.set(toWorld(window.x), toWorld(window.y), toWorld(window.z));
  group.add(panel);

  const frame = geometry.building.windowFrameMm;
  const framePieces: Array<{ name: string; x: number; y: number; width: number; height: number }> = [
    { name: "top", x: 0, y: window.height / 2 + frame / 2, width: window.width + frame, height: frame },
    { name: "bottom", x: 0, y: -window.height / 2 - frame / 2, width: window.width + frame, height: frame },
    { name: "left", x: -window.width / 2 - frame / 2, y: 0, width: frame, height: window.height },
    { name: "right", x: window.width / 2 + frame / 2, y: 0, width: frame, height: window.height },
  ];

  framePieces.forEach(({ name, x, y, width, height }) => {
    const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
    frameMesh.name = `${window.id}-${name}-frame`;
    frameMesh.scale.set(toWorld(width) / frameGeometry.parameters.width, toWorld(height) / frameGeometry.parameters.height, 1);
    frameMesh.position.set(toWorld(window.x + x), toWorld(window.y + y), toWorld(window.z - 5));
    group.add(frameMesh);
  });

  root.add(group);
};

const addPaving = (root: THREE.Group) => {
  const seamMaterial = createStandardMaterial("#64748b", 0.98);
  const seamHeight = 10;
  const seamPositions = geometry.getPavingSeamPositions();
  const longitudinalGeometry = new THREE.BoxGeometry(
    toWorld(groundWidth()),
    toWorld(seamHeight),
    toWorld(geometry.ground.seamWidthMm),
  );
  const depthGeometry = new THREE.BoxGeometry(
    toWorld(geometry.ground.seamWidthMm),
    toWorld(seamHeight),
    toWorld(geometry.ground.depth),
  );

  seamPositions.depthZ.forEach((z) => {
    const seam = new THREE.Mesh(longitudinalGeometry, seamMaterial);
    seam.name = `architecture-foreground-paving-cross-seam-${z}`;
    seam.position.set(0, toWorld(geometry.ground.y + seamHeight / 2), toWorld(z));
    root.add(seam);
  });

  seamPositions.longitudinalX.forEach((x) => {
    const seam = new THREE.Mesh(depthGeometry, seamMaterial);
    seam.name = `architecture-foreground-paving-longitudinal-seam-${x}`;
    seam.position.set(toWorld(x), toWorld(geometry.ground.y + seamHeight / 2), toWorld(geometry.ground.centerZ));
    root.add(seam);
  });
};

const groundWidth = () => geometry.ground.width;

export const createArchitectureForegroundGroup = (): THREE.Group => {
  const root = new THREE.Group();
  root.name = "architecture-foreground-subject";

  const buildingMaterial = createStandardMaterial("#92a7b8", 0.92);
  const facadeMaterial = createStandardMaterial("#b3c1cc", 0.88);
  const roofMaterial = createStandardMaterial("#dbe5ec", 0.8);
  const windowMaterial = createStandardMaterial("#20384b", 0.62);
  const frameMaterial = createStandardMaterial("#e5edf2", 0.82);
  const groundMaterial = createStandardMaterial("#d8e1e7", 1);

  const building = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width),
      toWorld(geometry.building.height),
      toWorld(geometry.building.depth),
    ),
    buildingMaterial,
  );
  building.name = "architecture-foreground-building";
  building.position.set(
    toWorld(geometry.building.center.x),
    toWorld(geometry.building.center.y),
    toWorld(geometry.building.center.z),
  );
  root.add(building);

  const frontFacade = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width - 120),
      toWorld(geometry.building.height - 120),
      toWorld(18),
    ),
    facadeMaterial,
  );
  frontFacade.name = "architecture-foreground-front-facade";
  frontFacade.position.set(
    toWorld(geometry.building.center.x),
    toWorld(geometry.building.center.y),
    toWorld(geometry.facade.frontFacadeZ - 8),
  );
  root.add(frontFacade);

  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.building.width + 120),
      toWorld(geometry.building.topHeight),
      toWorld(geometry.building.depth + 120),
    ),
    roofMaterial,
  );
  parapet.name = "architecture-foreground-roof-parapet";
  parapet.position.set(
    toWorld(geometry.building.center.x),
    toWorld(facadeTopY()),
    toWorld(geometry.building.center.z),
  );
  root.add(parapet);

  const roofLine = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(geometry.building.width + 200), toWorld(24), toWorld(geometry.building.depth + 200)),
    createStandardMaterial("#6b7f8d", 0.84),
  );
  roofLine.name = "architecture-foreground-roof-line";
  roofLine.position.set(
    toWorld(geometry.building.center.x),
    toWorld(geometry.facade.parapetTopY + 12),
    toWorld(geometry.building.center.z),
  );
  root.add(roofLine);

  const mullionGeometry = new THREE.BoxGeometry(
    toWorld(geometry.building.windowFrameMm),
    toWorld(geometry.building.height - 160),
    toWorld(22),
  );
  const mullionMaterial = createStandardMaterial("#516a7b", 0.86);
  const verticalMullionXs = Array.from(
    { length: geometry.building.windowColumns + 1 },
    (_, index) =>
      -geometry.building.width / 2 +
      (index * geometry.building.width) / geometry.building.windowColumns,
  );
  verticalMullionXs.forEach((x, index) => {
    const mullion = new THREE.Mesh(mullionGeometry, mullionMaterial);
    mullion.name = `architecture-foreground-vertical-mullion-${index + 1}`;
    mullion.position.set(
      toWorld(x),
      toWorld(geometry.building.center.y),
      toWorld(geometry.facade.frontFacadeZ - 26),
    );
    root.add(mullion);
  });

  const bandGeometry = new THREE.BoxGeometry(
    toWorld(geometry.building.width + 40),
    toWorld(18),
    toWorld(24),
  );
  const bandMaterial = createStandardMaterial("#d7e3ea", 0.9);
  geometry.windowRowCenters.forEach((y, index) => {
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.name = `architecture-foreground-horizontal-band-${index + 1}`;
    band.position.set(
      toWorld(geometry.building.center.x),
      toWorld(y - geometry.building.windowHeight / 2 - geometry.building.windowFrameMm / 2),
      toWorld(geometry.facade.frontFacadeZ - 27),
    );
    root.add(band);
  });

  const windowGeometry = new THREE.BoxGeometry(
    toWorld(geometry.building.windowWidth),
    toWorld(geometry.building.windowHeight),
    toWorld(20),
  );
  const frameGeometry = new THREE.BoxGeometry(toWorld(1), toWorld(1), toWorld(26));
  geometry.getWindows().forEach((window) => {
    addWindow({
      root,
      window,
      panelGeometry: windowGeometry,
      frameGeometry,
      windowMaterial,
      frameMaterial,
    });
  });

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(geometry.ground.width), toWorld(geometry.ground.depth)),
    groundMaterial,
  );
  ground.name = "architecture-foreground-ground";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, toWorld(geometry.ground.y), toWorld(geometry.ground.centerZ));
  root.add(ground);
  addPaving(root);

  return root;
};

const facadeTopY = () =>
  geometry.facade.mainBodyTopY + geometry.building.topHeight / 2;

export const disposeArchitectureForegroundGroup = (group: THREE.Group): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((resource) => resource.dispose());
  materials.forEach((resource) => resource.dispose());
};

/** React Three Fiber boundary backed by the same group factory used by RTT. */
export const ArchitectureForegroundSubject: React.FC = () => {
  const group = useMemo(() => createArchitectureForegroundGroup(), []);

  useEffect(
    () => () => {
      disposeArchitectureForegroundGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
