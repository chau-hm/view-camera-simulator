import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { getSceneById } from "../scenes/definitions";
import {
  publicSceneMessageKeys,
  type PublicSceneDescriptionKey,
  type PublicSceneTitleKey,
  type PublicSceneTopicKey,
} from "../i18n/messageKeys";

export const publicSceneIds = [
  "understanding-camera-movements",
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "table-tilt",
  "shelf-swing",
  "mirror-shift",
  "oblique-architecture",
] as const;
export type PublicSceneId = (typeof publicSceneIds)[number];
export type SceneAvailability = "available" | "in-development";

export type PublicSceneEntry = {
  id: PublicSceneId;
  titleKey: PublicSceneTitleKey;
  descriptionKey: PublicSceneDescriptionKey;
  topicKeys: readonly PublicSceneTopicKey[];
  availability: SceneAvailability;
  availableModes: readonly SimulatorMode[];
  thumbnailAsset: string;
  guidedTaskId?: string;
};

export const publicSceneCatalog: readonly PublicSceneEntry[] = [
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
    guidedTaskId: "oblique-rise-01",
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
