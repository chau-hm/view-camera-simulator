/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry, {
  type ObliqueTabletopBoardMarker,
  type ObliqueTabletopSubjectSample,
} from "../scenes/obliqueTabletopGeometry";
import { toWorld } from "./rttUtils";

const standardMaterial = (color: string, roughness = 0.84) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const basicMaterial = (color: string) => new THREE.MeshBasicMaterial({ color });

const setSubjectBoardTransform = (boardAssembly: THREE.Group): void => {
  const basis = geometry.subjectBoardTransformBasis;
  boardAssembly.matrixAutoUpdate = false;
  boardAssembly.matrix.makeBasis(
    new THREE.Vector3(basis.localX.x, basis.localX.y, basis.localX.z),
    new THREE.Vector3(basis.localY.x, basis.localY.y, basis.localY.z),
    new THREE.Vector3(basis.localZ.x, basis.localZ.y, basis.localZ.z),
  );
  boardAssembly.matrix.setPosition(
    new THREE.Vector3(
      toWorld(geometry.subjectBoard.center.x),
      toWorld(geometry.subjectBoard.center.y),
      toWorld(geometry.subjectBoard.center.z),
    ),
  );
};

const addTabletopSurfaceGuides = (tabletopAssembly: THREE.Group): void => {
  const guideMaterial = basicMaterial(geometry.tabletop.edgeColor);
  const guideHeight = 3;
  const guideGap = 2;
  const guideCount = 5;

  for (let index = 0; index < guideCount; index += 1) {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(5),
        toWorld(guideHeight),
        toWorld(geometry.tabletop.depth - 120),
      ),
      guideMaterial,
    );
    guide.name = `oblique-tabletop-table-depth-guide-${index + 1}`;
    guide.position.set(
      toWorld(
        -geometry.tabletop.width / 2 +
          ((index + 1) * geometry.tabletop.width) / (guideCount + 1),
      ),
      toWorld(geometry.tabletop.thickness / 2 + guideGap + guideHeight / 2),
      0,
    );
    tabletopAssembly.add(guide);
  }

  for (let index = 0; index < guideCount; index += 1) {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(geometry.tabletop.width - 120),
        toWorld(guideHeight),
        toWorld(5),
      ),
      guideMaterial,
    );
    guide.name = `oblique-tabletop-table-width-guide-${index + 1}`;
    guide.position.set(
      0,
      toWorld(geometry.tabletop.thickness / 2 + guideGap + guideHeight / 2),
      toWorld(
        -geometry.tabletop.depth / 2 +
          ((index + 1) * geometry.tabletop.depth) / (guideCount + 1),
      ),
    );
    tabletopAssembly.add(guide);
  }
};

const addBoardPlanSurface = (
  boardAssembly: THREE.Group,
  faceLocalY: number,
  outwardSign: 1 | -1,
  nameSuffix = "",
): void => {
  const surfaceMaterial =
    outwardSign === -1
      ? basicMaterial(geometry.subjectBoard.color)
      : standardMaterial(geometry.subjectBoard.color, 0.92);
  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.subjectBoard.width - 80),
      toWorld(3),
      toWorld(geometry.subjectBoard.depth - 80),
    ),
    surfaceMaterial,
  );
  surface.name = `oblique-tabletop-subject-board-plan-surface${nameSuffix}`;
  surface.position.y = toWorld(faceLocalY + outwardSign * 1.5);
  boardAssembly.add(surface);

  const lineMaterial = basicMaterial(geometry.subjectBoard.planLineColor);
  const lineY = toWorld(faceLocalY + outwardSign * 3.5);
  const horizontalLineDepths = [-1050, -350, 350, 1050];
  horizontalLineDepths.forEach((localDepth, index) => {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(geometry.subjectBoard.width - 220),
        toWorld(2),
        toWorld(5),
      ),
      lineMaterial,
    );
    line.name = `oblique-tabletop-subject-board-plan-horizontal-${index + 1}${nameSuffix}`;
    line.position.set(0, lineY, toWorld(localDepth));
    boardAssembly.add(line);
  });

  const verticalLineXs = [-1100, -550, 550, 1100];
  verticalLineXs.forEach((localX, index) => {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(5),
        toWorld(2),
        toWorld(geometry.subjectBoard.depth - 220),
      ),
      lineMaterial,
    );
    line.name = `oblique-tabletop-subject-board-plan-vertical-${index + 1}${nameSuffix}`;
    line.position.set(toWorld(localX), lineY, 0);
    boardAssembly.add(line);
  });

  const borderMaterial = basicMaterial(geometry.subjectBoard.edgeColor);
  [
    {
      name: "near",
      x: 0,
      z: -geometry.subjectBoard.depth / 2 + 55,
      width: geometry.subjectBoard.width - 80,
      depth: 6,
    },
    {
      name: "far",
      x: 0,
      z: geometry.subjectBoard.depth / 2 - 55,
      width: geometry.subjectBoard.width - 80,
      depth: 6,
    },
    {
      name: "left",
      x: -geometry.subjectBoard.width / 2 + 55,
      z: 0,
      width: 6,
      depth: geometry.subjectBoard.depth - 80,
    },
    {
      name: "right",
      x: geometry.subjectBoard.width / 2 - 55,
      z: 0,
      width: 6,
      depth: geometry.subjectBoard.depth - 80,
    },
  ].forEach(({ name, x, z, width, depth }) => {
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(toWorld(width), toWorld(2), toWorld(depth)),
      borderMaterial,
    );
    border.name = `oblique-tabletop-subject-board-border-${name}${nameSuffix}`;
    border.position.set(toWorld(x), lineY, toWorld(z));
    boardAssembly.add(border);
  });
};

