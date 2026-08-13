/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  mirrorShiftGeometry,
  reflectPointAcrossMirrorPlane,
  resolveMirrorShiftCameraAnchors,
  type MirrorShiftProp,
} from "../scenes/mirrorShiftGeometry";
import type { Vec3 } from "../types/optics";
import { toWorld } from "./rttUtils";

const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.05,
    ...options,
  });

const addBox = (
  parent: THREE.Object3D,
  name: string,
  position: { x: number; y: number; z: number },
  dimensions: { x: number; y: number; z: number },
  meshMaterial: THREE.Material,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(dimensions.x),
      toWorld(dimensions.y),
      toWorld(dimensions.z),
    ),
    meshMaterial,
  );
  mesh.name = name;
  mesh.position.set(toWorld(position.x), toWorld(position.y), toWorld(position.z));
  parent.add(mesh);
  return mesh;
};

const addCylinder = (
  parent: THREE.Object3D,
  name: string,
  position: { x: number; y: number; z: number },
  dimensions: { x: number; y: number },
  meshMaterial: THREE.Material,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      toWorld(dimensions.x),
      toWorld(dimensions.x),
      toWorld(dimensions.y),
      32,
    ),
    meshMaterial,
  );
  mesh.name = name;
  mesh.position.set(toWorld(position.x), toWorld(position.y), toWorld(position.z));
  parent.add(mesh);
  return mesh;
};

const addBeam = (
  parent: THREE.Object3D,
  name: string,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  widthMm: number,
  meshMaterial: THREE.Material,
): THREE.Mesh => {
  const startWorld = new THREE.Vector3(toWorld(start.x), toWorld(start.y), toWorld(start.z));
  const endWorld = new THREE.Vector3(toWorld(end.x), toWorld(end.y), toWorld(end.z));
  const direction = endWorld.clone().sub(startWorld);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(widthMm), toWorld(widthMm), length),
    meshMaterial,
  );
  mesh.name = name;
  mesh.userData.baseLengthWorld = length;
  mesh.position.copy(startWorld).add(endWorld).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.normalize(),
  );
  parent.add(mesh);
  return mesh;
};

const setObjectPositionMm = (object: THREE.Object3D, position: Vec3): void => {
  object.position.set(toWorld(position.x), toWorld(position.y), toWorld(position.z));
};

const updateBeamTransform = (
  mesh: THREE.Mesh,
  start: Vec3,
  end: Vec3,
): void => {
  const startWorld = new THREE.Vector3(toWorld(start.x), toWorld(start.y), toWorld(start.z));
  const endWorld = new THREE.Vector3(toWorld(end.x), toWorld(end.y), toWorld(end.z));
  const direction = endWorld.clone().sub(startWorld);
  const length = direction.length();
  if (length <= 1e-9) return;
  const baseLength =
    typeof mesh.userData.baseLengthWorld === "number"
      ? mesh.userData.baseLengthWorld
      : length;
  mesh.position.copy(startWorld).add(endWorld).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.normalize(),
  );
  mesh.scale.set(1, 1, baseLength > 1e-9 ? length / baseLength : 1);
};

const updateCameraReflectionProxy = (
  cameraGroup: THREE.Group,
  anchors: ReturnType<typeof resolveMirrorShiftCameraAnchors>["reflected"],
): void => {
  const { camera } = mirrorShiftGeometry;
  const frontStandard = cameraGroup.getObjectByName(
    "mirror-shift-camera-reflection-front-standard",
  );
  const rearStandard = cameraGroup.getObjectByName(
    "mirror-shift-camera-reflection-rear-standard",
  );
  const bellows = cameraGroup.getObjectByName("mirror-shift-camera-reflection-bellows");
  const lens = cameraGroup.getObjectByName("mirror-shift-camera-reflection-lens");
  const tripodHead = cameraGroup.getObjectByName(
    "mirror-shift-camera-reflection-tripod-head",
  );
  const leftLeg = cameraGroup.getObjectByName(
    "mirror-shift-camera-reflection-left-leg",
  );
  const rightLeg = cameraGroup.getObjectByName(
    "mirror-shift-camera-reflection-right-leg",
  );

  if (frontStandard) setObjectPositionMm(frontStandard, anchors.frontStandardCenter);
  if (rearStandard) setObjectPositionMm(rearStandard, anchors.rearStandardCenter);
  if (bellows) {
    setObjectPositionMm(bellows, {
      x: (anchors.frontStandardCenter.x + anchors.rearStandardCenter.x) / 2,
      y: (anchors.frontStandardCenter.y + anchors.rearStandardCenter.y) / 2,
      z: (anchors.frontStandardCenter.z + anchors.rearStandardCenter.z) / 2,
    });
  }
  if (lens) {
    setObjectPositionMm(lens, {
      x: anchors.frontStandardCenter.x,
      y: anchors.frontStandardCenter.y,
      z: anchors.frontStandardCenter.z - camera.lens.depthMm / 2 - 10,
    });
  }
  if (tripodHead) setObjectPositionMm(tripodHead, anchors.tripodHead);
  if (leftLeg instanceof THREE.Mesh) {
    updateBeamTransform(leftLeg, anchors.tripodHead, anchors.leftTripodFoot);
  }
  if (rightLeg instanceof THREE.Mesh) {
    updateBeamTransform(rightLeg, anchors.tripodHead, anchors.rightTripodFoot);
  }
};

