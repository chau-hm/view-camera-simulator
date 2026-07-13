/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import geometry, { type TableTiltSubjectDefinition } from "../scenes/tableTiltGeometry";
import { toWorld } from "./rttUtils";

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const standardMaterial = (color: string, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const basicMaterial = (color: string) => new THREE.MeshBasicMaterial({ color });

const addCup = (parent: THREE.Group, subject: TableTiltSubjectDefinition) => {
  const { width, height, depth } = subject.dimensions;
  const radius = Math.min(width, depth) / 2;
  const detail = geometry.detailGeometry.cup;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(
      toWorld(radius),
      toWorld(radius * detail.bottomRadiusRatio),
      toWorld(height),
      detail.bodyRadialSegments,
    ),
    standardMaterial(subject.materialHints.primary, 0.72),
  );
  body.name = subject.semanticName;
  body.position.y = toWorld(height / 2);
  parent.add(body);

  const stripeMaterial = basicMaterial(subject.materialHints.detail);
  detail.stripes.anglesDeg.forEach((angleDeg, index) => {
    const angle = degreesToRadians(angleDeg);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(detail.stripes.width),
        toWorld(height * detail.stripes.heightRatio),
        toWorld(detail.stripes.depth),
      ),
      stripeMaterial,
    );
    stripe.name = `${subject.semanticName}-stripe-${index + 1}`;
    stripe.position.set(
      toWorld(Math.sin(angle) * (radius + detail.stripes.surfaceGap)),
      toWorld(height * detail.stripes.centerHeightRatio),
      toWorld(-Math.cos(angle) * (radius + detail.stripes.surfaceGap)),
    );
    stripe.rotation.y = Math.PI - angle;
    parent.add(stripe);
  });

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      toWorld(radius + detail.rim.radiusOffset),
      toWorld(detail.rim.tubeRadius),
      detail.rim.radialSegments,
      detail.rim.tubularSegments,
    ),
    standardMaterial(subject.materialHints.secondary, 0.68),
  );
  rim.name = `${subject.semanticName}-rim`;
  rim.position.y = toWorld(height + detail.rim.heightOffset);
  rim.rotation.x = Math.PI / 2;
  parent.add(rim);

  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(
      toWorld(detail.handle.radius),
      toWorld(detail.handle.tubeRadius),
      detail.handle.radialSegments,
      detail.handle.tubularSegments,
    ),
    standardMaterial(subject.materialHints.primary, 0.72),
  );
  handle.name = `${subject.semanticName}-handle`;
  handle.position.set(
    toWorld(radius + detail.handle.centerXOffsetFromBodyRadius),
    toWorld(height * detail.handle.centerHeightRatio),
    0,
  );
  parent.add(handle);
};

const addNotebook = (parent: THREE.Group, subject: TableTiltSubjectDefinition) => {
  const { width, height, depth } = subject.dimensions;
  const detail = geometry.detailGeometry.notebook;
  const pageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(width - detail.pageInset * 2),
      toWorld(height - detail.pageHeightReduction),
      toWorld(depth - detail.pageInset * 2),
    ),
    standardMaterial(subject.materialHints.secondary, 0.96),
  );
  pageBlock.position.y = toWorld(height / 2);
  parent.add(pageBlock);

  const coverMaterial = standardMaterial(subject.materialHints.primary, 0.78);
  const bottomCover = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(width), toWorld(detail.coverThickness), toWorld(depth)),
    coverMaterial,
  );
  bottomCover.position.y = toWorld(detail.coverThickness / 2);
  parent.add(bottomCover);

  const topCover = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(width), toWorld(detail.coverThickness), toWorld(depth)),
    coverMaterial,
  );
  topCover.name = subject.semanticName;
  topCover.position.y = toWorld(height - detail.coverThickness / 2);
  parent.add(topCover);

  const panel = detail.focusPanel;
  const panelCenterZ = -depth / 2 - panel.frontGap - panel.thickness / 2;
  const focusPanel = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(panel.width), toWorld(panel.height), toWorld(panel.thickness)),
    standardMaterial(subject.materialHints.secondary, 0.9),
  );
  focusPanel.name = `${subject.semanticName}-line-pattern-surface`;
  focusPanel.position.set(0, toWorld(panel.centerHeight), toWorld(panelCenterZ));
  parent.add(focusPanel);

  const lineMaterial = basicMaterial(subject.materialHints.detail);
  for (let index = 0; index < panel.lineCount; index += 1) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(panel.width * panel.lineWidthRatio),
        toWorld(panel.lineHeight),
        toWorld(panel.lineDepth),
      ),
      lineMaterial,
    );
    line.name = `${subject.semanticName}-line-${index + 1}`;
    line.position.set(
      0,
      toWorld(
        panel.centerHeight - panel.height / 2 +
          ((index + 1) * panel.height) / (panel.lineCount + 1),
      ),
      toWorld(panelCenterZ - panel.thickness / 2 - panel.lineGap - panel.lineDepth / 2),
    );
    parent.add(line);
  }

  const binding = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(detail.binding.width),
      toWorld(detail.binding.height),
      toWorld(depth * detail.binding.depthRatio),
    ),
    basicMaterial("#111827"),
  );
  binding.name = `${subject.semanticName}-binding`;
  binding.position.set(
    toWorld(-width / 2 + detail.binding.insetFromLeftEdge),
    toWorld(height + detail.binding.centerOffsetAboveTop),
    0,
  );
  parent.add(binding);
};

