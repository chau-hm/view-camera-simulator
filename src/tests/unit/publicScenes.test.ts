import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  publicSceneCatalog,
  publicSceneIds,
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

  it("publishes Lesson 0 as the first free-only anatomy lesson", () => {
    const entry = publicSceneCatalog[0];
    expect(entry).toMatchObject({
      id: "view-camera-anatomy",
      availableModes: ["free"],
      lesson: { kind: "anatomy", id: "view-camera-anatomy" },
    });
    expect(entry.thumbnailAsset).toBe("assets/scene-view-camera-anatomy.png");
    expect(entry.thumbnailAsset).not.toMatch(/\.svg$/);
    expect(existsSync(resolve(process.cwd(), "public", entry.thumbnailAsset))).toBe(true);
    expect(entry.thumbnailAsset).not.toBe("assets/view-camera-hero-illustration.png");
    expect(publicSceneIds[0]).toBe("view-camera-anatomy");
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

  it("publishes Oblique Tabletop with Free Practice and a five-stage guided lesson", () => {
    const entry = publicSceneCatalog.find(
      (candidate) => candidate.id === "oblique-tabletop",
    )!;
    expect(entry).toMatchObject({
      id: "oblique-tabletop",
      availableModes: ["free", "guided"],
      availability: "available",
      thumbnailAsset: "assets/oblique-tabletop.png",
    });
    expect(entry.guidedTaskId).toBe("oblique-tabletop-aperture-01");
    expect(entry.guidedTaskIds).toEqual([
      "oblique-tabletop-focus-01",
      "oblique-tabletop-tilt-01",
      "oblique-tabletop-swing-01",
      "oblique-tabletop-refine-01",
      "oblique-tabletop-aperture-01",
    ]);
    expect(entry.guidedLesson).toMatchObject({
      id: "oblique-tabletop",
      includeObserveStage: true,
      taskStageIds: ["focus", "tilt", "swing", "refine", "aperture"],
    });
    expect(entry.thumbnailAsset).not.toMatch(/\.svg$/);
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
        taskId: entry.guidedTaskId,
        publicEntry: entry,
        task: getTaskById(entry.guidedTaskId!),
      }),
    ).toBe(true);
  });

  it("publishes Interior Corner with its ordered guided lesson stages", () => {
    const entry = publicSceneCatalog.find((candidate) => candidate.id === "interior-corner")!;
    expect(entry).toMatchObject({
      id: "interior-corner",
      availability: "available",
      availableModes: ["free", "guided"],
      thumbnailAsset: "assets/interior-corner.png",
    });
    expect(entry.guidedTaskId).toBe("interior-corner-depth-of-field-01");
    expect(entry.guidedTaskIds).toEqual([
      "interior-corner-compose-01",
      "interior-corner-align-focus-01",
      "interior-corner-depth-of-field-01",
    ]);
    expect(entry.guidedLesson).toEqual({
      id: "interior-corner",
      includeObserveStage: true,
      taskStageIds: ["compose", "align-focus", "depth-of-field"],
    });
    expect(entry.thumbnailAsset).not.toMatch(/\.svg$/);
    expect(existsSync(resolve(process.cwd(), "public", entry.thumbnailAsset))).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "free",
        sceneId: entry.id,
        publicEntry: entry,
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "free",
        sceneId: entry.id,
        taskId: "swing-01",
        publicEntry: entry,
        task: getTaskById("swing-01"),
      }),
    ).toBe(false);
    if (!entry.guidedTaskIds) throw new Error("Interior Corner guided task stages are missing");
    for (const taskId of entry.guidedTaskIds) {
      expect(
        isValidSimulatorRoute({
          mode: "guided",
          sceneId: entry.id,
          taskId,
          publicEntry: entry,
          task: getTaskById(taskId),
        }),
      ).toBe(true);
    }
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: entry.id,
        taskId: "not-a-task",
        publicEntry: entry,
      }),
    ).toBe(false);
  });

  it("publishes Architecture + Foreground with its direct guided tasks", () => {
    const entry = publicSceneCatalog.find(
      (candidate) => candidate.id === "architecture-foreground",
    )!;
    expect(entry.availability).toBe("available");
    expect(entry.availableModes).toEqual(["free", "guided"]);
    expect(entry.guidedTaskId).toBe("architecture-foreground-compound-01");
    expect(entry.guidedTaskIds).toEqual([
      "architecture-foreground-rise-01",
      "architecture-foreground-tilt-focus-01",
      "architecture-foreground-dof-01",
      "architecture-foreground-compound-01",
    ]);
    expect(entry.guidedLesson).toEqual({
      id: "architecture-foreground",
      includeObserveStage: true,
      taskStageIds: ["compose", "align-focus", "depth-of-field", "final-challenge"],
    });
    expect(entry.thumbnailAsset).toBe("assets/architecture-foreground.png");
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
        taskId: "architecture-foreground-rise-01",
        publicEntry: entry,
        task: getTaskById("architecture-foreground-rise-01"),
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: entry.id,
        taskId: "architecture-foreground-tilt-focus-01",
        publicEntry: entry,
        task: getTaskById("architecture-foreground-tilt-focus-01"),
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: entry.id,
        taskId: "architecture-foreground-dof-01",
        publicEntry: entry,
        task: getTaskById("architecture-foreground-dof-01"),
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: entry.id,
        taskId: "architecture-foreground-compound-01",
        publicEntry: entry,
        task: getTaskById("architecture-foreground-compound-01"),
      }),
    ).toBe(true);
  });

  it("publishes Oblique Architecture as an independent free and guided scene", () => {
    const entry = publicSceneCatalog.find((candidate) => candidate.id === "oblique-architecture")!;
    expect(entry?.availableModes).toEqual(["free", "guided"]);
    expect(entry?.guidedTaskId).toBe("oblique-compound-01");
    expect(entry?.guidedTaskIds).toEqual([
      "oblique-rise-01",
      "oblique-swing-focus-01",
      "oblique-compound-01",
    ]);
    expect(entry?.guidedLesson).toEqual({
      id: "oblique-architecture",
      includeObserveStage: true,
      taskStageIds: ["compose", "align-focus", "final-challenge"],
    });
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: "oblique-architecture",
        taskId: "oblique-rise-01",
        publicEntry: entry,
        task: getTaskById("oblique-rise-01"),
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: "oblique-architecture",
        taskId: "oblique-compound-01",
        publicEntry: entry,
        task: getTaskById("oblique-compound-01"),
      }),
    ).toBe(true);
    expect(
      isValidSimulatorRoute({
        mode: "guided",
        sceneId: "oblique-architecture",
        taskId: "oblique-swing-focus-01",
        publicEntry: entry,
        task: getTaskById("oblique-swing-focus-01"),
      }),
    ).toBe(true);
  });

  it("places Interior Corner last in the canonical public order", () => {
    expect(publicSceneCatalog.at(-1)?.id).toBe("interior-corner");
    expect(publicSceneIds.at(-1)).toBe("interior-corner");
    expect(new Set(publicSceneCatalog.map((entry) => entry.id)).size).toBe(publicSceneCatalog.length);
    expect(new Set(publicSceneIds).size).toBe(publicSceneIds.length);
    expect(publicSceneCatalog.map((entry) => entry.id)).toEqual([...publicSceneIds]);
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

  it("requires lesson metadata to have guided support and ordered tasks", () => {
    const lessonWithoutGuidedMode = [
      {
        ...shelfEntry,
        availableModes: ["free"] as const,
        guidedLesson: {
          id: "shelf-lesson",
          includeObserveStage: true,
          taskStageIds: ["compose"] as const,
        },
      },
    ];
    const lessonWithoutTasks = [
      {
        ...shelfEntry,
        guidedTaskIds: undefined,
        guidedLesson: {
          id: "shelf-lesson",
          includeObserveStage: true,
          taskStageIds: ["compose"] as const,
        },
      },
    ];
    const lessonWithMismatchedStages = [
      {
        ...shelfEntry,
        guidedLesson: {
          id: "shelf-lesson",
          includeObserveStage: true,
          taskStageIds: ["compose", "align-focus"] as const,
        },
      },
    ];

    expect(validate(lessonWithoutGuidedMode).errors).toContain(
      "shelf-swing: guidedLesson requires guided mode",
    );
    expect(validate(lessonWithoutTasks).errors).toContain(
      "shelf-swing: guidedLesson requires ordered guidedTaskIds",
    );
    expect(validate(lessonWithMismatchedStages).errors).toContain(
      "shelf-swing: guidedLesson stage count must match guidedTaskIds",
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
