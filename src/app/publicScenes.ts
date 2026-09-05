import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { getSceneById } from "../scenes/definitions";
import {
  publicSceneMessageKeys,
  type PublicSceneDescriptionKey,
  type PublicSceneTitleKey,
  type PublicSceneTopicKey,
} from "../i18n/messageKeys";
import { INTERIOR_CORNER_GUIDED_TASK_IDS } from "../scenes/interiorCornerGuidedLesson";

export const publicSceneIds = [
  "view-camera-anatomy",
  "understanding-camera-movements",
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "table-tilt",
  "shelf-swing",
  "oblique-tabletop",
  "mirror-shift",
  "oblique-architecture",
  "architecture-foreground",
  "interior-corner",
] as const;
export type PublicSceneId = (typeof publicSceneIds)[number];
export type SceneAvailability = "available" | "in-development";

export type PublicGuidedLessonTaskStageId =
  | "focus"
  | "tilt"
  | "swing"
  | "refine"
  | "aperture"
  | "compose"
  | "align-focus"
  | "depth-of-field"
  | "final-challenge";

export type PublicGuidedLessonConfig = {
  id: string;
  includeObserveStage: boolean;
  /** Stage labels aligned with the existing ordered guidedTaskIds list. */
  taskStageIds: readonly PublicGuidedLessonTaskStageId[];
};

export type PublicLessonConfig = {
  kind: "anatomy";
  id: string;
};

export type PublicSceneEntry = {
  id: PublicSceneId;
  titleKey: PublicSceneTitleKey;
  descriptionKey: PublicSceneDescriptionKey;
  topicKeys: readonly PublicSceneTopicKey[];
  availability: SceneAvailability;
  availableModes: readonly SimulatorMode[];
  thumbnailAsset: string;
  guidedTaskId?: string;
  /** Additional direct guided routes for scenes that grow across learning slices. */
  guidedTaskIds?: readonly string[];
  /** Optional lightweight lesson integration metadata for the public scene. */
  guidedLesson?: PublicGuidedLessonConfig;
  /** Optional explanatory lesson rendered without task/evaluation state. */
  lesson?: PublicLessonConfig;
};