const addWallAndFloor = (root: THREE.Group): void => {
  const wallMaterial = material("#cbd5e1", { roughness: 0.92 });
  const wallDepthMm = 260;
  const wallZ = mirrorShiftGeometry.mirror.plane.point.z + 140;
  const sideOffsetX =
    mirrorShiftGeometry.mirror.widthMm / 2 +
    mirrorShiftGeometry.mirror.frameMm +
    mirrorShiftGeometry.wall.sidePanelWidthMm / 2;

  addBox(
    root,
    "mirror-shift-wall-left",
    { x: -sideOffsetX, y: mirrorShiftGeometry.wall.centerY, z: wallZ },
    {
      x: mirrorShiftGeometry.wall.sidePanelWidthMm,
      y: mirrorShiftGeometry.wall.heightMm,
      z: wallDepthMm,
    },
    wallMaterial,
  );
  addBox(
    root,
    "mirror-shift-wall-right",
    { x: sideOffsetX, y: mirrorShiftGeometry.wall.centerY, z: wallZ },
    {
      x: mirrorShiftGeometry.wall.sidePanelWidthMm,
      y: mirrorShiftGeometry.wall.heightMm,
      z: wallDepthMm,
    },
    wallMaterial,
  );
  addBox(
    root,
    "mirror-shift-wall-top",
    {
      x: 0,
      y: mirrorShiftGeometry.wall.topPanelCenterY,
      z: wallZ,
    },
    {
      x: mirrorShiftGeometry.wall.widthMm,
      y: mirrorShiftGeometry.wall.topPanelHeightMm,
      z: wallDepthMm,
    },
    wallMaterial,
  );
  addBox(
    root,
    "mirror-shift-wall-bottom",
    {
      x: 0,
      y: (mirrorShiftGeometry.floor.y + mirrorShiftGeometry.mirror.innerBounds.min.y) / 2,
      z: wallZ,
    },
    {
      x: mirrorShiftGeometry.wall.widthMm,
      y: mirrorShiftGeometry.mirror.innerBounds.min.y - mirrorShiftGeometry.floor.y,
      z: wallDepthMm,
    },
    wallMaterial,
  );

  const floorMaterial = material("#e2e8f0", { roughness: 0.95, metalness: 0 });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(
      toWorld(mirrorShiftGeometry.floor.widthMm),
      toWorld(mirrorShiftGeometry.floor.depthMm),
    ),
    floorMaterial,
  );
  floor.name = "mirror-shift-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(
    0,
    toWorld(mirrorShiftGeometry.floor.y),
    toWorld(mirrorShiftGeometry.floor.centerZ),
  );
  root.add(floor);
};

