import * as THREE from "three";
import type { TableTiltSubjectDefinition } from "../scenes/tableTiltGeometry";
import type { TableTiltPresentation } from "../scenes/presentation/tableTilt";
import { resolveTableTiltMaterialVariations } from "../scenes/tableTiltMaterialVariation";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import { toWorld } from "./rttUtils";
import { createProceduralSurfaceMaterial } from "./ProceduralSurfaceMaterials";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import { ceramicGlaze, cupShell, easedBox, paperEdges, recessedTray } from "./table-tilt/TableTiltFinishes";
import {
  createTableTiltStudioEnvironment,
  createTableTiltStudioFloorMaterial,
} from "./table-tilt/TableTiltStudioEnvironment";

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const standardMaterial = (color: string, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

const basicMaterial = (color: string) => new THREE.MeshBasicMaterial({ color });

const addCup = (
  parent: THREE.Group,
  subject: TableTiltSubjectDefinition,
  presentation: TableTiltPresentation,
) => {
  const { width, height, depth } = subject.dimensions;
  const radius = Math.min(width, depth) / 2;
  const detail = presentation.geometry.detailGeometry.cup;
  const glaze = ceramicGlaze();
  const body = new THREE.Mesh(cupShell(radius, height, detail.bodyRadialSegments), glaze);
  body.name = subject.semanticName;
  parent.add(body);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(toWorld(radius - 2.8), toWorld(2.8), 8, 40),
    standardMaterial("#eddbc4", 0.52),
  );
  rim.name = `${subject.semanticName}-rim`;
  rim.position.y = toWorld(height - 3);
  rim.rotation.x = Math.PI / 2;
  parent.add(rim);

  const handlePath = new THREE.CatmullRomCurve3([
    [radius - 7, 138], [radius + 30, 144], [radius + 65, 122],
    [radius + 73, 87], [radius + 51, 50], [radius - 14, 55],
  ].map(([x, y]) => new THREE.Vector3(toWorld(x), toWorld(y), 0)));
  const handleMaterial = glaze.clone();
  handleMaterial.vertexColors = false;
  handleMaterial.color.set("#e9d7bd");
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handlePath, 24, toWorld(11), 8), handleMaterial);
  handle.name = `${subject.semanticName}-handle`;
  parent.add(handle);

  const card = detail.focusCard;
  const focusCard = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(card.width), toWorld(card.thickness), toWorld(card.depth)),
    standardMaterial(subject.materialHints.secondary, 0.9),
  );
  focusCard.name = `${subject.semanticName}-focus-card-surface`;
  focusCard.position.set(0, toWorld(card.centerHeight), toWorld(card.centerZ));
  parent.add(focusCard);

  const cardBottom = card.centerHeight - card.thickness / 2;
  for (const x of [-card.width * 0.4, card.width * 0.4]) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(card.supportWidth),
        toWorld(cardBottom),
        toWorld(card.supportWidth),
      ),
      standardMaterial(subject.materialHints.primary, 0.82),
    );
    support.name = `${subject.semanticName}-focus-card-support`;
    support.position.set(toWorld(x), toWorld(cardBottom / 2), toWorld(card.centerZ));
    parent.add(support);
  }

  const bandDepth = card.depth / card.bandCount;
  const bandGeometry = new THREE.BoxGeometry(
    toWorld(card.width * 0.86), toWorld(card.bandThickness), toWorld(bandDepth * 0.56),
  );
  const bandMaterials = [basicMaterial(subject.materialHints.detail), basicMaterial("#1e3a8a")];
  for (let index = 0; index < card.bandCount; index += 1) {
    const band = new THREE.Mesh(
      bandGeometry,
      bandMaterials[index % 2],
    );
    band.name = `${subject.semanticName}-focus-card-band-${index + 1}`;
    band.position.set(
      0,
      toWorld(card.centerHeight + card.thickness / 2 + card.bandGap + card.bandThickness / 2),
      toWorld(card.centerZ - card.depth / 2 + bandDepth / 2 + index * bandDepth),
    );
    parent.add(band);
  }

  const fineBands = card.fineBands;
  const fineBandDepth = card.depth / fineBands.count;
  const fineBandGeometry = new THREE.BoxGeometry(
    toWorld(card.width * fineBands.widthRatio), toWorld(fineBands.thickness),
    toWorld(fineBandDepth * fineBands.depthRatio),
  );
  const fineBandMaterials = [basicMaterial("#f8fafc"), bandMaterials[0]];
  for (let index = 0; index < fineBands.count; index += 1) {
    const band = new THREE.Mesh(
      fineBandGeometry,
      fineBandMaterials[index % 2],
    );
    band.name = `${subject.semanticName}-focus-card-fine-band-${index + 1}`;
    band.position.set(
      0,
      toWorld(card.centerHeight + card.thickness / 2 + fineBands.surfaceGap + fineBands.thickness / 2),
      toWorld(card.centerZ - card.depth / 2 + fineBandDepth / 2 + index * fineBandDepth),
    );
    parent.add(band);
  }
};

