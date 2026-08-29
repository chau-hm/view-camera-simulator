import type { Vec3 } from "../../types/optics";
import { simulatorMessageKeys, type SimulatorMessageKey } from "../../i18n/simulatorMessageKeys";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import architectureForegroundGeometry from "../../scenes/architectureForegroundGeometry";

export type SceneGeometryGuide = {
  id: string;
  label: string;
  labelMessageKey?: SimulatorMessageKey;
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

const sceneGeometryGuides: Readonly<Record<string, readonly SceneGeometryGuide[]>> = {
  "table-tilt": [
    {
      id: "table-tilt-tabletop",
      label: "Tabletop",
      labelMessageKey: simulatorMessageKeys.geometry.tabletopGuide,
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
      labelMessageKey: simulatorMessageKeys.geometry.diagonalSubjectPlaneGuide,
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
      labelMessageKey: simulatorMessageKeys.geometry.targetFacadeDepthGuide,
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
      labelMessageKey: simulatorMessageKeys.geometry.architectureForegroundGroundGuide,
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
      labelMessageKey: simulatorMessageKeys.geometry.architectureForegroundBuildingGuide,
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

export type SceneGeometryTargetMessageKeyMap = Readonly<Record<string, SimulatorMessageKey>>;

const targetMessageKeys: Readonly<Record<string, SceneGeometryTargetMessageKeyMap>> = {
  "table-tilt": {
    "near-cup": simulatorMessageKeys.geometry.nearCardTarget,
    "mid-notebook": simulatorMessageKeys.geometry.middleNotebookTarget,
    "far-book": simulatorMessageKeys.geometry.farChartTarget,
  },
  "shelf-swing": {
    "shelf-front": simulatorMessageKeys.geometry.frontChartTarget,
    "shelf-middle": simulatorMessageKeys.geometry.middleChartTarget,
    "shelf-back": simulatorMessageKeys.geometry.backChartTarget,
  },
  "focus-fundamentals-two-targets": {
    "focus-near-detail": simulatorMessageKeys.geometry.nearDetailTarget,
    "focus-far-detail": simulatorMessageKeys.geometry.farDetailTarget,
  },
  "oblique-architecture": {
    "facade-near": simulatorMessageKeys.geometry.nearFacadeTarget,
    "facade-middle": simulatorMessageKeys.geometry.middleFacadeTarget,
    "facade-far": simulatorMessageKeys.geometry.farFacadeTarget,
  },
  "architecture-foreground": {
    "foreground-near": simulatorMessageKeys.geometry.architectureForegroundNearTarget,
    "foreground-middle": simulatorMessageKeys.geometry.architectureForegroundMiddleTarget,
    "building-base": simulatorMessageKeys.geometry.architectureForegroundBuildingBaseTarget,
    "building-middle": simulatorMessageKeys.geometry.architectureForegroundBuildingMiddleTarget,
  },
};

export const getSceneGeometryGuides = (sceneId: string): readonly SceneGeometryGuide[] =>
  sceneGeometryGuides[sceneId] ?? [];

export const getSceneGeometryTargetMessageKey = (
  sceneId: string,
  targetId: string,
): SimulatorMessageKey =>
  targetMessageKeys[sceneId]?.[targetId] ??
  (/near/i.test(targetId)
    ? simulatorMessageKeys.geometry.nearDetailTarget
    : /far/i.test(targetId)
      ? simulatorMessageKeys.geometry.farDetailTarget
      : simulatorMessageKeys.geometry.targetFallback);
