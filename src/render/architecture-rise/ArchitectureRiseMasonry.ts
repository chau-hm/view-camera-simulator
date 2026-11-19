import * as THREE from "three";
import type { ArchitectureRisePresentation } from "../../scenes/presentation/architectureRise";
import type { ArchitectureRiseDetailStyle } from "./ArchitectureRiseDetailConfig";
import type { ArchitectureRiseWindowFactory } from "./ArchitectureRiseWindowDetails";

export type ArchitectureRiseMmBounds = Readonly<{
  minXMm: number;
  maxXMm: number;
  minYMm: number;
  maxYMm: number;
}>;

export type ArchitectureRiseMasonryAxis = "x" | "z";

export function expandArchitectureRiseBounds(
  bounds: ArchitectureRiseMmBounds,
  marginMm: number,
): ArchitectureRiseMmBounds {
  return {
    minXMm: bounds.minXMm - marginMm,
    maxXMm: bounds.maxXMm + marginMm,
    minYMm: bounds.minYMm - marginMm,
    maxYMm: bounds.maxYMm + marginMm,
  };
}

/** Map segmented boxes to the same physical brick tile regardless of mesh bounds. */
export function createWorldAlignedBrickBoxGeometry(
  sizeMm: readonly [number, number, number],
  centerMm: readonly [number, number, number],
  style: ArchitectureRiseDetailStyle["masonry"],
  axis: ArchitectureRiseMasonryAxis,
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(sizeMm[0] / 1000, sizeMm[1] / 1000, sizeMm[2] / 1000);
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const tileWidthMm = (style.brickLengthMm + style.mortarJointMm) * style.tileBrickPitches;
  const tileHeightMm = (style.brickHeightMm + style.mortarJointMm) * style.tileCourses;

  for (let index = 0; index < positions.count; index += 1) {
    const xMm = centerMm[0] + positions.getX(index) * 1000;
    const yMm = centerMm[1] + positions.getY(index) * 1000;
    const zMm = centerMm[2] + positions.getZ(index) * 1000;
    const ny = normals.getY(index);
    let u: number;
    let v: number;

    if (Math.abs(ny) > 0.5) {
      u = (xMm + tileWidthMm) / tileWidthMm;
      v = (zMm + tileWidthMm) / tileWidthMm;
    } else {
      // Use the world tangent of the face, including exposed wall end caps.
      // The run axis selects the main wall face; its perpendicular end faces
      // need the other horizontal world coordinate to keep their scale physical.
      const horizontalMm = Math.abs(normals.getZ(index)) > 0.5
        ? xMm
        : Math.abs(normals.getX(index)) > 0.5
          ? zMm
          : axis === "x" ? xMm : zMm;
      u = (horizontalMm + tileWidthMm) / tileWidthMm;
      v = (yMm + tileHeightMm) / tileHeightMm;
    }
    // Keep coordinates continuous across physical tile boundaries. RepeatWrapping
    // performs the wrap per fragment; wrapping vertices here would stretch a face
    // whenever its endpoints fall on opposite sides of the 0/1 seam.
    uv.setXY(index, u, v);
    // Preserve the normal attribute and use only physical coordinates for UVs.
  }
  uv.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.architectureRiseBrickUv = {
    axis,
    tileWidthMm,
    tileHeightMm,
    anchoredWorldPositionMm: [...centerMm],
  };
  return geometry;
}

export function collectCanonicalFacadeQuietZones(
  getChartCells: () => readonly { x: number; y: number; width: number; height: number }[],
  getChartBars: () => readonly { x: number; y: number; width: number; height: number }[],
  getFineDetailPieces: () => readonly { x: number; y: number; width: number; height: number }[],
  marginMm: number,
): ArchitectureRiseMmBounds[] {
  const boundsFor = (pieces: readonly { x: number; y: number; width: number; height: number }[]): ArchitectureRiseMmBounds => {
    if (pieces.length === 0) throw new Error("Canonical facade quiet zones require target geometry");
    return {
      minXMm: Math.min(...pieces.map(({ x, width }) => x - width / 2)),
      maxXMm: Math.max(...pieces.map(({ x, width }) => x + width / 2)),
      minYMm: Math.min(...pieces.map(({ y, height }) => y - height / 2)),
      maxYMm: Math.max(...pieces.map(({ y, height }) => y + height / 2)),
    };
  };
  const chartBounds = boundsFor([...getChartCells(), ...getChartBars()]);
  const fineDetailBounds = boundsFor(getFineDetailPieces());
  return [
    expandArchitectureRiseBounds(chartBounds, marginMm),
    expandArchitectureRiseBounds(fineDetailBounds, marginMm),
  ];
}

export function isInsideArchitectureRiseQuietZone(
  xMm: number,
  yMm: number,
  zones: readonly ArchitectureRiseMmBounds[],
): boolean {
  return zones.some((zone) =>
    xMm >= zone.minXMm && xMm <= zone.maxXMm && yMm >= zone.minYMm && yMm <= zone.maxYMm,
  );
}

