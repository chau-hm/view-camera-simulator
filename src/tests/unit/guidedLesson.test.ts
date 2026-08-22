import { describe, expect, it } from "vitest";
import {
  getGuidedLessonContext,
  getGuidedLessonStages,
} from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";

const entry = getPublicSceneEntryById("oblique-architecture");
if (!entry) throw new Error("Missing Oblique Architecture public scene entry");
const architectureForegroundEntry = getPublicSceneEntryById("architecture-foreground");
if (!architectureForegroundEntry) throw new Error("Missing Architecture + Foreground public scene entry");

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

describe("Architecture + Foreground guided lesson routing", () => {
  it("derives the five-stage sequence from the ordered public task metadata", () => {
    expect(getGuidedLessonStages(architectureForegroundEntry)).toEqual([
      { id: "observe" },
      { id: "compose", taskId: "architecture-foreground-rise-01" },
      { id: "align-focus", taskId: "architecture-foreground-tilt-focus-01" },
      { id: "depth-of-field", taskId: "architecture-foreground-dof-01" },
      { id: "final-challenge", taskId: "architecture-foreground-compound-01" },
    ]);
  });

  it("constructs the complete lesson route context in order", () => {
    const observe = getGuidedLessonContext({
      entry: architectureForegroundEntry,
      mode: "free",
      sceneId: "architecture-foreground",
      taskId: null,
      search: "?lesson=1",
    });
    expect(observe).toMatchObject({
      lessonId: "architecture-foreground",
      stage: "observe",
      stageIndex: 0,
      previousHref: null,
      nextHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-rise-01?lesson=1",
    });

    const compose = getGuidedLessonContext({
      entry: architectureForegroundEntry,
      mode: "guided",
      sceneId: "architecture-foreground",
      taskId: "architecture-foreground-rise-01",
      search: "?lesson=1",
    });
    expect(compose).toMatchObject({
      stage: "compose",
      previousHref: "/simulator/free/architecture-foreground?lesson=1",
      nextHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-tilt-focus-01?lesson=1",
    });

    const alignFocus = getGuidedLessonContext({
      entry: architectureForegroundEntry,
      mode: "guided",
      sceneId: "architecture-foreground",
      taskId: "architecture-foreground-tilt-focus-01",
      search: "?lesson=1",
    });
    expect(alignFocus).toMatchObject({
      stage: "align-focus",
      previousHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-rise-01?lesson=1",
      nextHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-dof-01?lesson=1",
    });

    const depthOfField = getGuidedLessonContext({
      entry: architectureForegroundEntry,
      mode: "guided",
      sceneId: "architecture-foreground",
      taskId: "architecture-foreground-dof-01",
      search: "?lesson=1",
    });
    expect(depthOfField).toMatchObject({
      stage: "depth-of-field",
      previousHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-tilt-focus-01?lesson=1",
      nextHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-compound-01?lesson=1",
    });

    const finalChallenge = getGuidedLessonContext({
      entry: architectureForegroundEntry,
      mode: "guided",
      sceneId: "architecture-foreground",
      taskId: "architecture-foreground-compound-01",
      search: "?lesson=1",
    });
    expect(finalChallenge).toMatchObject({
      stage: "final-challenge",
      previousHref:
        "/simulator/guided/architecture-foreground/architecture-foreground-dof-01?lesson=1",
      nextHref: null,
    });
  });

  it("keeps direct task routes outside the lesson when the query is absent", () => {
    expect(
      getGuidedLessonContext({
        entry: architectureForegroundEntry,
        mode: "guided",
        sceneId: "architecture-foreground",
        taskId: "architecture-foreground-dof-01",
        search: "",
      }),
    ).toBeNull();
  });
});
