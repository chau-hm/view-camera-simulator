/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";
import {
  DEFAULT_PRESENTATION_LIGHTING,
  type PresentationLightingProfile,
  type ResolvedPresentationLighting,
} from "./presentationLightingContract";
import {
  collectSceneGraphCapacity,
  isSceneCapacityProfilingEnabled,
  type SceneGraphCapacityMetrics,
} from "./sceneCapacityProfiling";

const SHADOW_HELPER_NAME =
  /(?:line|guide|overlay|axis|crosshair|scheimpflug|lattice|construction|ray|frustum|measurement|legend|diagnostic|dof)/i;
const SHADOW_RECEIVER_NAME =
  /(?:ground|floor|tabletop|wall|backdrop|rug|surface|room|roof|plinth)/i;
const TeachingShadowParticipationRefreshContext = createContext<(() => void) | null>(null);
const NOOP = (): void => undefined;

/** Reapplies scene shadow policy after an effect-owned subject graph mounts. */
export const useRefreshTeachingShadowParticipation = (): (() => void) =>
  useContext(TeachingShadowParticipationRefreshContext) ?? NOOP;

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

const configureDirectionalShadow = (
  light: THREE.DirectionalLight,
  profile: PresentationLightingProfile,
): void => {
  const { key } = profile;
  const shadow = light.shadow;
  const requestedMapSize = key.shadowMapSize;
  const mapSizeChanged =
    shadow.mapSize.x !== requestedMapSize ||
    shadow.mapSize.y !== requestedMapSize;

  light.castShadow = key.castsShadow;
  if (mapSizeChanged) shadow.mapSize.set(requestedMapSize, requestedMapSize);

  // LightShadow.mapSize configures the next map, but does not resize a target
  // that the renderer has already created. Keep that target aligned with the
  // applied profile through Three.js' public RenderTarget lifecycle.
  const shadowMap = shadow.map;
  if (
    shadowMap &&
    (shadowMap.width !== requestedMapSize || shadowMap.height !== requestedMapSize)
  ) {
    shadowMap.setSize(requestedMapSize, requestedMapSize);
  }

  shadow.bias = key.shadowBias;
  shadow.normalBias = key.shadowNormalBias;
  shadow.camera.left = key.shadowCamera.left;
  shadow.camera.right = key.shadowCamera.right;
  shadow.camera.top = key.shadowCamera.top;
  shadow.camera.bottom = key.shadowCamera.bottom;
  shadow.camera.near = key.shadowCamera.near;
  shadow.camera.far = key.shadowCamera.far;
  shadow.camera.updateProjectionMatrix();
};

export type PresentationLightingRig = Readonly<{
  fillLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  target: THREE.Object3D;
}>;

export const applyPresentationLightingProfile = (
  rig: Pick<PresentationLightingRig, "fillLight" | "keyLight">,
  profile: PresentationLightingProfile,
): void => {
  rig.fillLight.color.set(profile.fill.skyColor);
  rig.fillLight.groundColor.set(profile.fill.groundColor);
  rig.fillLight.intensity = profile.fill.intensity;
  rig.keyLight.color.set(profile.key.color);
  rig.keyLight.intensity = profile.key.intensity;
  configureDirectionalShadow(rig.keyLight, profile);
};

export const updatePresentationLightingRig = (
  rig: PresentationLightingRig,
  lighting: ResolvedPresentationLighting,
): void => {
  applyPresentationLightingProfile(rig, lighting.profile);
  const [targetX, targetY, targetZ] = lighting.placement.targetWorld;
  const [offsetX, offsetY, offsetZ] = lighting.placement.keyOffsetWorld;
  rig.target.position.set(targetX, targetY, targetZ);
  rig.keyLight.position.set(targetX + offsetX, targetY + offsetY, targetZ + offsetZ);
  rig.keyLight.target = rig.target;
  rig.target.updateMatrixWorld();
  rig.keyLight.updateMatrixWorld();
};