const addMirrorAperture = (root: THREE.Group): void => {
  const { mirror } = mirrorShiftGeometry;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(mirror.widthMm), toWorld(mirror.heightMm)),
    new THREE.MeshBasicMaterial({
      color: "#35566f",
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  surface.name = "mirror-shift-mirror-surface";
  surface.position.set(
    toWorld(mirror.center.x),
    toWorld(mirror.center.y),
    toWorld(mirror.plane.point.z),
  );
  surface.renderOrder = 2;
  root.add(surface);

  const frameMaterial = new THREE.MeshBasicMaterial({ color: "#e2e8f0" });
  const frameDepthMm = 120;
  const frameZ = mirror.plane.point.z - 55;
  const framedWidth = mirror.widthMm + mirror.frameMm * 2;
  const horizontalBarSize = { x: framedWidth, y: mirror.frameMm, z: frameDepthMm };
  const verticalBarSize = { x: mirror.frameMm, y: mirror.heightMm, z: frameDepthMm };

  addBox(
    root,
    "mirror-shift-mirror-frame-top",
    { x: mirror.center.x, y: mirror.center.y + mirror.heightMm / 2 + mirror.frameMm / 2, z: frameZ },
    horizontalBarSize,
    frameMaterial,
  );
  addBox(
    root,
    "mirror-shift-mirror-frame-bottom",
    { x: mirror.center.x, y: mirror.center.y - mirror.heightMm / 2 - mirror.frameMm / 2, z: frameZ },
    horizontalBarSize,
    frameMaterial,
  );
  addBox(
    root,
    "mirror-shift-mirror-frame-left",
    { x: mirror.center.x - mirror.widthMm / 2 - mirror.frameMm / 2, y: mirror.center.y, z: frameZ },
    verticalBarSize,
    frameMaterial,
  );
  addBox(
    root,
    "mirror-shift-mirror-frame-right",
    { x: mirror.center.x + mirror.widthMm / 2 + mirror.frameMm / 2, y: mirror.center.y, z: frameZ },
    verticalBarSize,
    frameMaterial,
  );
};

const addProp = (
  parent: THREE.Object3D,
  prop: MirrorShiftProp,
  namePrefix: "real" | "reflected",
  sourceProp: MirrorShiftProp = prop,
): void => {
  const propMaterial = material(prop.color, { roughness: namePrefix === "reflected" ? 0.62 : 0.78 });
  const name = `mirror-shift-${namePrefix}-${prop.id}`;
  if (prop.shape === "cylinder") {
    addCylinder(parent, name, prop.position, prop.dimensions, propMaterial);
    return;
  }

  addBox(parent, name, prop.position, prop.dimensions, propMaterial);
  const detailMaterial = material(namePrefix === "reflected" ? "#dbeafe" : "#eff6ff", {
    roughness: 0.6,
  });
  const detailDepth = sourceProp.dimensions.z / 2 + 4;
  for (const [index, offsetY] of [-320, 40].entries()) {
    const realDetailPosition = {
      x: sourceProp.position.x,
      y: sourceProp.position.y + offsetY,
      z: sourceProp.position.z - detailDepth,
    };
    const detailPosition =
      namePrefix === "reflected"
        ? reflectPointAcrossMirrorPlane(realDetailPosition)
        : realDetailPosition;
    addBox(
      parent,
      `${name}-detail-${index + 1}`,
      detailPosition,
      { x: prop.dimensions.x * 0.7, y: 42, z: 12 },
      detailMaterial,
    );
  }
};

const addCameraReflection = (
  root: THREE.Group,
  anchors: ReturnType<typeof resolveMirrorShiftCameraAnchors>["reflected"] =
    mirrorShiftGeometry.camera.reflectedAnchors,
): void => {
  const { camera } = mirrorShiftGeometry;
  const cameraGroup = new THREE.Group();
  cameraGroup.name = "mirror-shift-camera-reflection";
  cameraGroup.userData = { reflectionOf: "neutral-view-camera" };

  const bodyMaterial = material("#111827", { roughness: 0.62, metalness: 0.08 });
  const bellowsMaterial = material("#0f172a", {
    roughness: 0.88,
    transparent: true,
    opacity: 0.88,
  });
  const lensMaterial = material("#0ea5e9", {
    roughness: 0.2,
    metalness: 0.52,
  });
  const tripodMaterial = material("#475569", { roughness: 0.72, metalness: 0.18 });

  addBox(
    cameraGroup,
    "mirror-shift-camera-reflection-front-standard",
    anchors.frontStandardCenter,
    {
      x: camera.frontStandard.widthMm,
      y: camera.frontStandard.heightMm,
      z: camera.frontStandard.depthMm,
    },
    bodyMaterial,
  );
  addBox(
    cameraGroup,
    "mirror-shift-camera-reflection-rear-standard",
    anchors.rearStandardCenter,
    {
      x: camera.rearStandard.widthMm,
      y: camera.rearStandard.heightMm,
      z: camera.rearStandard.depthMm,
    },
    bodyMaterial,
  );

  const bellowsMidpoint = {
    x: (anchors.frontStandardCenter.x + anchors.rearStandardCenter.x) / 2,
    y: (anchors.frontStandardCenter.y + anchors.rearStandardCenter.y) / 2,
    z: (anchors.frontStandardCenter.z + anchors.rearStandardCenter.z) / 2,
  };
  addBox(
    cameraGroup,
    "mirror-shift-camera-reflection-bellows",
    bellowsMidpoint,
    {
      x: camera.bellows.widthMm,
      y: camera.bellows.heightMm,
      z: Math.abs(anchors.rearStandardCenter.z - anchors.frontStandardCenter.z),
    },
    bellowsMaterial,
  );

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(
      toWorld(camera.lens.radiusMm),
      toWorld(camera.lens.radiusMm),
      toWorld(camera.lens.depthMm),
      24,
    ),
    lensMaterial,
  );
  lens.name = "mirror-shift-camera-reflection-lens";
  lens.rotation.x = Math.PI / 2;
  lens.position.set(
    toWorld(anchors.frontStandardCenter.x),
    toWorld(anchors.frontStandardCenter.y),
    toWorld(anchors.frontStandardCenter.z - camera.lens.depthMm / 2 - 10),
  );
  cameraGroup.add(lens);

  addBox(
    cameraGroup,
    "mirror-shift-camera-reflection-tripod-head",
    anchors.tripodHead,
    { x: 110, y: 70, z: 100 },
    tripodMaterial,
  );
  addBeam(
    cameraGroup,
    "mirror-shift-camera-reflection-left-leg",
    anchors.tripodHead,
    anchors.leftTripodFoot,
    camera.tripod.legWidthMm,
    tripodMaterial,
  );
  addBeam(
    cameraGroup,
    "mirror-shift-camera-reflection-right-leg",
    anchors.tripodHead,
    anchors.rightTripodFoot,
    camera.tripod.legWidthMm,
    tripodMaterial,
  );
  updateCameraReflectionProxy(cameraGroup, anchors);
  root.add(cameraGroup);
};

