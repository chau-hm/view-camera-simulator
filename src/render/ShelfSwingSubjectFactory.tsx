import * as THREE from "three";
import type { ShelfSwingSubjectDefinition } from "../scenes/shelfSwingGeometry";
import type { ShelfSwingPresentation } from "../scenes/presentation/shelfSwing";
import {
  resolveShelfSwingPropVariationPlan,
  type ShelfSwingPropVariation,
  type ShelfSwingStationVariation,
} from "../scenes/shelfSwingPropVariation";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import { toWorld } from "./rttUtils";
import {
  createFocusFriendlyMaterial,
  disposeTeachingSubjectResources,
} from "./TeachingMaterials";

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const standardMaterial = (color: string, roughness = 0.88, flatShading = false) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading });

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

const addComparisonMotif = (
  chartGroup: THREE.Group,
  subject: ShelfSwingSubjectDefinition,
): void => {
  const motif = subject.focusChart.comparisonMotif;
  const motifGroup = new THREE.Group();
  motifGroup.name = `${subject.focusChart.semanticName}-comparison-motif`;
  motifGroup.position.set(
    toWorld(motif.chartLocalCenter.x),
    toWorld(motif.chartLocalCenter.y),
    toWorld(motif.chartLocalCenter.z),
  );
  motifGroup.userData = {
    focusTargetId: subject.id,
    comparisonMotif: {
      widthMm: motif.width,
      heightMm: motif.height,
      rows: motif.rows,
    },
  };

  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(motif.width), toWorld(motif.height), toWorld(motif.backingDepth)),
    basicMaterial(subject.materialHints.secondary),
  );
  backing.name = `${motifGroup.name}-backing`;
  backing.position.z = toWorld(motif.surfaceGap + motif.backingDepth / 2);
  motifGroup.add(backing);

  const barMaterial = basicMaterial(subject.materialHints.detail);
  motif.rows.forEach((row) => {
    const totalWidth = row.count * row.barWidth + (row.count - 1) * row.gap;
    for (let index = 0; index < row.count; index += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(
          toWorld(row.barWidth),
          toWorld(row.barHeight),
          toWorld(motif.barDepth),
        ),
        barMaterial,
      );
      bar.name = `${motifGroup.name}-${row.id}-${index + 1}`;
      bar.position.set(
        toWorld(-totalWidth / 2 + row.barWidth / 2 + index * (row.barWidth + row.gap)),
        toWorld(row.yOffset),
        toWorld(motif.surfaceGap + motif.backingDepth + motif.barDepth / 2),
      );
      motifGroup.add(bar);
    }
  });

  chartGroup.add(motifGroup);
};

const addStationContext = (
  station: THREE.Group,
  subject: ShelfSwingSubjectDefinition,
  presentation: ShelfSwingPresentation,
  frameMaterial: THREE.Material,
): void => {
  const context = new THREE.Group();
  context.name = `${subject.semanticName}-context-structure`;

  const { frameThickness, shelfThickness } = presentation.geometry.detailGeometry;
  const backdrop = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(subject.dimensions.width - frameThickness * 2),
      toWorld(subject.dimensions.height - shelfThickness * 2),
      toWorld(28),
    ),
    frameMaterial,
  );
  backdrop.name = `${subject.semanticName}-backdrop-panel`;
  backdrop.position.set(
    0,
    toWorld(subject.dimensions.height / 2),
    toWorld(subject.dimensions.depth - 14),
  );
  context.add(backdrop);

  const bookMaterials = [
    standardMaterial(subject.materialHints.primary, 0.78),
    standardMaterial(subject.materialHints.secondary, 0.86),
    standardMaterial(subject.materialHints.detail, 0.82),
  ];
  const bookGeometries = [
    new THREE.BoxGeometry(toWorld(58), toWorld(230), toWorld(105)),
    new THREE.BoxGeometry(toWorld(72), toWorld(190), toWorld(112)),
    new THREE.BoxGeometry(toWorld(48), toWorld(270), toWorld(98)),
  ];
  const bookGroup = new THREE.Group();
  bookGroup.name = `${subject.semanticName}-context-books`;

  const bookRows = [
    { y: shelfThickness + 115, z: subject.dimensions.depth * 0.68, rotation: 0 },
    {
      y: subject.dimensions.height - shelfThickness - 145,
      z: subject.dimensions.depth * 0.68,
      rotation: 0.035,
    },
  ];
  bookRows.forEach((row, rowIndex) => {
    for (let index = 0; index < 4; index += 1) {
      const book = new THREE.Mesh(
        bookGeometries[(index + rowIndex) % bookGeometries.length],
        bookMaterials[(index + rowIndex) % bookMaterials.length],
      );
      book.name = `${subject.semanticName}-context-book-${rowIndex + 1}-${index + 1}`;
      book.position.set(
        toWorld(-165 + index * 72),
        toWorld(row.y),
        toWorld(row.z),
      );
      book.rotation.z = row.rotation * (index % 2 === 0 ? 1 : -1);
      bookGroup.add(book);
    }
  });
  context.add(bookGroup);
  station.add(context);
};