export const publicSceneCatalog: readonly PublicSceneEntry[] = [
  {
    id: "view-camera-anatomy",
    titleKey: publicSceneMessageKeys.viewCameraAnatomy.title,
    descriptionKey: publicSceneMessageKeys.viewCameraAnatomy.description,
    topicKeys: [
      publicSceneMessageKeys.viewCameraAnatomy.topics.anatomy,
      publicSceneMessageKeys.viewCameraAnatomy.topics.focusing,
      publicSceneMessageKeys.viewCameraAnatomy.topics.filmPlane,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/scene-view-camera-anatomy.png",
    lesson: {
      kind: "anatomy",
      id: "view-camera-anatomy",
    },
  },
  {
    id: "understanding-camera-movements",
    titleKey: publicSceneMessageKeys.understanding.title,
    descriptionKey: publicSceneMessageKeys.understanding.description,
    topicKeys: [
      publicSceneMessageKeys.understanding.topics.viewpoint,
      publicSceneMessageKeys.understanding.topics.framing,
      publicSceneMessageKeys.understanding.topics.frontRearStandards,
      publicSceneMessageKeys.understanding.topics.perspectiveControl,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/understanding-camera-movements.png",
  },
  {
    id: "focus-fundamentals-two-targets",
    titleKey: publicSceneMessageKeys.focusFundamentals.title,
    descriptionKey: publicSceneMessageKeys.focusFundamentals.description,
    topicKeys: [
      publicSceneMessageKeys.focusFundamentals.topics.frontRearFocusing,
      publicSceneMessageKeys.focusFundamentals.topics.imageAlignment,
      publicSceneMessageKeys.focusFundamentals.topics.fixedAperture,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/two-targets-illustration.png",
  },
  {
    id: "architecture-rise",
    titleKey: publicSceneMessageKeys.architectureRise.title,
    descriptionKey: publicSceneMessageKeys.architectureRise.description,
    topicKeys: [
      publicSceneMessageKeys.architectureRise.topics.frontRise,
      publicSceneMessageKeys.architectureRise.topics.framing,
      publicSceneMessageKeys.architectureRise.topics.perspectiveControl,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/architecture-rise.png",
    guidedTaskId: "rise-01",
  },
  {
    id: "table-tilt",
    titleKey: publicSceneMessageKeys.tableTilt.title,
    descriptionKey: publicSceneMessageKeys.tableTilt.description,
    topicKeys: [
      publicSceneMessageKeys.tableTilt.topics.frontTilt,
      publicSceneMessageKeys.tableTilt.topics.planeOfSharpFocus,
      publicSceneMessageKeys.tableTilt.topics.scheimpflugPrinciple,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/table-tilt.png",
    guidedTaskId: "tilt-01",
  },
  {
    id: "shelf-swing",
    titleKey: publicSceneMessageKeys.shelfSwing.title,
    descriptionKey: publicSceneMessageKeys.shelfSwing.description,
    topicKeys: [
      publicSceneMessageKeys.shelfSwing.topics.frontSwing,
      publicSceneMessageKeys.shelfSwing.topics.planeOfSharpFocus,
      publicSceneMessageKeys.shelfSwing.topics.scheimpflugPrinciple,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/shelf-swing.png",
    guidedTaskId: "swing-01",
  },
  {
    id: "oblique-tabletop",
    titleKey: publicSceneMessageKeys.obliqueTabletop.title,
    descriptionKey: publicSceneMessageKeys.obliqueTabletop.description,
    topicKeys: [
      publicSceneMessageKeys.obliqueTabletop.topics.obliquePlane,
      publicSceneMessageKeys.obliqueTabletop.topics.depthVariation,
      publicSceneMessageKeys.obliqueTabletop.topics.focusDistance,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/oblique-tabletop.png",
    guidedTaskId: "oblique-tabletop-aperture-01",
    guidedTaskIds: [
      "oblique-tabletop-focus-01",
      "oblique-tabletop-tilt-01",
      "oblique-tabletop-swing-01",
      "oblique-tabletop-refine-01",
      "oblique-tabletop-aperture-01",
    ],
    guidedLesson: {
      id: "oblique-tabletop",
      includeObserveStage: true,
      taskStageIds: ["focus", "tilt", "swing", "refine", "aperture"],
    },
  },
  {
    id: "mirror-shift",
    titleKey: publicSceneMessageKeys.mirrorShift.title,
    descriptionKey: publicSceneMessageKeys.mirrorShift.description,
    topicKeys: [
      publicSceneMessageKeys.mirrorShift.topics.viewpoint,
      publicSceneMessageKeys.mirrorShift.topics.framing,
      publicSceneMessageKeys.mirrorShift.topics.frontShift,
      publicSceneMessageKeys.mirrorShift.topics.parallax,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/mirror-shift.png",
    guidedTaskId: "mirror-shift-01",
  },
  {
    id: "oblique-architecture",
    titleKey: publicSceneMessageKeys.obliqueArchitecture.title,
    descriptionKey: publicSceneMessageKeys.obliqueArchitecture.description,
    topicKeys: [
      publicSceneMessageKeys.obliqueArchitecture.topics.frontRise,
      publicSceneMessageKeys.obliqueArchitecture.topics.frontSwing,
      publicSceneMessageKeys.obliqueArchitecture.topics.compoundMovements,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/oblique-architecture.png",
    guidedTaskId: "oblique-compound-01",
    guidedTaskIds: ["oblique-rise-01", "oblique-swing-focus-01", "oblique-compound-01"],
    guidedLesson: {
      id: "oblique-architecture",
      includeObserveStage: true,
      taskStageIds: ["compose", "align-focus", "final-challenge"],
    },
  },
  {
    id: "architecture-foreground",
    titleKey: publicSceneMessageKeys.architectureForeground.title,
    descriptionKey: publicSceneMessageKeys.architectureForeground.description,
    topicKeys: [
      publicSceneMessageKeys.architectureForeground.topics.levelFraming,
      publicSceneMessageKeys.architectureForeground.topics.foregroundDepth,
      publicSceneMessageKeys.architectureForeground.topics.sharpness,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/architecture-foreground.png",
    guidedTaskId: "architecture-foreground-compound-01",
    guidedTaskIds: [
      "architecture-foreground-rise-01",
      "architecture-foreground-tilt-focus-01",
      "architecture-foreground-dof-01",
      "architecture-foreground-compound-01",
    ],
    guidedLesson: {
      id: "architecture-foreground",
      includeObserveStage: true,
      taskStageIds: ["compose", "align-focus", "depth-of-field", "final-challenge"],
    },
  },
  {
    id: "interior-corner",
    titleKey: publicSceneMessageKeys.interiorCorner.title,
    descriptionKey: publicSceneMessageKeys.interiorCorner.description,
    topicKeys: [
      publicSceneMessageKeys.interiorCorner.topics.frontRise,
      publicSceneMessageKeys.interiorCorner.topics.frontSwing,
      publicSceneMessageKeys.interiorCorner.topics.architecturalDepth,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/interior-corner.png",
    guidedTaskId: INTERIOR_CORNER_GUIDED_TASK_IDS.aperture,
    guidedTaskIds: [
      INTERIOR_CORNER_GUIDED_TASK_IDS.compose,
      INTERIOR_CORNER_GUIDED_TASK_IDS.swing,
      INTERIOR_CORNER_GUIDED_TASK_IDS.refine,
      INTERIOR_CORNER_GUIDED_TASK_IDS.aperture,
    ],
    guidedLesson: {
      id: "interior-corner",
      includeObserveStage: true,
      taskStageIds: ["compose", "swing", "refine", "aperture"],
    },
  },
];

export const getPublicSceneEntryById = (sceneId: string): PublicSceneEntry | undefined =>
  publicSceneCatalog.find((entry) => entry.id === sceneId);

export const getPublicSceneEntries = (): Array<{
  scene: SceneDefinition;
  meta: PublicSceneEntry;
}> =>
  publicSceneCatalog
    .map((entry) => ({ scene: getSceneById(entry.id), meta: entry }))
    .filter(
      (e): e is { scene: SceneDefinition; meta: PublicSceneEntry } =>
        typeof e.scene !== "undefined",
    );

export const getAvailablePublicSceneEntries = () =>
  getPublicSceneEntries().filter(({ meta }) => meta.availability === "available");

export const getPublicScenes = (): SceneDefinition[] =>
  getAvailablePublicSceneEntries().map((entry) => entry.scene);
