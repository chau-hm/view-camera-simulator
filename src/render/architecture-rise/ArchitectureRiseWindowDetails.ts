import * as THREE from "three";
import {
  getArchitectureRiseGlazingBoundsMm,
  type ArchitectureRiseEastWindow,
  type ArchitectureRiseFrontWindow,
  type ArchitectureRiseWindow,
} from "../../scenes/presentation/architectureRiseLayout";
import type { ArchitectureRiseDetailStyle } from "./ArchitectureRiseDetailConfig";

export type ArchitectureRiseWindowBoxSpec = Readonly<{
  name: string;
  size: readonly [number, number, number];
  position: readonly [number, number, number];
  material: THREE.Material;
  parent: THREE.Object3D;
}>;

export type ArchitectureRiseWindowMaterials = Readonly<{
  glass: THREE.Material;
  trim: THREE.Material;
}>;

export type ArchitectureRiseWindowFactory = (spec: ArchitectureRiseWindowBoxSpec) => THREE.Mesh;

export function addArchitectureRiseWindowAssembly(options: {
  root: THREE.Object3D;
  window: ArchitectureRiseWindow;
  frontFacadeZMm: number;
  eastFacadeXMm: number;
  materials: ArchitectureRiseWindowMaterials;
  style: ArchitectureRiseDetailStyle["window"];
  addBox: ArchitectureRiseWindowFactory;
}): THREE.Group {
  const { root, window, frontFacadeZMm, eastFacadeXMm, materials, style, addBox } = options;
  const group = new THREE.Group();
  const name = `architecture-rise-window-${window.id}`;
  group.name = name;
  group.userData.glazingBoundsMm = getArchitectureRiseGlazingBoundsMm(window);
  group.userData.architectureRole = "window-assembly";
  group.userData.resources = root.userData.resources;
  root.add(group);

  if (window.elevation === "front") {
    addFrontWindow({ group, name, window, frontFacadeZMm, materials, style, addBox });
  } else {
    addEastWindow({ group, name, window, eastFacadeXMm, materials, style, addBox });
  }

  return group;
}