const addAnalyticalSurfaceSamples = (boardAssembly: THREE.Group): void => {
  geometry.subjectBoardAnalyticalSurfaceSamples.forEach((sample) => {
    const sampleNode = new THREE.Object3D();
    sampleNode.name = `oblique-tabletop-board-surface-sample-${sample.id}`;
    sampleNode.position.set(
      toWorld(sample.localPosition.x),
      toWorld(geometry.subjectBoardFocusSurfaceLocalY),
      toWorld(sample.localPosition.z),
    );
    sampleNode.userData = {
      analyticalCoverageSampleId: sample.id,
      geometryAnchor: "canonical-subject-board-surface",
      focusSampleWorldMm: { ...sample.worldPosition },
    };
    boardAssembly.add(sampleNode);
  });
};

const addBoardFocusDetail = (
  boardAssembly: THREE.Group,
  sample: ObliqueTabletopSubjectSample,
  faceLocalY: number,
  outwardSign: 1 | -1,
  nameSuffix = "",
  includeFocusMetadata = true,
): void => {
  const detailGroup = new THREE.Group();
  detailGroup.name = `oblique-tabletop-board-detail-${sample.id}${nameSuffix}`;
  detailGroup.position.set(
    toWorld(sample.localPosition.x),
    0,
    toWorld(sample.localPosition.z),
  );
  if (includeFocusMetadata) {
    detailGroup.userData = {
      focusTargetId: sample.id,
      geometryAnchor: "visible-subject-board-detail",
      focusSampleWorldMm: { ...sample.worldPosition },
    };
  }

  const detail = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(250), toWorld(10), toWorld(170)),
    outwardSign === -1
      ? basicMaterial(sample.id === "middle" ? "#7c3aed" : "#b45309")
      : standardMaterial(sample.id === "middle" ? "#7c3aed" : "#b45309", 0.8),
  );
  detail.name = `oblique-tabletop-board-detail-${sample.id}-surface${nameSuffix}`;
  detail.position.y = toWorld(faceLocalY + outwardSign * 5);
  detailGroup.add(detail);

  const detailLineMaterial = basicMaterial("#f8fafc");
  [-45, 0, 45].forEach((localX, index) => {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(toWorld(3), toWorld(1.5), toWorld(140)),
      detailLineMaterial,
    );
    line.name = `oblique-tabletop-board-detail-${sample.id}-line-${index + 1}${nameSuffix}`;
    line.position.set(
      toWorld(localX),
      toWorld(faceLocalY + outwardSign * 10.5),
      0,
    );
    detailGroup.add(line);
  });

  if (includeFocusMetadata) {
    const focusProbe = new THREE.Object3D();
    focusProbe.name = `oblique-tabletop-focus-detail-${sample.id}`;
    focusProbe.position.y = toWorld(geometry.subjectBoardFocusSurfaceLocalY);
    focusProbe.userData = {
      focusTargetId: sample.id,
      geometryAnchor: "visible-subject-board-focus-probe",
      focusProbeWorldMm: { ...sample.worldPosition },
    };
    detailGroup.add(focusProbe);
  }
  boardAssembly.add(detailGroup);
};