const addNotebook = (
  parent: THREE.Group,
  subject: TableTiltSubjectDefinition,
  presentation: TableTiltPresentation,
) => {
  const { width, height, depth } = subject.dimensions;
  const detail = presentation.geometry.detailGeometry.notebook;
  const paperMaterial = createProceduralSurfaceMaterial({
    pattern: "paper", color: "#eee2cc", repeat: [3, 1], roughness: 0.94, normalStrength: 0.24,
  });
  paperMaterial.vertexColors = true;
  const pageBlock = new THREE.Mesh(
    paperEdges(width - detail.pageInset * 2, height - detail.pageHeightReduction, depth - detail.pageInset * 2, 9),
    paperMaterial,
  );
  pageBlock.name = `${subject.semanticName}-pages`;
  pageBlock.position.y = toWorld(height / 2);
  parent.add(pageBlock);

  const coverMaterial = createProceduralSurfaceMaterial({
    pattern: "fabric", color: "#aaa084", repeat: [3, 2], roughness: 0.89, normalStrength: 0.42,
  });
  const coverGeometry = easedBox(width, detail.coverThickness, depth, 1.5);
  const bottomCover = new THREE.Mesh(
    coverGeometry,
    coverMaterial,
  );
  bottomCover.position.y = toWorld(detail.coverThickness / 2);
  parent.add(bottomCover);

  const topCover = new THREE.Mesh(
    coverGeometry,
    coverMaterial,
  );
  topCover.name = subject.semanticName;
  topCover.position.y = toWorld(height - detail.coverThickness / 2);
  parent.add(topCover);

  const panel = detail.focusPanel;
  const focusPanel = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(panel.width), toWorld(panel.thickness), toWorld(panel.depth)),
    standardMaterial(subject.materialHints.secondary, 0.9),
  );
  focusPanel.name = `${subject.semanticName}-line-pattern-surface`;
  focusPanel.position.set(0, toWorld(panel.centerHeight), 0);
  parent.add(focusPanel);

  const panelBottom = panel.centerHeight - panel.thickness / 2;
  const supportHeight = Math.max(0, panelBottom - height);
  const holderMaterial = standardMaterial("#9c7755", 0.85);
  for (const x of [-panel.width * 0.4, panel.width * 0.4]) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(panel.supportWidth),
        toWorld(supportHeight),
        toWorld(panel.supportWidth),
      ),
      holderMaterial,
    );
    support.name = `${subject.semanticName}-focus-panel-support`;
    support.position.set(toWorld(x), toWorld(height + supportHeight / 2), 0);
    parent.add(support);
  }

  const lineMaterial = basicMaterial(subject.materialHints.detail);
  const lineGeometry = new THREE.BoxGeometry(
    toWorld(panel.width * panel.lineWidthRatio), toWorld(panel.lineThickness), toWorld(panel.lineDepth),
  );
  for (let index = 0; index < panel.lineCount; index += 1) {
    const line = new THREE.Mesh(
      lineGeometry,
      lineMaterial,
    );
    line.name = `${subject.semanticName}-line-${index + 1}`;
    line.position.set(
      0,
      toWorld(panel.centerHeight + panel.thickness / 2 + panel.lineGap + panel.lineThickness / 2),
      toWorld(
        -panel.depth / 2 +
          ((index + 1) * panel.depth) / (panel.lineCount + 1),
      ),
    );
    parent.add(line);
  }

  const fineLines = panel.fineLines;
  const fineLineMaterial = basicMaterial("#b45309");
  const fineLineGeometry = new THREE.BoxGeometry(
    toWorld(fineLines.width), toWorld(fineLines.thickness), toWorld(fineLines.depth),
  );
  for (let index = 0; index < fineLines.count; index += 1) {
    const line = new THREE.Mesh(
      fineLineGeometry,
      fineLineMaterial,
    );
    line.name = `${subject.semanticName}-fine-line-${index + 1}`;
    line.position.set(
      toWorld(fineLines.centerX),
      toWorld(panel.centerHeight + panel.thickness / 2 + fineLines.surfaceGap + fineLines.thickness / 2),
      toWorld(-panel.depth / 2 + ((index + 1) * panel.depth) / (fineLines.count + 1)),
    );
    parent.add(line);
  }

  const binding = new THREE.Mesh(easedBox(16, height, depth - 3, 3), coverMaterial);
  binding.name = `${subject.semanticName}-binding`;
  binding.position.set(toWorld(-width / 2 + 8), toWorld(height / 2), 0);
  parent.add(binding);

  // Keep the elevated card and both canonical posts. The inset wooden saddle
  // makes the posts read as part of a small holder when seen from the side.
  const saddle = new THREE.Mesh(
    easedBox(panel.width * 0.7, supportHeight, 19, 3),
    holderMaterial,
  );
  saddle.name = `${subject.semanticName}-card-holder`;
  saddle.position.y = toWorld(height + supportHeight / 2);
  parent.add(saddle);
};

