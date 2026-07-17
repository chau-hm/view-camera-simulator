import type { SimulatorMode } from "../types/camera";
import type { TaskDefinition } from "../types/task";
import type { PublicSceneEntry } from "./publicScenes";

export type SimulatorRouteValidationInput = {
  mode: SimulatorMode;
  taskId?: string;
  sceneId: string;
  publicEntry: PublicSceneEntry;
  task?: TaskDefinition;
};

export const isValidSimulatorRoute = ({
  mode,
  taskId,
  sceneId,
  publicEntry,
  task,
}: SimulatorRouteValidationInput): boolean => {
  if (!publicEntry.availableModes.includes(mode)) {
    return false;
  }

  if (mode === "free") {
    return taskId === undefined;
  }

  return (
    taskId !== undefined &&
    task !== undefined &&
    task.mode === "guided" &&
    task.sceneId === sceneId &&
    publicEntry.guidedTaskId === taskId
  );
};
