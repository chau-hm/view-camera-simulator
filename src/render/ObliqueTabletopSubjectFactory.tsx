/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry, { type ObliqueTabletopMarker } from "../scenes/obliqueTabletopGeometry";
import { toWorld } from "./rttUtils";

const standardMaterial = (color: string, roughness = 0.84) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const basicMaterial = (color: string) =>
  new THREE.MeshBasicMaterial({ color });

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
    guide.name = `oblique-tabletop-depth-guide-${index + 1}`;
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
    guide.name = `oblique-tabletop-width-guide-${index + 1}`;
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

const addTabletopAnalyticalSurfaceSamples = (tabletopAssembly: THREE.Group): void => {
  geometry.tabletopAnalyticalSurfaceSamples.forEach((sample) => {
    const sampleNode = new THREE.Object3D();
    sampleNode.name = `oblique-tabletop-surface-sample-${sample.id}`;
    sampleNode.position.set(
      toWorld(sample.localPosition.x),
      toWorld(geometry.tabletop.thickness / 2),
      toWorld(sample.localPosition.z),
    );
    sampleNode.userData = {
      analyticalCoverageSampleId: sample.id,
      geometryAnchor: "canonical-tabletop-surface",
      focusSampleWorldMm: { ...sample.worldPosition },
    };
    tabletopAssembly.add(sampleNode);
  });
};

const addMarker = (
  tabletopAssembly: THREE.Group,
  marker: ObliqueTabletopMarker,
): void => {
  const markerGroup = new THREE.Group();
  markerGroup.name = `oblique-tabletop-marker-${marker.id}`;
  markerGroup.position.set(
    toWorld(marker.localPosition.x),
    0,
    toWorld(marker.localPosition.z),
  );
  markerGroup.userData = {
    markerId: marker.id,
    geometryAnchor: "visible-marker",
    focusProbeWorldMm: { ...marker.worldPosition },
  };

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.markerGeometry.width),
      toWorld(geometry.markerGeometry.height),
      toWorld(geometry.markerGeometry.depth),
    ),
    standardMaterial(marker.color, 0.76),
  );
  base.name = `oblique-tabletop-marker-${marker.id}-base`;
  base.position.y = toWorld(
    geometry.tabletop.thickness / 2 + geometry.markerGeometry.height / 2,
  );
  markerGroup.add(base);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.markerGeometry.width - 24),
      toWorld(geometry.markerGeometry.topThickness),
      toWorld(geometry.markerGeometry.depth - 24),
    ),
    standardMaterial("#f8fafc", 0.92),
  );
  top.name = `oblique-tabletop-marker-${marker.id}-surface`;
  top.position.y = toWorld(
    geometry.tabletop.thickness / 2 +
      geometry.markerGeometry.height +
      geometry.markerGeometry.topThickness / 2,
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
    stripe.name = `oblique-tabletop-marker-${marker.id}-stripe-${index + 1}`;
    stripe.position.set(
      toWorld(
        -geometry.markerGeometry.width / 2 +
          stripeWidth / 2 +
          index * stripeWidth,
      ),
      toWorld(
        geometry.tabletop.thickness / 2 +
          geometry.markerGeometry.height +
          geometry.markerGeometry.topThickness +
          0.75,
      ),
      0,
    );
    markerGroup.add(stripe);
  }

  const focusProbe = new THREE.Object3D();
  focusProbe.name = `oblique-tabletop-focus-${marker.id}`;
  focusProbe.position.set(
    0,
    toWorld(
      geometry.tabletop.thickness / 2 +
        geometry.markerGeometry.height +
        geometry.markerGeometry.surfaceGap,
    ),
    0,
  );
  focusProbe.userData = {
    markerId: marker.id,
    geometryAnchor: "visible-marker-focus-probe",
    focusProbeWorldMm: { ...marker.worldPosition },
  };
  markerGroup.add(focusProbe);

  const sampleOffsets = [
    { id: "centre", x: 0, z: 0 },
    { id: "left", x: -geometry.markerGeometry.width * 0.28, z: 0 },
    { id: "right", x: geometry.markerGeometry.width * 0.28, z: 0 },
    { id: "near", x: 0, z: -geometry.markerGeometry.depth * 0.28 },
    { id: "far", x: 0, z: geometry.markerGeometry.depth * 0.28 },
  ] as const;
  sampleOffsets.forEach((sample, index) => {
    const sampleNode = new THREE.Object3D();
    sampleNode.name = `oblique-tabletop-marker-${marker.id}-focus-sample-${sample.id}`;
    sampleNode.position.set(
      toWorld(sample.x),
      toWorld(
        geometry.tabletop.thickness / 2 +
          geometry.markerGeometry.height +
          geometry.markerGeometry.surfaceGap,
      ),
      toWorld(sample.z),
    );
    sampleNode.userData = {
      markerId: marker.id,
      focusSampleIndex: index,
      focusSampleWorldMm: marker.focusSampleWorldPositions[index],
    };
    markerGroup.add(sampleNode);
  });

  tabletopAssembly.add(markerGroup);
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
  // Use the canonical basis directly. Object3D.rotation.set(x, y, 0) uses
  // the opposite composition for this subject and would erase the lateral
  // component of the tilted surface normal.
  const basis = geometry.tabletopTransformBasis;
  tabletopAssembly.matrixAutoUpdate = false;
  tabletopAssembly.matrix.makeBasis(
    new THREE.Vector3(basis.localX.x, basis.localX.y, basis.localX.z),
    new THREE.Vector3(basis.localY.x, basis.localY.y, basis.localY.z),
    new THREE.Vector3(basis.localZ.x, basis.localZ.y, basis.localZ.z),
  );
  tabletopAssembly.matrix.setPosition(
    new THREE.Vector3(
      toWorld(geometry.tabletop.center.x),
      toWorld(geometry.tabletop.center.y),
      toWorld(geometry.tabletop.center.z),
    ),
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
  addTabletopAnalyticalSurfaceSamples(tabletopAssembly);

  geometry.markers.forEach((marker) => addMarker(tabletopAssembly, marker));
  root.add(tabletopAssembly);

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