const addBook = (
  parent: THREE.Group,
  subject: TableTiltSubjectDefinition,
  presentation: TableTiltPresentation,
) => {
  const { width, height, depth } = subject.dimensions;
  const detail = presentation.geometry.detailGeometry.book;
  const paperMaterial = createProceduralSurfaceMaterial({
    pattern: "paper", color: "#ded2bf", repeat: [3, 1], roughness: 0.94, normalStrength: 0.24,
  });
  paperMaterial.vertexColors = true;
  const pageBlock = new THREE.Mesh(
    paperEdges(width - detail.pageHorizontalInset * 2, height - detail.pageHeightReduction, depth - detail.pageDepthInset * 2, 21),
    paperMaterial,
  );
  pageBlock.name = `${subject.semanticName}-pages`;
  pageBlock.position.y = toWorld(height / 2);
  parent.add(pageBlock);

  const coverMaterial = createProceduralSurfaceMaterial({
    pattern: "fabric", color: "#34414c", repeat: [3, 2], roughness: 0.89, normalStrength: 0.42,
  });
  const coverGeometry = easedBox(width, detail.coverThickness, depth, 1.5);
  const bottomCover = new THREE.Mesh(
    coverGeometry,
    coverMaterial,
  );
  bottomCover.position.y = toWorld(detail.coverThickness / 2);
  parent.add(bottomCover);

  const topCover = new THREE.Mesh(
    coverGeometry,
    coverMaterial,
  );
  topCover.name = subject.semanticName;
  topCover.position.y = toWorld(height - detail.coverThickness / 2);
  parent.add(topCover);

  const spine = new THREE.Mesh(easedBox(19, height, depth - 2, 5), coverMaterial);
  spine.name = `${subject.semanticName}-spine`;
  spine.position.set(toWorld(-width / 2 + 9.5), toWorld(height / 2), 0);
  parent.add(spine);

  const chart = detail.focusChart;
  const chartPanel = new THREE.Mesh(
    new THREE.BoxGeometry(toWorld(chart.width), toWorld(chart.thickness), toWorld(chart.depth)),
    standardMaterial(subject.materialHints.secondary, 0.9),
  );
  chartPanel.name = `${subject.semanticName}-focus-chart-surface`;
  chartPanel.position.set(0, toWorld(chart.centerHeight), 0);
  parent.add(chartPanel);

  const chartBottom = chart.centerHeight - chart.thickness / 2;
  const supportHeight = Math.max(0, chartBottom - height);
  for (const x of [-chart.width * 0.4, chart.width * 0.4]) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(
        toWorld(chart.supportWidth),
        toWorld(supportHeight),
        toWorld(chart.supportWidth),
      ),
      standardMaterial(subject.materialHints.primary, 0.82),
    );
    support.name = `${subject.semanticName}-focus-chart-support`;
    support.position.set(toWorld(x), toWorld(height + supportHeight / 2), 0);
    parent.add(support);
  }

  const chartWidth = chart.width;
  const chartDepth = chart.depth;
  const columns = detail.focusChart.columns;
  const rows = detail.focusChart.rows;
  const cellWidth = chartWidth / columns;
  const cellDepth = chartDepth / rows;
  const cellGeometry = new THREE.BoxGeometry(toWorld(cellWidth), toWorld(chart.cellThickness), toWorld(cellDepth));
  const checkerMaterials = [basicMaterial(subject.materialHints.detail), basicMaterial("#f8fafc")];
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cell = new THREE.Mesh(
        cellGeometry,
        checkerMaterials[(column + row) % 2],
      );
      cell.name = `${subject.semanticName}-chart-${column}-${row}`;
      cell.position.set(
        toWorld(-chartWidth / 2 + cellWidth / 2 + column * cellWidth),
        toWorld(chart.centerHeight + chart.thickness / 2 + chart.cellGap + chart.cellThickness / 2),
        toWorld(-chartDepth / 2 + cellDepth / 2 + row * cellDepth),
      );
      parent.add(cell);
    }
  }

  const fineGrid = chart.fineGrid;
  const fineCellWidth = fineGrid.width / fineGrid.columns;
  const fineCellDepth = fineGrid.depth / fineGrid.rows;
  const fineCellGeometry = new THREE.BoxGeometry(
    toWorld(fineCellWidth - fineGrid.cellGap), toWorld(fineGrid.cellThickness),
    toWorld(fineCellDepth - fineGrid.cellGap),
  );
  for (let column = 0; column < fineGrid.columns; column += 1) {
    for (let row = 0; row < fineGrid.rows; row += 1) {
      const cell = new THREE.Mesh(
        fineCellGeometry,
        checkerMaterials[(column + row) % 2],
      );
      cell.name = `${subject.semanticName}-fine-grid-${column + 1}-${row + 1}`;
      cell.position.set(
        toWorld(fineGrid.centerX - fineGrid.width / 2 + fineCellWidth / 2 + column * fineCellWidth),
        toWorld(chart.centerHeight + chart.thickness / 2 + fineGrid.cellGap + fineGrid.cellThickness / 2),
        toWorld(fineGrid.centerZ - fineGrid.depth / 2 + fineCellDepth / 2 + row * fineCellDepth),
      );
      parent.add(cell);
    }
  }
};

