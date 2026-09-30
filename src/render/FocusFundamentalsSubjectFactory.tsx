import * as THREE from "three";
import type { FocusFundamentalsPresentation } from "../scenes/presentation/focusFundamentals";
import { toWorld } from "./rttUtils";

const FLOOR_COLOR = new THREE.Color("#9aa6b5");
const OBJECT_COLOR = new THREE.Color("#64748b");
const MARKER_COLORS = ["#ef4444", "#f59e0b"] as const;
const FLOOR_WIDTH_MM = 5000;
const FLOOR_DEPTH_MM = 5000;

export type FocusFundamentalsAssetRequest = Readonly<{
  presentation: FocusFundamentalsPresentation;
}>;

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
  pointer: THREE.BoxGeometry;
};

let frameGeometries: FrameGeometrySet | null = null;
let parallaxGeometries: ParallaxGeometrySet | null = null;
let objectMaterial: THREE.MeshStandardMaterial | null = null;
let parallaxBracketMaterial: THREE.MeshBasicMaterial | null = null;
let parallaxPointerMaterial: THREE.MeshBasicMaterial | null = null;
let markerGeometry: THREE.BoxGeometry | null = null;
let markerTextures: [THREE.DataTexture, THREE.DataTexture] | null = null;
let markerMaterials: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial] | null = null;
let floorGeometry: THREE.PlaneGeometry | null = null;
let floorMaterial: THREE.MeshStandardMaterial | null = null;
let backdropGeometry: THREE.PlaneGeometry | null = null;
let backdropMaterial: THREE.MeshBasicMaterial | null = null;
let cachedPresentation: FocusFundamentalsPresentation | null = null;

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

