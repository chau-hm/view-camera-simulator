/* eslint-disable react-refresh/only-export-components */
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { SceneSubjectRttLighting } from "./sceneSubjectRegistry";
import { vecToWorld } from "./rttUtils";
import {
  collectSceneGraphCapacity,
  isSceneCapacityProfilingEnabled,
  type SceneGraphCapacityMetrics,
} from "./sceneCapacityProfiling";

export const TEACHING_LIGHTING_CONFIG = {
  shadowMapType: THREE.PCFShadowMap,
  fill: {
    skyColor: "#ffffff",
    groundColor: "#64748b",
    intensity: 0.55,
  },
  key: {
    color: "#ffffff",
    intensity: 1.15,
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
  defaultKeyOffsetWorld: [-2.5, 3.5, -2.5] as const,
} as const;

export type TeachingLightingPlacement = Readonly<{
  targetWorld: readonly [number, number, number];
  keyOffsetWorld: readonly [number, number, number];
}>;

export const DEFAULT_TEACHING_LIGHTING_PLACEMENT: TeachingLightingPlacement = {
  targetWorld: [0, 0, 0],
  keyOffsetWorld: TEACHING_LIGHTING_CONFIG.defaultKeyOffsetWorld,
};

export const resolveTeachingLightingPlacement = (
  lighting?: SceneSubjectRttLighting,
): TeachingLightingPlacement => ({
  targetWorld: lighting
    ? vecToWorld(lighting.targetMm)
    : DEFAULT_TEACHING_LIGHTING_PLACEMENT.targetWorld,
  keyOffsetWorld: lighting
    ? [lighting.keyOffsetWorld.x, lighting.keyOffsetWorld.y, lighting.keyOffsetWorld.z]
    : TEACHING_LIGHTING_CONFIG.defaultKeyOffsetWorld,
});

const SHADOW_HELPER_NAME =
  /(?:line|guide|overlay|axis|crosshair|scheimpflug|lattice|construction|ray|frustum|measurement|legend|diagnostic|dof)/i;
const SHADOW_RECEIVER_NAME =
  /(?:ground|floor|tabletop|wall|backdrop|rug|surface|room|roof|plinth)/i;

const isLitMaterial = (material: THREE.Material): boolean =>
  material instanceof THREE.MeshStandardMaterial ||
  material instanceof THREE.MeshPhysicalMaterial ||
  material instanceof THREE.MeshLambertMaterial ||
  material instanceof THREE.MeshPhongMaterial;

const hasLitMaterial = (mesh: THREE.Mesh): boolean => {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some(isLitMaterial);
};

export type TeachingShadowParticipationSummary = Readonly<{
  casterCount: number;
  receiverCount: number;
}>;

/**
 * Opt subjects into the restrained teaching shadow pass without affecting
 * basic-material helpers, guides, or diagnostic overlays.
 */
export const configureTeachingShadowParticipation = (
  root: THREE.Object3D,
): TeachingShadowParticipationSummary => {
  let casterCount = 0;
  let receiverCount = 0;

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    const lit = hasLitMaterial(object);
    const helper = SHADOW_HELPER_NAME.test(object.name);
    const receiver =
      lit &&
      !helper &&
      (SHADOW_RECEIVER_NAME.test(object.name) || object.geometry instanceof THREE.PlaneGeometry);

    object.castShadow = lit && !helper;
    object.receiveShadow = receiver;

    if (object.castShadow) casterCount += 1;
    if (object.receiveShadow) receiverCount += 1;
  });

  return { casterCount, receiverCount };
};

const configureDirectionalShadow = (light: THREE.DirectionalLight): void => {
  const { key } = TEACHING_LIGHTING_CONFIG;
  light.castShadow = true;
  light.shadow.mapSize.set(key.shadowMapSize, key.shadowMapSize);
  light.shadow.bias = key.shadowBias;
  light.shadow.normalBias = key.shadowNormalBias;
  light.shadow.camera.left = key.shadowCamera.left;
  light.shadow.camera.right = key.shadowCamera.right;
  light.shadow.camera.top = key.shadowCamera.top;
  light.shadow.camera.bottom = key.shadowCamera.bottom;
  light.shadow.camera.near = key.shadowCamera.near;
  light.shadow.camera.far = key.shadowCamera.far;
  light.shadow.camera.updateProjectionMatrix();
};

export type TeachingLightingRig = Readonly<{
  fillLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  target: THREE.Object3D;
}>;

