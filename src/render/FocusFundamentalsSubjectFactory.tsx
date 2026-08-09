/* eslint-disable react-refresh/only-export-components */
import * as THREE from "three";
import React, { useMemo } from "react";
import { toWorld } from "./rttUtils";
import {
  focusFundamentalsFloorYmm,
  focusFundamentalsFocusDetails,
  focusFundamentalsFrameGeometry,
  focusFundamentalsMarkerSizeMm,
  focusFundamentalsObjectCenterMm,
  focusFundamentalsObjectRotationYRad,
  getFocusFundamentalsDetailMarkerLocalPosition,
  getFocusFundamentalsDetailMarkerRotationY,
} from "../scenes/focusFundamentalsTargets";
import {
  focusFundamentalsParallaxBracketBarWidthMm,
  focusFundamentalsParallaxFeatureShapes,
  focusFundamentalsParallaxFeatureRotationYRad,
  focusFundamentalsParallaxFeatures,
  focusFundamentalsParallaxPointerColor,
  focusFundamentalsParallaxPointerOuterColor,
  focusFundamentalsParallaxPointerOuterBorderWidthMm,
  focusFundamentalsParallaxPointerOuterDepthMm,
  focusFundamentalsParallaxPointerOuterFrontOffsetMm,
  focusFundamentalsParallaxPointerOuterHeightMm,
  focusFundamentalsParallaxPointerOuterLeftExtensionMm,
  focusFundamentalsParallaxPointerOuterWidthMm,
  focusFundamentalsParallaxPointerHeightMm,
  focusFundamentalsParallaxSupportWidthMm,
} from "../scenes/focusFundamentalsParallax";

const FLOOR_COLOR = new THREE.Color("#9aa6b5");
const OBJECT_COLOR = new THREE.Color("#64748b");
const MARKER_COLORS = ["#ef4444", "#f59e0b"] as const;
const FLOOR_WIDTH_MM = 5000;
const FLOOR_DEPTH_MM = 5000;

type FrameGeometrySet = {
  frontVertical: THREE.BoxGeometry;
  frontHorizontal: THREE.BoxGeometry;
  backVertical: THREE.BoxGeometry;
  backHorizontal: THREE.BoxGeometry;
  connector: THREE.BoxGeometry;
};

type ParallaxGeometrySet = {
  bracketVertical: THREE.BoxGeometry;
  bracketHorizontal: THREE.BoxGeometry;
  pointerOuterLeftVertical: THREE.BoxGeometry;
  pointerOuterVertical: THREE.BoxGeometry;
  pointerOuterHorizontal: THREE.BoxGeometry;
  pointer: THREE.BoxGeometry;
};

