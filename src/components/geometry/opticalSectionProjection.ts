import type { DerivedOpticsState, Vec3, Plane } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";

export type OpticalSection = {
  id: "side" | "top";
  filmA: Vec3;
  filmB: Vec3;
  lateral: (p: Vec3) => number;
};

export type PlaneSegment = {
  id: string;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  color: string;
};

export type OpticalSectionData = {
  sectionOrigin: Vec3;
  sectionDepthDir: Vec3;
  sections: OpticalSection[];
  lensCenter: Vec3;
  sideSegments: PlaneSegment[];
  topSegments: PlaneSegment[];
  sideFovDirs: Vec3[];
  topFovDirs: Vec3[];
  depthToX: (depthMm: number) => number;
  mapLateralToY: (value: number) => number;
  mapLateralToYTop: (value: number) => number;
  isInfinity: boolean;
  diagramMinDepthMm: number;
  diagramMaxDepthMm: number;
};

// Pure geometry helpers (no React, no scene-specific checks)
export const vecSub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vecAdd = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vecDot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vecScale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const vecLen = (a: Vec3) => Math.hypot(a.x, a.y, a.z) || 1;
export const vecNorm = (a: Vec3): Vec3 => {
  const l = vecLen(a);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

export const intersectRayPlane = (o: Vec3, d: Vec3, plane: Plane) => {
  const denom = vecDot(d, plane.normal);
  if (Math.abs(denom) < 1e-6) return null;
  const t = vecDot(vecSub(plane.point, o), plane.normal) / denom;
  if (!Number.isFinite(t) || t <= 0) return null;
  return vecAdd(o, vecScale(d, t));
};

export function computeOpticalSectionData({ opticsState, scene, svgWidth, svgHeight, depthWindow }: { opticsState: DerivedOpticsState; scene: SceneDefinition; svgWidth: number; svgHeight: number; depthWindow: { minMm: number; maxMm: number }; }): OpticalSectionData {
  const lensCenter = opticsState.lensCenterWorld;
  const filmCorners = opticsState.filmPlaneCornersWorld;
  
  const topMid = {
    x: (filmCorners.topLeft.x + filmCorners.topRight.x) / 2,
    y: (filmCorners.topLeft.y + filmCorners.topRight.y) / 2,
    z: (filmCorners.topLeft.z + filmCorners.topRight.z) / 2,
  };
  const bottomMid = {
    x: (filmCorners.bottomLeft.x + filmCorners.bottomRight.x) / 2,
    y: (filmCorners.bottomLeft.y + filmCorners.bottomRight.y) / 2,
    z: (filmCorners.bottomLeft.z + filmCorners.bottomRight.z) / 2,
  };
  const leftMid = {
    x: (filmCorners.topLeft.x + filmCorners.bottomLeft.x) / 2,
    y: (filmCorners.topLeft.y + filmCorners.bottomLeft.y) / 2,
    z: (filmCorners.topLeft.z + filmCorners.bottomLeft.z) / 2,
  };
  const rightMid = {
    x: (filmCorners.topRight.x + filmCorners.bottomRight.x) / 2,
    y: (filmCorners.topRight.y + filmCorners.bottomRight.y) / 2,
    z: (filmCorners.topRight.z + filmCorners.bottomRight.z) / 2,
  };
  
  const sectionOrigin = opticsState.filmCenterWorld;
  const sectionDepthDir = opticsState.filmNormalWorld;
  
  const sections: OpticalSection[] = [
    { id: "side", filmA: topMid, filmB: bottomMid, lateral: (p: Vec3) => p.y },
    { id: "top", filmA: leftMid, filmB: rightMid, lateral: (p: Vec3) => p.x },
  ];
  
  // caller-provided depth window (profile authoritative)
  const padding = 24;
  const diagramMinDepthMm = depthWindow.minMm;
  const diagramMaxDepthMm = depthWindow.maxMm;
  
  const depthToX = (depthMm: number) => {
    const t = (depthMm - diagramMinDepthMm) / (diagramMaxDepthMm - diagramMinDepthMm);
    return padding + t * (svgWidth - padding * 2);
  };

  const bounds = scene.bounds;
  const mapLateralToY = (value: number) => {
    const min = bounds.min.y;
    const max = bounds.max.y;
    const v = (value - min) / (max - min || 1);
    return svgHeight - (padding + v * (svgHeight - padding * 2));
  };
  const mapLateralToYTop = (value: number) => {
    const min = bounds.min.x;
    const max = bounds.max.x;
    const v = (value - min) / (max - min || 1);
    return svgHeight - (padding + v * (svgHeight - padding * 2));
  };

  const projectPlaneIntoSection = (plane: Plane, section: OpticalSection): PlaneSegment | null => {
    const dirA = vecNorm(vecSub(lensCenter, section.filmA));
    const dirB = vecNorm(vecSub(lensCenter, section.filmB));
    const pa = intersectRayPlane(lensCenter, dirA, plane);
    const pb = intersectRayPlane(lensCenter, dirB, plane);
    if (!pa || !pb) return null;
    const depthA = vecDot(vecSub(pa, sectionOrigin), sectionDepthDir);
    const depthB = vecDot(vecSub(pb, sectionOrigin), sectionDepthDir);
    const xA = depthToX(depthA);
    const xB = depthToX(depthB);
    const yA = section.id === "side" ? mapLateralToY(pa.y) : mapLateralToYTop(pa.x);
    const yB = section.id === "side" ? mapLateralToY(pb.y) : mapLateralToYTop(pb.x);
    return {
      id: plane.distance !== undefined ? String(plane.distance) : "plane",
      p1: { x: xA, y: yA },
      p2: { x: xB, y: yB },
      color: "",
    };
  };

  const sideSegments: PlaneSegment[] = [];
  const topSegments: PlaneSegment[] = [];
  const pushIf = (seg: PlaneSegment | null, target: PlaneSegment[], id: string, color: string) => {
    if (seg) {
      seg.id = id;
      seg.color = color;
      target.push(seg);
    }
  };

  pushIf(
    projectPlaneIntoSection(opticsState.filmPlane, sections[0]),
    sideSegments,
    "film",
    "#0284c7",
  );
  pushIf(
    projectPlaneIntoSection(opticsState.filmPlane, sections[1]),
    topSegments,
    "film",
    "#0284c7",
  );
  pushIf(
    projectPlaneIntoSection(opticsState.lensPlane, sections[0]),
    sideSegments,
    "lens",
    "#475569",
  );
  pushIf(
    projectPlaneIntoSection(opticsState.lensPlane, sections[1]),
    topSegments,
    "lens",
    "#475569",
  );
  if (opticsState.focusPlane) {
    pushIf(
      projectPlaneIntoSection(opticsState.focusPlane, sections[0]),
      sideSegments,
      "focus",
      "#16a34a",
    );
    pushIf(
      projectPlaneIntoSection(opticsState.focusPlane, sections[1]),
      topSegments,
      "focus",
      "#16a34a",
    );
  }
  if (opticsState.depthOfFieldNearPlane) {
    pushIf(
      projectPlaneIntoSection(opticsState.depthOfFieldNearPlane, sections[0]),
      sideSegments,
      "nearDof",
      "#8b5cf6",
    );
    pushIf(
      projectPlaneIntoSection(opticsState.depthOfFieldNearPlane, sections[1]),
      topSegments,
      "nearDof",
      "#8b5cf6",
    );
  }
  if (opticsState.depthOfFieldFarPlane) {
    pushIf(
      projectPlaneIntoSection(opticsState.depthOfFieldFarPlane, sections[0]),
      sideSegments,
      "farDof",
      "#8b5cf6",
    );
    pushIf(
      projectPlaneIntoSection(opticsState.depthOfFieldFarPlane, sections[1]),
      topSegments,
      "farDof",
      "#8b5cf6",
    );
  }

  const sideFovDirs = [vecNorm(vecSub(lensCenter, topMid)), vecNorm(vecSub(lensCenter, bottomMid))];
  const topFovDirs = [vecNorm(vecSub(lensCenter, leftMid)), vecNorm(vecSub(lensCenter, rightMid))];

  return {
    sectionOrigin,
    sectionDepthDir,
    sections,
    lensCenter,
    sideSegments,
    topSegments,
    sideFovDirs,
    topFovDirs,
    depthToX,
    mapLateralToY,
    mapLateralToYTop,
    isInfinity: !!opticsState.diagnostics?.isInfinityFocus,
    diagramMinDepthMm,
    diagramMaxDepthMm,
  };
}
