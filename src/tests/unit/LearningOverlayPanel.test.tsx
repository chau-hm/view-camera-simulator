import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { getGuidedLessonContext } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { LearningOverlayPanel } from "../../components/simulator/LearningOverlayPanel";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { i18n } from "../../i18n";

const guidedEntry = getPublicSceneEntryById("oblique-architecture");
if (!guidedEntry) throw new Error("Missing Oblique Architecture public scene entry");

const guidedTask = getTaskById("oblique-rise-01");
if (!guidedTask) throw new Error("Missing Oblique Architecture guided task");

const guidedContext = getGuidedLessonContext({
  entry: guidedEntry,
  mode: "guided",
  sceneId: guidedEntry.id,
  taskId: guidedTask.id,
  search: "?lesson=1",
});
if (!guidedContext) throw new Error("Expected guided lesson context");

const renderPanel = (mode: "guided" | "free" = "guided") =>
  render(
    <MemoryRouter>
      <LearningOverlayPanel
        mode={mode}
        sceneId="oblique-architecture"
        task={mode === "guided" ? guidedTask : null}
        evaluation={null}
        guidedLessonContext={mode === "guided" ? guidedContext : null}
      />
    </MemoryRouter>,
  );

describe("LearningOverlayPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("starts with guided Task content and no duplicate normal-flow row", () => {
    const { container } = renderPanel();

    expect(screen.getByTestId("learning-overlay-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Feedback$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByTestId("learning-overlay-task-view")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guided lesson progress" })).toBeInTheDocument();
    expect(container.querySelector(".simulator-task-feedback-grid")).not.toBeInTheDocument();
  });

  it("switches between Task and Feedback without changing the selected view on evaluation updates", () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));
    expect(screen.getByTestId("learning-overlay-feedback-view")).toHaveTextContent("Not started");
    expect(screen.getByRole("button", { name: /^Feedback$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="guided"
          sceneId="oblique-architecture"
          task={guidedTask}
          evaluation={{
            taskId: guidedTask.id,
            status: "failed",
            score: 0.5,
            criteria: [],
            primaryFeedback: { key: "tasks.common.genericPassPrimary" },
            secondaryFeedback: [],
          }}
          guidedLessonContext={guidedContext}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("learning-overlay-feedback-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Feedback$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /^Task$/ }));
    expect(screen.getByTestId("learning-overlay-task-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("collapses to a labelled control and restores the active content", () => {
    renderPanel();
    const collapse = screen.getByRole("button", { name: "Collapse Task and Feedback" });

    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(collapse).toHaveAttribute("aria-controls");
    fireEvent.click(collapse);

    const collapsed = screen.getByRole("button", { name: "Show Task and Feedback" });
    expect(collapsed).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("learning-overlay-panel")).toHaveAttribute("data-collapsed", "true");
    expect(screen.getByTestId("learning-overlay-panel").querySelector(".learning-overlay-panel__content"))
      .toHaveAttribute("hidden");

    fireEvent.click(collapsed);
    expect(screen.getByRole("button", { name: "Collapse Task and Feedback" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByTestId("learning-overlay-task-view")).toBeInTheDocument();
  });

  it("keeps Task and Feedback available in Free Practice", () => {
    renderPanel("free");

    expect(screen.getByTestId("learning-overlay-task-view")).toHaveTextContent("Free practice");
    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));
    expect(screen.getByTestId("learning-overlay-feedback-view")).toHaveTextContent("Live observation");
  });

  it("localizes the compact controls", async () => {
    renderPanel();
    await i18n.changeLanguage("zh-HK");

    expect(screen.getByRole("region", { name: "任務及回饋" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^任務$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^回饋$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起任務及回饋" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