export type MirrorShiftGroupOptions = {
  includeVirtualReflection?: boolean;
};

/** Build the static mirror scene for either the viewport or Ground Glass RTT. */
export const createMirrorShiftGroup = ({
  includeVirtualReflection = true,
}: MirrorShiftGroupOptions = {}): THREE.Group => {
  const root = new THREE.Group();
  root.name = "mirror-shift-subject";

  addWallAndFloor(root);
  addMirrorAperture(root);

  const realGroup = new THREE.Group();
  realGroup.name = "mirror-shift-real-props";
  mirrorShiftGeometry.props.forEach((prop) => addProp(realGroup, prop, "real"));
  root.add(realGroup);

  if (includeVirtualReflection) {
    const reflectedGroup = new THREE.Group();
    reflectedGroup.name = "mirror-shift-reflected-props";
    reflectedGroup.userData = { representation: "planar-mirror-reflection" };
    mirrorShiftGeometry.props.forEach((sourceProp, index) =>
      addProp(
        reflectedGroup,
        mirrorShiftGeometry.reflectedProps[index],
        "reflected",
        sourceProp,
      ),
    );
    addCameraReflection(reflectedGroup);
    root.add(reflectedGroup);
  }

  return root;
};

export const createMirrorShiftViewportGroup = (): THREE.Group =>
  createMirrorShiftGroup({ includeVirtualReflection: false });

export const createMirrorShiftRttGroup = (): THREE.Group =>
  createMirrorShiftGroup({ includeVirtualReflection: true });

/** Mutate only the reflected camera proxy; static reflection geometry stays mounted. */
export const updateMirrorShiftCameraReflection = (
  subjectGroup: THREE.Group,
  rigOriginWorld: Vec3,
): boolean => {
  const cameraGroup = subjectGroup.getObjectByName("mirror-shift-camera-reflection");
  if (!(cameraGroup instanceof THREE.Group)) return false;
  const anchors = resolveMirrorShiftCameraAnchors(rigOriginWorld).reflected;
  updateCameraReflectionProxy(cameraGroup, anchors);
  cameraGroup.userData.reflectedRigOriginWorld = { ...rigOriginWorld };
  return true;
};

export const disposeMirrorShiftGroup = (group: THREE.Group): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((meshMaterial) => materials.add(meshMaterial));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((meshMaterial) => meshMaterial.dispose());
};

/** React Three Fiber boundary for the physical viewport representation. */
export const MirrorShiftSubject: React.FC = () => {
  const group = useMemo(() => createMirrorShiftViewportGroup(), []);

  useEffect(
    () => () => {
      disposeMirrorShiftGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
