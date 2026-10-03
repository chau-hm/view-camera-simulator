import * as THREE from "three";
import type { ResolvedWorldIllumination } from "./worldIlluminationContract";
import { worldIlluminationPointToWorld } from "./worldIlluminationContract";

export type WorldIlluminationRig = Readonly<{
  lights: readonly THREE.Light[];
}>;

export const createWorldIlluminationRig = (
  scene: THREE.Scene,
  illumination: ResolvedWorldIllumination,
): WorldIlluminationRig => {
  const lights: THREE.Light[] = [];
  illumination.sources.forEach((source) => {
    if (source.kind !== "point") return;
    const values = worldIlluminationPointToWorld(source);
    const light = new THREE.PointLight(
      values.color,
      values.intensity,
      values.distance,
      values.decay,
    );
    light.name = source.id;
    light.position.set(...values.position);
    light.castShadow = values.castShadow;
    scene.add(light);
    lights.push(light);
  });
  return { lights };
};

export const disposeWorldIlluminationRig = (
  scene: THREE.Scene,
  rig: WorldIlluminationRig,
): void => {
  rig.lights.forEach((light) => {
    scene.remove(light);
    light.dispose();
  });
};
