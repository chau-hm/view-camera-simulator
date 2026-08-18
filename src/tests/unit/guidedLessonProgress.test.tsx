import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { getGuidedLessonContext } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { i18n } from "../../i18n";
import { GuidedLessonProgress } from "../../components/simulator/GuidedLessonProgress";
import type { TaskEvaluation } from "../../types/task";

const entry = getPublicSceneEntryById("oblique-architecture");
if (!entry) throw new Error("Missing Oblique Architecture public scene entry");

const passingEvaluation: TaskEvaluation = {
  taskId: "oblique-rise-01",
  status: "passed",
  score: 1,
  criteria: [],
  primaryFeedback: { key: "tasks.common.genericPassPrimary" },
  secondaryFeedback: [],
};

const contextFor = (mode: "free" | "guided", taskId: string | null) => {
  const context = getGuidedLessonContext({
    entry,
    mode,
    sceneId: "oblique-architecture",
    taskId,
    search: "?lesson=1",
  });
  if (!context) throw new Error("Expected lesson context");
  return context;
};

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

describe("GuidedLessonProgress", () => {
  it("marks Observe as the current stage and keeps Continue enabled", () => {
    render(
      <MemoryRouter>
        <GuidedLessonProgress context={contextFor("free", null)} evaluation={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Observe the Problem" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Observe");
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/simulator/guided/oblique-architecture/oblique-rise-01?lesson=1",
    );
  });

  it("gates task advancement on the existing passed evaluation", () => {
    const context = contextFor("guided", "oblique-rise-01");
    const { rerender } = render(
      <MemoryRouter>
        <GuidedLessonProgress context={context} evaluation={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/simulator/free/oblique-architecture?lesson=1",
    );

    rerender(
      <MemoryRouter>
        <GuidedLessonProgress context={context} evaluation={passingEvaluation} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/simulator/guided/oblique-architecture/oblique-swing-focus-01?lesson=1",
    );

    const stages = screen.getAllByRole("listitem");
    expect(stages[0]).toHaveAttribute("data-stage-status", "previous");
    expect(stages[0]).not.toHaveAttribute("data-stage-status", "complete");
  });

  it("uses neutral previous status for deep-linked later stages without progress history", () => {
    const context = contextFor("guided", "oblique-compound-01");
    render(
      <MemoryRouter>
        <GuidedLessonProgress context={context} evaluation={null} />
      </MemoryRouter>,
    );

    const stages = screen.getAllByRole("listitem");
    expect(stages.map((stage) => stage.getAttribute("data-stage-status"))).toEqual([
      "previous",
      "previous",
      "previous",
      "current",
    ]);
    expect(stages.slice(0, 3).every((stage) => !stage.className.includes("complete"))).toBe(true);
    expect(screen.queryByText("Lesson complete")).not.toBeInTheDocument();
  });

  it("shows completion and a Scenes exit on the final stage", () => {
    const context = contextFor("guided", "oblique-compound-01");
    render(
      <MemoryRouter>
        <GuidedLessonProgress context={context} evaluation={passingEvaluation} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Lesson complete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Scenes" })).toHaveAttribute(
      "href",
      "/scenes",
    );
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Final Challenge");
    expect(screen.getAllByRole("listitem").map((stage) => stage.getAttribute("data-stage-status"))).toEqual([
      "previous",
      "previous",
      "previous",
      "current",
    ]);
  });
});