const addBook = (parent: THREE.Group, subject: TableTiltSubjectDefinition) => {
  const { width, height, depth } = subject.dimensions;
  const detail = geometry.detailGeometry.book;
  const pageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(width - detail.pageHorizontalInset * 2),
      toWorld(height - detail.pageHeightReduction),
      toWorld(depth - detail.pageDepthInset * 2),
    ),
    standardMaterial(subject.materialHints.secondary, 0.98),
  );
  pageBlock.position.y = toWorld(height / 2);
  parent.add(pageBlock);

  const coverMaterial = standardMaterial(subject.materialHints.primary, 0.8);
  const bottomCover = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(width), toWorld(detail.coverThickness), toWorld(depth)),
    coverMaterial,
  );
  bottomCover.position.y = toWorld(detail.coverThickness / 2);
  parent.add(bottomCover);

  const topCover = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(width), toWorld(detail.coverThickness), toWorld(depth)),
    coverMaterial,
  );
  topCover.name = subject.semanticName;
  topCover.position.y = toWorld(height - detail.coverThickness / 2);
  parent.add(topCover);

  const chart = detail.focusChart;
  const chartCenterZ = -depth / 2 - chart.frontGap - chart.thickness / 2;
  const chartPanel = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(chart.width), toWorld(chart.height), toWorld(chart.thickness)),
    standardMaterial(subject.materialHints.secondary, 0.9),
  );
  chartPanel.name = `${subject.semanticName}-focus-chart-surface`;
  chartPanel.position.set(0, toWorld(chart.centerHeight), toWorld(chartCenterZ));
  parent.add(chartPanel);

  const chartWidth = chart.width;
  const chartHeight = chart.height;
  const columns = detail.focusChart.columns;
  const rows = detail.focusChart.rows;
  const cellWidth = chartWidth / columns;
  const cellHeight = chartHeight / rows;
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(
          toWorld(cellWidth),
          toWorld(cellHeight),
          toWorld(chart.cellDepth),
        ),
        basicMaterial((column + row) % 2 === 0 ? subject.materialHints.detail : "#f8fafc"),
      );
      cell.name = `${subject.semanticName}-chart-${column}-${row}`;
      cell.position.set(
        toWorld(-chartWidth / 2 + cellWidth / 2 + column * cellWidth),
        toWorld(-chartHeight / 2 + cellHeight / 2 + row * cellHeight + chart.centerHeight),
        toWorld(chartCenterZ - chart.thickness / 2 - chart.cellGap - chart.cellDepth / 2),
      );
      parent.add(cell);
    }
  }
};