const createSemanticSubject = (
  subject: TableTiltSubjectDefinition,
  presentation: TableTiltPresentation,
): THREE.Group => {
  const surfaceAnchor = new THREE.Group();
  surfaceAnchor.name = `${subject.semanticName}-anchor`;
  surfaceAnchor.position.set(
    toWorld(subject.worldPosition.x),
    toWorld(subject.worldPosition.y),
    toWorld(subject.worldPosition.z),
  );
  surfaceAnchor.rotation.x = presentation.geometry.tabletop.tiltAngleRad;
  surfaceAnchor.userData = {
    focusTargetId: subject.id,
    focusAnchorWorldMm: { ...subject.focusAnchorWorld },
  };

  const yawGroup = new THREE.Group();
  yawGroup.name = `${subject.semanticName}-orientation`;
  yawGroup.rotation.y = degreesToRadians(subject.yawDeg);
  surfaceAnchor.add(yawGroup);

  if (subject.id === "near-cup") addCup(yawGroup, subject, presentation);
  if (subject.id === "mid-notebook") addNotebook(yawGroup, subject, presentation);
  if (subject.id === "far-book") addBook(yawGroup, subject, presentation);

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
    yawGroup.add(sampleNode);
  });

  return surfaceAnchor;
};

const addTableTiltContext = (
  root: THREE.Group,
  presentation: TableTiltPresentation,
  frameMaterial: THREE.MeshStandardMaterial,
  woodMaterial: THREE.MeshStandardMaterial,
  contextAccentMaterial: THREE.MeshStandardMaterial = frameMaterial,
): void => {
  const { geometry } = presentation;
  const context = new THREE.Group();
  context.name = "table-tilt-context-structure";

  const tableStructure = new THREE.Group();
  tableStructure.name = "table-tilt-table-structure";
  tableStructure.position.set(
    toWorld(geometry.tabletop.center.x),
    toWorld(geometry.tabletop.center.y),
    toWorld(geometry.tabletop.center.z),
  );
  tableStructure.rotation.x = geometry.tabletop.tiltAngleRad;
  const [nearSupport, , farSupport] = geometry.tableSupports;
  const apronGeometry = easedBox(Math.abs(nearSupport.localX) * 2, 135, 76, 6);
  const railGeometry = easedBox(76, 135, farSupport.localDepth - nearSupport.localDepth, 6);
  const jointHeight = -geometry.tabletop.thickness / 2 - 65;
  for (const sign of [-1, 1]) {
    const apron = new THREE.Mesh(apronGeometry, frameMaterial);
    apron.name = `table-tilt-apron-${sign < 0 ? "near" : "far"}`;
    apron.position.set(0, toWorld(jointHeight), toWorld(sign * farSupport.localDepth));
    tableStructure.add(apron);

    const rail = new THREE.Mesh(railGeometry, frameMaterial);
    rail.name = `table-tilt-side-rail-${sign < 0 ? "left" : "right"}`;
    rail.position.set(toWorld(sign * farSupport.localX), toWorld(jointHeight), 0);
    tableStructure.add(rail);
  }
  const crossbar = new THREE.Mesh(easedBox(1900, 80, 76, 5), frameMaterial);
  crossbar.name = "table-tilt-underframe-crossbar";
  crossbar.position.set(0, toWorld(jointHeight), 0);
  tableStructure.add(crossbar);
  context.add(tableStructure);

  const addLocalBox = ({
    name,
    localX,
    localDepth,
    width,
    height,
    depth,
    material,
    createGeometry = easedBox,
  }: {
    name: string;
    localX: number;
    localDepth: number;
    width: number;
    height: number;
    depth: number;
    material: THREE.Material;
    createGeometry?: (width: number, height: number, depth: number, radius: number) => THREE.BufferGeometry;
  }) => {
    const position = geometry.tabletopLocalToWorld({
      localX,
      localDepth,
      verticalOffsetMm: height / 2,
    });
    const mesh = new THREE.Mesh(
      createGeometry(width, height, depth, 7),
      material,
    );
    mesh.name = name;
    mesh.position.set(toWorld(position.x), toWorld(position.y), toWorld(position.z));
    mesh.rotation.x = geometry.tabletop.tiltAngleRad;
    context.add(mesh);
  };

  addLocalBox({
    name: "table-tilt-context-near-tray",
    localX: 760,
    localDepth: -820,
    width: 360,
    height: 70,
    depth: 240,
    material: woodMaterial,
    createGeometry: recessedTray,
  });
  addLocalBox({
    name: "table-tilt-context-middle-canister",
    localX: -720,
    localDepth: 420,
    width: 180,
    height: 97,
    depth: 180,
    material: contextAccentMaterial,
  });
  addLocalBox({
    name: "table-tilt-context-far-block",
    localX: 720,
    localDepth: 1420,
    width: 220,
    height: 44,
    depth: 180,
    material: woodMaterial,
  });

  root.add(context);
};

