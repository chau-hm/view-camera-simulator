/* eslint-disable react-refresh/only-export-components */
import * as THREE from "three";
import React, { useMemo } from "react";
import { toWorld } from "./rttUtils";
import {
  focusFundamentalsFloorYmm,
  focusFundamentalsFocusDetails,
  focusFundamentalsMarkerSizeMm,
  focusFundamentalsObjectCenterMm,
  focusFundamentalsObjectDimensionsMm,
  focusFundamentalsObjectRotationYRad,
  getFocusFundamentalsDetailMarkerLocalPosition,
  getFocusFundamentalsDetailMarkerRotationY,
} from "../scenes/focusFundamentalsTargets";

const FLOOR_COLOR = new THREE.Color("#9aa6b5");
const OBJECT_COLOR = new THREE.Color("#64748b");
const MARKER_COLORS = ["#ef4444", "#f59e0b"] as const;
const FLOOR_WIDTH_MM = 5000;
const FLOOR_DEPTH_MM = 5000;

let objectGeometry: THREE.BoxGeometry | null = null;
let objectMaterial: THREE.MeshStandardMaterial | null = null;
let markerGeometry: THREE.BoxGeometry | null = null;
let markerTextures: [THREE.DataTexture, THREE.DataTexture] | null = null;
let markerMaterials: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial] | null = null;
let floorGeometry: THREE.PlaneGeometry | null = null;
let floorMaterial: THREE.MeshStandardMaterial | null = null;

const makeFocusDetailTexture = (accent: string): THREE.DataTexture => {
  const width = 64;
  const height = 64;
  const data = new Uint8Array(width * height * 4);
  const accentHex = accent.replace("#", "");
  const accentRgb = [
    Number.parseInt(accentHex.slice(0, 2), 16),
    Number.parseInt(accentHex.slice(2, 4), 16),
    Number.parseInt(accentHex.slice(4, 6), 16),
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const crosshair = Math.abs(x - width / 2) <= 1 || Math.abs(y - height / 2) <= 1;
      const accentBar = x < 5 && y < 22;
      const color = accentBar
        ? accentRgb
        : crosshair
          ? [255, 255, 255]
          : checker
            ? [18, 24, 38]
            : [244, 247, 250];
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

function ensureSharedResources() {
  if (!objectGeometry) {
    objectGeometry = new THREE.BoxGeometry(
      toWorld(focusFundamentalsObjectDimensionsMm.width),
      toWorld(focusFundamentalsObjectDimensionsMm.height),
      toWorld(focusFundamentalsObjectDimensionsMm.depth),
    );
  }
  if (!objectMaterial) {
    objectMaterial = new THREE.MeshStandardMaterial({
      color: OBJECT_COLOR,
      roughness: 0.78,
      metalness: 0.02,
    });
  }
  if (!markerGeometry) {
    markerGeometry = new THREE.BoxGeometry(
      toWorld(focusFundamentalsMarkerSizeMm.width),
      toWorld(focusFundamentalsMarkerSizeMm.height),
      toWorld(4),
    );
  }
  if (!markerTextures) {
    markerTextures = [
      makeFocusDetailTexture(MARKER_COLORS[0]),
      makeFocusDetailTexture(MARKER_COLORS[1]),
    ];
  }
  if (!markerMaterials) {
    markerMaterials = markerTextures.map(
      (texture) =>
        new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
        }),
    ) as [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial];
  }
  if (!floorGeometry) {
    floorGeometry = new THREE.PlaneGeometry(
      toWorld(FLOOR_WIDTH_MM),
      toWorld(FLOOR_DEPTH_MM),
    );
  }
  if (!floorMaterial) {
    floorMaterial = new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      roughness: 0.9,
      metalness: 0,
    });
  }
}

function addFocusDetailMarker(
  objectGroup: THREE.Group,
  detail: (typeof focusFundamentalsFocusDetails)[number],
  index: number,
) {
  const marker = new THREE.Mesh(markerGeometry!, markerMaterials![index]);
  marker.name = `${detail.id}-marker`;
  const markerPosition = getFocusFundamentalsDetailMarkerLocalPosition(detail);
  marker.position.set(
    toWorld(markerPosition.x),
    toWorld(markerPosition.y),
    toWorld(markerPosition.z),
  );
  marker.rotation.y = getFocusFundamentalsDetailMarkerRotationY(detail);
  marker.userData = {
    focusTargetId: detail.id,
    focusDetailWorldMm: detail.worldPositionMm,
    surface: detail.surface,
  };
  objectGroup.add(marker);
}

export function createFocusFundamentalsGroup(): THREE.Group {
  ensureSharedResources();

  const group = new THREE.Group();
  group.name = "focus-fundamentals-subject";

  const objectGroup = new THREE.Group();
  objectGroup.name = "focus-fundamentals-object";
  objectGroup.position.set(
    toWorld(focusFundamentalsObjectCenterMm.x),
    toWorld(focusFundamentalsObjectCenterMm.y),
    toWorld(focusFundamentalsObjectCenterMm.z),
  );
  objectGroup.rotation.y = focusFundamentalsObjectRotationYRad;

  const body = new THREE.Mesh(objectGeometry!, objectMaterial!);
  body.name = "focus-fundamentals-object-body";
  objectGroup.add(body);
  focusFundamentalsFocusDetails.forEach((detail, index) =>
    addFocusDetailMarker(objectGroup, detail, index),
  );
  group.add(objectGroup);

  const floor = new THREE.Mesh(floorGeometry!, floorMaterial!);
  floor.name = "focus-fundamentals-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = toWorld(focusFundamentalsFloorYmm);
  group.add(floor);

  return group;
}

/**
 * The interactive R3F scene mounts the same factory output as RTT.  Shared
 * resources are module-owned, so disable R3F auto-disposal for this primitive.
 */
export const FocusFundamentalsSubject: React.FC = () => {
  const group = useMemo(() => createFocusFundamentalsGroup(), []);
  return <primitive object={group} dispose={null} />;
};