const createVariationPropGeometry = (prop: ShelfSwingPropVariation): THREE.BufferGeometry => {
  const { width, height, depth } = prop.dimensionsMm;
  if (prop.family === "box") {
    return new THREE.BoxGeometry(toWorld(width), toWorld(height), toWorld(depth));
  }
  if (prop.family === "cylinder") {
    const radius = toWorld(width / 2);
    return new THREE.CylinderGeometry(radius, radius, toWorld(height), 16);
  }

  if (prop.family === "faceted") {
    const geometry = new THREE.DodecahedronGeometry(0.5, 0);
    geometry.scale(toWorld(width), toWorld(height), toWorld(depth));
    return geometry;
  }

  const radius = Math.min(width, depth) / 2;
  if (prop.family === "bowl") {
    const points = [
      new THREE.Vector2(0, -height / 2),
      new THREE.Vector2(radius * 0.38, -height / 2),
      new THREE.Vector2(radius * 0.66, -height * 0.3),
      new THREE.Vector2(radius * 0.92, -height * 0.02),
      new THREE.Vector2(radius, height * 0.33),
      new THREE.Vector2(radius * 0.9, height / 2),
      new THREE.Vector2(radius * 0.76, height * 0.46),
      new THREE.Vector2(radius * 0.64, height * 0.2),
      new THREE.Vector2(radius * 0.38, -height * 0.08),
      new THREE.Vector2(0, -height * 0.08),
    ].map((point) => new THREE.Vector2(toWorld(point.x), toWorld(point.y)));
    return new THREE.LatheGeometry(points, 16);
  }

  if (prop.family === "necked-vessel") {
    const points = [
      new THREE.Vector2(0, -height / 2),
      new THREE.Vector2(radius * 0.42, -height / 2),
      new THREE.Vector2(radius * 0.72, -height * 0.34),
      new THREE.Vector2(radius, -height * 0.08),
      new THREE.Vector2(radius * 0.94, height * 0.08),
      new THREE.Vector2(radius * 0.52, height * 0.25),
      new THREE.Vector2(radius * 0.3, height * 0.3),
      new THREE.Vector2(radius * 0.3, height * 0.46),
      new THREE.Vector2(radius * 0.42, height / 2),
      new THREE.Vector2(radius * 0.36, height * 0.44),
      new THREE.Vector2(radius * 0.25, height * 0.3),
      new THREE.Vector2(0, height * 0.27),
    ].map((point) => new THREE.Vector2(toWorld(point.x), toWorld(point.y)));
    return new THREE.LatheGeometry(points, 16);
  }

  const points = [
    new THREE.Vector2(0, -height / 2),
    new THREE.Vector2(radius * 0.58, -height / 2),
    new THREE.Vector2(radius * 0.88, -height * 0.3),
    new THREE.Vector2(radius * 0.68, height * 0.18),
    new THREE.Vector2(radius, height * 0.42),
    new THREE.Vector2(radius * 0.9, height / 2),
  ].map((point) => new THREE.Vector2(toWorld(point.x), toWorld(point.y)));
  return new THREE.LatheGeometry(points, 12);
};

const addVariationProps = (
  station: THREE.Group,
  subject: ShelfSwingSubjectDefinition,
  variation: ShelfSwingStationVariation,
): void => {
  variation.props.forEach((prop) => {
    const displayObject = new THREE.Mesh(
      createVariationPropGeometry(prop),
      standardMaterial(prop.palette.body, 0.76, prop.family === "faceted"),
    );
    displayObject.name = `${subject.semanticName}-variation-object-${prop.id}`;
    displayObject.position.set(
      toWorld(prop.positionMm.x),
      toWorld(prop.positionMm.y),
      toWorld(prop.positionMm.z),
    );
    displayObject.rotation.y = degreesToRadians(prop.rotationYDeg);
    displayObject.userData = {
      variationPropId: prop.id,
      family: prop.family,
      dimensionsMm: { ...prop.dimensionsMm },
    };
    station.add(displayObject);
  });
};

const createStation = (
  subject: ShelfSwingSubjectDefinition,
  presentation: ShelfSwingPresentation,
  variation: ShelfSwingStationVariation | undefined,
): THREE.Group => {
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
    presentation.geometry.detailGeometry;
  const chart = subject.focusChart;
  const frameMaterial = standardMaterial(subject.materialHints.primary, 0.82);
  const backingMaterial = createFocusFriendlyMaterial({
    pattern: "fine-grid",
    primaryColor: subject.materialHints.secondary,
    secondaryColor: subject.materialHints.detail,
    repeat: [4, 4],
    roughness: 0.94,
  });
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(chart.width + frameThickness * 2),
      toWorld(chart.height + frameThickness * 2),
      toWorld(backingThickness),
    ),
    backingMaterial,
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

  addStationContext(station, subject, presentation, frameMaterial);

  if (variation) {
    addVariationProps(station, subject, variation);
  } else {
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
  }

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
  addComparisonMotif(chartGroup, subject);
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

export type ShelfSwingAssetRequest = Readonly<{
  presentation: ShelfSwingPresentation;
  variationDescriptor?: SceneVariationDescriptor;
}>;

/** Create a canonical subject or a descriptor-backed Free Practice prop variant. */
export function createShelfSwingGroup(
  request: ShelfSwingAssetRequest,
): THREE.Group {
  const { presentation } = request;
  const { geometry } = presentation;
  const variationPlan = resolveShelfSwingPropVariationPlan(request.variationDescriptor);
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

  geometry.subjects.forEach((subject) => {
    const variation = variationPlan?.stations.find((station) => station.stationId === subject.id);
    root.add(createStation(subject, presentation, variation));
  });
  return root;
}

export function disposeShelfSwingGroup(group: THREE.Group): void {
  disposeTeachingSubjectResources(group);
}