function addFrontWindow(options: {
  group: THREE.Group;
  name: string;
  window: ArchitectureRiseFrontWindow;
  frontFacadeZMm: number;
  materials: ArchitectureRiseWindowMaterials;
  style: ArchitectureRiseDetailStyle["window"];
  addBox: ArchitectureRiseWindowFactory;
}): void {
  const { group, name, window, frontFacadeZMm: front, materials, style, addBox } = options;
  const z = front + window.glazingInsetMm;
  const glassWidth = window.openingWidthMm - 36;
  const glassHeight = window.openingHeightMm - 36;
  const revealDepth = window.glazingInsetMm - window.glazingDepthMm / 2;
  const bottom = window.centerYMm - window.openingHeightMm / 2;
  const top = window.centerYMm + window.openingHeightMm / 2;

  addBox({
    name: `${name}-glazing`,
    size: [glassWidth, glassHeight, window.glazingDepthMm],
    position: [window.centerXMm, window.centerYMm, z],
    material: materials.glass,
    parent: group,
  });
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-reveal-jamb-${sign < 0 ? "left" : "right"}`,
    size: [18, window.openingHeightMm, revealDepth],
    position: [window.centerXMm + sign * (window.openingWidthMm / 2 - 9), window.centerYMm, front + revealDepth / 2],
    material: materials.trim,
    parent: group,
  }));
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-reveal-head-${sign < 0 ? "lower" : "upper"}`,
    size: [window.openingWidthMm - 36, 18, revealDepth],
    position: [window.centerXMm, window.centerYMm + sign * (window.openingHeightMm / 2 - 9), front + revealDepth / 2],
    material: materials.trim,
    parent: group,
  }));

  const stoneDepth = 56;
  const stoneZ = front - stoneDepth / 2 + 12;
  const trimWidth = window.trimWidthMm;
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-stone-jamb-${sign < 0 ? "left" : "right"}`,
    size: [trimWidth, window.openingHeightMm, stoneDepth],
    position: [window.centerXMm + sign * (window.openingWidthMm / 2 + trimWidth / 2), window.centerYMm, stoneZ],
    material: materials.trim,
    parent: group,
  }));
  [
    { id: "lintel", sign: 1 },
    { id: "sill", sign: -1 },
  ].forEach(({ id, sign }) => addBox({
    name: `${name}-stone-${id}`,
    size: [window.openingWidthMm + 2 * trimWidth, trimWidth, stoneDepth],
    position: [window.centerXMm, window.centerYMm + sign * (window.openingHeightMm / 2 + trimWidth / 2), stoneZ],
    material: materials.trim,
    parent: group,
  }));

  const profileZ = stoneZ - style.surroundReliefMm / 2;
  const profileDepth = stoneDepth + style.surroundReliefMm;
  addBox({
    name: `${name}-profile-sill-cap`,
    size: [window.openingWidthMm + 2 * trimWidth + 2 * style.outerSillProjectionMm, style.outerSillThicknessMm, profileDepth],
    position: [window.centerXMm, bottom - trimWidth - style.outerSillThicknessMm / 2, profileZ],
    material: materials.trim,
    parent: group,
  });
  addBox({
    name: `${name}-profile-lintel-cap`,
    size: [window.openingWidthMm + 2 * trimWidth + 2 * style.outerLintelProjectionMm, style.outerLintelThicknessMm, profileDepth],
    position: [window.centerXMm, top + trimWidth + style.outerLintelThicknessMm / 2, profileZ],
    material: materials.trim,
    parent: group,
  });

  // A small raised center block is a restrained voussoir cue, not a new opening.
  addBox({
    name: `${name}-lintel-keystone`,
    size: [style.keystoneWidthMm, trimWidth + 8, profileDepth + 10],
    position: [window.centerXMm, top + trimWidth / 2, profileZ - 5],
    material: materials.trim,
    parent: group,
  });
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-sill-bracket-${sign < 0 ? "left" : "right"}`,
    size: [style.sillBracketWidthMm, style.sillBracketHeightMm, style.sillBracketDepthMm],
    position: [
      window.centerXMm + sign * (window.openingWidthMm / 2 + trimWidth / 2),
      bottom - trimWidth - style.outerSillThicknessMm - style.sillBracketHeightMm / 2,
      profileZ,
    ],
    material: materials.trim,
    parent: group,
  }));

  const frameZ = z - window.glazingDepthMm / 2 - 4;
  const frameDepth = 18;
  addBox({
    name: `${name}-mullion`,
    size: [window.mullionWidthMm, glassHeight, frameDepth],
    position: [window.centerXMm, window.centerYMm, frameZ],
    material: materials.trim,
    parent: group,
  });
  addBox({
    name: `${name}-transom`,
    size: [glassWidth, window.transomHeightMm, frameDepth],
    position: [window.centerXMm, window.centerYMm + glassHeight * 0.2, frameZ],
    material: materials.trim,
    parent: group,
  });

  group.userData.windowStyle = {
    elevation: "front",
    lintel: "layered-stone-with-raised-center",
    sill: "projecting-stone-with-support-brackets",
    projectionMm: style.surroundReliefMm,
  };
}

