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

export type MaterialAwareOutputTransform =
  | "material-aware"
  | "bypass-rgb-transform"
  | "bypass-tone-mapping"
  | "bypass-color-space";

export type MaterialAwareOutputInterventionId = "B0" | "B1" | "B2" | "B3" | "B4";

const toDisplayColor = (linearOutput: Node) =>
  workingToColorSpace(linearOutput, THREE.SRGBColorSpace);

const toDisplayOutput = (
  linearOutput: Node,
  toneMapped: boolean,
  transform: MaterialAwareOutputTransform,
) => {
  if (transform === "bypass-rgb-transform") return linearOutput;
  if (transform === "bypass-tone-mapping") return toDisplayColor(linearOutput);
  if (transform === "bypass-color-space") {
    return toneMapped
      ? toneMapping(THREE.ACESFilmicToneMapping, toneMappingExposure, linearOutput)
      : linearOutput;
  }
  const toneMappedOutput = toneMapped
    ? toneMapping(THREE.ACESFilmicToneMapping, toneMappingExposure, linearOutput)
    : linearOutput;
  return toDisplayColor(toneMappedOutput);
};

/** NodeMaterial output hooks verified by the PR #255 r186 fixture. */
export class MaterialAwareStandardNodeMaterial extends MeshStandardNodeMaterial {
  outputTransform: MaterialAwareOutputTransform = "material-aware";
  outputInterventionId: MaterialAwareOutputInterventionId = "B0";
  outputGraphBuildCount = 0;

  override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}:observer-output:${this.outputTransform}`;
  }

  override setupOutput(
    builder: Parameters<MeshStandardNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<MeshStandardNodeMaterial["setupOutput"]>[1],
  ) {
    this.outputGraphBuildCount += 1;
    const typedOutput = outputNode as Node<"vec4">;
    return super.setupOutput(builder, toDisplayOutput(typedOutput, this.toneMapped, this.outputTransform));
  }
}

export class MaterialAwareBasicNodeMaterial extends MeshBasicNodeMaterial {
  outputTransform: MaterialAwareOutputTransform = "material-aware";
  outputInterventionId: MaterialAwareOutputInterventionId = "B0";
  outputGraphBuildCount = 0;

  override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}:observer-output:${this.outputTransform}`;
  }

  override setupOutput(
    builder: Parameters<MeshBasicNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<MeshBasicNodeMaterial["setupOutput"]>[1],
  ) {
    this.outputGraphBuildCount += 1;
    return super.setupOutput(builder, toDisplayOutput(outputNode, this.toneMapped, this.outputTransform));
  }
}

export class MaterialAwareLineNodeMaterial extends LineBasicNodeMaterial {
  outputTransform: MaterialAwareOutputTransform = "material-aware";
  outputInterventionId: MaterialAwareOutputInterventionId = "B0";
  outputGraphBuildCount = 0;

  override customProgramCacheKey(): string {
    return `${super.customProgramCacheKey()}:observer-output:${this.outputTransform}`;
  }

  override setupOutput(
    builder: Parameters<LineBasicNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<LineBasicNodeMaterial["setupOutput"]>[1],
  ) {
    this.outputGraphBuildCount += 1;
    return super.setupOutput(builder, toDisplayOutput(outputNode, this.toneMapped, this.outputTransform));
  }
}

export const adaptObserverMaterialForOutput = (
  source: THREE.Material,
  outputTransform: MaterialAwareOutputTransform = "material-aware",
  outputInterventionId: MaterialAwareOutputInterventionId = "B0",
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
  const experimentalOutput = output as MaterialAwareNode & {
    outputTransform?: MaterialAwareOutputTransform;
    outputInterventionId?: MaterialAwareOutputInterventionId;
  };
  experimentalOutput.outputTransform = outputTransform;
  experimentalOutput.outputInterventionId = outputInterventionId;
  output.copy(source);
  if (outputTransform !== "material-aware") output.needsUpdate = true;
  Object.defineProperty(output, observerOutputSourceMaterial, {
    configurable: false,
    enumerable: false,
    value: source,
  });
  return output;
};
