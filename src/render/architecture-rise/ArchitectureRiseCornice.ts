import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../../scenes/presentation/architectureRise";
import type { ArchitectureRiseDetailStyle } from "./ArchitectureRiseDetailConfig";
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
  // A corbel grows outward from its narrow foot to the cornice soffit.
  // Draw its side section, then extrude across the street elevation.
  shape.moveTo(0, 0);
  shape.lineTo(depth * 0.26, 0);
  shape.lineTo(depth * 0.26, height * 0.12);
  shape.bezierCurveTo(depth * 0.28, height * 0.55, depth * 0.74, height * 0.32, depth * 0.82, height * 0.74);
  shape.lineTo(depth, height * 0.82);
  shape.lineTo(depth, height);
  shape.lineTo(0, height);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: true, bevelSegments: 1,
    bevelSize: toWorld(3), bevelThickness: toWorld(3), steps: 1, curveSegments: 3,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, depth / 2);
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
  soffitYMm: number;
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
    soffitYMm,
  } = options;
  const corniceBottomYMm = corniceCenterYMm - style.cornice.bandHeightMm / 2;
  const centers = getArchitectureRiseCorniceBracketCentersMm({
    facadeWidthMm,
    corniceBottomYMm,
    layout,
    style,
  });
  const bracketCenterZMm = frontFacadeZMm - style.cornice.bracketDepthMm / 2 - 12;
  const meshes = centers.map((centerXMm, index) => {
    const bracket = new THREE.Mesh(bracketGeometry, material);
    bracket.name = `architecture-rise-cornice-bracket-${index + 1}`;
    bracket.position.set(
      toWorld(centerXMm),
      toWorld(soffitYMm - style.cornice.bracketHeightMm),
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

type ProfilePoint = readonly [heightMm: number, projectionMm: number];

/** Sweep one stone moulding around all four corners with mitred face edges. */
export function addArchitectureRiseCorniceProfile(options: {
  parent: THREE.Group;
  facade: ArchitectureRisePresentation["layout"]["mainFacade"];
  names: readonly [string, string, string, string];
  profile: readonly ProfilePoint[];
  material: THREE.Material;
}): void {
  const { parent, facade, names, profile, material } = options;
  const corners = [[1, -1], [-1, -1], [-1, 1], [1, 1]] as const;
  function point(corner: typeof corners[number], [height, projection]: ProfilePoint) {
    const [sx, sz] = corner;
    return new THREE.Vector3(
      toWorld(sx < 0 ? facade.minXMm - projection : facade.maxXMm + projection),
      toWorld(height),
      toWorld(sz < 0 ? facade.frontZMm - projection : facade.backZMm + projection),
    );
  }
  for (let side = 0; side < corners.length; side++) {
    const start = corners[side]!;
    const end = corners[(side + 1) % corners.length]!;
    const positions: number[] = [];
    const uv: number[] = [];
    const indices: number[] = [];
    let sectionDistance = 0;
    for (let i = 1; i < profile.length; i++) {
      const a = point(start, profile[i - 1]!);
      const b = point(end, profile[i - 1]!);
      const c = point(end, profile[i]!);
      const d = point(start, profile[i]!);
      const offset = positions.length / 3;
      for (const v of [a, b, c, d]) positions.push(v.x, v.y, v.z);
      const next = sectionDistance + a.distanceTo(d);
      uv.push(0, sectionDistance, a.distanceTo(b), sectionDistance, c.distanceTo(d), next, 0, next);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
      sectionDistance = next;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = names[side]!;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
}
