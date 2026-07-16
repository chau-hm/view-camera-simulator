/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry, { type ShelfSwingSubjectDefinition } from "../scenes/shelfSwingGeometry";
import { toWorld } from "./rttUtils";

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const standardMaterial = (color: string, roughness = 0.88) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const basicMaterial = (color: string) =>
  new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

const addChartTiles = (chartGroup: THREE.Group, subject: ShelfSwingSubjectDefinition): void => {
  const chart = subject.focusChart;
  const dark = subject.materialHints.detail;
  const light = subject.materialHints.secondary;

  if (chart.pattern === "vertical-stripes") {
    const stripeWidth = chart.width / chart.columns;
    for (let column = 0; column < chart.columns; column += 1) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(toWorld(stripeWidth), toWorld(chart.height)),
        basicMaterial(column % 2 === 0 ? dark : light),
      );
      stripe.name = `${chart.semanticName}-stripe-${column + 1}`;
      stripe.position.x = toWorld(-chart.width / 2 + stripeWidth / 2 + column * stripeWidth);
      chartGroup.add(stripe);
    }
    return;
  }

  if (chart.pattern === "horizontal-lines") {
    const rowHeight = chart.height / chart.rows;
    for (let row = 0; row < chart.rows; row += 1) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(toWorld(chart.width), toWorld(rowHeight)),
        basicMaterial(row % 2 === 0 ? dark : light),
      );
      line.name = `${chart.semanticName}-line-${row + 1}`;
      line.position.y = toWorld(-chart.height / 2 + rowHeight / 2 + row * rowHeight);
      chartGroup.add(line);
    }
    return;
  }

  const cellWidth = chart.width / chart.columns;
  const cellHeight = chart.height / chart.rows;
  for (let column = 0; column < chart.columns; column += 1) {
    for (let row = 0; row < chart.rows; row += 1) {
      const cell = new THREE.Mesh(
        new THREE.PlaneGeometry(toWorld(cellWidth), toWorld(cellHeight)),
        basicMaterial((column + row) % 2 === 0 ? dark : light),
      );
      cell.name = `${chart.semanticName}-cell-${column + 1}-${row + 1}`;
      cell.position.set(
        toWorld(-chart.width / 2 + cellWidth / 2 + column * cellWidth),
        toWorld(-chart.height / 2 + cellHeight / 2 + row * cellHeight),
        0,
      );
      chartGroup.add(cell);
    }
  }
};

