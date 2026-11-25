import * as THREE from "three";

export const createStockMaterial = ({ family, colorHex, opacity }) => {
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
    ? new THREE.MeshBasicMaterial(parameters)
    : new THREE.MeshStandardMaterial({ ...parameters, roughness: 0.72, metalness: 0 });
  material.userData.mInv10SourceFamily = family;
  return material;
};

export const describeMaterial = (material) => ({
  uuid: material.uuid,
  family: material.constructor.name,
  sourceFamily: material.userData.mInv10SourceFamily ?? null,
  color: material.color?.getHexString(THREE.SRGBColorSpace) ?? null,
  opacity: material.opacity,
  transparent: material.transparent,
  blending: material.blending,
  blendSrc: material.blendSrc,
  blendDst: material.blendDst,
  blendEquation: material.blendEquation,
  blendSrcAlpha: material.blendSrcAlpha,
  blendDstAlpha: material.blendDstAlpha,
  blendEquationAlpha: material.blendEquationAlpha,
  depthTest: material.depthTest,
  depthWrite: material.depthWrite,
  side: material.side,
  premultipliedAlpha: material.premultipliedAlpha,
  toneMapped: material.toneMapped,
  forceSinglePass: material.forceSinglePass ?? null,
});
