import { describe, expect, it } from "vitest";
import { getPublicSceneEntryById, type PublicSceneEntry } from "../../app/publicScenes";
import { isValidSimulatorRoute } from "../../app/simulatorRouteValidation";
import { getTaskById } from "../../core/tasks/taskRegistry";
import type { SimulatorMode } from "../../types/camera";
import type { TaskDefinition } from "../../types/task";

const publicEntry = (sceneId: string): PublicSceneEntry => {
  const entry = getPublicSceneEntryById(sceneId);
  if (!entry) {
    throw new Error(`Missing public scene entry: ${sceneId}`);
  }
  return entry;
};

const task = (taskId: string): TaskDefinition => {
  const definition = getTaskById(taskId);
  if (!definition) {
    throw new Error(`Missing task definition: ${taskId}`);
  }
  return definition;
};

const validate = ({
  mode,
  sceneId,
  taskId,
  entry = publicEntry(sceneId),
  definition = taskId ? getTaskById(taskId) : undefined,
}: {
  mode: SimulatorMode;
  sceneId: string;
  taskId?: string;
  entry?: PublicSceneEntry;
  definition?: TaskDefinition;
}) =>
  isValidSimulatorRoute({
    mode,
    sceneId,
    taskId,
    publicEntry: entry,
    task: definition,
  });

describe("isValidSimulatorRoute", () => {
  it.each(["shelf-swing", "table-tilt"])("accepts free mode without a task for %s", (sceneId) => {
    expect(validate({ mode: "free", sceneId })).toBe(true);
  });

  it.each([
    ["shelf-swing", "swing-01"],
    ["table-tilt", "tilt-01"],
  ])("rejects free mode with task %s/%s", (sceneId, taskId) => {
    expect(validate({ mode: "free", sceneId, taskId })).toBe(false);
  });

  it.each([
    ["architecture-rise", "rise-01"],
    ["table-tilt", "tilt-01"],
    ["shelf-swing", "swing-01"],
  ])("accepts the configured guided task for %s", (sceneId, taskId) => {
    expect(validate({ mode: "guided", sceneId, taskId })).toBe(true);
  });

  it("rejects a guided route without a task", () => {
    expect(validate({ mode: "guided", sceneId: "shelf-swing" })).toBe(false);
  });

  it("rejects an unknown guided task", () => {
    expect(validate({ mode: "guided", sceneId: "shelf-swing", taskId: "not-a-task" })).toBe(false);
  });

  it.each([
    ["shelf-swing", "tilt-01"],
    ["shelf-swing", "rise-01"],
    ["table-tilt", "swing-01"],
    ["architecture-rise", "tilt-01"],
  ])("rejects scene/task mismatch %s/%s", (sceneId, taskId) => {
    expect(validate({ mode: "guided", sceneId, taskId })).toBe(false);
  });

  it("rejects a task that differs from the public guided task", () => {
    const entry = {
      ...publicEntry("shelf-swing"),
      guidedTaskId: "another-task",
    };

    expect(
      validate({
        mode: "guided",
        sceneId: "shelf-swing",
        taskId: "swing-01",
        entry,
        definition: task("swing-01"),
      }),
    ).toBe(false);
  });

  it("rejects guided mode when the public scene does not support it", () => {
    const entry = {
      ...publicEntry("shelf-swing"),
      availableModes: ["free"] as const,
    };

    expect(
      validate({
        mode: "guided",
        sceneId: "shelf-swing",
        taskId: "swing-01",
        entry,
        definition: task("swing-01"),
      }),
    ).toBe(false);
  });

  it("rejects a non-guided task definition", () => {
    const definition = { ...task("swing-01"), mode: "free" as const };

    expect(
      validate({
        mode: "guided",
        sceneId: "shelf-swing",
        taskId: "swing-01",
        definition,
      }),
    ).toBe(false);
  });
});
