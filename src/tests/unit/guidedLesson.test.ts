import { describe, expect, it } from "vitest";
import {
  getGuidedLessonContext,
  getGuidedLessonStages,
} from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";

const entry = getPublicSceneEntryById("oblique-architecture");
if (!entry) throw new Error("Missing Oblique Architecture public scene entry");

describe("Oblique Architecture guided lesson routing", () => {
  it("derives the four-stage sequence from the public guided task order", () => {
    expect(getGuidedLessonStages(entry)).toEqual([
      { id: "observe" },
      { id: "compose", taskId: "oblique-rise-01" },
      { id: "align-focus", taskId: "oblique-swing-focus-01" },
      { id: "final-challenge", taskId: "oblique-compound-01" },
    ]);
  });

  it("starts at Observe and provides the next lesson route", () => {
    const context = getGuidedLessonContext({
      entry,
      mode: "free",
      sceneId: "oblique-architecture",
      taskId: null,
      search: "?lesson=1",
    });

    expect(context).toMatchObject({
      stage: "observe",
      stageIndex: 0,
      previousHref: null,
      nextHref: "/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1",
    });
  });

  it("keeps direct task routes ordinary unless the lesson query is present", () => {
    expect(
      getGuidedLessonContext({
        entry,
        mode: "guided",
        sceneId: "oblique-architecture",
        taskId: "oblique-rise-01",
        search: "",
      }),
    ).toBeNull();

    const context = getGuidedLessonContext({
      entry,
      mode: "guided",
      sceneId: "oblique-architecture",
      taskId: "oblique-swing-focus-01",
      search: "?lesson=1",
    });

    expect(context).toMatchObject({
      stage: "align-focus",
      previousHref: "/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1",
      nextHref: "/simulator/guided/oblique-architecture/oblique-compound-01?lesson=1",
    });
  });

  it("does not turn an unrelated scene or task into a lesson stage", () => {
    expect(
      getGuidedLessonContext({
        entry,
        mode: "guided",
        sceneId: "oblique-architecture",
        taskId: "swing-01",
        search: "?lesson=1",
      }),
    ).toBeNull();
  });
});