export function addArchitectureRiseStoneBaseJoints(options: {
  parent: THREE.Group;
  addBox: ArchitectureRiseWindowFactory;
  layout: ArchitectureRisePresentation["layout"];
  groundYmm: number;
  baseTopYmm: number;
  facadeFrontZmm: number;
  facadeBackZmm: number;
  facadeWidthMm: number;
  material: THREE.Material;
  style: ArchitectureRiseDetailStyle["base"];
}): void {
  const {
    parent,
    addBox,
    layout,
    groundYmm,
    baseTopYmm,
    facadeFrontZmm,
    facadeBackZmm,
    facadeWidthMm,
    material,
    style,
  } = options;
  const facadeMinX = -facadeWidthMm / 2;
  const facadeMaxX = facadeWidthMm / 2;
  const doorMinX = layout.door.centerXMm - layout.door.openingWidthMm / 2;
  const doorMaxX = layout.door.centerXMm + layout.door.openingWidthMm / 2;
  const jointZ = facadeFrontZmm - 3;
  const jointDepth = 6;
  const joint = style.jointWidthMm;
  const course = style.blockCourseHeightMm;
  const depth = facadeBackZmm - facadeFrontZmm + 8;
  const depthCenter = (facadeBackZmm + facadeFrontZmm) / 2;
  const horizontalSpans = [
    [facadeMinX, doorMinX],
    [doorMaxX, facadeMaxX],
  ] as const;

  let courseIndex = 0;
  for (let y = groundYmm + course; y < baseTopYmm; y += course) {
    const faceY = y - joint / 2;
    horizontalSpans.forEach(([spanMin, spanMax], spanIndex) => {
      if (spanMax <= spanMin) return;
      addBox({
        name: `architecture-rise-stone-base-bed-joint-${courseIndex + 1}-${spanIndex + 1}`,
        size: [spanMax - spanMin, joint, jointDepth],
        position: [(spanMin + spanMax) / 2, faceY, jointZ],
        material,
        parent,
      });
    });

    const courseBottom = groundYmm + courseIndex * course;
    const courseTop = Math.min(courseBottom + course, baseTopYmm);
    const verticalJointHeight = Math.max(0, courseTop - courseBottom - joint * 2);
    const staggerMm = courseIndex % 2 === 0 ? style.blockWidthMm / 2 : 0;
    for (let x = facadeMinX + style.blockWidthMm + staggerMm; x < facadeMaxX; x += style.blockWidthMm) {
      if (x > doorMinX - joint && x < doorMaxX + joint) continue;
      addBox({
        name: `architecture-rise-stone-base-head-joint-${courseIndex + 1}-${Math.round(x)}`,
        size: [joint, verticalJointHeight, jointDepth],
        position: [x, courseBottom + (courseTop - courseBottom) / 2, jointZ],
        material,
        parent,
      });
    }
    courseIndex += 1;
  }

  parent.userData.stoneBaseCourses = courseIndex + 1;
  parent.userData.stoneBaseJointPattern = {
    blockWidthMm: style.blockWidthMm,
    blockCourseHeightMm: style.blockCourseHeightMm,
    jointWidthMm: joint,
    frontWorldAlignedMm: [facadeMinX, facadeMinX + style.blockWidthMm / 2],
    throughDepthMm: depth,
    throughDepthCenterMm: depthCenter,
  };
}

export function addArchitectureRiseCornerQuoins(options: {
  parent: THREE.Group;
  addBox: ArchitectureRiseWindowFactory;
  geometry: ArchitectureRisePresentation["geometry"];
  facadeFrontZmm: number;
  baseTopYmm: number;
  material: THREE.Material;
  style: ArchitectureRiseDetailStyle["base"];
}): void {
  const { parent, addBox, geometry, facadeFrontZmm, baseTopYmm, material, style } = options;
  const halfWidth = geometry.building.width / 2;
  const blockHeight = style.blockCourseHeightMm * 1.8;
  const blockWidth = 112;
  const blockDepth = 92;
  const joint = Math.max(style.jointWidthMm, 8);
  const startY = baseTopYmm + joint / 2;
  const endY = geometry.facade.mainBodyTopY - style.jointWidthMm;
  let courseIndex = 0;
  for (let minY = startY; minY + blockHeight <= endY; minY += blockHeight + joint) {
    const height = blockHeight;
    [-1, 1].forEach((sign) => {
      const x = sign * (halfWidth - blockWidth / 2 + 2);
      addBox({
        name: `architecture-rise-corner-quoin-${sign < 0 ? "west" : "east"}-${courseIndex + 1}`,
        size: [blockWidth, height, blockDepth],
        position: [x, minY + height / 2, facadeFrontZmm - 28],
        material,
        parent,
      });
    });
    courseIndex += 1;
  }
  parent.userData.cornerQuoinCourses = courseIndex;
}
