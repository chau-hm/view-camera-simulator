import * as THREE from "three";
import type { ResolvedWorldIllumination } from "./worldIlluminationContract";
import {
  worldIlluminationDirectionalToWorld,
  worldIlluminationPointToWorld,
} from "./worldIlluminationContract";

export type WorldIlluminationRig = Readonly<{
  lights: readonly THREE.Light[];
  targets: readonly THREE.Object3D[];
}>;

const assertNever = (source: never): never => {
  throw new Error(`Unsupported world illumination source: ${String(source)}`);
};

export const createWorldIlluminationRig = (
  scene: THREE.Scene,
  illumination: ResolvedWorldIllumination,
): WorldIlluminationRig => {
  const lights: THREE.Light[] = [];
  const targets: THREE.Object3D[] = [];
  illumination.sources.forEach((source) => {
    switch (source.kind) {
      case "point": {
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
        break;
      }
      case "directional": {
        const values = worldIlluminationDirectionalToWorld(source);
        const target = new THREE.Object3D();
        target.name = `${source.id}-target`;
        target.position.set(...values.target);

        const light = new THREE.DirectionalLight(values.color, values.intensity);
        light.name = source.id;
        light.position.set(...values.position);
        light.target = target;
        light.castShadow = values.castShadow;
        scene.add(target, light);
        lights.push(light);
        targets.push(target);
        break;
      }
      default:
        assertNever(source);
    }
  });
  return { lights, targets };
};

export const disposeWorldIlluminationRig = (
  scene: THREE.Scene,
  rig: WorldIlluminationRig,
): void => {
  rig.lights.forEach((light) => {
    scene.remove(light);
    light.dispose();
  });
  rig.targets.forEach((target) => scene.remove(target));
};
