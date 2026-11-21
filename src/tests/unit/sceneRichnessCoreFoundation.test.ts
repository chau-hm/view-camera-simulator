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
import { ARCHITECTURE_RISE_PRESENTATION } from "../../scenes/presentation/architectureRise";
import { ARCHITECTURE_RISE_PRESENTATION_LAYOUT } from "../../scenes/presentation/architectureRiseLayout";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../../scenes/presentation/obliqueArchitecture";
import { TABLE_TILT_PRESENTATION } from "../../scenes/presentation/tableTilt";
import { reflectPointAcrossMirrorPlane } from "../../scenes/mirrorShiftGeometry";
import { toWorld } from "../../render/rttUtils";

const worldBounds = (object: THREE.Object3D): THREE.Vector3 =>
  new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());

const worldZBounds = (object: THREE.Object3D): { min: number; max: number } => {
  const bounds = new THREE.Box3().setFromObject(object);
  return { min: bounds.min.z, max: bounds.max.z };
};

// Float32 world-space geometry rounds at about 1e-6 m near the 10 m return;
// this is 0.001 mm and remains far below a meaningful architectural offset.
const ARCHITECTURE_RISE_BOUNDARY_EPSILON_M = 1e-6;

const expectBoundsWithin = (actual: THREE.Box3, expected: THREE.Box3, epsilon: number): void => {
  expect(actual.min.x).toBeGreaterThanOrEqual(expected.min.x - epsilon);
  expect(actual.min.y).toBeGreaterThanOrEqual(expected.min.y - epsilon);
  expect(actual.min.z).toBeGreaterThanOrEqual(expected.min.z - epsilon);
  expect(actual.max.x).toBeLessThanOrEqual(expected.max.x + epsilon);
  expect(actual.max.y).toBeLessThanOrEqual(expected.max.y + epsilon);
  expect(actual.max.z).toBeLessThanOrEqual(expected.max.z + epsilon);
};