const createStation = (subject: ShelfSwingSubjectDefinition): THREE.Group => {
  const station = new THREE.Group();
  station.name = subject.semanticName;
  station.position.set(
    toWorld(subject.worldPosition.x),
    toWorld(subject.worldPosition.y),
    toWorld(subject.worldPosition.z),
  );
  station.rotation.y = degreesToRadians(subject.yawDeg);
  station.userData = {
    focusTargetId: subject.id,
    focusProbeWorldMm: { ...subject.focusDetailProbeWorld },
  };

  const { frameThickness, backingThickness, chartBackingGap, shelfThickness } =
    geometry.detailGeometry;
  const chart = subject.focusChart;
  const frameMaterial = standardMaterial(subject.materialHints.primary, 0.82);
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(chart.width + frameThickness * 2),
      toWorld(chart.height + frameThickness * 2),
      toWorld(backingThickness),
    ),
    standardMaterial(subject.materialHints.secondary, 0.94),
  );
  backing.name = `${subject.semanticName}-chart-backing`;
  // The chart and semantic samples stay on the canonical subject plane. Only
  // the physical backing moves behind it to avoid coplanar WebGL rendering.
  backing.position.set(
    toWorld(chart.centerLocal.x),
    toWorld(chart.centerLocal.y),
    toWorld(chart.centerLocal.z + chartBackingGap + backingThickness / 2),
  );
  station.add(backing);

  for (const xSign of [-1, 1]) {
    const upright = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(frameThickness),
        toWorld(subject.dimensions.height),
        toWorld(subject.dimensions.depth),
      ),
      frameMaterial,
    );
    upright.name = `${subject.semanticName}-${xSign < 0 ? "left" : "right"}-frame`;
    upright.position.set(
      toWorld((xSign * (subject.dimensions.width - frameThickness)) / 2),
      toWorld(subject.dimensions.height / 2),
      toWorld(subject.dimensions.depth / 2),
    );
    station.add(upright);
  }

  for (const y of [shelfThickness / 2, subject.dimensions.height - shelfThickness / 2]) {
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(subject.dimensions.width - frameThickness * 2),
        toWorld(shelfThickness),
        toWorld(subject.dimensions.depth),
      ),
      frameMaterial,
    );
    shelf.name = `${subject.semanticName}-shelf-${y < subject.dimensions.height / 2 ? "lower" : "upper"}`;
    shelf.position.set(0, toWorld(y), toWorld(subject.dimensions.depth / 2));
    station.add(shelf);
  }

  subject.displayObjects.forEach((definition) => {
    const objectGeometry =
      definition.shape === "cylinder"
        ? new THREE.CylinderGeometry(
            toWorld(definition.dimensions.x / 2),
            toWorld(definition.dimensions.z / 2),
            toWorld(definition.dimensions.y),
            24,
          )
        : new THREE.BoxGeometry(
            toWorld(definition.dimensions.x),
            toWorld(definition.dimensions.y),
            toWorld(definition.dimensions.z),
          );
    const displayObject = new THREE.Mesh(objectGeometry, standardMaterial(definition.color, 0.74));
    displayObject.name = `${subject.semanticName}-object-${definition.id}`;
    displayObject.position.set(
      toWorld(definition.localPosition.x),
      toWorld(definition.localPosition.y),
      toWorld(definition.localPosition.z),
    );
    station.add(displayObject);
  });

  const chartGroup = new THREE.Group();
  chartGroup.name = chart.semanticName;
  chartGroup.position.set(
    toWorld(chart.centerLocal.x),
    toWorld(chart.centerLocal.y),
    toWorld(chart.centerLocal.z),
  );
  // PlaneGeometry faces +Z by default; turn the chart face toward the lens at
  // the world origin while retaining the canonical station orientation.
  chartGroup.rotation.y = Math.PI;
  chartGroup.userData = {
    focusTargetId: subject.id,
    focusChartPattern: chart.pattern,
    focusChartSurfaceWorldMm: { ...subject.focusDetailProbeWorld },
  };
  addChartTiles(chartGroup, subject);
  station.add(chartGroup);

  const focusProbe = new THREE.Object3D();
  focusProbe.name = subject.focusProbeSemanticName;
  focusProbe.position.set(
    toWorld(subject.focusProbeLocalPosition.x),
    toWorld(subject.focusProbeLocalPosition.y),
    toWorld(subject.focusProbeLocalPosition.z),
  );
  focusProbe.userData = {
    focusTargetId: subject.id,
    focusProbeWorldMm: { ...subject.focusDetailProbeWorld },
  };
  station.add(focusProbe);

  subject.focusSamples.forEach((sample) => {
    const sampleNode = new THREE.Object3D();
    sampleNode.name = `${subject.semanticName}-focus-sample-${sample.id}`;
    sampleNode.position.set(
      toWorld(sample.localPosition.x),
      toWorld(sample.localPosition.y),
      toWorld(sample.localPosition.z),
    );
    sampleNode.userData = {
      focusTargetId: subject.id,
      focusSampleId: sample.id,
      focusSampleWorldMm: { ...sample.worldPosition },
    };
    station.add(sampleNode);
  });

  return station;
};

/** Create the canonical Shelf Swing subject for future R3F and RTT reuse. */
export function createShelfSwingGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "shelf-swing-subject";

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(geometry.floor.width), toWorld(geometry.floor.depth)),
    standardMaterial(geometry.floor.color, 1),
  );
  floorMesh.name = "shelf-swing-floor";
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(
    toWorld(geometry.floor.center.x),
    toWorld(geometry.floor.center.y),
    toWorld(geometry.floor.center.z),
  );
  root.add(floorMesh);

  geometry.subjects.forEach((subject) => root.add(createStation(subject)));
  return root;
}

export function disposeShelfSwingGroup(group: THREE.Group): void {
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

/** React Three Fiber boundary backed by the exact same group factory as future RTT. */
export const ShelfSwingSubject: React.FC = () => {
  const group = useMemo(() => createShelfSwingGroup(), []);

  useEffect(
    () => () => {
      disposeShelfSwingGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
