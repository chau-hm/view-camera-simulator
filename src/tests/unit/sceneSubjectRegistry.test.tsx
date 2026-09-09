import { cleanup, render } from "@testing-library/react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShelfSwingSubject } from "../../render/ShelfSwingSubjectFactory";
import {
  ArchitectureRiseRegisteredSubject,
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getRegisteredSceneSubject,
  getSceneSubjectRegistration,
  sceneSubjectRegistry,
} from "../../render/sceneSubjectRegistry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { publicSceneCatalog } from "../../app/publicScenes";
import geometry from "../../scenes/shelfSwingGeometry";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import { CAMERA_MOVEMENT_LATTICE } from "../../scenes/cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../../scenes/cameraMovementSceneCalibration";
import { CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID } from "../../render/CameraMovementsSubjectFactory";
import { isGroundGlassRttScene } from "../../render/groundGlassRttScenes";
import {
  mirrorShiftGeometry,
  reflectPointAcrossMirrorPlane,
} from "../../scenes/mirrorShiftGeometry";
import {
  lessonZeroGroundGlassSubjectBoundsMm,
  lessonZeroGroundGlassSubjectGeometry,
} from "../../scenes/lessonZeroGroundGlassSubject";

afterEach(cleanup);

const collectDisposableSpies = (group: THREE.Group) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  return [
    ...[...geometries].map((resource) => vi.spyOn(resource, "dispose")),
    ...[...materials].map((resource) => vi.spyOn(resource, "dispose")),
  ];
};

type BoardFootprint = {
  center: { x: number; z: number };
  width: number;
  depth: number;
};

const boardFootprintFullyCovers = (
  outer: BoardFootprint,
  inner: BoardFootprint,
) =>
  Math.abs(outer.center.x - inner.center.x) + inner.width / 2 <= outer.width / 2 &&
  Math.abs(outer.center.z - inner.center.z) + inner.depth / 2 <= outer.depth / 2;

const boardFootprintsSeparated = (first: BoardFootprint, second: BoardFootprint) =>
  Math.abs(first.center.x - second.center.x) >= (first.width + second.width) / 2 ||
  Math.abs(first.center.z - second.center.z) >= (first.depth + second.depth) / 2;

