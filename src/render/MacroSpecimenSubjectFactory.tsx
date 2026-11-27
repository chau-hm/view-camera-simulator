import * as THREE from "three";
import { createTourbillonWatch } from "./assets/tourbillon-watch/watch.mjs";
import { toWorld } from "./rttUtils";
import { disposeTeachingSubjectResources } from "./TeachingMaterials";
import type { MacroBellowsExtensionPresentation } from "../scenes/presentation/macroBellowsExtension";

export type MacroBellowsExtensionAssetRequest = Readonly<{
  presentation: MacroBellowsExtensionPresentation;
}>;

const watchByRoot = new WeakMap<THREE.Group, ReturnType<typeof createTourbillonWatch>>();
const disposedWatchRoots = new WeakSet<THREE.Group>();
const MILLIMETRES_TO_METRES = 0.001;

/** Preserve authored relief proportions when the millimetre mesh enters a metre world. */
const scaleWatchReliefToWorldUnits = (materials: readonly THREE.Material[]): void => {
  const visited = new Set<THREE.Material>();
  for (const material of materials) {
    if (visited.has(material)) continue;
    visited.add(material);
    if (!(material instanceof THREE.MeshStandardMaterial) || !material.bumpMap) continue;
    material.bumpScale *= MILLIMETRES_TO_METRES;
  }
};

/** Build one independently owned, strapless watch head for Observer or RTT. */
export function createMacroSpecimenGroup(
  _request: MacroBellowsExtensionAssetRequest,
): THREE.Group {
  const watch = createTourbillonWatch({ includeStrap: false });
  const { root } = watch;
  scaleWatchReliefToWorldUnits(watch.materials);
  const caseOriginMm = _request.presentation.geometry.MACRO_BELLOWS_WATCH.caseOriginMm;
  root.name = "macro-bellows-extension-watch-head";
  root.position.set(
    toWorld(caseOriginMm.x),
    toWorld(caseOriginMm.y),
    toWorld(caseOriginMm.z),
  );
  // Research asset local +Z faces the dial. The macro lens is at lower world Z.
  root.rotation.y = Math.PI;
  root.scale.setScalar(0.001);
  // Bump mapping does not displace mesh vertices, but bumpScale is the height
  // amplitude consumed by Three's normal-perturbation shader. Scale the
  // millimetre-authored relief amplitudes with the watch geometry at this boundary.
  watch.setCageAngle(0);
  const crystal = root.getObjectByName("front-sapphire");
  const hideCrystalForCapture = import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("macroWatchCrystal") === "off";
  if (hideCrystalForCapture && crystal) crystal.visible = false;
  root.userData.macroWatch = {
    strapIncluded: false,
    cageAngleRad: 0,
    crystalVisible: crystal?.visible ?? false,
  };
  watchByRoot.set(root, watch);
  return root;
}

/** Apply the shared clock sample to this renderer-owned watch instance. */
export const updateMacroSpecimenCageAngle = (
  root: THREE.Object3D,
  angleRad: number,
): boolean => {
  if (!(root instanceof THREE.Group)) return false;
  const watch = watchByRoot.get(root);
  if (!watch) return false;
  watch.setCageAngle(angleRad);
  const macroWatch = root.userData.macroWatch as
    | { strapIncluded: false; cageAngleRad: number }
    | undefined;
  if (macroWatch) macroWatch.cageAngleRad = angleRad;
  return true;
};

/** Read the real Three.js cage transform for focused runtime verification. */
export const readMacroSpecimenCageAngle = (root: THREE.Object3D): number | null => {
  const watch = root instanceof THREE.Group ? watchByRoot.get(root) : undefined;
  return watch?.cage.rotation.z ?? null;
};

export const disposeMacroSpecimenGroup = (group: THREE.Group): void => {
  if (disposedWatchRoots.has(group)) return;
  const watch = watchByRoot.get(group);
  if (watch) {
    disposedWatchRoots.add(group);
    watchByRoot.delete(group);
    watch.dispose();
    return;
  }
  disposedWatchRoots.add(group);
  disposeTeachingSubjectResources(group);
};
