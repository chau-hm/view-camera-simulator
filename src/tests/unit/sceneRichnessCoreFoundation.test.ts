import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../render/ArchitectureRiseSubjectFactory";
import {
  createObliqueArchitectureGroup,
  disposeObliqueArchitectureGroup,
} from "../../render/ObliqueArchitectureSubjectFactory";
import {
  createTableTiltGroup,
  disposeTableTiltGroup,
} from "../../render/TableTiltSubjectFactory";
import {
  createMirrorShiftRttGroup,
  createMirrorShiftViewportGroup,
  disposeMirrorShiftGroup,
} from "../../render/MirrorShiftSubjectFactory";
import architectureRiseGeometry from "../../scenes/architectureRiseGeometry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import { reflectPointAcrossMirrorPlane } from "../../scenes/mirrorShiftGeometry";
import { toWorld } from "../../render/rttUtils";

const worldBounds = (object: THREE.Object3D): THREE.Vector3 =>
  new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());

describe("core scene visual richness foundation", () => {
  it("adds architectural context at intended Architecture Rise scale without moving the canonical target", () => {
    const group = createArchitectureRiseGroup();
    try {
      group.updateMatrixWorld(true);

      const sideReturn = group.getObjectByName("architecture-rise-side-return");
      const entryLintel = group.getObjectByName("architecture-rise-entry-recess-lintel");

      expect(sideReturn).toBeInstanceOf(THREE.Mesh);
      expect(entryLintel).toBeInstanceOf(THREE.Mesh);
      expect(worldBounds(sideReturn!)).toMatchObject({
        x: expect.closeTo(toWorld(520), 6),
        y: expect.closeTo(toWorld(3000), 6),
        z: expect.closeTo(toWorld(760), 6),
      });
      expect(worldBounds(entryLintel!)).toMatchObject({
        x: expect.closeTo(toWorld(652), 6),
        y: expect.closeTo(toWorld(72), 6),
        z: expect.closeTo(toWorld(90), 6),
      });
      expect(architectureRiseGeometry.focusTarget.worldPosition).toEqual({
        x: 0,
        y: architectureRiseGeometry.building.center.y,
        z: architectureRiseGeometry.facade.frontFacadeZ - 10,
      });
      expect(group.getObjectByName("cell-0")).toBeInstanceOf(THREE.Mesh);
      expect(group.getObjectByName("architecture-rise-facade-window-bay-bay-1-1")).toBeInstanceOf(
        THREE.Group,
      );
      const windowBay = group.getObjectByName("architecture-rise-facade-window-bay-bay-2-2");
      expect(windowBay).toBeInstanceOf(THREE.Group);
      expect(worldBounds(windowBay!)).toMatchObject({
        x: expect.closeTo(toWorld(388), 6),
        y: expect.closeTo(toWorld(518), 6),
        z: expect.closeTo(toWorld(95), 6),
      });
      expect(group.getObjectByName("architecture-rise-roof-coping-front")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("architecture-rise-side-return-window-bay-side-2")).toBeInstanceOf(
        THREE.Group,
      );
      expect(group.getObjectByName("architecture-rise-street-curb")).toBeInstanceOf(THREE.Mesh);
      expect(architectureRiseGeometry.sceneBounds.min.x).toBeLessThanOrEqual(
        -architectureRiseGeometry.streetContext.sidewalkWidth / 2,
      );
      expect(architectureRiseGeometry.sceneBounds.max.x).toBeGreaterThanOrEqual(
        architectureRiseGeometry.streetContext.sidewalkWidth / 2,
      );
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });

  it("adds depth-bearing Oblique Architecture structure while preserving focus probes", () => {
    const group = createObliqueArchitectureGroup();
    try {
      group.updateMatrixWorld(true);
      const context = group.getObjectByName("oblique-architecture-context-structure");
      const reveal = group.getObjectByName("oblique-architecture-corner-reveal");
      const sideLedge = group.getObjectByName("oblique-architecture-side-ledge-2");

      expect(context).toBeInstanceOf(THREE.Group);
      expect(reveal).toBeInstanceOf(THREE.Mesh);
      expect(sideLedge).toBeInstanceOf(THREE.Mesh);
      expect(worldBounds(reveal!)).toMatchObject({
        x: expect.closeTo(toWorld(84), 6),
        z: expect.closeTo(toWorld(100), 6),
      });
      expect(group.getObjectByName("oblique-architecture-focus-facade-middle")).toBeInstanceOf(
        THREE.Object3D,
      );
      expect(
        group
          .getObjectByName("oblique-architecture-focus-facade-middle")!
          .userData.focusProbeWorldMm,
      ).toEqual(obliqueArchitectureGeometry.focusTargets[1].worldPosition);
    } finally {
      disposeObliqueArchitectureGroup(group);
    }
  });

  it("adds near, middle, and far Table Tilt context without changing calibrated subjects", () => {
    const group = createTableTiltGroup();
    try {
      group.updateMatrixWorld(true);
      const near = group.getObjectByName("table-tilt-context-near-tray");
      const middle = group.getObjectByName("table-tilt-context-middle-canister");
      const far = group.getObjectByName("table-tilt-context-far-block");
      expect(near).toBeInstanceOf(THREE.Mesh);
      expect(middle).toBeInstanceOf(THREE.Mesh);
      expect(far).toBeInstanceOf(THREE.Mesh);

      const nearWorld = new THREE.Vector3();
      const middleWorld = new THREE.Vector3();
      const farWorld = new THREE.Vector3();
      near!.getWorldPosition(nearWorld);
      middle!.getWorldPosition(middleWorld);
      far!.getWorldPosition(farWorld);
      expect(nearWorld.z).toBeLessThan(middleWorld.z);
      expect(middleWorld.z).toBeLessThan(farWorld.z);
      expect(worldBounds(near!)).toMatchObject({
        x: expect.closeTo(toWorld(360), 6),
        y: expect.closeTo(toWorld(70), 6),
        z: expect.closeTo(toWorld(240), 6),
      });
      for (const subject of tableTiltGeometry.subjects) {
        const anchor = group.getObjectByName(`${subject.semanticName}-anchor`);
        expect(anchor).toBeInstanceOf(THREE.Group);
        expect(anchor!.position.toArray()).toEqual([
          toWorld(subject.worldPosition.x),
          toWorld(subject.worldPosition.y),
          toWorld(subject.worldPosition.z),
        ]);
      }
    } finally {
      disposeTableTiltGroup(group);
    }
  });

  it("keeps Mirror Shift context paired across the existing reflection transform", () => {
    const viewport = createMirrorShiftViewportGroup();
    const rtt = createMirrorShiftRttGroup();
    try {
      expect(viewport.getObjectByName("mirror-shift-real-context-plinth")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(viewport.getObjectByName("mirror-shift-reflected-context-plinth")).toBeUndefined();
      const real = rtt.getObjectByName("mirror-shift-real-context-plinth");
      const reflected = rtt.getObjectByName("mirror-shift-reflected-context-plinth");
      expect(real).toBeInstanceOf(THREE.Mesh);
      expect(reflected).toBeInstanceOf(THREE.Mesh);

      const realWorld = new THREE.Vector3();
      const reflectedWorld = new THREE.Vector3();
      real!.getWorldPosition(realWorld);
      reflected!.getWorldPosition(reflectedWorld);
      const realMm = {
        x: realWorld.x / 0.001,
        y: realWorld.y / 0.001,
        z: realWorld.z / 0.001,
      };
      const expected = reflectPointAcrossMirrorPlane(realMm);
      expect(reflectedWorld.x).toBeCloseTo(toWorld(expected.x), 10);
      expect(reflectedWorld.y).toBeCloseTo(toWorld(expected.y), 10);
      expect(reflectedWorld.z).toBeCloseTo(toWorld(expected.z), 10);
      expect(realMm.z).toBeCloseTo(1700, 10);
    } finally {
      disposeMirrorShiftGroup(viewport);
      disposeMirrorShiftGroup(rtt);
    }
  });
});
