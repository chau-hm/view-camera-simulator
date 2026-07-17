import type { SceneDefinition } from "../types/scene";
import type { TaskDefinition } from "../types/task";
import type { PublicSceneEntry } from "./publicScenes";

export type PublicSceneCatalogValidationInput = {
  entries: readonly PublicSceneEntry[];
  resolveScene: (sceneId: string) => SceneDefinition | undefined;
  resolveTask: (taskId: string) => TaskDefinition | undefined;
};

export type PublicSceneCatalogValidationResult = {
  valid: boolean;
  errors: string[];
};

export const validatePublicSceneCatalog = ({
  entries,
  resolveScene,
  resolveTask,
}: PublicSceneCatalogValidationInput): PublicSceneCatalogValidationResult => {
  const errors: string[] = [];
  const guidedTaskOwners = new Map<string, string>();

  entries.forEach((entry) => {
    if (!resolveScene(entry.id)) {
      errors.push(`${entry.id}: scene definition is missing`);
    }

    const supportsFree = entry.availableModes.includes("free");
    const supportsGuided = entry.availableModes.includes("guided");

    if (entry.availability === "available" && !supportsFree) {
      errors.push(`${entry.id}: available scenes must support free mode`);
    }
    if (supportsGuided && !entry.guidedTaskId) {
      errors.push(`${entry.id}: guided mode requires guidedTaskId`);
    }
    if (!supportsGuided && entry.guidedTaskId) {
      errors.push(`${entry.id}: guidedTaskId requires guided mode`);
    }

    if (!entry.guidedTaskId) return;

    const previousOwner = guidedTaskOwners.get(entry.guidedTaskId);
    if (previousOwner) {
      errors.push(
        `${entry.id}: guided task ${entry.guidedTaskId} is already assigned to ${previousOwner}`,
      );
    } else {
      guidedTaskOwners.set(entry.guidedTaskId, entry.id);
    }

    const task = resolveTask(entry.guidedTaskId);
    if (!task) {
      errors.push(`${entry.id}: guided task ${entry.guidedTaskId} is missing`);
      return;
    }
    if (task.mode !== "guided") {
      errors.push(`${entry.id}: task ${entry.guidedTaskId} must use guided mode`);
    }
    if (task.sceneId !== entry.id) {
      errors.push(
        `${entry.id}: task ${entry.guidedTaskId} belongs to scene ${task.sceneId}`,
      );
    }
  });

  return { valid: errors.length === 0, errors };
};
