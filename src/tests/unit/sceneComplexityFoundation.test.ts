import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createArchitectureForegroundGroup,
  disposeArchitectureForegroundGroup,
} from "../../render/ArchitectureForegroundSubjectFactory";
import {
  createInteriorCornerGroup,
  disposeInteriorCornerGroup,
} from "../../render/InteriorCornerSubjectFactory";
import {
  createObliqueTabletopGroup,
  disposeObliqueTabletopGroup,
} from "../../render/ObliqueTabletopSubjectFactory";
import {
  createShelfSwingGroup,
  disposeShelfSwingGroup,
} from "../../render/ShelfSwingSubjectFactory";
import architectureGeometry from "../../scenes/architectureForegroundGeometry";
import interiorGeometry from "../../scenes/interiorCornerGeometry";
import obliqueGeometry from "../../scenes/obliqueTabletopGeometry";
import shelfGeometry from "../../scenes/shelfSwingGeometry";
import { toWorld } from "../../render/rttUtils";

describe("scene complexity foundation", () => {
  it("adds architectural depth while retaining the registered subject anchors", () => {
    const group = createArchitectureForegroundGroup();
    try {
      expect(group.getObjectByName("architecture-foreground-window-1-1-recess")).toBeInstanceOf(
        THREE.Group,
      );
      expect(group.getObjectByName("architecture-foreground-window-1-1-recess-sill")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("architecture-foreground-forecourt-structure")).toBeInstanceOf(
        THREE.Group,
      );
      expect(group.getObjectByName("architecture-foreground-forecourt-near-curb")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("architecture-foreground-building")).toBeInstanceOf(THREE.Mesh);
      expect(group.getObjectByName("architecture-foreground-ground")).toBeInstanceOf(THREE.Mesh);
      group.updateMatrixWorld(true);
      const reveal = group.getObjectByName(
        "architecture-foreground-window-1-1-recess-left",
      );
      expect(reveal).toBeInstanceOf(THREE.Mesh);
      const revealBounds = new THREE.Box3().setFromObject(reveal!);
      const revealSize = revealBounds.getSize(new THREE.Vector3());
      expect(revealSize.x).toBeCloseTo(toWorld(34), 6);
      expect(revealSize.z).toBeCloseTo(toWorld(76), 6);
      expect(architectureGeometry.focusTargets.map((target) => target.worldPosition)).toEqual([
        {
          x: 0,
          y: architectureGeometry.ground.y + 12,
          z: 4700,
        },
        {
          x: 0,
          y: architectureGeometry.ground.y + 12,
          z: 6900,
        },
        {
          x: 0,
          y: architectureGeometry.ground.y + 520,
          z: architectureGeometry.facade.frontFacadeZ - 12,
        },
        {
          x: 0,
          y: architectureGeometry.ground.y + 2450,
          z: architectureGeometry.facade.frontFacadeZ - 12,
        },
      ]);
    } finally {
      disposeArchitectureForegroundGroup(group);
    }
  });

  it("adds physical interior furniture structure without changing focus probes", () => {
    const group = createInteriorCornerGroup();
    try {
      expect(group.getObjectByName("interior-corner-furniture-structure")).toBeInstanceOf(
        THREE.Group,
      );
      expect(group.getObjectByName("interior-corner-console-leg-left-near")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("interior-corner-console-lower-shelf")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("interior-corner-bench-leg-right-far")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("interior-corner-console-vase")).toBeInstanceOf(THREE.Mesh);
      group.updateMatrixWorld(true);
      const consoleLeg = group.getObjectByName("interior-corner-console-leg-left-near");
      const consoleBody = group.getObjectByName("interior-corner-console");
      const lowerShelf = group.getObjectByName("interior-corner-console-lower-shelf");
      expect(consoleLeg).toBeInstanceOf(THREE.Mesh);
      expect(consoleBody).toBeInstanceOf(THREE.Mesh);
      expect(lowerShelf).toBeInstanceOf(THREE.Mesh);
      const legBounds = new THREE.Box3().setFromObject(consoleLeg!);
      const legSize = legBounds.getSize(new THREE.Vector3());
      const bodyBounds = new THREE.Box3().setFromObject(consoleBody!);
      const shelfBounds = new THREE.Box3().setFromObject(lowerShelf!);
      expect(legSize.x).toBeCloseTo(toWorld(80), 6);
      expect(legSize.y).toBeCloseTo(toWorld(480), 6);
      expect(legSize.z).toBeCloseTo(toWorld(80), 6);
      expect(legBounds.min.y).toBeCloseTo(toWorld(interiorGeometry.room.floorY), 6);
      expect(bodyBounds.min.y).toBeGreaterThan(legBounds.min.y + toWorld(250));
      expect(shelfBounds.max.y).toBeLessThan(bodyBounds.min.y);
      expect(interiorGeometry.focusTargets.map((target) => target.worldPosition.z)).toEqual([
        5800,
        8000,
        10400,
      ]);
      interiorGeometry.focusTargets.forEach((target) => {
        const probe = group.getObjectByName(`interior-corner-focus-${target.id}`);
        expect(probe?.userData.focusProbeWorldMm).toEqual(target.worldPosition);
      });
    } finally {
      disposeInteriorCornerGroup(group);
    }
  });

  it("adds near, middle, and far tabletop context around the canonical board", () => {
    const group = createObliqueTabletopGroup();
    try {
      expect(group.getObjectByName("oblique-tabletop-context-props")).toBeInstanceOf(THREE.Group);
      expect(group.getObjectByName("oblique-tabletop-context-near-prop")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("oblique-tabletop-context-middle-prop")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("oblique-tabletop-context-far-prop")).toBeInstanceOf(
        THREE.Mesh,
      );

      group.updateMatrixWorld(true);
      const board = group.getObjectByName("oblique-tabletop-subject-board-assembly");
      expect(board).toBeInstanceOf(THREE.Group);
      const boardWorld = new THREE.Vector3();
      board!.getWorldPosition(boardWorld);
      expect(boardWorld.x).toBeCloseTo(toWorld(obliqueGeometry.subjectBoard.center.x), 10);
      expect(boardWorld.y).toBeCloseTo(toWorld(obliqueGeometry.subjectBoard.center.y), 10);
      expect(boardWorld.z).toBeCloseTo(toWorld(obliqueGeometry.subjectBoard.center.z), 10);
      expect(group.getObjectByName("oblique-tabletop-marker-middle")).toBeInstanceOf(THREE.Group);
      expect(obliqueGeometry.focusTargets).toHaveLength(7);
    } finally {
      disposeObliqueTabletopGroup(group);
    }
  });

  it("adds repeated shelf context while retaining every calibrated station", () => {
    const group = createShelfSwingGroup();
    try {
      shelfGeometry.subjects.forEach((subject) => {
        expect(group.getObjectByName(`${subject.semanticName}-backdrop-panel`)).toBeInstanceOf(
          THREE.Mesh,
        );
        expect(group.getObjectByName(`${subject.semanticName}-context-book-1-1`)).toBeInstanceOf(
          THREE.Mesh,
        );
        expect(group.getObjectByName(subject.focusChart.semanticName)).toBeInstanceOf(THREE.Group);
        const probe = group.getObjectByName(subject.focusProbeSemanticName);
        expect(probe?.userData.focusProbeWorldMm).toEqual(subject.focusDetailProbeWorld);
      });
    } finally {
      disposeShelfSwingGroup(group);
    }
  });
});
