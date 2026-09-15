import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getAvailablePublicSceneEntries,
  getGroupedPublicSceneEntries,
  getPublishedPublicSceneEntries,
  getPublicSceneEntries,
  getPublicSceneEntryById,
  getPublicScenes,
  publicSceneCatalog,
  publicSceneGroups,
  publicSceneIds,
  type PublicSceneEntry,
} from "../../app/publicScenes";
import { validatePublicSceneCatalog } from "../../app/publicSceneCatalogValidation";
import { isValidSimulatorRoute } from "../../app/simulatorRouteValidation";
import {
  isScenePublished,
  scenePublication,
  type ScenePublicationConfig,
} from "../../config/scenePublication";
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
const macroSceneIds = [
  "macro-bellows-extension",
  "macro-depth-of-field",
  "macro-oblique-plane",
  "macro-compound-movements",
] as const;

const expectedGroupedCatalogEntries = (publication: ScenePublicationConfig) =>
  publicSceneGroups.flatMap((group) => {
    const entries = publicSceneCatalog.filter(
      (entry) =>
        entry.groupId === group.id &&
        isScenePublished(entry.id, publication),
    );
    return entries.length > 0 ? [{ groupId: group.id, entries }] : [];
  });

describe("public scene catalog integrity", () => {
  it("keeps the production catalog internally consistent", () => {
    expect(validate(publicSceneCatalog)).toEqual({ valid: true, errors: [] });
  });

  it("declares exactly one publication state for every catalog scene", () => {
    const catalogSceneIds = publicSceneCatalog.map((entry) => entry.id);
    const publicationSceneIds = Object.keys(scenePublication);

    expect(new Set(publicationSceneIds).size).toBe(publicationSceneIds.length);
    expect(publicationSceneIds.sort()).toEqual([...catalogSceneIds].sort());
    expect(Object.values(scenePublication).every((value) => typeof value === "boolean")).toBe(true);
  });

  it("declares each scene in one registered group with deterministic group order", () => {
    const groupIds = publicSceneGroups.map(({ id }) => id);

    expect(groupIds).toEqual([
      "foundations",
      "core-movements",
      "combined-movements",
      "macro-photography",
    ]);
    expect(new Set(groupIds).size).toBe(groupIds.length);
    expect(publicSceneCatalog.every((entry) => groupIds.includes(entry.groupId))).toBe(true);
    expect(publicSceneCatalog.map(({ id, groupId }) => [id, groupId])).toEqual([
      ["view-camera-anatomy", "foundations"],
      ["understanding-camera-movements", "foundations"],
      ["focus-fundamentals-two-targets", "foundations"],
      ["architecture-rise", "core-movements"],
      ["table-tilt", "core-movements"],
      ["shelf-swing", "core-movements"],
      ["oblique-tabletop", "combined-movements"],
      ["mirror-shift", "core-movements"],
      ["oblique-architecture", "combined-movements"],
      ["architecture-foreground", "combined-movements"],
      ["interior-corner", "combined-movements"],
      ["macro-bellows-extension", "macro-photography"],
      ["macro-depth-of-field", "macro-photography"],
      ["macro-oblique-plane", "macro-photography"],
      ["macro-compound-movements", "macro-photography"],
    ]);
  });

  it("publishes the Macro Photography roadmap in its exact learning order", () => {
    const catalogMacroEntries = publicSceneCatalog.filter((entry) =>
      macroSceneIds.includes(entry.id as (typeof macroSceneIds)[number]),
    );

    expect(publicSceneIds.filter((id) => id.startsWith("macro-"))).toEqual([
      ...macroSceneIds,
    ]);
    expect(catalogMacroEntries.map(({ id }) => id)).toEqual([...macroSceneIds]);
    expect(catalogMacroEntries.every(({ groupId }) => groupId === "macro-photography")).toBe(true);
    expect(catalogMacroEntries.map(({ availability }) => availability)).toEqual(["available", "in-development", "in-development", "in-development"]);
    expect(catalogMacroEntries.map(({ availableModes }) => availableModes)).toEqual([["free"], [], [], []]);
    expect(catalogMacroEntries.every(({ guidedTaskId, guidedTaskIds, guidedLesson, lesson }) =>
      guidedTaskId === undefined &&
      guidedTaskIds === undefined &&
      guidedLesson === undefined &&
      lesson === undefined,
    )).toBe(true);
    expect(macroSceneIds.every((id) => scenePublication[id] === true)).toBe(true);
  });

  it("shows the Macro Photography group only while its roadmap entries are published", () => {
    const macroGroup = getGroupedPublicSceneEntries().find(
      ({ group }) => group.id === "macro-photography",
    );
    expect(macroGroup?.entries.map(({ meta }) => meta.id)).toEqual([...macroSceneIds]);

    const disabledPublication = {
      ...scenePublication,
      ...Object.fromEntries(macroSceneIds.map((id) => [id, false])),
    };
    expect(
      getGroupedPublicSceneEntries(disabledPublication).some(
        ({ group }) => group.id === "macro-photography",
      ),
    ).toBe(false);
  });

  it("keeps published roadmap metadata separate from implemented scene APIs", () => {
    const publishedMacroEntries = getPublishedPublicSceneEntries().filter(({ meta }) =>
      macroSceneIds.includes(meta.id as (typeof macroSceneIds)[number]),
    );

    expect(publishedMacroEntries).toHaveLength(macroSceneIds.length);
    expect(publishedMacroEntries.filter(({ scene }) => scene !== undefined).map(({ meta }) => meta.id)).toEqual(["macro-bellows-extension"]);
    expect(getPublicSceneEntries().filter(({ meta }) => meta.id.startsWith("macro-")).map(({ meta }) => meta.id)).toEqual(["macro-bellows-extension"]);
    expect(getAvailablePublicSceneEntries().filter(({ meta }) => meta.id.startsWith("macro-")).map(({ meta }) => meta.id)).toEqual(["macro-bellows-extension"]);
    expect(getPublicScenes().filter((scene) => scene.id.startsWith("macro-")).map(({ id }) => id)).toEqual(["macro-bellows-extension"]);
  });

  it("groups published entries by registry order and omits empty groups", () => {
    const catalogOrder = publicSceneCatalog.map(({ id }) => id);
    const registryOrder = publicSceneGroups.map(({ id }) => id);
    const grouped = getGroupedPublicSceneEntries();
    const expectedPublishedEntries = publicSceneCatalog.filter((entry) =>
      isScenePublished(entry.id, scenePublication),
    );
    const expectedGroups = expectedGroupedCatalogEntries(scenePublication);

    expect(grouped.map(({ group }) => group.id)).toEqual(
      expectedGroups.map(({ groupId }) => groupId),
    );
    expect(grouped.map(({ entries }) => entries.map(({ meta }) => meta.id))).toEqual(
      expectedGroups.map(({ entries }) => entries.map(({ id }) => id)),
    );
    const groupedSceneIds = grouped.flatMap(({ entries }) => entries.map(({ meta }) => meta.id));
    expect(groupedSceneIds).toHaveLength(expectedPublishedEntries.length);
    expect([...groupedSceneIds].sort()).toEqual(
      expectedPublishedEntries.map(({ id }) => id).sort(),
    );
    expect(publicSceneCatalog.map(({ id }) => id)).toEqual(catalogOrder);
    expect(publicSceneGroups.map(({ id }) => id)).toEqual(registryOrder);

    const publication = { ...scenePublication, "table-tilt": false, "oblique-tabletop": false };
    const filteredGroups = getGroupedPublicSceneEntries(publication);
    const expectedFilteredGroups = expectedGroupedCatalogEntries(publication);
    expect(filteredGroups.map(({ group }) => group.id)).toEqual(
      expectedFilteredGroups.map(({ groupId }) => groupId),
    );
    expect(filteredGroups.map(({ entries }) => entries.map(({ meta }) => meta.id))).toEqual(
      expectedFilteredGroups.map(({ entries }) => entries.map(({ id }) => id)),
    );
    expect(filteredGroups.flatMap(({ entries }) => entries.map(({ meta }) => meta.id))).not.toContain(
      "table-tilt",
    );
    expect(filteredGroups.flatMap(({ entries }) => entries.map(({ meta }) => meta.id))).not.toContain(
      "oblique-tabletop",
    );

    const onlyFoundationsPublished = Object.fromEntries(
      publicSceneIds.map((id) => [id, id === "view-camera-anatomy"]),
    );
    const onlyFoundationsGroups = getGroupedPublicSceneEntries(onlyFoundationsPublished);
    expect(onlyFoundationsGroups.map(({ group }) => group.id)).toEqual(
      expectedGroupedCatalogEntries(onlyFoundationsPublished).map(({ groupId }) => groupId),
    );
    expect(onlyFoundationsGroups.map(({ entries }) => entries.map(({ meta }) => meta.id))).toEqual([
      ["view-camera-anatomy"],
    ]);

    const coreMovementsDisabled = Object.fromEntries(
      publicSceneCatalog.map((entry) => [entry.id, entry.groupId !== "core-movements"]),
    );
    const coreDisabledGroups = getGroupedPublicSceneEntries(coreMovementsDisabled);
    expect(coreDisabledGroups.map(({ group }) => group.id)).toEqual([
      "foundations",
      "combined-movements",
      "macro-photography",
    ]);
    expect(coreDisabledGroups.map(({ group }) => group.id)).not.toContain("core-movements");
    expect(coreDisabledGroups.flatMap(({ entries }) => entries.map(({ meta }) => meta.id))).toEqual([
      ...publicSceneCatalog
        .filter((entry) => entry.groupId !== "core-movements")
        .map(({ id }) => id),
    ]);

    expect(
      getGroupedPublicSceneEntries(Object.fromEntries(publicSceneIds.map((id) => [id, false]))),
    ).toEqual([]);
  });

  it("fails closed for disabled and undeclared scene IDs", () => {
    const publication = { ...scenePublication, "shelf-swing": false };

    expect(isScenePublished("shelf-swing", publication)).toBe(false);
    expect(isScenePublished("future-scene", publication)).toBe(false);
  });

  it("filters published and available entries independently without changing catalog order", () => {
    const disabledPublication = { ...scenePublication, "table-tilt": false };
    const expectedPublishedIds = publicSceneCatalog
      .filter((entry) => isScenePublished(entry.id, disabledPublication))
      .map((entry) => entry.id);
    const expectedImplementedPublishedIds = publicSceneCatalog
      .filter(
        (entry) =>
          isScenePublished(entry.id, disabledPublication) &&
          getSceneById(entry.id) !== undefined,
      )
      .map((entry) => entry.id);
    const expectedAvailableIds = publicSceneCatalog
      .filter(
        (entry) =>
          isScenePublished(entry.id, disabledPublication) &&
          entry.availability === "available",
      )
      .map((entry) => entry.id);

    expect(getPublishedPublicSceneEntries(disabledPublication).map(({ meta }) => meta.id)).toEqual(
      expectedPublishedIds,
    );
    expect(getPublicSceneEntries(disabledPublication).map(({ meta }) => meta.id)).toEqual(
      expectedImplementedPublishedIds,
    );
    expect(getAvailablePublicSceneEntries(disabledPublication).map(({ meta }) => meta.id)).toEqual(
      expectedAvailableIds,
    );
    expect(getPublicScenes(disabledPublication).map((scene) => scene.id)).toEqual(
      expectedAvailableIds,
    );

    const reenabledPublication = { ...disabledPublication, "table-tilt": true };
    const expectedReenabledPublishedIds = publicSceneCatalog
      .filter((entry) => isScenePublished(entry.id, reenabledPublication))
      .map((entry) => entry.id);
    const expectedReenabledImplementedIds = publicSceneCatalog
      .filter(
        (entry) =>
          isScenePublished(entry.id, reenabledPublication) &&
          getSceneById(entry.id) !== undefined,
      )
      .map((entry) => entry.id);
    const expectedReenabledAvailableIds = publicSceneCatalog
      .filter(
        (entry) =>
          isScenePublished(entry.id, reenabledPublication) &&
          entry.availability === "available",
      )
      .map((entry) => entry.id);
    expect(getPublishedPublicSceneEntries(reenabledPublication).map(({ meta }) => meta.id)).toEqual(
      expectedReenabledPublishedIds,
    );
    expect(getPublicSceneEntries(reenabledPublication).map(({ meta }) => meta.id)).toEqual(
      expectedReenabledImplementedIds,
    );
    expect(getAvailablePublicSceneEntries(reenabledPublication).map(({ meta }) => meta.id)).toEqual(
      expectedReenabledAvailableIds,
    );
    expect(getPublicScenes(reenabledPublication).map((scene) => scene.id)).toEqual(
      expectedReenabledAvailableIds,
    );
  });

  it("keeps a published in-development entry visible but unavailable", () => {
    const publication = { ...scenePublication, "shelf-swing": true };
    const originalAvailability = shelfEntry.availability;
    shelfEntry.availability = "in-development";

    try {
      expect(isScenePublished(shelfEntry.id, publication)).toBe(true);
      expect(getPublicSceneEntries(publication).map(({ meta }) => meta.id)).toContain(
        shelfEntry.id,
      );
      expect(getAvailablePublicSceneEntries(publication).map(({ meta }) => meta.id)).not.toContain(
        shelfEntry.id,
      );
      expect(getPublicScenes(publication).map((scene) => scene.id)).not.toContain(shelfEntry.id);
    } finally {
      shelfEntry.availability = originalAvailability;
    }
  });

  it("keeps unpublished scenes in the internal registry while hiding public lookup", () => {
    const unpublishedPublication = { ...scenePublication, "shelf-swing": false };

    expect(getSceneById("shelf-swing")).toBeDefined();
    expect(getPublicSceneEntryById("shelf-swing", unpublishedPublication)).toBeUndefined();
  });

  it("continues validating catalog metadata independently of publication", () => {
    const unpublishedPublication = { ...scenePublication, "shelf-swing": false };

    expect(isScenePublished("shelf-swing", unpublishedPublication)).toBe(false);
    expect(validate([shelfEntry], () => undefined).errors).toContain(
      "shelf-swing: scene definition is missing",
    );
  });

  it("publishes an existing WebP thumbnail for every public scene", () => {
    expect(publicSceneCatalog).toHaveLength(publicSceneIds.length);

    for (const entry of publicSceneCatalog) {
      expect(entry.thumbnailAsset).toMatch(/^assets\/[^/]+\.webp$/);
      const assetPath = resolve(process.cwd(), "public", entry.thumbnailAsset);
      expect(existsSync(assetPath)).toBe(true);
      const bytes = readFileSync(assetPath);
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
      expect(bytes.length).toBeGreaterThan(0);
      expect(existsSync(assetPath.replace(/\.webp$/, ".png"))).toBe(false);
    }
  });

  it("publishes Lesson 0 as the first free-only anatomy lesson", () => {
    const entry = publicSceneCatalog[0];
    expect(entry).toMatchObject({
      id: "view-camera-anatomy",
      availableModes: ["free"],
      lesson: { kind: "anatomy", id: "view-camera-anatomy" },
    });
    expect(entry.thumbnailAsset).toBe("assets/scene-view-camera-anatomy.webp");
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
      thumbnailAsset: "assets/oblique-tabletop.webp",
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

  it("publishes Interior Corner with its four-stage Rise/Swing guided lesson", () => {
    const entry = publicSceneCatalog.find((candidate) => candidate.id === "interior-corner")!;
    expect(entry).toMatchObject({
      id: "interior-corner",
      availability: "available",
      availableModes: ["free", "guided"],
      thumbnailAsset: "assets/interior-corner.webp",
    });
    expect(entry.guidedTaskId).toBe("interior-corner-aperture-01");
    expect(entry.guidedTaskIds).toEqual([
      "interior-corner-compose-01",
      "interior-corner-swing-01",
      "interior-corner-refine-01",
      "interior-corner-aperture-01",
    ]);
    expect(entry.guidedLesson).toEqual({
      id: "interior-corner",
      includeObserveStage: true,
      taskStageIds: ["compose", "swing", "refine", "aperture"],
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
    expect(entry.thumbnailAsset).toBe("assets/architecture-foreground.webp");
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

  it("places the Macro Photography roadmap last in the canonical public order", () => {
    expect(publicSceneCatalog.slice(-macroSceneIds.length).map(({ id }) => id)).toEqual([
      ...macroSceneIds,
    ]);
    expect(publicSceneIds.slice(-macroSceneIds.length)).toEqual([...macroSceneIds]);
    expect(new Set(publicSceneCatalog.map((entry) => entry.id)).size).toBe(publicSceneCatalog.length);
    expect(new Set(publicSceneIds).size).toBe(publicSceneIds.length);
    expect(publicSceneCatalog.map((entry) => entry.id)).toEqual([...publicSceneIds]);
  });

  it("rejects a missing scene definition", () => {
    expect(validate(publicSceneCatalog, () => undefined).errors).toContain(
      "shelf-swing: scene definition is missing",
    );
  });

  it("accepts a missing scene definition only for in-development entries", () => {
    const entry = publicSceneCatalog.find((candidate) => candidate.id === macroSceneIds[1])!;

    expect(validate([entry], () => undefined)).toEqual({ valid: true, errors: [] });
  });

  it("rejects in-development entries that claim simulator or lesson behavior", () => {
    const entry = publicSceneCatalog.find((candidate) => candidate.id === macroSceneIds[1])!;
    const modeEntry = [{ ...entry, availableModes: ["free"] as const }];
    const taskEntry = [{ ...entry, guidedTaskId: "future-task" }];
    const taskIdsEntry = [{ ...entry, guidedTaskIds: [] as const }];
    const lessonEntry = [
      {
        ...entry,
        lesson: { kind: "anatomy" as const, id: "future-lesson" },
      },
    ];

    expect(validate(modeEntry).errors).toContain(
      `${entry.id}: in-development scenes must not support simulator modes`,
    );
    expect(validate(taskEntry).errors).toContain(
      `${entry.id}: in-development scenes must not claim guided tasks`,
    );
    expect(validate(taskIdsEntry).errors).toContain(
      `${entry.id}: in-development scenes must not claim guided tasks`,
    );
    expect(validate(lessonEntry).errors).toContain(
      `${entry.id}: in-development scenes must not claim lesson metadata`,
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
