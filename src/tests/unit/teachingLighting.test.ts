import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyPresentationLightingProfile,
  configureTeachingShadowParticipation,
  createPresentationLightingRig,
  disposePresentationLightingRig,
  updatePresentationLightingRig,
} from "../../render/TeachingLighting";
import { resolvePresentationLightingPlacement } from "../../render/presentationLighting";
import {
  PRESENTATION_SHADOW_MAP_TYPE,
  DEFAULT_PRESENTATION_LIGHTING_PLACEMENT,
  TEACHING_PRESENTATION_LIGHTING_PROFILE,
} from "../../render/presentationLightingContract";
import type {
  PresentationLightingProfile,
  ResolvedPresentationLighting,
} from "../../render/presentationLightingContract";

const expectLightsToMatchProfile = (
  fillLight: THREE.HemisphereLight,
  keyLight: THREE.DirectionalLight,
  profile: PresentationLightingProfile,
) => {
  expect(fillLight).toBeInstanceOf(THREE.HemisphereLight);
  expect(fillLight.color.equals(new THREE.Color(profile.fill.skyColor))).toBe(true);
  expect(fillLight.groundColor.equals(new THREE.Color(profile.fill.groundColor))).toBe(true);
  expect(fillLight.intensity).toBe(profile.fill.intensity);
  expect(keyLight).toBeInstanceOf(THREE.DirectionalLight);
  expect(keyLight.color.equals(new THREE.Color(profile.key.color))).toBe(true);
  expect(keyLight.intensity).toBe(profile.key.intensity);
  expect(keyLight.castShadow).toBe(profile.key.castsShadow);
  expect(keyLight.shadow.mapSize.width).toBe(profile.key.shadowMapSize);
  expect(keyLight.shadow.mapSize.height).toBe(profile.key.shadowMapSize);
  expect(keyLight.shadow.bias).toBe(profile.key.shadowBias);
  expect(keyLight.shadow.normalBias).toBe(profile.key.shadowNormalBias);
  expect(keyLight.shadow.camera).toMatchObject(profile.key.shadowCamera);
};

describe("shared presentation lighting", () => {
  it("keeps the canonical teaching recipe separate from placement and renderer policy", () => {
    expect(TEACHING_PRESENTATION_LIGHTING_PROFILE).toEqual({
      id: "teaching-default",
      fill: {
        skyColor: "#ffffff",
        groundColor: "#64748b",
        intensity: 0.55,
      },
      key: {
        color: "#ffffff",
        intensity: 1.15,
        castsShadow: true,
        shadowMapSize: 1024,
        shadowBias: -0.0002,
        shadowNormalBias: 0.015,
        shadowCamera: {
          left: -8,
          right: 8,
          top: 8,
          bottom: -8,
          near: 0.1,
          far: 32,
        },
      },
    });
    expect(Object.keys(TEACHING_PRESENTATION_LIGHTING_PROFILE).sort()).toEqual([
      "fill",
      "id",
      "key",
    ]);
    expect(PRESENTATION_SHADOW_MAP_TYPE).toBe(THREE.PCFShadowMap);
    expect(DEFAULT_PRESENTATION_LIGHTING_PLACEMENT).toEqual({
      targetWorld: [0, 0, 0],
      keyOffsetWorld: [-2.5, 3.5, -2.5],
    });
  });

  it("converts scene intent into the shared world placement", () => {
    expect(
      resolvePresentationLightingPlacement({
        targetMm: { x: 1000, y: -500, z: 2500 },
        keyOffsetWorld: { x: -2, y: 3, z: -4 },
      }),
    ).toEqual({
      targetWorld: [1, -0.5, 2.5],
      keyOffsetWorld: [-2, 3, -4],
    });
  });

  it("creates and updates a rig from one profile and disposes only its owned lights", () => {
    const scene = new THREE.Scene();
    const lighting: ResolvedPresentationLighting = {
      profile: TEACHING_PRESENTATION_LIGHTING_PROFILE,
      placement: {
        targetWorld: [1, 2, 3],
        keyOffsetWorld: [-2, 4, -3],
      },
    };
    const rig = createPresentationLightingRig(scene, lighting);

    expect(scene.getObjectByName("teaching-lighting-fill")).toBe(rig.fillLight);
    expect(scene.getObjectByName("teaching-lighting-key")).toBe(rig.keyLight);
    expectLightsToMatchProfile(
      rig.fillLight,
      rig.keyLight,
      TEACHING_PRESENTATION_LIGHTING_PROFILE,
    );
    expect(rig.target.position.toArray()).toEqual([1, 2, 3]);
    expect(rig.keyLight.position.toArray()).toEqual([-1, 6, 0]);

    const updatedProfile = {
      ...TEACHING_PRESENTATION_LIGHTING_PROFILE,
      id: "test-updated",
      fill: {
        ...TEACHING_PRESENTATION_LIGHTING_PROFILE.fill,
        skyColor: "#ddeeff",
        intensity: 0.7,
      },
      key: {
        ...TEACHING_PRESENTATION_LIGHTING_PROFILE.key,
        intensity: 1.4,
        shadowMapSize: 512,
        shadowBias: -0.001,
        shadowNormalBias: 0.03,
        shadowCamera: {
          ...TEACHING_PRESENTATION_LIGHTING_PROFILE.key.shadowCamera,
          left: -4,
        },
      },
    } satisfies PresentationLightingProfile;
    updatePresentationLightingRig(rig, {
      profile: updatedProfile,
      placement: {
        targetWorld: [0, 0, 0],
        keyOffsetWorld: [2, 3, 4],
      },
    });

    expectLightsToMatchProfile(rig.fillLight, rig.keyLight, updatedProfile);
    expect(rig.keyLight.position.toArray()).toEqual([2, 3, 4]);

    disposePresentationLightingRig(scene, rig);
    expect(scene.getObjectByName("teaching-lighting-key")).toBeUndefined();
    expect(scene.getObjectByName("teaching-lighting-fill")).toBeUndefined();
    expect(scene.getObjectByName("teaching-lighting-target")).toBeUndefined();
  });

  it("applies the same profile recipe to React and imperative rig lights", () => {
    const scene = new THREE.Scene();
    const imperativeRig = createPresentationLightingRig(scene);
    const fillLight = new THREE.HemisphereLight();
    const keyLight = new THREE.DirectionalLight();

    applyPresentationLightingProfile(
      { fillLight, keyLight },
      TEACHING_PRESENTATION_LIGHTING_PROFILE,
    );

    expectLightsToMatchProfile(
      fillLight,
      keyLight,
      TEACHING_PRESENTATION_LIGHTING_PROFILE,
    );
    expectLightsToMatchProfile(
      imperativeRig.fillLight,
      imperativeRig.keyLight,
      TEACHING_PRESENTATION_LIGHTING_PROFILE,
    );
    disposePresentationLightingRig(scene, imperativeRig);
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