function ensureSharedResources(presentation: FocusFundamentalsPresentation) {
  if (cachedPresentation && cachedPresentation !== presentation) {
    throw new Error(
      "Focus Fundamentals module-shared resources require the canonical presentation instance",
    );
  }
  cachedPresentation ??= presentation;
  if (!frameGeometries) {
    const { front, back, depthMm, memberWidthMm } = presentation.geometry.frame;
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
    const gateShape = presentation.geometry.parallax.featureShapes["near-alignment-gate"];
    const pointerShape = presentation.geometry.parallax.featureShapes["far-alignment-pointer"];
    const totalBracketWidthMm =
      gateShape.rightEdgeXMm - gateShape.leftEdgeXMm +
      presentation.geometry.parallax.bracketBarWidthMm * 2;
    parallaxGeometries = {
      bracketVertical: new THREE.BoxGeometry(
        toWorld(presentation.geometry.parallax.bracketBarWidthMm),
        toWorld(gateShape.heightMm),
        toWorld(gateShape.depthMm),
      ),
      bracketHorizontal: new THREE.BoxGeometry(
        toWorld(totalBracketWidthMm),
        toWorld(presentation.geometry.parallax.bracketBarWidthMm),
        toWorld(gateShape.depthMm),
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
  if (!parallaxPointerMaterial) {
    parallaxPointerMaterial = new THREE.MeshBasicMaterial({
      color: presentation.geometry.parallax.pointerColor,
      side: THREE.DoubleSide,
    });
  }
  if (!markerGeometry) {
    markerGeometry = new THREE.BoxGeometry(
      toWorld(presentation.geometry.markerSizeMm.width),
      toWorld(presentation.geometry.markerSizeMm.height),
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
  if (!backdropGeometry) {
    const subjectWidthMm =
      presentation.geometry.connectedSubjectBoundsMm.max.x -
      presentation.geometry.connectedSubjectBoundsMm.min.x;
    const subjectHeightMm =
      presentation.geometry.connectedSubjectBoundsMm.max.y -
      presentation.geometry.connectedSubjectBoundsMm.min.y;
    backdropGeometry = new THREE.PlaneGeometry(
      toWorld(subjectWidthMm + presentation.geometry.backdrop.horizontalMarginMm * 2),
      toWorld(subjectHeightMm + presentation.geometry.backdrop.verticalMarginMm * 2),
    );
  }
  if (!backdropMaterial) {
    backdropMaterial = new THREE.MeshBasicMaterial({
      color: presentation.geometry.backdrop.color,
      side: THREE.DoubleSide,
    });
  }
}

function addFocusDetailMarker(
  objectGroup: THREE.Group,
  detail: FocusFundamentalsPresentation["geometry"]["focusDetails"][number],
  index: number,
) {
  const marker = new THREE.Mesh(markerGeometry!, markerMaterials![index]);
  marker.name = `${detail.id}-marker`;
  const markerPosition = detail.markerLocalPositionMm;
  marker.position.set(
    toWorld(markerPosition.x),
    toWorld(markerPosition.y),
    toWorld(markerPosition.z),
  );
  marker.rotation.y = detail.markerRotationYRad;
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
  memberWidthMm: number,
) => {
  const halfMember = memberWidthMm / 2;
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
  widthMm: number,
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
  feature: FocusFundamentalsPresentation["geometry"]["parallax"]["features"][number],
  presentation: FocusFundamentalsPresentation,
) => {
  featureGroup.position.set(
    toWorld(feature.localPositionMm.x),
    toWorld(feature.localPositionMm.y),
    toWorld(feature.localPositionMm.z),
  );
  // The parent subject is yawed for depth readability. Counter-rotate this
  // small sight assembly so its bracket/pointer remains legible to the camera.
  featureGroup.rotation.y = presentation.geometry.parallax.featureRotationYRad;
  featureGroup.userData = {
    parallaxFeatureId: feature.id,
    parallaxFeatureDepthMm: feature.depthMm,
    parallaxFeatureWorldMm: feature.referenceWorldPositionMm,
  };

  if (feature.id === "near-alignment-gate") {
    const gateShape = presentation.geometry.parallax.featureShapes[feature.id];
    const halfGap = (gateShape.rightEdgeXMm - gateShape.leftEdgeXMm) / 2;
    const halfBar = presentation.geometry.parallax.bracketBarWidthMm / 2;
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

  const pointer = new THREE.Mesh(
    parallaxGeometries!.pointer,
    parallaxPointerMaterial!,
  );
  pointer.name = "focus-fundamentals-far-alignment-pointer-mesh";
  pointer.position.set(0, 0, 0);
  featureGroup.add(pointer);
};

const addParallaxAlignmentFeatures = (
  objectGroup: THREE.Group,
  presentation: FocusFundamentalsPresentation,
) => {
  const supports = new THREE.Group();
  supports.name = "focus-fundamentals-parallax-supports";
  const features = new THREE.Group();
  features.name = "focus-fundamentals-parallax-features";

  for (const feature of presentation.geometry.parallax.features) {
    addDepthConnector(
      supports,
      `focus-fundamentals-${feature.id}-support`,
      feature.supportAnchorLocalPositionMm,
      feature.localPositionMm,
      presentation.geometry.parallax.supportWidthMm,
    );
    const featureGroup = new THREE.Group();
    featureGroup.name = `focus-fundamentals-${feature.id}`;
    addParallaxAlignmentFeature(featureGroup, feature, presentation);
    features.add(featureGroup);
  }

  objectGroup.add(supports, features);
};

const addDepthConnectors = (
  connectorGroup: THREE.Group,
  presentation: FocusFundamentalsPresentation,
) => {
  const { front, back, depthMm, memberWidthMm } = presentation.geometry.frame;
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
      memberWidthMm,
    );
  }
};

export function createFocusFundamentalsGroup(
  request: FocusFundamentalsAssetRequest,
): THREE.Group {
  const { presentation } = request;
  ensureSharedResources(presentation);

  const group = new THREE.Group();
  group.name = "focus-fundamentals-subject";

  const objectGroup = new THREE.Group();
  objectGroup.name = "focus-fundamentals-object";
  objectGroup.position.set(
    toWorld(presentation.geometry.objectCenterMm.x),
    toWorld(presentation.geometry.objectCenterMm.y),
    toWorld(presentation.geometry.objectCenterMm.z),
  );
  objectGroup.rotation.y = presentation.geometry.objectRotationYRad;

  const body = new THREE.Group();
  body.name = "focus-fundamentals-object-body";
  const frontFrame = new THREE.Group();
  frontFrame.name = "focus-fundamentals-front-frame";
  addFrame(
    frontFrame,
    "front",
    presentation.geometry.frame.front,
    frameGeometries!.frontVertical,
    frameGeometries!.frontHorizontal,
    presentation.geometry.frame.memberWidthMm,
  );
  const backFrame = new THREE.Group();
  backFrame.name = "focus-fundamentals-back-frame";
  addFrame(
    backFrame,
    "back",
    presentation.geometry.frame.back,
    frameGeometries!.backVertical,
    frameGeometries!.backHorizontal,
    presentation.geometry.frame.memberWidthMm,
  );
  const depthConnectors = new THREE.Group();
  depthConnectors.name = "focus-fundamentals-depth-connectors";
  addDepthConnectors(depthConnectors, presentation);
  body.add(frontFrame, backFrame, depthConnectors);
  objectGroup.add(body);
  presentation.geometry.focusDetails.forEach((detail, index) =>
    addFocusDetailMarker(objectGroup, detail, index),
  );
  addParallaxAlignmentFeatures(objectGroup, presentation);

  const backdrop = new THREE.Mesh(backdropGeometry!, backdropMaterial!);
  backdrop.name = "focus-fundamentals-backdrop";
  backdrop.position.set(
    toWorld(
      (presentation.geometry.connectedSubjectBoundsMm.min.x +
        presentation.geometry.connectedSubjectBoundsMm.max.x) /
        2,
    ),
    toWorld(
      (presentation.geometry.connectedSubjectBoundsMm.min.y +
        presentation.geometry.connectedSubjectBoundsMm.max.y) /
        2,
    ),
    toWorld(
      presentation.geometry.connectedSubjectBoundsMm.max.z +
        presentation.geometry.backdrop.rearMarginMm,
    ),
  );
  group.add(backdrop, objectGroup);

  const floor = new THREE.Mesh(floorGeometry!, floorMaterial!);
  floor.name = "focus-fundamentals-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = toWorld(presentation.geometry.floorYmm);
  group.add(floor);

  return group;
}