const addMarker = (
  boardAssembly: THREE.Group,
  marker: ObliqueTabletopBoardMarker,
  faceLocalY: number,
  outwardSign: 1 | -1,
  nameSuffix = "",
  includeFocusMetadata = true,
): void => {
  const markerGroup = new THREE.Group();
  markerGroup.name = `oblique-tabletop-marker-${marker.id}${nameSuffix}`;
  markerGroup.position.set(
    toWorld(marker.localPosition.x),
    0,
    toWorld(marker.localPosition.z),
  );
  if (includeFocusMetadata) {
    markerGroup.userData = {
      markerId: marker.id,
      geometryAnchor: "visible-subject-board-marker",
      focusProbeWorldMm: { ...marker.worldPosition },
    };
  }

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.markerGeometry.width),
      toWorld(geometry.markerGeometry.height),
      toWorld(geometry.markerGeometry.depth),
    ),
    outwardSign === -1 ? basicMaterial(marker.color) : standardMaterial(marker.color, 0.76),
  );
  base.name = `oblique-tabletop-marker-${marker.id}-base${nameSuffix}`;
  base.position.y = toWorld(faceLocalY + outwardSign * geometry.markerGeometry.height / 2);
  markerGroup.add(base);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.markerGeometry.width - 24),
      toWorld(geometry.markerGeometry.topThickness),
      toWorld(geometry.markerGeometry.depth - 24),
    ),
    outwardSign === -1 ? basicMaterial("#f8fafc") : standardMaterial("#f8fafc", 0.92),
  );
  top.name = `oblique-tabletop-marker-${marker.id}-surface${nameSuffix}`;
  top.position.y = toWorld(
    faceLocalY +
      outwardSign *
        (geometry.markerGeometry.height + geometry.markerGeometry.topThickness / 2),
  );
  markerGroup.add(top);

  const stripeMaterial = basicMaterial(marker.color);
  const stripeWidth = geometry.markerGeometry.width / geometry.markerGeometry.stripeCount;
  for (let index = 0; index < geometry.markerGeometry.stripeCount; index += 1) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(geometry.markerGeometry.stripeWidth),
        toWorld(1.5),
        toWorld(geometry.markerGeometry.stripeDepth),
      ),
      stripeMaterial,
    );
    stripe.name = `oblique-tabletop-marker-${marker.id}-stripe-${index + 1}${nameSuffix}`;
    stripe.position.set(
      toWorld(
        -geometry.markerGeometry.width / 2 +
          stripeWidth / 2 +
          index * stripeWidth,
      ),
      toWorld(
        faceLocalY +
          outwardSign *
            (geometry.markerGeometry.height +
              geometry.markerGeometry.topThickness +
              0.75),
      ),
      0,
    );
    markerGroup.add(stripe);
  }

  if (includeFocusMetadata) {
    const focusProbe = new THREE.Object3D();
    focusProbe.name = `oblique-tabletop-focus-${marker.id}`;
    focusProbe.position.y = toWorld(geometry.subjectBoardFocusSurfaceLocalY);
    focusProbe.userData = {
      markerId: marker.id,
      geometryAnchor: "visible-subject-board-marker-focus-probe",
      focusProbeWorldMm: { ...marker.worldPosition },
    };
    markerGroup.add(focusProbe);
  }

  if (includeFocusMetadata) marker.focusSampleWorldPositions.forEach((worldPosition, index) => {
    const sampleNode = new THREE.Object3D();
    sampleNode.name = `oblique-tabletop-marker-${marker.id}-focus-sample-${index + 1}${nameSuffix}`;
    sampleNode.position.set(
      toWorld(
        index === 1
          ? -geometry.markerGeometry.width * 0.28
          : index === 2
            ? geometry.markerGeometry.width * 0.28
            : 0,
      ),
      toWorld(geometry.subjectBoardFocusSurfaceLocalY),
      toWorld(
        index === 3
          ? -geometry.markerGeometry.depth * 0.28
          : index === 4
            ? geometry.markerGeometry.depth * 0.28
            : 0,
      ),
    );
    sampleNode.userData = {
      markerId: marker.id,
      focusSampleIndex: index,
      focusSampleWorldMm: { ...worldPosition },
    };
    markerGroup.add(sampleNode);
  });

  boardAssembly.add(markerGroup);
};

