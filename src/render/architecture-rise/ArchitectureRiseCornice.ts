import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../../scenes/presentation/architectureRise";
import type { ArchitectureRiseDetailStyle } from "./ArchitectureRiseDetailConfig";
import type { ArchitectureRiseWindowFactory } from "./ArchitectureRiseWindowDetails";
import { toWorld } from "../rttUtils";

export function getArchitectureRiseCorniceBracketCentersMm(options: {
  facadeWidthMm: number;
  corniceBottomYMm: number;
  layout: ArchitectureRisePresentation["layout"];
  style: ArchitectureRiseDetailStyle;
}): number[] {
  const { facadeWidthMm, corniceBottomYMm, layout, style } = options;
  const { cornice, window } = style;
  const halfWidth = facadeWidthMm / 2;
  const bracketBottomYMm = corniceBottomYMm - cornice.bracketHeightMm;
  const exclusionPaddingMm = cornice.bracketWidthMm / 2 + 20;
  const exclusions = layout.windows
    .filter((item) => item.elevation === "front")
    .filter((item) => item.centerYMm + item.openingHeightMm / 2 + item.trimWidthMm + window.outerLintelThicknessMm >= bracketBottomYMm)
    .map((item) => ({
      min: item.centerXMm - item.openingWidthMm / 2 - item.trimWidthMm - window.outerLintelProjectionMm - exclusionPaddingMm,
      max: item.centerXMm + item.openingWidthMm / 2 + item.trimWidthMm + window.outerLintelProjectionMm + exclusionPaddingMm,
    }))
    .sort((a, b) => a.min - b.min);

  const spans: Array<{ min: number; max: number }> = [];
  let cursor = -halfWidth + cornice.bracketCornerClearanceMm;
  const facadeMax = halfWidth - cornice.bracketCornerClearanceMm;
  exclusions.forEach(({ min, max }) => {
    if (min > cursor) spans.push({ min: cursor, max: Math.min(min, facadeMax) });
    cursor = Math.max(cursor, max);
  });
  if (cursor < facadeMax) spans.push({ min: cursor, max: facadeMax });

  const centers: number[] = [];
  spans.forEach(({ min, max }) => {
    if (max <= min) return;
    const count = Math.max(1, Math.floor((max - min) / cornice.bracketSpacingMm) + 1);
    if (count === 1) {
      centers.push((min + max) / 2);
      return;
    }
    for (let index = 0; index < count; index += 1) {
      centers.push(min + (index * (max - min)) / (count - 1));
    }
  });
  return centers;
}

export function createArchitectureRiseCorniceBracketGeometry(
  style: ArchitectureRiseDetailStyle["cornice"],
): THREE.ExtrudeGeometry {
  const width = toWorld(style.bracketWidthMm);
  const height = toWorld(style.bracketHeightMm);
  const depth = toWorld(style.bracketDepthMm);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width * 0.42, height * 0.18);
  shape.lineTo(width * 0.29, height * 0.34);
  shape.lineTo(width * 0.2, height * 0.54);
  shape.lineTo(width * 0.33, height * 0.7);
  shape.lineTo(width / 2, height * 0.82);
  shape.lineTo(width / 2, height);
  shape.lineTo(-width / 2, height);
  shape.lineTo(-width / 2, height * 0.82);
  shape.lineTo(-width * 0.33, height * 0.7);
  shape.lineTo(-width * 0.2, height * 0.54);
  shape.lineTo(-width * 0.29, height * 0.34);
  shape.lineTo(-width * 0.42, height * 0.18);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: toWorld(4),
    bevelThickness: toWorld(4),
    steps: 1,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  geometry.userData.architectureRiseRole = "cornice-support-bracket";
  return geometry;
}

export function addArchitectureRiseCorniceBrackets(options: {
  parent: THREE.Group;
  frontFacadeZMm: number;
  facadeWidthMm: number;
  corniceCenterYMm: number;
  layout: ArchitectureRisePresentation["layout"];
  style: ArchitectureRiseDetailStyle;
  material: THREE.Material;
  bracketGeometry: THREE.BufferGeometry;
  corniceDepthMm: number;
}): THREE.Mesh[] {
  const {
    parent,
    frontFacadeZMm,
    facadeWidthMm,
    corniceCenterYMm,
    layout,
    style,
    material,
    bracketGeometry,
    corniceDepthMm,
  } = options;
  const corniceBottomYMm = corniceCenterYMm - style.cornice.bandHeightMm / 2;
  const centers = getArchitectureRiseCorniceBracketCentersMm({
    facadeWidthMm,
    corniceBottomYMm,
    layout,
    style,
  });
  const corniceFrontZMm = frontFacadeZMm + 20 - corniceDepthMm / 2;
  const bracketCenterZMm = corniceFrontZMm + style.cornice.bracketDepthMm / 2 - 8;
  const meshes = centers.map((centerXMm, index) => {
    const bracket = new THREE.Mesh(bracketGeometry, material);
    bracket.name = `architecture-rise-cornice-bracket-${index + 1}`;
    bracket.position.set(
      toWorld(centerXMm),
      toWorld(corniceBottomYMm - style.cornice.bracketHeightMm),
      toWorld(bracketCenterZMm),
    );
    bracket.castShadow = true;
    bracket.receiveShadow = true;
    bracket.userData.architectureRole = "cornice-support-bracket";
    bracket.userData.centerXMm = centerXMm;
    parent.add(bracket);
    return bracket;
  });
  parent.userData.corniceBracketCentersMm = centers;
  parent.userData.corniceBracketSpacingMm = style.cornice.bracketSpacingMm;
  return meshes;
}

export function addArchitectureRiseParapetPierCaps(options: {
  parent: THREE.Group;
  addBox: ArchitectureRiseWindowFactory;
  facadeWidthMm: number;
  parapetTopYMm: number;
  frontFacadeZMm: number;
  material: THREE.Material;
  style: ArchitectureRiseDetailStyle["cornice"];
}): void {
  const { parent, addBox, facadeWidthMm, parapetTopYMm, frontFacadeZMm, material, style } = options;
  const pierWidthMm = 96;
  const pierDepthMm = 140;
  const capHeightMm = 46;
  const capDepthMm = 160;
  [-1, 1].forEach((sign) => {
    const centerXMm = sign * (facadeWidthMm / 2 - 120);
    addBox({
      name: `architecture-rise-parapet-pier-${sign < 0 ? "left" : "right"}`,
      size: [pierWidthMm, style.parapetCourseHeightMm, pierDepthMm],
      position: [centerXMm, parapetTopYMm - style.parapetCourseHeightMm / 2, frontFacadeZMm - 18],
      material,
      parent,
    });
    addBox({
      name: `architecture-rise-parapet-pier-cap-${sign < 0 ? "left" : "right"}`,
      size: [pierWidthMm + 44, capHeightMm, capDepthMm],
      position: [centerXMm, parapetTopYMm - capHeightMm / 2, frontFacadeZMm - 20],
      material,
      parent,
    });
  });
}