const createSemanticSubject = (subject: TableTiltSubjectDefinition): THREE.Group => {
  const surfaceAnchor = new THREE.Group();
  surfaceAnchor.name = `${subject.semanticName}-anchor`;
  surfaceAnchor.position.set(
    toWorld(subject.worldPosition.x),
    toWorld(subject.worldPosition.y),
    toWorld(subject.worldPosition.z),
  );
  surfaceAnchor.rotation.x = geometry.tabletop.tiltAngleRad;
  surfaceAnchor.userData = {
    focusTargetId: subject.id,
    focusAnchorWorldMm: { ...subject.focusAnchorWorld },
  };

  const yawGroup = new THREE.Group();
  yawGroup.name = `${subject.semanticName}-orientation`;
  yawGroup.rotation.y = degreesToRadians(subject.yawDeg);
  surfaceAnchor.add(yawGroup);

  if (subject.id === "near-cup") addCup(yawGroup, subject);
  if (subject.id === "mid-notebook") addNotebook(yawGroup, subject);
  if (subject.id === "far-book") addBook(yawGroup, subject);

  // A semantic, non-rendering node marks the exact visible detail surface used
  // by optics evaluation. RTT and R3F share this same object hierarchy.
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
  yawGroup.add(focusProbe);

  return surfaceAnchor;
};

/** Create the canonical Table Tilt subject for future offscreen RTT use. */
export function createTableTiltGroup(): THREE.Group {
  const root = new THREE.Group();
  root.name = "table-tilt-subject";

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(geometry.floor.width), toWorld(geometry.floor.depth)),
    standardMaterial(geometry.floor.color, 1),
  );
  floorMesh.name = "table-tilt-floor";
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(
    toWorld(geometry.floor.center.x),
    toWorld(geometry.floor.center.y),
    toWorld(geometry.floor.center.z),
  );
  root.add(floorMesh);

  const tabletopAssembly = new THREE.Group();
  tabletopAssembly.name = "table-tilt-tabletop-assembly";
  tabletopAssembly.position.set(
    toWorld(geometry.tabletop.center.x),
    toWorld(geometry.tabletop.center.y),
    toWorld(geometry.tabletop.center.z),
  );
  tabletopAssembly.rotation.x = geometry.tabletop.tiltAngleRad;

  const tabletopMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      toWorld(geometry.tabletop.width),
      toWorld(geometry.tabletop.thickness),
      toWorld(geometry.tabletop.depth),
    ),
    standardMaterial(geometry.tabletop.color, 0.82),
  );
  tabletopMesh.name = "table-tilt-tabletop";
  tabletopAssembly.add(tabletopMesh);

  const edgeMaterial = basicMaterial(geometry.tabletop.edgeColor);
  const guideDefinition = geometry.detailGeometry.tabletopGuides;
  for (let index = 0; index < guideDefinition.count; index += 1) {
    const guideMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(guideDefinition.width),
        toWorld(guideDefinition.height),
        toWorld(geometry.tabletop.depth - guideDefinition.edgeMargin * 2),
      ),
      edgeMaterial,
    );
    guideMesh.name = `table-tilt-tabletop-guide-${index + 1}`;
    guideMesh.position.set(
      toWorld(
        -geometry.tabletop.width / 2 +
          ((index + 1) * geometry.tabletop.width) / (guideDefinition.count + 1),
      ),
      toWorld(
        geometry.tabletop.thickness / 2 + guideDefinition.surfaceGap + guideDefinition.height / 2,
      ),
      0,
    );
    tabletopAssembly.add(guideMesh);
  }
  root.add(tabletopAssembly);

  geometry.tableSupports.forEach((support) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(support.width),
        toWorld(support.height),
        toWorld(support.depth),
      ),
      standardMaterial(support.color, 0.92),
    );
    leg.name = `table-tilt-support-${support.id}`;
    leg.position.set(
      toWorld(support.center.x),
      toWorld(support.center.y),
      toWorld(support.center.z),
    );
    root.add(leg);
  });

  geometry.subjects.forEach((subject) => root.add(createSemanticSubject(subject)));

  return root;
}

export function disposeTableTiltGroup(group: THREE.Group): void {
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

/** React Three Fiber boundary backed by the exact same group factory as RTT. */
export const TableTiltSubject: React.FC = () => {
  const group = useMemo(() => createTableTiltGroup(), []);

  useEffect(
    () => () => {
      disposeTableTiltGroup(group);
    },
    [group],
  );

  return <primitive object={group} dispose={null} />;
};