function addEastWindow(options: {
  group: THREE.Group;
  name: string;
  window: ArchitectureRiseEastWindow;
  eastFacadeXMm: number;
  materials: ArchitectureRiseWindowMaterials;
  style: ArchitectureRiseDetailStyle["window"];
  addBox: ArchitectureRiseWindowFactory;
}): void {
  const { group, name, window, eastFacadeXMm: eastFace, materials, style, addBox } = options;
  const glassCenterX = eastFace - window.glazingInsetMm;
  const glassWidth = window.openingWidthMm - 36;
  const glassHeight = window.openingHeightMm - 36;
  const revealDepth = window.glazingInsetMm - window.glazingDepthMm / 2;
  const bottom = window.centerYMm - window.openingHeightMm / 2;
  const top = window.centerYMm + window.openingHeightMm / 2;

  addBox({
    name: `${name}-glazing`,
    size: [window.glazingDepthMm, glassHeight, glassWidth],
    position: [glassCenterX, window.centerYMm, window.centerZMm],
    material: materials.glass,
    parent: group,
  });
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-reveal-jamb-${sign < 0 ? "near" : "far"}`,
    size: [revealDepth, window.openingHeightMm, 18],
    position: [eastFace - revealDepth / 2, window.centerYMm, window.centerZMm + sign * (window.openingWidthMm / 2 - 9)],
    material: materials.trim,
    parent: group,
  }));
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-reveal-${sign < 0 ? "sill" : "head"}`,
    size: [revealDepth, 18, glassWidth],
    position: [eastFace - revealDepth / 2, window.centerYMm + sign * (window.openingHeightMm / 2 - 9), window.centerZMm],
    material: materials.trim,
    parent: group,
  }));

  const stoneDepth = 56;
  const stoneX = eastFace + stoneDepth / 2 - 12;
  const trimWidth = window.trimWidthMm;
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-stone-jamb-${sign < 0 ? "near" : "far"}`,
    size: [stoneDepth, window.openingHeightMm, trimWidth],
    position: [stoneX, window.centerYMm, window.centerZMm + sign * (window.openingWidthMm / 2 + trimWidth / 2)],
    material: materials.trim,
    parent: group,
  }));
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-stone-${sign < 0 ? "sill" : "lintel"}`,
    size: [stoneDepth, trimWidth, window.openingWidthMm + 2 * trimWidth],
    position: [stoneX, window.centerYMm + sign * (window.openingHeightMm / 2 + trimWidth / 2), window.centerZMm],
    material: materials.trim,
    parent: group,
  }));

  const profileDepth = stoneDepth + style.surroundReliefMm;
  const profileCenterX = stoneX + style.surroundReliefMm / 2;
  addBox({
    name: `${name}-profile-sill-cap`,
    size: [profileDepth, style.outerSillThicknessMm, window.openingWidthMm + 2 * trimWidth + 2 * style.outerSillProjectionMm],
    position: [profileCenterX, bottom - trimWidth - style.outerSillThicknessMm / 2, window.centerZMm],
    material: materials.trim,
    parent: group,
  });
  addBox({
    name: `${name}-profile-lintel-cap`,
    size: [profileDepth, style.outerLintelThicknessMm, window.openingWidthMm + 2 * trimWidth + 2 * style.outerLintelProjectionMm],
    position: [profileCenterX, top + trimWidth + style.outerLintelThicknessMm / 2, window.centerZMm],
    material: materials.trim,
    parent: group,
  });
  [-1, 1].forEach((sign) => addBox({
    name: `${name}-sill-bracket-${sign < 0 ? "near" : "far"}`,
    size: [style.sillBracketDepthMm, style.sillBracketHeightMm, style.sillBracketWidthMm],
    position: [
      profileCenterX,
      bottom - trimWidth - style.outerSillThicknessMm - style.sillBracketHeightMm / 2,
      window.centerZMm + sign * (window.openingWidthMm / 2 + trimWidth / 2),
    ],
    material: materials.trim,
    parent: group,
  }));

  // East return glazing faces +X. The mullion's outside face is carried past
  // the glass surface while a small engagement keeps the joint connected.
  const mullionDepthMm = 18;
  const mullionEngagementMm = 4;
  const glassExteriorX = glassCenterX + window.glazingDepthMm / 2;
  const mullionCenterX = glassExteriorX + mullionDepthMm / 2 - mullionEngagementMm;
  addBox({
    name: `${name}-mullion`,
    size: [mullionDepthMm, glassHeight, window.mullionWidthMm],
    position: [mullionCenterX, window.centerYMm, window.centerZMm],
    material: materials.trim,
    parent: group,
  });

  group.userData.windowStyle = {
    elevation: "east",
    lintel: "layered-stone-cap",
    sill: "projecting-stone-with-support-brackets",
    projectionMm: style.surroundReliefMm,
    mullionExteriorDirection: "+x",
  };
}