let frameGeometries: FrameGeometrySet | null = null;
let parallaxGeometries: ParallaxGeometrySet | null = null;
let objectMaterial: THREE.MeshStandardMaterial | null = null;
let parallaxBracketMaterial: THREE.MeshBasicMaterial | null = null;
let parallaxPointerOuterMaterial: THREE.MeshBasicMaterial | null = null;
let parallaxPointerMaterial: THREE.MeshBasicMaterial | null = null;
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
  if (!frameGeometries) {
    const { front, back, depthMm, memberWidthMm } = focusFundamentalsFrameGeometry;
    frameGeometries = {
      frontVertical: new THREE.BoxGeometry(
        toWorld(memberWidthMm),
        toWorld(front.heightMm),
        toWorld(depthMm),
      ),
      frontHorizontal: new THREE.BoxGeometry(
        toWorld(front.widthMm - memberWidthMm * 2),
        toWorld(memberWidthMm),
        toWorld(depthMm),
      ),
      backVertical: new THREE.BoxGeometry(
        toWorld(memberWidthMm),
        toWorld(back.heightMm),
        toWorld(depthMm),
      ),
      backHorizontal: new THREE.BoxGeometry(
        toWorld(back.widthMm - memberWidthMm * 2),
        toWorld(memberWidthMm),
        toWorld(depthMm),
      ),
      // A unit cube is scaled to each connector's physical local length.
      connector: new THREE.BoxGeometry(1, 1, 1),
    };
  }
  if (!objectMaterial) {
    objectMaterial = new THREE.MeshStandardMaterial({
      color: OBJECT_COLOR,
      roughness: 0.78,
      metalness: 0.02,
    });
  }
  if (!parallaxGeometries) {
    const gateShape = focusFundamentalsParallaxFeatureShapes["near-alignment-gate"];
    const pointerShape = focusFundamentalsParallaxFeatureShapes["far-alignment-pointer"];
    const totalBracketWidthMm =
      gateShape.rightEdgeXMm - gateShape.leftEdgeXMm +
      focusFundamentalsParallaxBracketBarWidthMm * 2;
    parallaxGeometries = {
      bracketVertical: new THREE.BoxGeometry(
        toWorld(focusFundamentalsParallaxBracketBarWidthMm),
        toWorld(gateShape.heightMm),
        toWorld(gateShape.depthMm),
      ),
      bracketHorizontal: new THREE.BoxGeometry(
        toWorld(totalBracketWidthMm),
        toWorld(focusFundamentalsParallaxBracketBarWidthMm),
        toWorld(gateShape.depthMm),
      ),
      pointerOuterLeftVertical: new THREE.BoxGeometry(
        toWorld(
          focusFundamentalsParallaxPointerOuterBorderWidthMm +
            focusFundamentalsParallaxPointerOuterLeftExtensionMm,
        ),
        toWorld(focusFundamentalsParallaxPointerOuterHeightMm),
        toWorld(focusFundamentalsParallaxPointerOuterDepthMm),
      ),
      pointerOuterVertical: new THREE.BoxGeometry(
        toWorld(focusFundamentalsParallaxPointerOuterBorderWidthMm),
        toWorld(focusFundamentalsParallaxPointerOuterHeightMm),
        toWorld(focusFundamentalsParallaxPointerOuterDepthMm),
      ),
      pointerOuterHorizontal: new THREE.BoxGeometry(
        toWorld(
          focusFundamentalsParallaxPointerOuterWidthMm -
            focusFundamentalsParallaxPointerOuterBorderWidthMm * 2,
        ),
        toWorld(
          (focusFundamentalsParallaxPointerOuterHeightMm -
            focusFundamentalsParallaxPointerHeightMm) /
            2,
        ),
        toWorld(focusFundamentalsParallaxPointerOuterDepthMm),
      ),
      pointer: new THREE.BoxGeometry(
        toWorld(pointerShape.rightEdgeXMm - pointerShape.leftEdgeXMm),
        toWorld(pointerShape.heightMm),
        toWorld(pointerShape.depthMm),
      ),
    };
  }
  if (!parallaxBracketMaterial) {
    parallaxBracketMaterial = new THREE.MeshBasicMaterial({
      color: "#f8fafc",
      side: THREE.DoubleSide,
    });
  }
  if (!parallaxPointerOuterMaterial) {
    parallaxPointerOuterMaterial = new THREE.MeshBasicMaterial({
      color: focusFundamentalsParallaxPointerOuterColor,
      side: THREE.DoubleSide,
    });
  }
  if (!parallaxPointerMaterial) {
    parallaxPointerMaterial = new THREE.MeshBasicMaterial({
      color: focusFundamentalsParallaxPointerColor,
      side: THREE.DoubleSide,
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

type FrameDefinition = {
  widthMm: number;
  heightMm: number;
  centerZMm: number;
};

const addFrameBar = (
  frameGroup: THREE.Group,
  geometry: THREE.BoxGeometry,
  name: string,
  positionMm: { x: number; y: number; z: number },
) => {
  const bar = new THREE.Mesh(geometry, objectMaterial!);
  bar.name = name;
  bar.position.set(
    toWorld(positionMm.x),
    toWorld(positionMm.y),
    toWorld(positionMm.z),
  );
  frameGroup.add(bar);
};

const addFrame = (
  frameGroup: THREE.Group,
  frameName: "front" | "back",
  frame: FrameDefinition,
  verticalGeometry: THREE.BoxGeometry,
  horizontalGeometry: THREE.BoxGeometry,
) => {
  const halfMember = focusFundamentalsFrameGeometry.memberWidthMm / 2;
  const halfWidth = frame.widthMm / 2;
  const halfHeight = frame.heightMm / 2;
  const x = halfWidth - halfMember;
  const y = halfHeight - halfMember;

  addFrameBar(
    frameGroup,
    verticalGeometry,
    `focus-fundamentals-${frameName}-frame-left`,
    { x: -x, y: 0, z: frame.centerZMm },
  );
  addFrameBar(
    frameGroup,
    verticalGeometry,
    `focus-fundamentals-${frameName}-frame-right`,
    { x, y: 0, z: frame.centerZMm },
  );
  addFrameBar(
    frameGroup,
    horizontalGeometry,
    `focus-fundamentals-${frameName}-frame-top`,
    { x: 0, y, z: frame.centerZMm },
  );
  addFrameBar(
    frameGroup,
    horizontalGeometry,
    `focus-fundamentals-${frameName}-frame-bottom`,
    { x: 0, y: -y, z: frame.centerZMm },
  );
};

const addDepthConnector = (
  connectorGroup: THREE.Group,
  name: string,
  startMm: { x: number; y: number; z: number },
  endMm: { x: number; y: number; z: number },
  widthMm: number = focusFundamentalsFrameGeometry.memberWidthMm,
) => {
  const start = new THREE.Vector3(
    toWorld(startMm.x),
    toWorld(startMm.y),
    toWorld(startMm.z),
  );
  const end = new THREE.Vector3(
    toWorld(endMm.x),
    toWorld(endMm.y),
    toWorld(endMm.z),
  );
  const direction = end.clone().sub(start);
  const connector = new THREE.Mesh(frameGeometries!.connector, objectMaterial!);
  connector.name = name;
  connector.position.copy(start).add(end).multiplyScalar(0.5);
  connector.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction.clone().normalize(),
  );
  connector.scale.set(
    toWorld(widthMm),
    toWorld(widthMm),
    direction.length(),
  );
  connectorGroup.add(connector);
};

const addParallaxAlignmentFeature = (
  featureGroup: THREE.Group,
  feature: (typeof focusFundamentalsParallaxFeatures)[number],
) => {
  featureGroup.position.set(
    toWorld(feature.localPositionMm.x),
    toWorld(feature.localPositionMm.y),
    toWorld(feature.localPositionMm.z),
  );
  // The parent subject is yawed for depth readability. Counter-rotate this
  // small sight assembly so its bracket/pointer remains legible to the camera.
  featureGroup.rotation.y = focusFundamentalsParallaxFeatureRotationYRad;
  featureGroup.userData = {
    parallaxFeatureId: feature.id,
    parallaxFeatureDepthMm: feature.depthMm,
    parallaxFeatureWorldMm: feature.referenceWorldPositionMm,
  };

  if (feature.id === "near-alignment-gate") {
    const gateShape = focusFundamentalsParallaxFeatureShapes[feature.id];
    const halfGap = (gateShape.rightEdgeXMm - gateShape.leftEdgeXMm) / 2;
    const halfBar = focusFundamentalsParallaxBracketBarWidthMm / 2;
    const verticalOffset = halfGap + halfBar;
    const verticalY = 0;
    const topY = gateShape.heightMm / 2 - halfBar;
    const left = new THREE.Mesh(
      parallaxGeometries!.bracketVertical,
      parallaxBracketMaterial!,
    );
    left.name = "focus-fundamentals-near-alignment-gate-left";
    left.position.set(toWorld(-verticalOffset), toWorld(verticalY), 0);
    const right = new THREE.Mesh(
      parallaxGeometries!.bracketVertical,
      parallaxBracketMaterial!,
    );
    right.name = "focus-fundamentals-near-alignment-gate-right";
    right.position.set(toWorld(verticalOffset), toWorld(verticalY), 0);
    const top = new THREE.Mesh(
      parallaxGeometries!.bracketHorizontal,
      parallaxBracketMaterial!,
    );
    top.name = "focus-fundamentals-near-alignment-gate-top";
    top.position.set(0, toWorld(topY), 0);
    featureGroup.add(left, right, top);
    return;
  }

  const pointerOuterRightVerticalOffset =
    focusFundamentalsParallaxPointerOuterWidthMm / 2 -
    focusFundamentalsParallaxPointerOuterBorderWidthMm / 2;
  const pointerOuterLeftWidthMm =
    focusFundamentalsParallaxPointerOuterBorderWidthMm +
    focusFundamentalsParallaxPointerOuterLeftExtensionMm;
  const pointerOuterLeftVerticalOffset =
    -focusFundamentalsParallaxPointerOuterWidthMm / 2 -
    focusFundamentalsParallaxPointerOuterLeftExtensionMm +
    pointerOuterLeftWidthMm / 2;
  const pointerOuterHorizontalOffset =
    focusFundamentalsParallaxPointerOuterHeightMm / 2 -
    (focusFundamentalsParallaxPointerOuterHeightMm - focusFundamentalsParallaxPointerHeightMm) /
      4;
  const pointerOuterParts = [
    {
      name: "focus-fundamentals-far-alignment-pointer-outer-left",
      position: { x: pointerOuterLeftVerticalOffset, y: 0 },
      geometry: parallaxGeometries!.pointerOuterLeftVertical,
    },
    {
      name: "focus-fundamentals-far-alignment-pointer-outer-right",
      position: { x: pointerOuterRightVerticalOffset, y: 0 },
      geometry: parallaxGeometries!.pointerOuterVertical,
    },
    {
      name: "focus-fundamentals-far-alignment-pointer-outer-top",
      position: { x: 0, y: pointerOuterHorizontalOffset },
      geometry: parallaxGeometries!.pointerOuterHorizontal,
    },
    {
      name: "focus-fundamentals-far-alignment-pointer-outer-bottom",
      position: { x: 0, y: -pointerOuterHorizontalOffset },
      geometry: parallaxGeometries!.pointerOuterHorizontal,
    },
  ];
  for (const part of pointerOuterParts) {
    const pointerOuter = new THREE.Mesh(part.geometry, parallaxPointerOuterMaterial!);
    pointerOuter.name = part.name;
    pointerOuter.position.set(
      toWorld(part.position.x),
      toWorld(part.position.y),
      toWorld(focusFundamentalsParallaxPointerOuterFrontOffsetMm),
    );
    featureGroup.add(pointerOuter);
  }

  const pointer = new THREE.Mesh(
    parallaxGeometries!.pointer,
    parallaxPointerMaterial!,
  );
  pointer.name = "focus-fundamentals-far-alignment-pointer-mesh";
  pointer.position.set(0, 0, 0);
  featureGroup.add(pointer);
};

const addParallaxAlignmentFeatures = (objectGroup: THREE.Group) => {
  const supports = new THREE.Group();
  supports.name = "focus-fundamentals-parallax-supports";
  const features = new THREE.Group();
  features.name = "focus-fundamentals-parallax-features";

  for (const feature of focusFundamentalsParallaxFeatures) {
    addDepthConnector(
      supports,
      `focus-fundamentals-${feature.id}-support`,
      feature.supportAnchorLocalPositionMm,
      feature.localPositionMm,
      focusFundamentalsParallaxSupportWidthMm,
    );
    const featureGroup = new THREE.Group();
    featureGroup.name = `focus-fundamentals-${feature.id}`;
    addParallaxAlignmentFeature(featureGroup, feature);
    features.add(featureGroup);
  }

  objectGroup.add(supports, features);
};

const addDepthConnectors = (connectorGroup: THREE.Group) => {
  const { front, back, depthMm, memberWidthMm } = focusFundamentalsFrameGeometry;
  const halfFrontWidth = front.widthMm / 2 - memberWidthMm / 2;
  const halfFrontHeight = front.heightMm / 2 - memberWidthMm / 2;
  const halfBackWidth = back.widthMm / 2 - memberWidthMm / 2;
  const halfBackHeight = back.heightMm / 2 - memberWidthMm / 2;
  const frontBackSurfaceZ = front.centerZMm + depthMm / 2;
  const backFrontSurfaceZ = back.centerZMm - depthMm / 2;

  for (const [index, sign] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].entries()) {
    const [xSign, ySign] = sign;
    addDepthConnector(
      connectorGroup,
      `focus-fundamentals-depth-rail-${index + 1}`,
      {
        x: xSign * halfFrontWidth,
        y: ySign * halfFrontHeight,
        z: frontBackSurfaceZ,
      },
      {
        x: xSign * halfBackWidth,
        y: ySign * halfBackHeight,
        z: backFrontSurfaceZ,
      },
    );
  }
};

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

  const body = new THREE.Group();
  body.name = "focus-fundamentals-object-body";
  const frontFrame = new THREE.Group();
  frontFrame.name = "focus-fundamentals-front-frame";
  addFrame(
    frontFrame,
    "front",
    focusFundamentalsFrameGeometry.front,
    frameGeometries!.frontVertical,
    frameGeometries!.frontHorizontal,
  );
  const backFrame = new THREE.Group();
  backFrame.name = "focus-fundamentals-back-frame";
  addFrame(
    backFrame,
    "back",
    focusFundamentalsFrameGeometry.back,
    frameGeometries!.backVertical,
    frameGeometries!.backHorizontal,
  );
  const depthConnectors = new THREE.Group();
  depthConnectors.name = "focus-fundamentals-depth-connectors";
  addDepthConnectors(depthConnectors);
  body.add(frontFrame, backFrame, depthConnectors);
  objectGroup.add(body);
  focusFundamentalsFocusDetails.forEach((detail, index) =>
    addFocusDetailMarker(objectGroup, detail, index),
  );
  addParallaxAlignmentFeatures(objectGroup);
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
