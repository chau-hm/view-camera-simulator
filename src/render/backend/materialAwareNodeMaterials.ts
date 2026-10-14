import * as THREE from "three";
import {
  LineBasicNodeMaterial,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  type Node,
} from "three/webgpu";
import {
  toneMapping,
  toneMappingExposure,
  workingToColorSpace,
} from "three/tsl";
import { observerOutputSourceMaterial } from "./observerMaterialOutputIdentity";

export const OBSERVER_MATERIAL_MAP_SLOTS = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
] as const;

export type MaterialAwareNode = THREE.Material & { copy: (source: THREE.Material) => unknown };

const toDisplayColor = (linearOutput: Node) =>
  workingToColorSpace(linearOutput, THREE.SRGBColorSpace);

/** NodeMaterial output hooks verified by the PR #255 r186 fixture. */
export class MaterialAwareStandardNodeMaterial extends MeshStandardNodeMaterial {
  override setupOutput(
    builder: Parameters<MeshStandardNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<MeshStandardNodeMaterial["setupOutput"]>[1],
  ) {
    const typedOutput = outputNode as Node<"vec4">;
    const toneMappedOutput = this.toneMapped
      ? toneMapping(THREE.ACESFilmicToneMapping, toneMappingExposure, typedOutput)
      : typedOutput;
    return super.setupOutput(builder, toDisplayColor(toneMappedOutput));
  }
}

export class MaterialAwareBasicNodeMaterial extends MeshBasicNodeMaterial {
  override setupOutput(
    builder: Parameters<MeshBasicNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<MeshBasicNodeMaterial["setupOutput"]>[1],
  ) {
    return super.setupOutput(builder, toDisplayColor(outputNode));
  }
}

export class MaterialAwareLineNodeMaterial extends LineBasicNodeMaterial {
  override setupOutput(
    builder: Parameters<LineBasicNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<LineBasicNodeMaterial["setupOutput"]>[1],
  ) {
    return super.setupOutput(builder, toDisplayColor(outputNode));
  }
}

export const adaptObserverMaterialForOutput = (
  source: THREE.Material,
): MaterialAwareNode | null => {
  let output: MaterialAwareNode | null = null;
  if (source.constructor === THREE.MeshStandardMaterial) {
    output = new MaterialAwareStandardNodeMaterial() as MaterialAwareNode;
  } else if (source.constructor === THREE.MeshBasicMaterial) {
    output = new MaterialAwareBasicNodeMaterial() as MaterialAwareNode;
  } else if (source.constructor === THREE.LineBasicMaterial) {
    output = new MaterialAwareLineNodeMaterial() as MaterialAwareNode;
  }
  if (!output) return null;
  output.copy(source);
  Object.defineProperty(output, observerOutputSourceMaterial, {
    configurable: false,
    enumerable: false,
    value: source,
  });
  return output;
};
