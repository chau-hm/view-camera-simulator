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

const MACRO_WATCH_FINISHES = {
  "Polished rose gold": { metalness: 0.58, roughness: 0.34, emissiveIntensity: 0.12 },
  "Machined rose gold": { metalness: 0.54, roughness: 0.36, emissiveIntensity: 0.12 },
  "Rose gold shoulders": { metalness: 0.5, roughness: 0.42, emissiveIntensity: 0.1 },
  "Polished steel": { metalness: 0.46, roughness: 0.32, emissiveIntensity: 0.08 },
  "Gray steel": { metalness: 0.42, roughness: 0.4, emissiveIntensity: 0.08 },
  "Heat blued steel": { metalness: 0.55, roughness: 0.34, emissiveIntensity: 0.08 },
  "Silver facing": { metalness: 0.25, roughness: 0.4, emissiveIntensity: 0.3 },
  "Hobnail silver": { metalness: 0.22, roughness: 0.4, emissiveIntensity: 0.3 },
  "Spun silver chapter ring": { metalness: 0.2, roughness: 0.45, emissiveIntensity: 0.3 },
  "Gilt brass": { metalness: 0.5, roughness: 0.37, emissiveIntensity: 0.12 },
  "Rhodium bridges": { metalness: 0.48, roughness: 0.42, emissiveIntensity: 0.15 },
  "Perlage mainplate": { metalness: 0.5, roughness: 0.45, emissiveIntensity: 0.15 },
} as const;

/** Keep source metal roles distinct while giving them enough diffuse response under the bounded teaching rig. */
const adaptMacroWatchFinishes = (root: THREE.Object3D): void => {
  const adapted = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      if (adapted.has(material) || !(material instanceof THREE.MeshStandardMaterial)) return;
      adapted.add(material);
      const finish = MACRO_WATCH_FINISHES[material.name as keyof typeof MACRO_WATCH_FINISHES];
      if (!finish) return;
      material.metalness = finish.metalness;
      material.roughness = finish.roughness;
      material.emissive.copy(material.color);
      material.emissiveIntensity = finish.emissiveIntensity;
    });
  });
};

/** Build one independently owned, strapless watch head for Observer or RTT. */
export function createMacroSpecimenGroup(
  _request: MacroBellowsExtensionAssetRequest,
): THREE.Group {
  const watch = createTourbillonWatch({ includeStrap: false });
  const { root } = watch;
  adaptMacroWatchFinishes(root);
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
  // Keep the 60-second cage feature available in the asset, but fixed at its
  // canonical zero phase for repeatable focus and magnification captures.
  watch.setCageAngle(0);
  root.userData.macroWatch = Object.freeze({ strapIncluded: false, cageAngleRad: 0 });
  watchByRoot.set(root, watch);
  return root;
}

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