/** Create the canonical Oblique Tabletop subject for R3F and Ground Glass RTT. */
export function createObliqueTabletopGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "oblique-tabletop-subject";

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      toWorld(geometry.floor.width),
      toWorld(geometry.floor.depth),
    ),
    standardMaterial(geometry.floor.color, 1),
  );
  floorMesh.name = "oblique-tabletop-floor";
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(
    toWorld(geometry.floor.center.x),
    toWorld(geometry.floor.center.y),
    toWorld(geometry.floor.center.z),
  );
  root.add(floorMesh);

  const tabletopAssembly = new THREE.Group();
  tabletopAssembly.name = "oblique-tabletop-tabletop-assembly";
  tabletopAssembly.position.set(
    toWorld(geometry.tabletop.center.x),
    toWorld(geometry.tabletop.center.y),
    toWorld(geometry.tabletop.center.z),
  );

  const tabletopMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.tabletop.width),
      toWorld(geometry.tabletop.thickness),
      toWorld(geometry.tabletop.depth),
    ),
    standardMaterial(geometry.tabletop.color, 0.82),
  );
  tabletopMesh.name = "oblique-tabletop-tabletop";
  tabletopAssembly.add(tabletopMesh);
  addTabletopSurfaceGuides(tabletopAssembly);
  root.add(tabletopAssembly);

  const boardAssembly = new THREE.Group();
  boardAssembly.name = "oblique-tabletop-subject-board-assembly";
  setSubjectBoardTransform(boardAssembly);
  const boardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.subjectBoard.width),
      toWorld(geometry.subjectBoard.thickness),
      toWorld(geometry.subjectBoard.depth),
    ),
    standardMaterial(geometry.subjectBoard.edgeColor, 0.84),
  );
  boardMesh.name = "oblique-tabletop-subject-board";
  boardAssembly.add(boardMesh);
  // The physical camera sees the lower, camera-facing side of this shallow
  // incline. Keep matching presentation details on the upper side for the
  // elevated 3D observer view; both faces share the same board transform.
  addBoardPlanSurface(
    boardAssembly,
    geometry.subjectBoardFaceLocalY,
    -1,
  );
  addBoardPlanSurface(
    boardAssembly,
    geometry.subjectBoardPresentationFaceLocalY,
    1,
    "-presentation",
  );
  addAnalyticalSurfaceSamples(boardAssembly);
  geometry.subjectBoardVisibleFocusSamples.forEach((sample) =>
    addBoardFocusDetail(
      boardAssembly,
      sample,
      geometry.subjectBoardFaceLocalY,
      -1,
    ),
  );
  geometry.subjectBoardVisibleFocusSamples.forEach((sample) =>
    addBoardFocusDetail(
      boardAssembly,
      sample,
      geometry.subjectBoardPresentationFaceLocalY,
      1,
      "-presentation",
      false,
    ),
  );
  geometry.boardMarkers.forEach((marker) =>
    addMarker(
      boardAssembly,
      marker,
      geometry.subjectBoardFaceLocalY,
      -1,
    ),
  );
  geometry.boardMarkers.forEach((marker) =>
    addMarker(
      boardAssembly,
      marker,
      geometry.subjectBoardPresentationFaceLocalY,
      1,
      "-presentation",
      false,
    ),
  );
  root.add(boardAssembly);

  geometry.tableSupports.forEach((support) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(support.width),
        toWorld(support.height),
        toWorld(support.depth),
      ),
      standardMaterial(support.color, 0.9),
    );
    leg.name = `oblique-tabletop-support-${support.id}`;
    leg.position.set(
      toWorld(support.center.x),
      toWorld(support.center.y),
      toWorld(support.center.z),
    );
    root.add(leg);
  });

  geometry.subjectBoardSupports.forEach((support) => {
    const supportMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(support.width),
        toWorld(support.height),
        toWorld(support.depth),
      ),
      standardMaterial(support.color, 0.88),
    );
    supportMesh.name = `oblique-tabletop-board-support-${support.id}`;
    supportMesh.position.set(
      toWorld(support.center.x),
      toWorld(support.center.y),
      toWorld(support.center.z),
    );
    root.add(supportMesh);
  });

  return root;
}

export function disposeObliqueTabletopGroup(group: THREE.Group): void {
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
}

/** React Three Fiber boundary backed by the same group factory used by RTT. */
export const ObliqueTabletopSubject: React.FC = () => {
  const group = useMemo(() => createObliqueTabletopGroup(), []);

  useEffect(
    () => () => {
      disposeObliqueTabletopGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
