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
      "Compare whole-camera viewpoint changes with Front and Rear standard movements, and observe how each affects framing, perspective geometry and the Ground Glass image.",
    topics: ["Viewpoint", "Framing", "Front / Rear standards", "Perspective control"],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/understanding-camera-movements.png",
  },
  {
    id: "focus-fundamentals-two-targets",
    description:
      "Compare Front and Rear focusing across two depths of one object at fixed f/32, and observe how image alignment changes on the Ground Glass.",
    topics: ["Front / Rear focusing", "Image alignment", "Fixed f/32"],
    availability: "available",
    availableModes: ["free"],
    thumbnailAsset: "assets/two-targets-illustration.png",
  },
  {
    id: "architecture-rise",
    description:
      "Keep the camera level and use Front Rise to include more of the building while preserving the scene's intended parallel verticals.",
    topics: ["Front Rise", "Framing", "Perspective control"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/architecture-rise.png",
    guidedTaskId: "rise-01",
  },
  {
    id: "table-tilt",
    description:
      "Use Front Tilt to rotate the plane of sharp focus until it aligns with three coplanar focus cards above the tabletop.",
    topics: ["Front Tilt", "Plane of sharp focus", "Scheimpflug principle"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/table-tilt.png",
    guidedTaskId: "tilt-01",
  },
  {
    id: "shelf-swing",
    description:
      "Use Front Swing to rotate the plane of sharp focus through subjects arranged diagonally in depth.",
    topics: ["Front Swing", "Plane of sharp focus", "Scheimpflug principle"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/shelf-swing.png",
    guidedTaskId: "swing-01",
  },
  {
    id: "mirror-shift",
    description:
      "Move the whole camera sideways to clear its reflection, then use opposite Front Shift to restore the mirror framing while keeping the changed viewpoint.",
    topics: ["Viewpoint", "Framing", "Front Shift", "Parallax"],
    availability: "available",
    availableModes: ["free", "guided"],
    thumbnailAsset: "assets/mirror-shift.png",
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
