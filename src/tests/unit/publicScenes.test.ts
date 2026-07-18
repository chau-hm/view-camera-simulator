import { describe, expect, it } from "vitest";
import {
  publicSceneCatalog,
  type PublicSceneEntry,
} from "../../app/publicScenes";
import { validatePublicSceneCatalog } from "../../app/publicSceneCatalogValidation";
import { isValidSimulatorRoute } from "../../app/simulatorRouteValidation";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getSceneById } from "../../scenes/definitions";
import type { TaskDefinition } from "../../types/task";

const validate = (
  entries: readonly PublicSceneEntry[],
  resolveScene = getSceneById,
  resolveTask = getTaskById,
) => validatePublicSceneCatalog({ entries, resolveScene, resolveTask });

const shelfEntry = publicSceneCatalog.find((entry) => entry.id === "shelf-swing")!;
const shelfTask = getTaskById("swing-01")!;

describe("public scene catalog integrity", () => {
  it("keeps the production catalog internally consistent", () => {
    expect(validate(publicSceneCatalog)).toEqual({ valid: true, errors: [] });
  });

  it("publishes Focus Fundamentals as free-only without inventing a guided task", () => {
    const entry = publicSceneCatalog.find(
      (candidate) => candidate.id === "focus-fundamentals-two-targets",
    )!;
    expect(entry.availableModes).toEqual(["free"]);
    expect(entry.guidedTaskId).toBeUndefined();
    expect(
      isValidSimulatorRoute({
        mode: "free",
        sceneId: entry.id,
        publicEntry: entry,
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: entry.id,
        taskId: "not-a-task",
        publicEntry: entry,
      }),
    ).toBe(false);
  });

  it("rejects a missing scene definition", () => {
    expect(validate(publicSceneCatalog, () => undefined).errors).toContain(
      "shelf-swing: scene definition is missing",
    );
  });

  it("rejects an available scene without free mode", () => {
    const entries = [
      { ...shelfEntry, availableModes: ["guided"] as const },
    ];
    expect(validate(entries).errors).toContain(
      "shelf-swing: available scenes must support free mode",
    );
  });

  it("requires guided mode and guidedTaskId to appear together", () => {
    const missingTaskId = [{ ...shelfEntry, guidedTaskId: undefined }];
    const unexpectedTaskId = [
      { ...shelfEntry, availableModes: ["free"] as const },
    ];

    expect(validate(missingTaskId).errors).toContain(
      "shelf-swing: guided mode requires guidedTaskId",
    );
    expect(validate(unexpectedTaskId).errors).toContain(
      "shelf-swing: guidedTaskId requires guided mode",
    );
  });

  it("requires every guided task to resolve in guided mode for the same scene", () => {
    expect(validate([shelfEntry], getSceneById, () => undefined).errors).toContain(
      "shelf-swing: guided task swing-01 is missing",
    );

    const freeTask = { ...shelfTask, mode: "free" as const };
    expect(validate([shelfEntry], getSceneById, () => freeTask).errors).toContain(
      "shelf-swing: task swing-01 must use guided mode",
    );

    const wrongSceneTask = { ...shelfTask, sceneId: "table-tilt" };
    expect(validate([shelfEntry], getSceneById, () => wrongSceneTask).errors).toContain(
      "shelf-swing: task swing-01 belongs to scene table-tilt",
    );
  });

  it("rejects guided task IDs assigned to more than one public scene", () => {
    const duplicateEntry: PublicSceneEntry = {
      ...shelfEntry,
      id: "table-tilt",
    };
    const resolveTask = (taskId: string): TaskDefinition | undefined =>
      taskId === "swing-01" ? shelfTask : undefined;

    expect(validate([shelfEntry, duplicateEntry], getSceneById, resolveTask).errors).toContain(
      "table-tilt: guided task swing-01 is already assigned to shelf-swing",
    );
  });
});