export const createPresentationLightingRig = (
  scene: THREE.Scene,
  lighting: ResolvedPresentationLighting = DEFAULT_PRESENTATION_LIGHTING,
): PresentationLightingRig => {
  const { profile } = lighting;
  const fillLight = new THREE.HemisphereLight(
    profile.fill.skyColor,
    profile.fill.groundColor,
    profile.fill.intensity,
  );
  fillLight.name = "teaching-lighting-fill";

  const keyLight = new THREE.DirectionalLight(
    profile.key.color,
    profile.key.intensity,
  );
  keyLight.name = "teaching-lighting-key";

  const target = new THREE.Object3D();
  target.name = "teaching-lighting-target";
  keyLight.target = target;

  scene.add(fillLight, target, keyLight);

  const rig = { fillLight, keyLight, target };
  updatePresentationLightingRig(rig, lighting);
  return rig;
};

export const disposePresentationLightingRig = (
  scene: THREE.Scene,
  rig: PresentationLightingRig,
): void => {
  scene.remove(rig.fillLight, rig.keyLight, rig.target);
  rig.keyLight.dispose();
};

export const PresentationLighting = ({
  lighting = DEFAULT_PRESENTATION_LIGHTING,
}: {
  lighting?: ResolvedPresentationLighting;
}) => {
  const { profile, placement } = lighting;
  const target = useMemo(() => {
    const object = new THREE.Object3D();
    object.name = "teaching-lighting-target";
    return object;
  }, []);
  const fillLightRef = useRef<THREE.HemisphereLight>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const targetX = placement.targetWorld[0];
  const targetY = placement.targetWorld[1];
  const targetZ = placement.targetWorld[2];
  const offsetX = placement.keyOffsetWorld[0];
  const offsetY = placement.keyOffsetWorld[1];
  const offsetZ = placement.keyOffsetWorld[2];
  const keyPosition = useMemo(
    () => [targetX + offsetX, targetY + offsetY, targetZ + offsetZ] as [
      number,
      number,
      number,
    ],
    [offsetX, offsetY, offsetZ, targetX, targetY, targetZ],
  );

  useLayoutEffect(() => {
    target.position.set(targetX, targetY, targetZ);
    target.updateMatrixWorld();
    const fillLight = fillLightRef.current;
    const keyLight = keyLightRef.current;
    if (!fillLight || !keyLight) return;
    keyLight.target = target;
    applyPresentationLightingProfile({ fillLight, keyLight }, profile);
    keyLight.position.set(...keyPosition);
    keyLight.updateMatrixWorld();
  }, [keyPosition, profile, target, targetX, targetY, targetZ]);

  return (
    <>
      <hemisphereLight
        ref={fillLightRef}
        name="teaching-lighting-fill"
        args={[
          profile.fill.skyColor,
          profile.fill.groundColor,
          profile.fill.intensity,
        ]}
      />
      <directionalLight
        ref={keyLightRef}
        name="teaching-lighting-key"
        color={profile.key.color}
        position={keyPosition}
        intensity={profile.key.intensity}
        castShadow={profile.key.castsShadow}
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
  const refreshSubjectGraph = useCallback(() => {
    const subjectRoot = subjectRootRef.current;
    if (!subjectRoot) return;
    configureTeachingShadowParticipation(subjectRoot);
    onCapacityChange?.(
      isSceneCapacityProfilingEnabled()
        ? collectSceneGraphCapacity(subjectRoot)
        : null,
    );
  }, [onCapacityChange]);

  useLayoutEffect(() => {
    refreshSubjectGraph();
    return () => onCapacityChange?.(null);
  }, [onCapacityChange, refreshSubjectGraph, subjectKey]);

  return (
    <TeachingShadowParticipationRefreshContext.Provider value={refreshSubjectGraph}>
      <group ref={subjectRootRef} name="teaching-shadow-subject">
        {children}
      </group>
    </TeachingShadowParticipationRefreshContext.Provider>
  );
};