describe("core scene visual richness foundation", () => {
  it("adds architectural context at intended Architecture Rise scale without moving the canonical target", () => {
    const group = createArchitectureRiseGroup({
      presentation: ARCHITECTURE_RISE_PRESENTATION,
    });
    try {
      group.updateMatrixWorld(true);

      const sideReturn = group.getObjectByName("architecture-rise-side-return");
      const entryLintel = group.getObjectByName("architecture-rise-entry-stone-lintel");
      const serviceAssembly = group.getObjectByName("architecture-rise-attached-service-return");

      expect(sideReturn).toBeInstanceOf(THREE.Mesh);
      expect(entryLintel).toBeInstanceOf(THREE.Mesh);
      expect(serviceAssembly).toBeInstanceOf(THREE.Group);
      const sideReturnBounds = new THREE.Box3().setFromObject(sideReturn!);
      const serviceReturn = ARCHITECTURE_RISE_PRESENTATION_LAYOUT.serviceReturn;
      const serviceReturnEnvelope = new THREE.Box3(
        new THREE.Vector3(toWorld(serviceReturn.minXMm), toWorld(serviceReturn.minYMm), toWorld(serviceReturn.minZMm)),
        new THREE.Vector3(toWorld(serviceReturn.maxXMm), toWorld(serviceReturn.maxYMm), toWorld(serviceReturn.maxZMm)),
      );
      expectBoundsWithin(sideReturnBounds, serviceReturnEnvelope, ARCHITECTURE_RISE_BOUNDARY_EPSILON_M);
      expect(serviceReturn.minXMm).toBe(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.mainFacade.maxXMm);

      const negativeControlDisplacementM = 0.01;
      expect(negativeControlDisplacementM).toBeGreaterThan(ARCHITECTURE_RISE_BOUNDARY_EPSILON_M);
      const displacedBounds = sideReturnBounds.clone().translate(
        new THREE.Vector3(0, 0, -negativeControlDisplacementM),
      );
      expect(() =>
        expectBoundsWithin(displacedBounds, serviceReturnEnvelope, ARCHITECTURE_RISE_BOUNDARY_EPSILON_M),
      ).toThrow();
      expectBoundsWithin(sideReturnBounds, serviceReturnEnvelope, ARCHITECTURE_RISE_BOUNDARY_EPSILON_M);
      const entryLintelBounds = new THREE.Box3().setFromObject(entryLintel!);
      expect(entryLintelBounds.min.x).toBeLessThan(toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.door.centerXMm));
      expect(entryLintelBounds.max.x).toBeGreaterThan(toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.door.centerXMm));
      expect(entryLintelBounds.min.y).toBeGreaterThan(toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.door.centerYMm));
      expect(architectureRiseGeometry.focusTarget.worldPosition).toEqual({
        x: 0,
        y: architectureRiseGeometry.building.center.y,
        z: architectureRiseGeometry.facade.frontFacadeZ - 10,
      });
      expect(group.getObjectByName("cell-0")).toBeInstanceOf(THREE.Mesh);
      const windowAssembly = group.getObjectByName("architecture-rise-window-middle-right");
      expect(windowAssembly).toBeInstanceOf(THREE.Group);
      expect(group.getObjectByName("architecture-rise-window-top-center-glazing")).toBeInstanceOf(THREE.Mesh);
      expect(group.getObjectByName("architecture-rise-window-service-east-lower-glazing")).toBeInstanceOf(THREE.Mesh);
      expect(worldBounds(windowAssembly!).x).toBeGreaterThan(toWorld(ARCHITECTURE_RISE_PRESENTATION_LAYOUT.windows[4]!.openingWidthMm));
      expect(group.getObjectByName("architecture-rise-roof-coping-front")).toBeInstanceOf(
        THREE.Mesh,
      );
      expect(group.getObjectByName("architecture-rise-street-curb")).toBeInstanceOf(THREE.Mesh);
      expect(architectureRiseGeometry.sceneBounds.min.x).toBeLessThanOrEqual(
        -architectureRiseGeometry.streetContext.sidewalkWidth / 2,
      );
      expect(architectureRiseGeometry.sceneBounds.max.x).toBeGreaterThanOrEqual(
        architectureRiseGeometry.streetContext.sidewalkWidth / 2,
      );

      const primaryFacade = group.getObjectByName("architecture-rise-primary-facade");
      const buildingMass = group.getObjectByName("architecture-rise-building-mass");
      const focusChart = group.getObjectByName("architecture-rise-focus-chart");
      const crosshairHorizontal = group.getObjectByName("architecture-focus-crosshair-horizontal");
      const crosshairVertical = group.getObjectByName("architecture-focus-crosshair-vertical");
      const fineDetail = group.getObjectByName("architecture-rise-facade-fine-detail");

      expect(primaryFacade).toBeInstanceOf(THREE.Mesh);
      expect(buildingMass).toBeUndefined();
      expect(focusChart).toBeInstanceOf(THREE.Group);
      expect(crosshairHorizontal).toBeInstanceOf(THREE.Mesh);
      expect(crosshairVertical).toBeInstanceOf(THREE.Mesh);
      expect(fineDetail).toBeInstanceOf(THREE.Group);

      const primaryFacadeZ = worldZBounds(primaryFacade!);
      const focusChartZ = worldZBounds(focusChart!);
      const crosshairHorizontalZ = worldZBounds(crosshairHorizontal!);
      const crosshairVerticalZ = worldZBounds(crosshairVertical!);
      const fineDetailZ = worldZBounds(fineDetail!);

      expect(focusChartZ.max).toBeLessThan(primaryFacadeZ.min);
      expect(crosshairHorizontalZ.max).toBeLessThan(primaryFacadeZ.min);
      expect(crosshairVerticalZ.max).toBeLessThan(primaryFacadeZ.min);
      expect(fineDetailZ.max).toBeLessThan(primaryFacadeZ.min);
    } finally {
      disposeArchitectureRiseGroup(group);
    }
  });

  it("adds depth-bearing Oblique Architecture structure while preserving focus probes", () => {
    const group = createObliqueArchitectureGroup({
      presentation: OBLIQUE_ARCHITECTURE_PRESENTATION,
    });
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
    const group = createTableTiltGroup({ presentation: TABLE_TILT_PRESENTATION });
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
