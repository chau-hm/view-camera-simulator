import type { Vec3 } from "../../types/optics";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";

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
};

export const getSceneGeometryGuides = (sceneId: string): readonly SceneGeometryGuide[] =>
  sceneGeometryGuides[sceneId] ?? [];

export const getSceneGeometryTargetLabel = (sceneId: string, targetId: string): string =>
  targetLabels[sceneId]?.[targetId] ??
  (/near/i.test(targetId) ? "Near board" : /far/i.test(targetId) ? "Far board" : "Target");
