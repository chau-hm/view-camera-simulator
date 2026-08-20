import type { Vec3 } from "../../types/optics";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import architectureForegroundGeometry from "../../scenes/architectureForegroundGeometry";

export type SceneGeometryGuide = {
  id: string;
  label: string;
  view: "side" | "top";
  startWorld: Vec3;
  endWorld: Vec3;
  color: string;
  testId: string;
  labelPositionT?: number;
  labelOffsetPx?: {
    x: number;
    y: number;
  };
  labelAnchor?: "start" | "middle" | "end";
};

export type SceneGeometryTargetLabelMap = Readonly<Record<string, string>>;

const sceneGeometryGuides: Readonly<Record<string, readonly SceneGeometryGuide[]>> = {
  "table-tilt": [
    {
      id: "table-tilt-tabletop",
      label: "Tabletop",
      view: "side",
      startWorld: tableTiltGeometry.tabletopExtents.near.topSurfaceCenterWorld,
      endWorld: tableTiltGeometry.tabletopExtents.far.topSurfaceCenterWorld,
      color: "#92400e",
      testId: "tabletop-guide",
      labelPositionT: 1,
      labelOffsetPx: { x: -4, y: 18 },
      labelAnchor: "end",
    },
  ],
  "shelf-swing": [
    {
      id: "shelf-swing-subject-trace",
      label: "Diagonal subject plane",
      view: "top",
      startWorld: shelfSwingGeometry.frontSubject.focusDetailProbeWorld,
      endWorld: shelfSwingGeometry.backSubject.focusDetailProbeWorld,
      color: "#115e59",
      testId: "shelf-swing-subject-trace",
      labelPositionT: 0.72,
      labelOffsetPx: { x: 0, y: -20 },
      labelAnchor: "middle",
    },
  ],
  "oblique-architecture": [
    {
      id: "oblique-architecture-target-facade",
      label: "Target façade depth",
      view: "top",
      startWorld: obliqueArchitectureGeometry.focusTargets[0].worldPosition,
      endWorld: obliqueArchitectureGeometry.focusTargets[2].worldPosition,
      color: "#115e59",
      testId: "oblique-architecture-target-facade",
      labelPositionT: 0.52,
      labelOffsetPx: { x: 0, y: -18 },
      labelAnchor: "middle",
    },
  ],
  "architecture-foreground": [
    {
      id: "architecture-foreground-ground",
      label: "Foreground ground",
      view: "side",
      startWorld: {
        x: 0,
        y: architectureForegroundGeometry.ground.y,
        z: architectureForegroundGeometry.ground.nearZ,
      },
      endWorld: {
        x: 0,
        y: architectureForegroundGeometry.ground.y,
        z: architectureForegroundGeometry.facade.frontFacadeZ,
      },
      color: "#a16207",
      testId: "architecture-foreground-ground-guide",
      labelPositionT: 0.5,
      labelOffsetPx: { x: 0, y: 18 },
      labelAnchor: "middle",
    },
    {
      id: "architecture-foreground-building-profile",
      label: "Building profile",
      view: "side",
      startWorld: architectureForegroundGeometry.buildingVerticalEdges[0].bottom,
      endWorld: architectureForegroundGeometry.buildingVerticalEdges[0].top,
      color: "#115e59",
      testId: "architecture-foreground-building-guide",
      labelPositionT: 0.52,
      labelOffsetPx: { x: 10, y: 0 },
      labelAnchor: "start",
    },
  ],
};

const targetLabels: Readonly<Record<string, SceneGeometryTargetLabelMap>> = {
  "table-tilt": {
    "near-cup": "Near card",
    "mid-notebook": "Middle notebook",
    "far-book": "Far chart",
  },
  "shelf-swing": {
    "shelf-front": "Front chart",
    "shelf-middle": "Middle chart",
    "shelf-back": "Back chart",
  },
  "focus-fundamentals-two-targets": {
    "focus-near-detail": "Near detail",
    "focus-far-detail": "Far detail",
  },
  "oblique-architecture": {
    "facade-near": "Near façade",
    "facade-middle": "Middle façade",
    "facade-far": "Far façade",
  },
  "architecture-foreground": {
    "foreground-near": "Near foreground",
    "foreground-middle": "Middle foreground",
    "building-base": "Building base",
    "building-middle": "Building middle",
  },
};

export const getSceneGeometryGuides = (sceneId: string): readonly SceneGeometryGuide[] =>
  sceneGeometryGuides[sceneId] ?? [];

export const getSceneGeometryTargetLabel = (sceneId: string, targetId: string): string =>
  targetLabels[sceneId]?.[targetId] ??
  (/near/i.test(targetId) ? "Near detail" : /far/i.test(targetId) ? "Far detail" : "Target");
