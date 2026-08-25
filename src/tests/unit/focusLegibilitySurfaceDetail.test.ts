import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createArchitectureRiseGroup } from "../../render/ArchitectureRiseSubjectFactory";
import {
  createShelfSwingGroup,
  disposeShelfSwingGroup,
} from "../../render/ShelfSwingSubjectFactory";
import {
  createTableTiltGroup,
  disposeTableTiltGroup,
} from "../../render/TableTiltSubjectFactory";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import architectureRiseGeometry from "../../scenes/architectureRiseGeometry";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";

const expectFinitePositive = (value: number) => {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
};

describe("focus-legibility surface detail", () => {
  it("defines the Architecture Rise detail panel in finite physical bounds", () => {
    const pieces = architectureRiseGeometry.getArchitectureFacadeFineDetailPieces();

    expect(pieces).toHaveLength(
      1 +
        architectureRiseGeometry.facadeFineDetail.frameColumns +
        architectureRiseGeometry.facadeFineDetail.frameRows +
        architectureRiseGeometry.facadeFineDetail.fineLineCount,
    );
    pieces.forEach((piece) => {
      [piece.x, piece.y, piece.z, piece.width, piece.height, piece.depth].forEach(
        expectFinitePositive,
      );
      expect(piece.x - piece.width / 2).toBeGreaterThanOrEqual(
        -architectureRiseGeometry.building.width / 2,
      );
      expect(piece.x + piece.width / 2).toBeLessThanOrEqual(
        architectureRiseGeometry.building.width / 2,
      );
      expect(piece.y - piece.height / 2).toBeGreaterThanOrEqual(
        architectureRiseGeometry.facade.mainBodyBottomY,
      );
      expect(piece.y + piece.height / 2).toBeLessThanOrEqual(
        architectureRiseGeometry.facade.mainBodyTopY,
      );
      expect(piece.z).toBeLessThan(architectureRiseGeometry.facade.frontFacadeZ);
    });
  });

  it("keeps Table Tilt fine detail attached inside each canonical focus surface", () => {
    const { cup, notebook, book } = tableTiltGeometry.detailGeometry;

    expectFinitePositive(cup.focusCard.fineBands.count);
    expect(cup.focusCard.width * cup.focusCard.fineBands.widthRatio).toBeLessThan(
      cup.focusCard.width,
    );
    expect(cup.focusCard.depth / cup.focusCard.fineBands.count).toBeGreaterThan(
      cup.focusCard.fineBands.depthRatio,
    );

    expect(notebook.focusPanel.fineLines.width).toBeLessThan(notebook.focusPanel.width);
    expect(
      Math.abs(notebook.focusPanel.fineLines.centerX) +
        notebook.focusPanel.fineLines.width / 2,
    ).toBeLessThanOrEqual(notebook.focusPanel.width / 2);
    expect(notebook.focusPanel.fineLines.count).toBeGreaterThan(0);

    expect(book.focusChart.fineGrid.width).toBeLessThan(book.focusChart.width);
    expect(book.focusChart.fineGrid.depth).toBeLessThan(book.focusChart.depth);
    expect(book.focusChart.fineGrid.columns).toBeGreaterThan(1);
    expect(book.focusChart.fineGrid.rows).toBeGreaterThan(1);

    expect(tableTiltScene.focusTargets.map((target) => target.worldPosition)).toEqual(
      tableTiltGeometry.focusTargets.map((target) => target.worldPosition),
    );
    tableTiltGeometry.subjects.forEach((subject) => {
      expect(subject.focusSamples).toHaveLength(5);
      expect(subject.focusDetailProbeWorld).toEqual(subject.focusSamples[0].worldPosition);
    });
  });

  it("uses one identical physical comparison motif for all Shelf Swing stations", () => {
    const motifs = shelfSwingGeometry.subjects.map((subject) => subject.focusChart.comparisonMotif);
    expect(motifs[1]).toEqual(motifs[0]);
    expect(motifs[2]).toEqual(motifs[0]);

    const motif = motifs[0];
    expectFinitePositive(motif.width);
    expectFinitePositive(motif.height);
    motif.rows.forEach((row) => {
      expect(row.count).toBeGreaterThan(1);
      expectFinitePositive(row.barWidth);
      expectFinitePositive(row.gap);
      expectFinitePositive(row.barHeight);
      expect(row.count * row.barWidth + (row.count - 1) * row.gap).toBeLessThanOrEqual(
        motif.width,
      );
    });
    expect(shelfSwingScene.focusTargets.map((target) => target.worldPosition)).toEqual(
      shelfSwingGeometry.focusTargets.map((target) => target.worldPosition),
    );
  });

  it("exposes the new detail nodes through the shared RTT subject factories", () => {
    const architectureGroup = createArchitectureRiseGroup();
    const shelfGroup = createShelfSwingGroup();
    const tableGroup = createTableTiltGroup();
    try {
      const architectureDetail = architectureGroup.getObjectByName(
        "architecture-rise-facade-fine-detail",
      );
      expect(architectureDetail).toBeInstanceOf(THREE.Group);
      expect(architectureDetail?.children).toHaveLength(
        architectureRiseGeometry.getArchitectureFacadeFineDetailPieces().length,
      );

      shelfSwingGeometry.subjects.forEach((subject) => {
        const motif = shelfGroup.getObjectByName(
          `${subject.focusChart.semanticName}-comparison-motif`,
        );
        expect(motif).toBeInstanceOf(THREE.Group);
        expect(
          motif?.children.filter((child) => child instanceof THREE.Mesh),
        ).toHaveLength(
          1 + subject.focusChart.comparisonMotif.rows.reduce((sum, row) => sum + row.count, 0),
        );
      });

      expect(
        tableGroup.getObjectByName("table-tilt-near-cup-focus-card-fine-band-1"),
      ).toBeInstanceOf(THREE.Mesh);
      expect(tableGroup.getObjectByName("table-tilt-mid-notebook-fine-line-1")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(tableGroup.getObjectByName("table-tilt-far-book-fine-grid-1-1")).toBeInstanceOf(
        THREE.Mesh,
      );
    } finally {
      architectureGroup.clear();
      disposeShelfSwingGroup(shelfGroup);
      disposeTableTiltGroup(tableGroup);
    }
  });
});
