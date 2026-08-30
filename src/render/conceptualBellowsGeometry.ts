import { Quaternion, Vector3 } from "three";
import type { StandardFrame, Vec3 } from "../types/optics";
import { add, scale, subtract } from "../core/math/vec";
import {
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "./planeOrientation";

/** Number of visible pleat transitions in the conceptual bellows. */
export const CONCEPTUAL_BELLOWS_FOLD_COUNT = 9;
/** Endpoint sections plus one section for each visible pleat transition. */
export const CONCEPTUAL_BELLOWS_SECTION_COUNT = CONCEPTUAL_BELLOWS_FOLD_COUNT + 2;

const FRONT_MOUTH_WIDTH_MM = 112;
const FRONT_MOUTH_HEIGHT_MM = 84;
const REAR_MOUTH_WIDTH_MM = 128;
const REAR_MOUTH_HEIGHT_MM = 98;
const FRONT_MOUTH_OFFSET_MM = 8;
const REAR_MOUTH_OFFSET_MM = 8;

export type BellowsEndpointFrame = {
  /** Attachment centre in the coordinate space of the supplied canonical frames. */
  center: Vec3;
  /** Orthonormal local frame used by the mouth cross-section. */
  right: Vec3;
  up: Vec3;
  normal: Vec3;
  quaternion: Quaternion;
  widthMm: number;
  heightMm: number;
};

export type ConceptualBellowsAttachmentFrames = {
  rear: BellowsEndpointFrame;
  front: BellowsEndpointFrame;
};

export type BellowsCrossSection = BellowsEndpointFrame;

export type ConceptualBellowsGeometry = {
  sections: BellowsCrossSection[];
  positions: number[];
  normals: number[];
  triangleIndices: number[];
};

type CanonicalBellowsFrameInputs = {
  frontCenter: Vec3;
  frontNormal: Vec3;
  rearFrame: StandardFrame;
};

const vecFromVector3 = (value: Vector3): Vec3 => ({
  x: value.x,
  y: value.y,
  z: value.z,
});

const basisFromQuaternion = (quaternion: Quaternion): Pick<
  BellowsEndpointFrame,
  "right" | "up" | "normal"
> => ({
  right: vecFromVector3(new Vector3(1, 0, 0).applyQuaternion(quaternion)),
  up: vecFromVector3(new Vector3(0, 1, 0).applyQuaternion(quaternion)),
  normal: vecFromVector3(new Vector3(0, 0, 1).applyQuaternion(quaternion)),
});

const createEndpointFrame = ({
  center,
  quaternion,
  widthMm,
  heightMm,
  normalOffsetMm,
}: {
  center: Vec3;
  quaternion: Quaternion;
  widthMm: number;
  heightMm: number;
  normalOffsetMm: number;
}): BellowsEndpointFrame => {
  const normalizedQuaternion = quaternion.clone().normalize();
  const basis = basisFromQuaternion(normalizedQuaternion);
  return {
    center: add(center, scale(basis.normal, normalOffsetMm)),
    ...basis,
    quaternion: normalizedQuaternion,
    widthMm,
    heightMm,
  };
};

/**
 * Resolve the two physical bellows mouths from the same transforms used by
 * the rendered standards. The small offsets are in each standard's local
 * normal direction: the front mouth sits behind the lens board and the rear
 * mouth sits just in front of the focusing back.
 */
export const resolveConceptualBellowsAttachmentFrames = ({
  frontCenter,
  frontNormal,
  rearFrame,
}: CanonicalBellowsFrameInputs): ConceptualBellowsAttachmentFrames => {
  const frontTransform = resolveFrontStandardRenderTransform(
    frontCenter,
    frontNormal,
  );
  const rearTransform = resolveRearStandardRenderTransform(rearFrame);

  return {
    rear: createEndpointFrame({
      center: rearFrame.centerWorld,
      quaternion: rearTransform.quaternion,
      widthMm: REAR_MOUTH_WIDTH_MM,
      heightMm: REAR_MOUTH_HEIGHT_MM,
      normalOffsetMm: REAR_MOUTH_OFFSET_MM,
    }),
    front: createEndpointFrame({
      center: frontCenter,
      quaternion: frontTransform.quaternion,
      widthMm: FRONT_MOUTH_WIDTH_MM,
      heightMm: FRONT_MOUTH_HEIGHT_MM,
      normalOffsetMm: -FRONT_MOUTH_OFFSET_MM,
    }),
  };
};

const lerp = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

const lerpVec3 = (start: Vec3, end: Vec3, t: number): Vec3 =>
  add(start, scale(subtract(end, start), t));

const crossSectionAt = (
  rear: BellowsEndpointFrame,
  front: BellowsEndpointFrame,
  index: number,
): BellowsCrossSection => {
  const lastIndex = CONCEPTUAL_BELLOWS_SECTION_COUNT - 1;
  const t = index / lastIndex;
  const quaternion = index === 0
    ? rear.quaternion.clone()
    : index === lastIndex
      ? front.quaternion.clone()
      : new Quaternion().slerpQuaternions(rear.quaternion, front.quaternion, t);
  const pleatScale = index === 0 || index === lastIndex
    ? 1
    : index % 2 === 0
      ? 1.06
      : 0.94;
  const basis = basisFromQuaternion(quaternion);

  return {
    center: lerpVec3(rear.center, front.center, t),
    ...basis,
    quaternion: quaternion.normalize(),
    widthMm: lerp(rear.widthMm, front.widthMm, t) * pleatScale,
    heightMm: lerp(rear.heightMm, front.heightMm, t) * pleatScale,
  };
};

const crossSectionCorners = (section: BellowsCrossSection): Vec3[] => {
  const rightHalf = scale(section.right, section.widthMm / 2);
  const upHalf = scale(section.up, section.heightMm / 2);
  return [
    add(section.center, add(scale(rightHalf, -1), scale(upHalf, -1))),
    add(section.center, add(rightHalf, scale(upHalf, -1))),
    add(section.center, add(rightHalf, upHalf)),
    add(section.center, add(scale(rightHalf, -1), upHalf)),
  ];
};

const computeVertexNormals = (
  positions: number[],
  triangleIndices: number[],
): number[] => {
  const normals = Array.from({ length: positions.length }, () => 0);
  for (let index = 0; index < triangleIndices.length; index += 3) {
    const aIndex = triangleIndices[index] * 3;
    const bIndex = triangleIndices[index + 1] * 3;
    const cIndex = triangleIndices[index + 2] * 3;
    const a = new Vector3(
      positions[aIndex],
      positions[aIndex + 1],
      positions[aIndex + 2],
    );
    const b = new Vector3(
      positions[bIndex],
      positions[bIndex + 1],
      positions[bIndex + 2],
    );
    const c = new Vector3(
      positions[cIndex],
      positions[cIndex + 1],
      positions[cIndex + 2],
    );
    const faceNormal = new Vector3().subVectors(b, a).cross(
      new Vector3().subVectors(c, a),
    );
    for (const vertexIndex of [aIndex, bIndex, cIndex]) {
      normals[vertexIndex] += faceNormal.x;
      normals[vertexIndex + 1] += faceNormal.y;
      normals[vertexIndex + 2] += faceNormal.z;
    }
  }

  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(normals[index], normals[index + 1], normals[index + 2]);
    if (length > 0 && Number.isFinite(length)) {
      normals[index] /= length;
      normals[index + 1] /= length;
      normals[index + 2] /= length;
    } else {
      normals[index] = 0;
      normals[index + 1] = 1;
      normals[index + 2] = 0;
    }
  }
  return normals;
};