export type TableTiltAssetRequest = Readonly<{
  presentation: TableTiltPresentation;
  variationDescriptor?: SceneVariationDescriptor;
}>;

/** Create the canonical Table Tilt subject for interactive and RTT use. */
export function createTableTiltGroup(
  request: TableTiltAssetRequest,
): THREE.Group {
  const { presentation } = request;
  const { geometry } = presentation;
  const variations = resolveTableTiltMaterialVariations(request.variationDescriptor);
  const root = new THREE.Group();
  root.name = "table-tilt-subject";

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(toWorld(geometry.floor.width), toWorld(geometry.floor.depth)),
    createTableTiltStudioFloorMaterial(geometry.floor),
  );
  floorMesh.name = "table-tilt-floor";
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(
    toWorld(geometry.floor.center.x),
    toWorld(geometry.floor.center.y),
    toWorld(geometry.floor.center.z),
  );
  root.add(floorMesh, createTableTiltStudioEnvironment(geometry.floor));

  const tabletopAssembly = new THREE.Group();
  tabletopAssembly.name = "table-tilt-tabletop-assembly";
  tabletopAssembly.position.set(
    toWorld(geometry.tabletop.center.x),
    toWorld(geometry.tabletop.center.y),
    toWorld(geometry.tabletop.center.z),
  );
  tabletopAssembly.rotation.x = geometry.tabletop.tiltAngleRad;

  const tabletopWoodMaterial = variations
    ? createProceduralSurfaceMaterial({
        color: variations.tabletopWood.color,
        pattern: "wood",
        repeat: variations.tabletopWood.repeat,
        roughness: variations.tabletopWood.roughness,
        normalStrength: variations.tabletopWood.normalStrength,
        variationSeed: variations.tabletopWood.variationSeed,
      })
    : createProceduralSurfaceMaterial({
        pattern: "wood", color: "#c09264", repeat: [2, 4], roughness: 0.72, normalStrength: 0.37,
      });
  const contextWoodMaterial = variations
    ? createProceduralSurfaceMaterial({
        color: variations.contextWood.color,
        pattern: "wood",
        repeat: variations.contextWood.repeat,
        roughness: variations.contextWood.roughness,
        normalStrength: variations.contextWood.normalStrength,
        variationSeed: variations.contextWood.variationSeed,
      })
    : tabletopWoodMaterial;
  const frameMaterial = variations
    ? standardMaterial(variations.tableFrame.color, variations.tableFrame.roughness)
    : standardMaterial("#4d3b30", 0.84);
  const contextAccentMaterial = variations
    ? standardMaterial(variations.contextAccent.color, variations.contextAccent.roughness)
    : frameMaterial;
  const tabletopGeometry = easedBox(
    geometry.tabletop.width, geometry.tabletop.thickness, geometry.tabletop.depth, 9,
  );
  // Longitudinal grain across the top, matching the existing guide direction.
  const normals = tabletopGeometry.attributes.normal;
  const uv = tabletopGeometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(normals.getY(i)) > 0.5) uv.setXY(i, uv.getY(i), uv.getX(i));
  }
  const tabletopMesh = new THREE.Mesh(tabletopGeometry, tabletopWoodMaterial);
  tabletopMesh.name = "table-tilt-tabletop";
  tabletopAssembly.add(tabletopMesh);

  const edgeMaterial = standardMaterial("#ba8b5d", 0.77);
  const guideDefinition = geometry.detailGeometry.tabletopGuides;
  const guideGeometry = new THREE.BoxGeometry(
    toWorld(guideDefinition.width), toWorld(guideDefinition.height),
    toWorld(geometry.tabletop.depth - guideDefinition.edgeMargin * 2),
  );
  for (let index = 0; index < guideDefinition.count; index += 1) {
    const guideMesh = new THREE.Mesh(guideGeometry, edgeMaterial);
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

  addTableTiltContext(root, presentation, frameMaterial, contextWoodMaterial, contextAccentMaterial);

  const referenceLeg = geometry.tableSupports[0];
  const legGeometry = easedBox(referenceLeg.width, referenceLeg.height, referenceLeg.depth, 7);
  geometry.tableSupports.forEach((support) => {
    const leg = new THREE.Mesh(legGeometry, frameMaterial);
    leg.name = `table-tilt-support-${support.id}`;
    leg.position.set(
      toWorld(support.center.x),
      toWorld(support.center.y),
      toWorld(support.center.z),
    );
    root.add(leg);
  });

  geometry.subjects.forEach((subject) =>
    root.add(createSemanticSubject(subject, presentation)),
  );

  return root;
}

export function disposeTableTiltGroup(group: THREE.Group): void {
  disposeTeachingSubjectResources(group);
}
