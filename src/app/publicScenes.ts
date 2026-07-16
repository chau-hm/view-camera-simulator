import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { getSceneById } from "../scenes/definitions";

export const publicSceneIds = [
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "table-tilt",
  "shelf-swing",
] as const;
export type PublicSceneId = (typeof publicSceneIds)[number];
export type SceneAvailability = "available" | "in-development";

export type PublicSceneEntry = {
  id: PublicSceneId;
  description: string;
  topics: readonly string[];
  availability: SceneAvailability;
  availableModes: readonly SimulatorMode[];
  thumbnailAsset: string;
  guidedTaskId?: string;
};

export const publicSceneCatalog: readonly PublicSceneEntry[] = [
  {
    id: "focus-fundamentals-two-targets",
    description:
      "Compare two targets at different distances. Adjust focus and aperture to see how the plane of focus and depth of field change.",
    topics: ["Focus", "Aperture", "Depth of field"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/two-targets-illustration.png",
  },
  {
    id: "architecture-rise",
    description:
      "Use front rise to include the top of a building while keeping the camera level and vertical lines parallel.",
    topics: ["Rise", "Architecture", "Perspective control"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/architecture-rise.png",
  },
  {
    id: "table-tilt",
    description:
      "Use front tilt to align the plane of sharp focus with three coplanar focus cards above the tabletop.",
    topics: ["Tilt", "Plane of focus", "Scheimpflug principle"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/table-tilt.png",
    guidedTaskId: "tilt-01",
  },
  {
    id: "shelf-swing",
    description:
      "Use front swing to rotate the plane of sharp focus through three subjects arranged diagonally from front-left to back-right.",
    topics: ["Swing", "Plane of focus", "Scheimpflug principle"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/shelf-swing.png",
    guidedTaskId: "swing-01",
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