describe("scene subject registry", () => {
  it("registers every canonical rendered scene and rejects unknown IDs", () => {
    expect(Object.keys(sceneSubjectRegistry)).toEqual([
      "view-camera-anatomy",
      "understanding-camera-movements",
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "architecture-foreground",
      "oblique-architecture",
      "table-tilt",
      "shelf-swing",
      "oblique-tabletop",
      "mirror-shift",
      "interior-corner",
    ]);
    Object.keys(sceneSubjectRegistry).forEach((sceneId) => {
      expect(getSceneSubjectRegistration(sceneId)).toBeDefined();
      expect(getRegisteredSceneSubject(sceneId)).toBeDefined();
    });
    expect(getSceneSubjectRegistration("not-a-scene")).toBeUndefined();
    expect(getRegisteredSceneSubject("not-a-scene")).toBeUndefined();
    expect(createRegisteredRttSubject("not-a-scene")).toBeNull();
  });

  it("registers the Lesson 0 subject with canonical RTT bounds", () => {
    const registration = getSceneSubjectRegistration("view-camera-anatomy");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("view-camera-anatomy")).toBe(registration?.SceneSubject);
    expect(registration?.rttBounds).toBe(lessonZeroGroundGlassSubjectBoundsMm);

    const group = createRegisteredRttSubject("view-camera-anatomy");
    expect(group?.name).toBe("view-camera-anatomy-subject");
    expect(group?.getObjectByName("view-camera-anatomy-target-board")).toBeInstanceOf(THREE.Mesh);
    expect(group?.children.length).toBe(lessonZeroGroundGlassSubjectGeometry.boxes.length);
    group?.traverse((object) => {
      expect(Number.isFinite(object.position.x)).toBe(true);
      expect(Number.isFinite(object.position.y)).toBe(true);
      expect(Number.isFinite(object.position.z)).toBe(true);
    });
  });

  it("requires every public scene to declare the RTT subject contract", () => {
    for (const entry of publicSceneCatalog) {
      expect(isGroundGlassRttScene(entry.id), `public scene ${entry.id} must use RTT`).toBe(true);
      expect(getSceneSubjectRegistration(entry.id), `public scene ${entry.id} needs a subject registration`).toBeDefined();
      expect(getRegisteredSceneSubject(entry.id), `public scene ${entry.id} needs a React subject`).toBeDefined();

      const group = createRegisteredRttSubject(entry.id);
      expect(group, `public scene ${entry.id} needs an RTT subject factory`).not.toBeNull();
      if (group) disposeRegisteredRttSubject(entry.id, group);
    }
  });

  it("resolves Shelf Swing to its shared React subject and canonical RTT factory", () => {
    expect(getRegisteredSceneSubject("shelf-swing")).toBe(ShelfSwingSubject);
    const group = createRegisteredRttSubject("shelf-swing");
    expect(group).not.toBeNull();
    expect(group?.name).toBe("shelf-swing-subject");
    expect(group?.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);
    geometry.subjects.forEach((subject) => {
      expect(group?.getObjectByName(subject.semanticName)).toBeInstanceOf(THREE.Group);
      expect(group?.getObjectByName(subject.focusChart.semanticName)).toBeInstanceOf(THREE.Group);
    });
    disposeRegisteredRttSubject("shelf-swing", group!);
  });

  it("resolves Mirror Shift to the shared static reflection subject and RTT factory", () => {
    const registration = getSceneSubjectRegistration("mirror-shift");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("mirror-shift")).toBe(registration?.SceneSubject);

    const group = createRegisteredRttSubject("mirror-shift");
    expect(group?.name).toBe("mirror-shift-subject");
    expect(group?.getObjectByName("mirror-shift-mirror-surface")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("mirror-shift-camera-reflection")).toBeInstanceOf(THREE.Group);
    disposeRegisteredRttSubject("mirror-shift", group!);
  });

  it("resolves Interior Corner to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("interior-corner");
    expect(registration).toBeDefined();
    expect(getRegisteredSceneSubject("interior-corner")).toBe(registration?.SceneSubject);

    const group = createRegisteredRttSubject("interior-corner");
    expect(group?.name).toBe("interior-corner-subject");
    expect(group?.getObjectByName("interior-corner-floor")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-back-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-receding-side-wall")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-room-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-side-cornice")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("interior-corner-wall-detail-interior-wall-near")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("interior-corner-wall-detail-interior-wall-middle")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("interior-corner-wall-detail-interior-wall-far")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("interior-corner-focus-interior-wall-near")).toBeInstanceOf(THREE.Object3D);
    expect(group?.getObjectByName("interior-corner-focus-interior-wall-middle")).toBeInstanceOf(THREE.Object3D);
    expect(group?.getObjectByName("interior-corner-focus-interior-wall-far")).toBeInstanceOf(THREE.Object3D);

    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("interior-corner", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("resolves Oblique Architecture to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("oblique-architecture");
    expect(registration).toBeDefined();
    const group = createRegisteredRttSubject("oblique-architecture");
    expect(group?.name).toBe("oblique-architecture-subject");
    expect(group?.getObjectByName("oblique-architecture-building")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-corner")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-target-facade")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-architecture-side-window-2-1")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("oblique-architecture-side-window-2-7")).toBeInstanceOf(THREE.Group);
    expect(group?.getObjectByName("oblique-architecture-focus-facade-middle")).toBeInstanceOf(THREE.Object3D);
    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("oblique-architecture", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("resolves Oblique Tabletop focus probes before the first render", () => {
    const group = createRegisteredRttSubject("oblique-tabletop")!;
    try {
      for (const marker of obliqueTabletopGeometry.boardMarkers) {
        const probe = group.getObjectByName(`oblique-tabletop-focus-${marker.id}`)!;
        // Do not force updateMatrixWorld: getWorldPosition must update the
        // manually assigned board matrix even before a renderer has visited it.
        const position = probe.getWorldPosition(new THREE.Vector3());
        expect(position.x).toBeCloseTo(marker.worldPosition.x * 0.001, 10);
        expect(position.y).toBeCloseTo(marker.worldPosition.y * 0.001, 10);
        expect(position.z).toBeCloseTo(marker.worldPosition.z * 0.001, 10);
      }
    } finally {
      disposeRegisteredRttSubject("oblique-tabletop", group);
    }
  });

  it("resolves Oblique Tabletop to one shared static subject for 3D and RTT", () => {
    const registration = getSceneSubjectRegistration("oblique-tabletop");
    expect(registration).toBeDefined();
    const group = createRegisteredRttSubject("oblique-tabletop");
    expect(group?.name).toBe("oblique-tabletop-subject");
    expect(group?.getObjectByName("oblique-tabletop-tabletop")).toBeInstanceOf(THREE.Mesh);
    expect(group?.getObjectByName("oblique-tabletop-floor")).toBeInstanceOf(THREE.Mesh);

    group?.updateMatrixWorld(true);
    const tabletopAssembly = group?.getObjectByName("oblique-tabletop-tabletop-assembly");
    expect(tabletopAssembly).toBeInstanceOf(THREE.Group);
    const renderedTableNormal = new THREE.Vector3(0, 1, 0).transformDirection(
      tabletopAssembly!.matrixWorld,
    );
    expect(renderedTableNormal.x).toBeCloseTo(obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.x, 10);
    expect(renderedTableNormal.y).toBeCloseTo(obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.y, 10);
    expect(renderedTableNormal.z).toBeCloseTo(obliqueTabletopGeometry.tabletopTopSurfacePlane.normal.z, 10);

    const boardAssembly = group?.getObjectByName("oblique-tabletop-subject-board-assembly");
    expect(boardAssembly).toBeInstanceOf(THREE.Group);
    const renderedBoardNormal = new THREE.Vector3(0, 1, 0).transformDirection(
      boardAssembly!.matrixWorld,
    );
    expect(renderedBoardNormal.x).toBeCloseTo(obliqueTabletopGeometry.subjectBoardPlane.normal.x, 10);
    expect(renderedBoardNormal.y).toBeCloseTo(obliqueTabletopGeometry.subjectBoardPlane.normal.y, 10);
    expect(renderedBoardNormal.z).toBeCloseTo(obliqueTabletopGeometry.subjectBoardPlane.normal.z, 10);

    const boardMesh = group?.getObjectByName("oblique-tabletop-subject-board");
    expect(boardMesh).toBeInstanceOf(THREE.Mesh);
    const renderedFacePoint = new THREE.Vector3(
      0,
      obliqueTabletopGeometry.subjectBoard.thickness * 0.001 / 2,
      0,
    ).applyMatrix4(boardMesh!.matrixWorld);
    expect(renderedFacePoint.x).toBeCloseTo(
      obliqueTabletopGeometry.subjectBoardFrontSurfacePlane.point.x * 0.001,
      10,
    );
    expect(renderedFacePoint.y).toBeCloseTo(
      obliqueTabletopGeometry.subjectBoardFrontSurfacePlane.point.y * 0.001,
      10,
    );
    expect(renderedFacePoint.z).toBeCloseTo(
      obliqueTabletopGeometry.subjectBoardFrontSurfacePlane.point.z * 0.001,
      10,
    );

    const presentationNodes: THREE.Object3D[] = [];
    const planSurfaceNodes: THREE.Object3D[] = [];
    group?.traverse((object) => {
      if (object.name.includes("presentation")) presentationNodes.push(object);
      if (object.name === "oblique-tabletop-subject-board-plan-surface") {
        planSurfaceNodes.push(object);
      }
    });
    expect(presentationNodes).toHaveLength(0);
    expect(planSurfaceNodes).toHaveLength(1);
    expect(
      group?.getObjectByName("oblique-tabletop-subject-board-plan-surface-presentation"),
    ).toBeUndefined();

    obliqueTabletopGeometry.boardMarkers.forEach((marker) => {
      const markerGroup = group?.getObjectByName(`oblique-tabletop-marker-${marker.id}`);
      expect(markerGroup).toBeInstanceOf(THREE.Group);
      expect(markerGroup?.userData.markerId).toBe(marker.id);
      expect(markerGroup?.userData.focusTargetId).toBeUndefined();
      const probe = group?.getObjectByName(`oblique-tabletop-focus-${marker.id}`);
      expect(probe).toBeInstanceOf(THREE.Object3D);
      expect(probe?.userData.markerId).toBe(marker.id);
      expect(probe?.userData.focusTargetId).toBeUndefined();
      const probeWorld = new THREE.Vector3();
      probe?.getWorldPosition(probeWorld);
      expect(probeWorld.x).toBeCloseTo(marker.worldPosition.x * 0.001, 10);
      expect(probeWorld.y).toBeCloseTo(marker.worldPosition.y * 0.001, 10);
      expect(probeWorld.z).toBeCloseTo(marker.worldPosition.z * 0.001, 10);
    });
    obliqueTabletopGeometry.subjectBoardAnalyticalSurfaceSamples.forEach((sample) => {
      const sampleNode = group?.getObjectByName(
        `oblique-tabletop-board-surface-sample-${sample.id}`,
      );
      expect(sampleNode).toBeInstanceOf(THREE.Object3D);
      const sampleWorld = new THREE.Vector3();
      sampleNode?.getWorldPosition(sampleWorld);
      expect(sampleWorld.x).toBeCloseTo(sample.worldPosition.x * 0.001, 10);
      expect(sampleWorld.y).toBeCloseTo(sample.worldPosition.y * 0.001, 10);
      expect(sampleWorld.z).toBeCloseTo(sample.worldPosition.z * 0.001, 10);
      expect(sampleNode?.userData.analyticalCoverageSampleId).toBe(sample.id);
      expect(sampleNode?.userData.geometryAnchor).toBe("canonical-subject-board-surface");
      expect(sampleNode?.userData.focusTargetId).toBeUndefined();
    });
    obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.forEach((sample) => {
      const detail = group?.getObjectByName(
        `oblique-tabletop-board-detail-${sample.id}`,
      );
      expect(detail).toBeInstanceOf(THREE.Group);
      expect(detail?.userData.focusTargetId).toBe(sample.id);
      expect(detail?.userData.geometryAnchor).toBe("visible-subject-board-detail");

      const focusProbe = group?.getObjectByName(
        `oblique-tabletop-focus-detail-${sample.id}`,
      );
      expect(focusProbe).toBeInstanceOf(THREE.Object3D);
      const focusWorld = new THREE.Vector3();
      focusProbe?.getWorldPosition(focusWorld);
      expect(focusWorld.x).toBeCloseTo(sample.worldPosition.x * 0.001, 10);
      expect(focusWorld.y).toBeCloseTo(sample.worldPosition.y * 0.001, 10);
      expect(focusWorld.z).toBeCloseTo(sample.worldPosition.z * 0.001, 10);
      expect(focusProbe?.userData.focusTargetId).toBe(sample.id);
      expect(focusProbe?.userData.geometryAnchor).toBe("visible-subject-board-focus-probe");

      const detailSurface = detail?.getObjectByName(
        `oblique-tabletop-board-detail-${sample.id}-surface`,
      );
      expect(detailSurface).toBeInstanceOf(THREE.Mesh);
      const detailOuterSurfaceWorld = new THREE.Vector3(
        0,
        obliqueTabletopGeometry.focusDetailGeometry.height * 0.001 / 2,
        0,
      ).applyMatrix4(detailSurface!.matrixWorld);
      expect(detailOuterSurfaceWorld.x).toBeCloseTo(focusWorld.x, 10);
      expect(detailOuterSurfaceWorld.y).toBeCloseTo(focusWorld.y, 10);
      expect(detailOuterSurfaceWorld.z).toBeCloseTo(focusWorld.z, 10);
    });

    const visibleDetailFootprints = obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.map(
      (sample) => ({
        center: sample.localPosition,
        width: obliqueTabletopGeometry.focusDetailGeometry.width,
        depth: obliqueTabletopGeometry.focusDetailGeometry.depth,
      }),
    );
    obliqueTabletopGeometry.boardMarkers.forEach((marker) => {
      const markerFootprint = {
        center: marker.localPosition,
        width: obliqueTabletopGeometry.markerGeometry.width,
        depth: obliqueTabletopGeometry.markerGeometry.depth,
      };
      visibleDetailFootprints.forEach((detailFootprint) => {
        expect(boardFootprintFullyCovers(markerFootprint, detailFootprint)).toBe(false);
      });
    });

    const middleMarkerFootprint = {
      center: obliqueTabletopGeometry.middleBoardMarker.localPosition,
      width: obliqueTabletopGeometry.markerGeometry.width,
      depth: obliqueTabletopGeometry.markerGeometry.depth,
    };
    const middleDetail = obliqueTabletopGeometry.subjectBoardVisibleFocusSamples.find(
      (sample) => sample.id === "middle",
    )!;
    const middleDetailFootprint = {
      center: middleDetail.localPosition,
      width: obliqueTabletopGeometry.focusDetailGeometry.width,
      depth: obliqueTabletopGeometry.focusDetailGeometry.depth,
    };
    expect(middleDetail.localPosition).toEqual({ x: 0, z: 0 });
    expect(boardFootprintsSeparated(middleMarkerFootprint, middleDetailFootprint)).toBe(true);

    const renderedMiddleMarker = group?.getObjectByName("oblique-tabletop-marker-middle");
    const renderedMiddleMarkerWorld = new THREE.Vector3();
    renderedMiddleMarker?.getWorldPosition(renderedMiddleMarkerWorld);
    const expectedMiddleMarkerWorld = obliqueTabletopGeometry.subjectBoardLocalPointToWorld({
      x: obliqueTabletopGeometry.middleBoardMarker.localPosition.x,
      y: 0,
      z: obliqueTabletopGeometry.middleBoardMarker.localPosition.z,
    });
    expect(renderedMiddleMarkerWorld.x).toBeCloseTo(expectedMiddleMarkerWorld.x * 0.001, 10);
    expect(renderedMiddleMarkerWorld.y).toBeCloseTo(expectedMiddleMarkerWorld.y * 0.001, 10);
    expect(renderedMiddleMarkerWorld.z).toBeCloseTo(expectedMiddleMarkerWorld.z * 0.001, 10);

    const spies = collectDisposableSpies(group!);
    disposeRegisteredRttSubject("oblique-tabletop", group!);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it("registers canonical lattice identity and calibration-driven ghost policy", () => {
    const registration = getSceneSubjectRegistration(
      "understanding-camera-movements",
    );
    expect(registration?.canonicalLattice).toEqual({
      geometryId: CAMERA_MOVEMENT_LATTICE_GEOMETRY_ID,
      edgeCount: CAMERA_MOVEMENT_LATTICE.edges.length,
    });
    expect(registration?.showReferenceCamera).toBe(
      CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.showReferenceCamera,
    );
    expect(registration?.showReferenceCamera).toBe(false);
  });

  it.each(["shelf-swing", "table-tilt", "oblique-architecture"])(
    "uses the explicit unique-resource disposer for %s",
    (sceneId) => {
      const group = createRegisteredRttSubject(sceneId)!;
      const spies = collectDisposableSpies(group);
      expect(spies.length).toBeGreaterThan(0);

      disposeRegisteredRttSubject(sceneId, group);

      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    },
  );

  it.each(["focus-fundamentals-two-targets", "architecture-rise"])(
    "does not generically dispose shared factory resources for %s",
    (sceneId) => {
      expect(getSceneSubjectRegistration(sceneId)?.disposeRttGroup).toBeUndefined();
    },
  );

  it("keeps Architecture Rise canonical focus markers in registered rendering", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = render(<ArchitectureRiseRegisteredSubject scene={architectureRiseScene} />);
    consoleError.mockRestore();

    architectureRiseScene.focusTargets.forEach((target) => {
      expect(
        view.container.querySelector(
          `[name="architecture-focus-target-${target.id}"]`,
        ),
      ).not.toBeNull();
    });
  });

  it("derives Shelf Swing RTT lighting from the middle canonical focus chart", () => {
    const lighting = getSceneSubjectRegistration("shelf-swing")?.rttLighting;
    expect(lighting?.targetMm).toEqual(geometry.middleSubject.focusDetailProbeWorld);
    expect(lighting?.keyOffsetWorld).toEqual({ x: -2.5, y: 3.5, z: -2.5 });
    expect(lighting?.fillOffsetWorld).toEqual({ x: 2.5, y: 1.5, z: -1.5 });
  });

  it("aims Mirror Shift lighting into the reflected chamber", () => {
    const lighting = getSceneSubjectRegistration("mirror-shift")?.rttLighting;
    expect(lighting?.targetMm).toEqual(
      reflectPointAcrossMirrorPlane({
        x: mirrorShiftGeometry.mirror.center.x,
        y: mirrorShiftGeometry.mirror.center.y,
        z: mirrorShiftGeometry.floor.centerZ,
      }),
    );
    expect(lighting?.keyOffsetWorld).toEqual({ x: -2.5, y: 3.5, z: 2.5 });
  });
});
