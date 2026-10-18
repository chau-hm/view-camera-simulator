import * as THREE from "three";
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  color,
  toneMapping,
  toneMappingExposure,
  vec4,
  workingToColorSpace,
} from "three/tsl";

const toDisplayOutput = (outputNode, toneMapped) => {
  const toneMappedOutput = toneMapped
    ? toneMapping(THREE.ACESFilmicToneMapping, toneMappingExposure, outputNode)
    : outputNode;
  return workingToColorSpace(toneMappedOutput, THREE.SRGBColorSpace);
};

/** Minimal copy of the app's public NodeMaterial.setupOutput adapter boundary. */
class MaterialAwareStandardNodeMaterial extends MeshStandardNodeMaterial {
  customProgramCacheKey() {
    return `${super.customProgramCacheKey()}:m-inv10:material-aware`;
  }

  setupOutput(builder, outputNode) {
    return super.setupOutput(builder, toDisplayOutput(outputNode, this.toneMapped));
  }
}

class MaterialAwareBasicNodeMaterial extends MeshBasicNodeMaterial {
  customProgramCacheKey() {
    return `${super.customProgramCacheKey()}:m-inv10:material-aware`;
  }

  setupOutput(builder, outputNode) {
    return super.setupOutput(builder, toDisplayOutput(outputNode, this.toneMapped));
  }
}

export const createAdapterMaterial = ({ family, colorHex, opacity }) => {
  const parameters = {
    color: colorHex,
    opacity,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    premultipliedAlpha: false,
    toneMapped: true,
    forceSinglePass: false,
  };
  const material = family === "basic"
    ? new MaterialAwareBasicNodeMaterial(parameters)
    : new MaterialAwareStandardNodeMaterial({ ...parameters, roughness: 0.72, metalness: 0 });
  material.userData.mInv10SourceFamily = family;
  return material;
};

export const createDisplaySpaceBackgroundNode = (backgroundHex) =>
  workingToColorSpace(vec4(color(new THREE.Color(backgroundHex)), 1), THREE.SRGBColorSpace);
