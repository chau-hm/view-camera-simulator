import type { SceneDefinition } from "../types/scene";
import type { SimulatorMode } from "../types/camera";
import { getSceneById } from "../scenes/definitions";

export const publicSceneIds = [
  "understanding-camera-movements",
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "table-tilt",
  "shelf-swing",
  "mirror-shift",
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
    id: "understanding-camera-movements",
    description:
      "Observe front and rear camera movements and how each movement changes the camera geometry and image.",
    topics: ["Camera movements", "Front standard", "Rear standard", "Comparative geometry"],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/understanding-camera-movements.png",
  },
  {
    id: "focus-fundamentals-two-targets",
    description:
      "Compare Front and Rear focusing on two depths of one object with a fixed f/32 aperture.",
    topics: ["Focus", "Front / Rear standards", "Parallax alignment"],
    availability: "available",
    availableModes: ["free"],
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
    guidedTaskId: "rise-01",
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
  {
    id: "mirror-shift",
    description:
      "Inspect a static planar mirror scene and compare its reflected props and view-camera proxy on the Ground Glass.",
    topics: ["Mirror", "Reflected viewpoint", "Ground Glass"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/mirror-shift.svg",
    guidedTaskId: "mirror-shift-01",
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