export const updateTeachingLightingRig = (
  rig: TeachingLightingRig,
  placement: TeachingLightingPlacement,
): void => {
  const [targetX, targetY, targetZ] = placement.targetWorld;
  const [offsetX, offsetY, offsetZ] = placement.keyOffsetWorld;
  rig.target.position.set(targetX, targetY, targetZ);
  rig.keyLight.position.set(targetX + offsetX, targetY + offsetY, targetZ + offsetZ);
  rig.keyLight.target = rig.target;
  rig.target.updateMatrixWorld();
  rig.keyLight.updateMatrixWorld();
};

export const createTeachingLightingRig = (
  scene: THREE.Scene,
  placement: TeachingLightingPlacement = DEFAULT_TEACHING_LIGHTING_PLACEMENT,
): TeachingLightingRig => {
  const fillLight = new THREE.HemisphereLight(
    TEACHING_LIGHTING_CONFIG.fill.skyColor,
    TEACHING_LIGHTING_CONFIG.fill.groundColor,
    TEACHING_LIGHTING_CONFIG.fill.intensity,
  );
  fillLight.name = "teaching-lighting-fill";

  const keyLight = new THREE.DirectionalLight(
    TEACHING_LIGHTING_CONFIG.key.color,
    TEACHING_LIGHTING_CONFIG.key.intensity,
  );
  keyLight.name = "teaching-lighting-key";

  const target = new THREE.Object3D();
  target.name = "teaching-lighting-target";
  keyLight.target = target;

  configureDirectionalShadow(keyLight);
  scene.add(fillLight, target, keyLight);

  const rig = { fillLight, keyLight, target };
  updateTeachingLightingRig(rig, placement);
  return rig;
};

export const disposeTeachingLightingRig = (scene: THREE.Scene, rig: TeachingLightingRig): void => {
  scene.remove(rig.fillLight, rig.keyLight, rig.target);
  rig.keyLight.dispose();
};

export const TeachingLighting = ({
  placement = DEFAULT_TEACHING_LIGHTING_PLACEMENT,
}: {
  placement?: TeachingLightingPlacement;
}) => {
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.name = "teaching-lighting-target";
    return object;
  }, []);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const targetX = placement.targetWorld[0];
  const targetY = placement.targetWorld[1];
  const targetZ = placement.targetWorld[2];
  const offsetX = placement.keyOffsetWorld[0];
  const offsetY = placement.keyOffsetWorld[1];
  const offsetZ = placement.keyOffsetWorld[2];
  const keyPosition = useMemo(
    () => [targetX + offsetX, targetY + offsetY, targetZ + offsetZ] as [number, number, number],
    [offsetX, offsetY, offsetZ, targetX, targetY, targetZ],
  );

  useLayoutEffect(() => {
    target.position.set(targetX, targetY, targetZ);
    target.updateMatrixWorld();
    const keyLight = keyLightRef.current;
    if (!keyLight) return;
    keyLight.target = target;
    configureDirectionalShadow(keyLight);
    keyLight.updateMatrixWorld();
  }, [offsetX, offsetY, offsetZ, targetX, targetY, targetZ, target]);

  return (
    <>
      <hemisphereLight
        name="teaching-lighting-fill"
        args={[
          TEACHING_LIGHTING_CONFIG.fill.skyColor,
          TEACHING_LIGHTING_CONFIG.fill.groundColor,
          TEACHING_LIGHTING_CONFIG.fill.intensity,
        ]}
      />
      <directionalLight
        ref={keyLightRef}
        name="teaching-lighting-key"
        position={keyPosition}
        intensity={TEACHING_LIGHTING_CONFIG.key.intensity}
        castShadow
        target={target}
      />
      <primitive object={target} dispose={null} />
    </>
  );
};

export const TeachingShadowParticipation = ({
  subjectKey,
  children,
  onCapacityChange,
}: {
  subjectKey: string;
  children: ReactNode;
  onCapacityChange?: (metrics: SceneGraphCapacityMetrics | null) => void;
}) => {
  const subjectRootRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const subjectRoot = subjectRootRef.current;
    if (!subjectRoot) return;
    configureTeachingShadowParticipation(subjectRoot);
    onCapacityChange?.(
      isSceneCapacityProfilingEnabled()
        ? collectSceneGraphCapacity(subjectRoot)
        : null,
    );
    return () => onCapacityChange?.(null);
  }, [onCapacityChange, subjectKey]);

  return (
    <group ref={subjectRootRef} name="teaching-shadow-subject">
      {children}
    </group>
  );
};
