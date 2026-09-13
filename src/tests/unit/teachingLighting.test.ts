import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  configureTeachingShadowParticipation,
  createTeachingLightingRig,
  disposeTeachingLightingRig,
  resolveTeachingLightingPlacement,
  TEACHING_LIGHTING_CONFIG,
  updateTeachingLightingRig,
} from "../../render/TeachingLighting";

describe("teaching lighting", () => {
  it("converts the existing scene lighting target into shared world placement", () => {
    expect(
      resolveTeachingLightingPlacement({
        targetMm: { x: 1000, y: -500, z: 2500 },
        keyOffsetWorld: { x: -2, y: 3, z: -4 },
        fillOffsetWorld: { x: 1, y: 1, z: 1 },
      }),
    ).toEqual({
      targetWorld: [1, -0.5, 2.5],
      keyOffsetWorld: [-2, 3, -4],
    });
  });

  it("creates one bounded shadow key and one hemisphere fill", () => {
    const scene = new THREE.Scene();
    const rig = createTeachingLightingRig(scene, {
      targetWorld: [1, 2, 3],
      keyOffsetWorld: [-2, 4, -3],
    });

    expect(scene.getObjectByName("teaching-lighting-fill")).toBe(rig.fillLight);
    expect(scene.getObjectByName("teaching-lighting-key")).toBe(rig.keyLight);
    expect(rig.fillLight).toBeInstanceOf(THREE.HemisphereLight);
    expect(rig.keyLight.castShadow).toBe(true);
    expect(TEACHING_LIGHTING_CONFIG.shadowMapType).toBe(THREE.PCFShadowMap);
    expect(rig.keyLight.shadow.mapSize.width).toBe(TEACHING_LIGHTING_CONFIG.key.shadowMapSize);
    expect(rig.keyLight.shadow.camera.left).toBe(TEACHING_LIGHTING_CONFIG.key.shadowCamera.left);
    expect(rig.target.position.toArray()).toEqual([1, 2, 3]);
    expect(rig.keyLight.position.toArray()).toEqual([-1, 6, 0]);

    updateTeachingLightingRig(rig, {
      targetWorld: [0, 0, 0],
      keyOffsetWorld: [2, 3, 4],
    });
    expect(rig.keyLight.position.toArray()).toEqual([2, 3, 4]);

    disposeTeachingLightingRig(scene, rig);
    expect(scene.getObjectByName("teaching-lighting-key")).toBeUndefined();
    expect(scene.getObjectByName("teaching-lighting-fill")).toBeUndefined();
    expect(scene.getObjectByName("teaching-lighting-target")).toBeUndefined();
  });

  it("keeps helper geometry out of shadows while opting in lit subjects and receivers", () => {
    const root = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial());
    floor.name = "teaching-floor";
    const subject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    subject.name = "teaching-subject";
    const guide = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    guide.name = "teaching-guide";
    root.add(floor, subject, guide);

    const summary = configureTeachingShadowParticipation(root);

    expect(floor.castShadow).toBe(true);
    expect(floor.receiveShadow).toBe(true);
    expect(subject.castShadow).toBe(true);
    expect(subject.receiveShadow).toBe(false);
    expect(guide.castShadow).toBe(false);
    expect(guide.receiveShadow).toBe(false);
    expect(summary).toEqual({ casterCount: 2, receiverCount: 1 });
  });

  it("configures only the explicit photographic subject root", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    camera.name = "conceptual-camera-body";
    const filmPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial(),
    );
    filmPlane.name = "optical-film-plane";

    const subjectRoot = new THREE.Group();
    const subject = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    subject.name = "photographic-subject";
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshStandardMaterial(),
    );
    floor.name = "subject-floor";
    subjectRoot.add(subject, floor);
    scene.add(camera, filmPlane, subjectRoot);

    configureTeachingShadowParticipation(subjectRoot);

    expect(subject.castShadow).toBe(true);
    expect(floor.receiveShadow).toBe(true);
    expect(camera.castShadow).toBe(false);
    expect(camera.receiveShadow).toBe(false);
    expect(filmPlane.castShadow).toBe(false);
    expect(filmPlane.receiveShadow).toBe(false);
  });
});
