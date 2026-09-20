import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { getSceneById } from "../scenes/definitions";
import {
  isScenePublished,
  scenePublication,
  type ScenePublicationConfig,
} from "../config/scenePublication";
import {
  publicSceneMessageKeys,
  publicSceneGroupMessageKeys,
  type PublicSceneDescriptionKey,
  type PublicSceneGroupDescriptionKey,
  type PublicSceneGroupTitleKey,
  type PublicSceneTitleKey,
  type PublicSceneTopicKey,
} from "../i18n/messageKeys";
import { INTERIOR_CORNER_GUIDED_TASK_IDS } from "../scenes/interiorCornerGuidedLesson";

export type PublicSceneGroupId =
  | "foundations"
  | "core-movements"
  | "combined-movements"
  | "macro-photography";

export type PublicSceneGroup = {
  id: PublicSceneGroupId;
  titleKey: PublicSceneGroupTitleKey;
  descriptionKey: PublicSceneGroupDescriptionKey;
};

export const publicSceneGroups = [
  {
    id: "foundations",
    titleKey: publicSceneGroupMessageKeys.foundations.title,
    descriptionKey: publicSceneGroupMessageKeys.foundations.description,
  },
  {
    id: "core-movements",
    titleKey: publicSceneGroupMessageKeys.coreMovements.title,
    descriptionKey: publicSceneGroupMessageKeys.coreMovements.description,
  },
  {
    id: "combined-movements",
    titleKey: publicSceneGroupMessageKeys.combinedMovements.title,
    descriptionKey: publicSceneGroupMessageKeys.combinedMovements.description,
  },
  {
    id: "macro-photography",
    titleKey: publicSceneGroupMessageKeys.macroPhotography.title,
    descriptionKey: publicSceneGroupMessageKeys.macroPhotography.description,
  },
] as const satisfies readonly PublicSceneGroup[];

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
  "macro-bellows-extension",
  "macro-depth-of-field",
  "macro-oblique-plane",
  "macro-compound-movements",
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
  groupId: PublicSceneGroupId;
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
    groupId: "foundations",
    titleKey: publicSceneMessageKeys.viewCameraAnatomy.title,
    descriptionKey: publicSceneMessageKeys.viewCameraAnatomy.description,
    topicKeys: [
      publicSceneMessageKeys.viewCameraAnatomy.topics.anatomy,
      publicSceneMessageKeys.viewCameraAnatomy.topics.focusing,
      publicSceneMessageKeys.viewCameraAnatomy.topics.filmPlane,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/scene-view-camera-anatomy.webp",
    lesson: {
      kind: "anatomy",
      id: "view-camera-anatomy",
    },
  },
  {
    id: "understanding-camera-movements",
    groupId: "foundations",
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
    thumbnailAsset: "assets/understanding-camera-movements.webp",
  },
  {
    id: "focus-fundamentals-two-targets",
    groupId: "foundations",
    titleKey: publicSceneMessageKeys.focusFundamentals.title,
    descriptionKey: publicSceneMessageKeys.focusFundamentals.description,
    topicKeys: [
      publicSceneMessageKeys.focusFundamentals.topics.frontRearFocusing,
      publicSceneMessageKeys.focusFundamentals.topics.imageAlignment,
      publicSceneMessageKeys.focusFundamentals.topics.fixedAperture,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/two-targets-illustration.webp",
  },
  {
    id: "architecture-rise",
    groupId: "core-movements",
    titleKey: publicSceneMessageKeys.architectureRise.title,
    descriptionKey: publicSceneMessageKeys.architectureRise.description,
    topicKeys: [
      publicSceneMessageKeys.architectureRise.topics.frontRise,
      publicSceneMessageKeys.architectureRise.topics.framing,
      publicSceneMessageKeys.architectureRise.topics.perspectiveControl,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/architecture-rise.webp",
    guidedTaskId: "rise-01",
  },
  {
    id: "table-tilt",
    groupId: "core-movements",
    titleKey: publicSceneMessageKeys.tableTilt.title,
    descriptionKey: publicSceneMessageKeys.tableTilt.description,
    topicKeys: [
      publicSceneMessageKeys.tableTilt.topics.frontTilt,
      publicSceneMessageKeys.tableTilt.topics.planeOfSharpFocus,
      publicSceneMessageKeys.tableTilt.topics.scheimpflugPrinciple,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/table-tilt.webp",
    guidedTaskId: "tilt-01",
  },
  {
    id: "shelf-swing",
    groupId: "core-movements",
    titleKey: publicSceneMessageKeys.shelfSwing.title,
    descriptionKey: publicSceneMessageKeys.shelfSwing.description,
    topicKeys: [
      publicSceneMessageKeys.shelfSwing.topics.frontSwing,
      publicSceneMessageKeys.shelfSwing.topics.planeOfSharpFocus,
      publicSceneMessageKeys.shelfSwing.topics.scheimpflugPrinciple,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/shelf-swing.webp",
    guidedTaskId: "swing-01",
  },
  {
    id: "oblique-tabletop",
    groupId: "combined-movements",
    titleKey: publicSceneMessageKeys.obliqueTabletop.title,
    descriptionKey: publicSceneMessageKeys.obliqueTabletop.description,
    topicKeys: [
      publicSceneMessageKeys.obliqueTabletop.topics.obliquePlane,
      publicSceneMessageKeys.obliqueTabletop.topics.depthVariation,
      publicSceneMessageKeys.obliqueTabletop.topics.focusDistance,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/oblique-tabletop.webp",
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
    groupId: "core-movements",
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
    thumbnailAsset: "assets/mirror-shift.webp",
    guidedTaskId: "mirror-shift-01",
  },
  {
    id: "oblique-architecture",
    groupId: "combined-movements",
    titleKey: publicSceneMessageKeys.obliqueArchitecture.title,
    descriptionKey: publicSceneMessageKeys.obliqueArchitecture.description,
    topicKeys: [
      publicSceneMessageKeys.obliqueArchitecture.topics.frontRise,
      publicSceneMessageKeys.obliqueArchitecture.topics.frontSwing,
      publicSceneMessageKeys.obliqueArchitecture.topics.compoundMovements,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/oblique-architecture.webp",
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
    groupId: "combined-movements",
    titleKey: publicSceneMessageKeys.architectureForeground.title,
    descriptionKey: publicSceneMessageKeys.architectureForeground.description,
    topicKeys: [
      publicSceneMessageKeys.architectureForeground.topics.levelFraming,
      publicSceneMessageKeys.architectureForeground.topics.foregroundDepth,
      publicSceneMessageKeys.architectureForeground.topics.sharpness,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/architecture-foreground.webp",
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
    groupId: "combined-movements",
    titleKey: publicSceneMessageKeys.interiorCorner.title,
    descriptionKey: publicSceneMessageKeys.interiorCorner.description,
    topicKeys: [
      publicSceneMessageKeys.interiorCorner.topics.frontRise,
      publicSceneMessageKeys.interiorCorner.topics.frontSwing,
      publicSceneMessageKeys.interiorCorner.topics.architecturalDepth,
    ],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/interior-corner.webp",
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
  {
    id: "macro-bellows-extension",
    groupId: "macro-photography",
    titleKey: publicSceneMessageKeys.macroBellowsExtension.title,
    descriptionKey: publicSceneMessageKeys.macroBellowsExtension.description,
    topicKeys: [
      publicSceneMessageKeys.macroBellowsExtension.topics.bellowsExtension,
      publicSceneMessageKeys.macroBellowsExtension.topics.magnification,
      publicSceneMessageKeys.macroBellowsExtension.topics.lifeSizeReproduction,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/macro-bellows-extension.webp",
  },
  {
    id: "macro-depth-of-field",
    groupId: "macro-photography",
    titleKey: publicSceneMessageKeys.macroDepthOfField.title,
    descriptionKey: publicSceneMessageKeys.macroDepthOfField.description,
    topicKeys: [
      publicSceneMessageKeys.macroDepthOfField.topics.macroDepthOfField,
      publicSceneMessageKeys.macroDepthOfField.topics.aperture,
      publicSceneMessageKeys.macroDepthOfField.topics.focusDistribution,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/macro-depth-of-field.webp",
  },
  {
    id: "macro-oblique-plane",
    groupId: "macro-photography",
    titleKey: publicSceneMessageKeys.macroObliquePlane.title,
    descriptionKey: publicSceneMessageKeys.macroObliquePlane.description,
    topicKeys: [
      publicSceneMessageKeys.macroObliquePlane.topics.frontTilt,
      publicSceneMessageKeys.macroObliquePlane.topics.scheimpflugPrinciple,
      publicSceneMessageKeys.macroObliquePlane.topics.obliqueFocusPlane,
    ],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/macro-oblique-plane.webp",
  },
  {
    id: "macro-compound-movements",
    groupId: "macro-photography",
    titleKey: publicSceneMessageKeys.macroCompoundMovements.title,
    descriptionKey: publicSceneMessageKeys.macroCompoundMovements.description,
    topicKeys: [
      publicSceneMessageKeys.macroCompoundMovements.topics.tiltSwing,
      publicSceneMessageKeys.macroCompoundMovements.topics.compoundMovements,
      publicSceneMessageKeys.macroCompoundMovements.topics.macroFocusControl,
    ],
    availability: "in-development",
    availableModes: [],
    thumbnailAsset: "assets/macro-compound-movements.webp",
  },
];

export type PublishedPublicSceneEntry = {
  scene: SceneDefinition | undefined;
  meta: PublicSceneEntry;
};

export type ImplementedPublicSceneEntry = {
  scene: SceneDefinition;
  meta: PublicSceneEntry;
};

export const getPublicSceneEntryById = (
  sceneId: string,
  publication: ScenePublicationConfig = scenePublication,
): PublicSceneEntry | undefined =>
  publicSceneCatalog.find(
    (entry) => entry.id === sceneId && isScenePublished(entry.id, publication),
  );

export const getPublishedPublicSceneEntries = (
  publication: ScenePublicationConfig = scenePublication,
): PublishedPublicSceneEntry[] =>
  publicSceneCatalog
    .filter((entry) => isScenePublished(entry.id, publication))
    .map((meta) => ({ scene: getSceneById(meta.id), meta }));

export const getPublicSceneEntries = (
  publication: ScenePublicationConfig = scenePublication,
): ImplementedPublicSceneEntry[] =>
  getPublishedPublicSceneEntries(publication).filter(
    (entry): entry is ImplementedPublicSceneEntry =>
      typeof entry.scene !== "undefined",
  );

export const getAvailablePublicSceneEntries = (
  publication: ScenePublicationConfig = scenePublication,
) => getPublicSceneEntries(publication).filter(({ meta }) => meta.availability === "available");

export const getGroupedPublicSceneEntries = (
  publication: ScenePublicationConfig = scenePublication,
): Array<{
  group: (typeof publicSceneGroups)[number];
  entries: PublishedPublicSceneEntry[];
}> => {
  const publishedEntries = getPublishedPublicSceneEntries(publication);

  return publicSceneGroups.flatMap((group) => {
    const entries = publishedEntries.filter(({ meta }) => meta.groupId === group.id);
    return entries.length > 0 ? [{ group, entries }] : [];
  });
};

export const getPublicScenes = (
  publication: ScenePublicationConfig = scenePublication,
): SceneDefinition[] => getAvailablePublicSceneEntries(publication).map((entry) => entry.scene);