/**
 * Build one open, indexed bellows mesh. Each pair of adjacent sections makes
 * four side-wall strips; the ends stay open so the camera reads as hollow
 * folded bellows rather than a stack of solid blocks.
 */
export const buildConceptualBellowsGeometry = (
  frames: ConceptualBellowsAttachmentFrames,
): ConceptualBellowsGeometry => {
  const sections = Array.from(
    { length: CONCEPTUAL_BELLOWS_SECTION_COUNT },
    (_, index) => crossSectionAt(frames.rear, frames.front, index),
  );
  const positions: number[] = [];
  for (const section of sections) {
    for (const corner of crossSectionCorners(section)) {
      positions.push(corner.x, corner.y, corner.z);
    }
  }

  const triangleIndices: number[] = [];
  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
    const nextSectionIndex = sectionIndex + 1;
    for (let cornerIndex = 0; cornerIndex < 4; cornerIndex += 1) {
      const nextCornerIndex = (cornerIndex + 1) % 4;
      const a = sectionIndex * 4 + cornerIndex;
      const b = sectionIndex * 4 + nextCornerIndex;
      const c = nextSectionIndex * 4 + nextCornerIndex;
      const d = nextSectionIndex * 4 + cornerIndex;
      triangleIndices.push(a, b, c, a, c, d);
    }
  }

  return {
    sections,
    positions,
    normals: computeVertexNormals(positions, triangleIndices),
    triangleIndices,
  };
};
