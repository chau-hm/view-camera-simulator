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

export type ArchitectureRiseWallOpening = Readonly<{
  id: string;
  centerHorizontalMm: number;
  centerVerticalMm: number;
  widthMm: number;
  heightMm: number;
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

type Span = readonly [number, number];

function masonrySpans(min: number, max: number, openings: Span[]): Span[] {
  const spans: Span[] = [];
  let edge = min;
  for (const [left, right] of openings.sort((a, b) => a[0] - b[0])) {
    if (right <= edge || left >= max) continue;
    if (left > edge) spans.push([edge, left]);
    edge = Math.max(edge, right);
  }
  if (edge < max) spans.push([edge, max]);
  return spans;
}

export function addArchitectureRiseStoneBaseJoints(options: {
  parent: THREE.Group;
  addBox: ArchitectureRiseWindowFactory;
  facade: ArchitectureRisePresentation["layout"]["mainFacade"];
  frontOpenings: readonly ArchitectureRiseWallOpening[];
  rearOpenings: readonly ArchitectureRiseWallOpening[];
  baseTopYmm: number;
  material: THREE.Material;
  trim: THREE.Material;
  style: ArchitectureRiseDetailStyle["base"];
}): void {
  const { facade, frontOpenings, rearOpenings, baseTopYmm, material, trim, style, parent, addBox } = options;
  const { minXMm, maxXMm, frontZMm, backZMm, minYMm } = facade;
  const faces = [
    { name: "front", alongX: true, outward: -1, plane: frontZMm, min: minXMm, max: maxXMm, openings: frontOpenings },
    { name: "rear", alongX: true, outward: 1, plane: backZMm, min: minXMm, max: maxXMm, openings: rearOpenings },
    { name: "west", alongX: false, outward: -1, plane: minXMm, min: frontZMm, max: backZMm, openings: [] },
    { name: "east", alongX: false, outward: 1, plane: maxXMm, min: frontZMm, max: backZMm, openings: [] },
  ];
  // The flush lime joints share one draw. Clip their actual triangles to every
  // opening so mortar never stretches over a pane, even when seen obliquely.
  const vertices: number[] = [];
  const indices: number[] = [];
  const joint = style.jointWidthMm;
  for (const face of faces) {
    const rects = face.openings.map(o => ({
      left: o.centerHorizontalMm - o.widthMm / 2, right: o.centerHorizontalMm + o.widthMm / 2,
      bottom: o.centerVerticalMm - o.heightMm / 2, top: o.centerVerticalMm + o.heightMm / 2,
    }));
    function patch(left: number, right: number, bottom: number, top: number) {
      const offset = vertices.length / 3;
      const plane = face.plane + face.outward * 1.5;
      for (const [h, y] of [[left, bottom], [right, bottom], [right, top], [left, top]] as const) {
        vertices.push((face.alongX ? h : plane) / 1000, y / 1000, (face.alongX ? plane : h) / 1000);
      }
      const forward = face.alongX ? face.outward > 0 : face.outward < 0;
      for (const i of forward ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) indices.push(offset + i);
    }
    const horizontalSpans = (bottom: number, top: number) => masonrySpans(face.min, face.max,
      rects.filter(o => o.top > bottom && o.bottom < top).map(o => [o.left, o.right]));
    let row = 0;
    for (let bottom = minYMm; bottom < baseTopYmm; bottom += style.blockCourseHeightMm) {
      const top = Math.min(bottom + style.blockCourseHeightMm, baseTopYmm);
      const bedBottom = Math.max(bottom, top - joint);
      for (const [left, right] of horizontalSpans(bedBottom, top)) patch(left, right, bedBottom, top);
      const firstJoint = face.min + style.blockWidthMm * (row % 2 === 0 ? 0.5 : 1);
      for (let h = firstJoint; h + joint < face.max; h += style.blockWidthMm) {
        const cuts: Span[] = rects.filter(o => o.right > h && o.left < h + joint).map(o => [o.bottom, o.top]);
        for (const [low, high] of masonrySpans(bottom, bedBottom, cuts)) patch(h, h + joint, low, high);
      }
      row++;
    }

    // Front and rear caps own the projecting corner squares. Side returns
    // abut them along Z. The lower stair light interrupts the rear cap.
    const capHeight = 80;
    const projection = 55;
    for (const [start, end] of horizontalSpans(baseTopYmm - capHeight / 2, baseTopYmm + capHeight / 2)) {
      const left = start - (face.alongX && start === face.min ? projection : 0);
      const right = end + (face.alongX && end === face.max ? projection : 0);
      const h = (left + right) / 2;
      const d = face.plane + face.outward * projection / 2;
      addBox({
        name: `architecture-rise-base-string-course-${face.name}-${start}`,
        size: face.alongX ? [right - left, capHeight, projection] : [projection, capHeight, right - left],
        position: face.alongX ? [h, baseTopYmm, d] : [d, baseTopYmm, h],
        material: trim, parent,
      });
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const joints = new THREE.Mesh(geometry, material);
  joints.name = "architecture-rise-stone-base-joints";
  parent.add(joints);
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
  const blockHeight = style.blockCourseHeightMm;
  const joint = Math.max(style.jointWidthMm, 8);
  const startY = baseTopYmm + joint / 2;
  const endY = geometry.facade.mainBodyTopY - style.jointWidthMm;
  let courseIndex = 0;
  for (let minY = startY; minY + blockHeight <= endY; minY += blockHeight + joint) {
    const height = blockHeight;
    const blockWidth = courseIndex % 2 === 0 ? 164 : 116;
    const blockDepth = courseIndex % 2 === 0 ? 98 : 146;
    [-1, 1].forEach((sign) => {
      const x = sign * (halfWidth - blockWidth / 2 + 12);
      addBox({
        name: `architecture-rise-corner-quoin-${sign < 0 ? "west" : "east"}-${courseIndex + 1}`,
        size: [blockWidth, height, blockDepth],
        position: [x, minY + height / 2, facadeFrontZmm - 52 + blockDepth / 2],
        material,
        parent,
      });
    });
    courseIndex += 1;
  }
  parent.userData.cornerQuoinCourses = courseIndex;
}
