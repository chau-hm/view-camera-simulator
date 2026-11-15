import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { getGuidedLessonContext } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { LearningOverlayPanel } from "../../components/simulator/LearningOverlayPanel";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { i18n } from "../../i18n";
import type { TaskEvaluation } from "../../types/task";

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

const interiorCornerEntry = getPublicSceneEntryById("interior-corner");
if (!interiorCornerEntry) throw new Error("Missing Interior Corner public scene entry");

const interiorCornerComposeTask = getTaskById("interior-corner-compose-01");
if (!interiorCornerComposeTask) throw new Error("Missing Interior Corner Compose task");

const interiorCornerObserveContext = getGuidedLessonContext({
  entry: interiorCornerEntry,
  mode: "free",
  sceneId: interiorCornerEntry.id,
  taskId: null,
  search: "?lesson=1",
});
if (!interiorCornerObserveContext) throw new Error("Expected Interior Corner Observe context");

const interiorCornerComposeContext = getGuidedLessonContext({
  entry: interiorCornerEntry,
  mode: "guided",
  sceneId: interiorCornerEntry.id,
  taskId: interiorCornerComposeTask.id,
  search: "?lesson=1",
});
if (!interiorCornerComposeContext) throw new Error("Expected Interior Corner Compose context");

const completedEvaluation: TaskEvaluation = {
  taskId: guidedTask.id,
  status: "passed",
  score: 1,
  criteria: [],
  primaryFeedback: { key: "tasks.common.genericPassPrimary" },
  secondaryFeedback: [],
};

const failedEvaluation: TaskEvaluation = {
  taskId: guidedTask.id,
  status: "failed",
  score: 0.5,
  criteria: [],
  primaryFeedback: { key: "tasks.common.genericFailPrimary" },
  secondaryFeedback: [],
};

const renderPanel = (
  mode: "guided" | "free" = "guided",
  evaluation: TaskEvaluation | null = null,
  sceneId = "oblique-architecture",
  task = mode === "guided" ? guidedTask : null,
  guidedLessonContext = mode === "guided" ? guidedContext : null,
) =>
  render(
    <MemoryRouter>
      <LearningOverlayPanel
        mode={mode}
        sceneId={sceneId}
        task={task}
        evaluation={evaluation}
        guidedLessonContext={guidedLessonContext}
      />
    </MemoryRouter>,
  );

const getPanel = () => screen.getByTestId("learning-overlay-panel");
const getDrawer = () => screen.getByTestId("learning-overlay-drawer");
const getRail = () => {
  const rail = getPanel().querySelector<HTMLButtonElement>(".learning-overlay-panel__rail");
  if (!rail) throw new Error("Learning rail not found");
  return rail;
};

const openDrawer = () => {
  fireEvent.click(getRail());
  expect(getPanel()).not.toHaveAttribute("data-drawer-state", "peek");
};

describe("LearningOverlayPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts guided tasks with the Task view expanded and pinned", () => {
    const { container } = renderPanel();

    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(getPanel()).toHaveAttribute("data-pinned", "true");
    expect(getRail()).toHaveAttribute("aria-expanded", "true");
    expect(getDrawer()).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Feedback$/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("learning-overlay-task-view")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guided lesson progress" })).toBeInTheDocument();
    expect(container.querySelector(".simulator-task-feedback-grid")).not.toBeInTheDocument();
  });

  it("keeps Free Practice collapsed until the rail is activated", () => {
    renderPanel("free");

    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getRail()).toHaveAccessibleName("Open Task and Feedback");
    expect(getRail()).toHaveAttribute("aria-expanded", "false");
    expect(getDrawer()).toHaveAttribute("aria-hidden", "true");

    fireEvent.focus(getRail());
    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
    expect(getRail()).toHaveAttribute("aria-expanded", "true");
  });

  it("starts a Free-mode guided lesson Observe stage pinned with Continue visible", () => {
    renderPanel("free", null, interiorCornerEntry.id, null, interiorCornerObserveContext);

    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(getPanel()).toHaveAttribute("data-pinned", "true");
    expect(getRail()).toHaveAttribute("aria-expanded", "true");
    expect(getDrawer()).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("learning-overlay-task-view")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guided lesson progress" })).toHaveAttribute(
      "data-guided-lesson-stage",
      "observe",
    );
    expect(screen.getByRole("link", { name: "Continue" })).toBeVisible();
  });

  it("applies drawer defaults when switching between Free Practice and guided lesson stages", () => {
    const { rerender } = renderPanel("free", null, interiorCornerEntry.id, null, null);
    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="free"
          sceneId={interiorCornerEntry.id}
          task={null}
          evaluation={null}
          guidedLessonContext={interiorCornerObserveContext}
        />
      </MemoryRouter>,
    );

    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));
    expect(screen.getByRole("button", { name: /^Feedback$/ })).toHaveAttribute("aria-pressed", "true");

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="guided"
          sceneId={interiorCornerEntry.id}
          task={interiorCornerComposeTask}
          evaluation={null}
          guidedLessonContext={interiorCornerComposeContext}
        />
      </MemoryRouter>,
    );

    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Guided lesson progress" })).toHaveAttribute(
      "data-guided-lesson-stage",
      "compose",
    );

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="free"
          sceneId={interiorCornerEntry.id}
          task={null}
          evaluation={null}
          guidedLessonContext={null}
        />
      </MemoryRouter>,
    );

    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getPanel()).toHaveAttribute("data-pinned", "false");
    expect(getDrawer()).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps a closed Observe drawer collapsed after evaluation updates", () => {
    const { rerender } = renderPanel("free", null, interiorCornerEntry.id, null, interiorCornerObserveContext);

    fireEvent.click(screen.getByRole("button", { name: "Close Task and Feedback" }));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getDrawer()).toHaveAttribute("aria-hidden", "true");

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="free"
          sceneId={interiorCornerEntry.id}
          task={null}
          evaluation={{ ...completedEvaluation, taskId: interiorCornerComposeTask.id }}
          guidedLessonContext={interiorCornerObserveContext}
        />
      </MemoryRouter>,
    );

    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getDrawer()).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps guided lesson Observe in flow on narrow layouts", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query === "(max-width: 900px)",
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });

    try {
      renderPanel("free", null, interiorCornerEntry.id, null, interiorCornerObserveContext);
      expect(getPanel()).toHaveAttribute("data-drawer-state", "flow");
      expect(getDrawer()).toHaveAttribute("aria-hidden", "false");
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("switches between Task and Feedback without changing the selected view on evaluation updates", () => {
    const { rerender } = renderPanel();
    openDrawer();

    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));
    expect(screen.getByTestId("learning-overlay-feedback-view")).toHaveTextContent("Not started");

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="guided"
          sceneId="oblique-architecture"
          task={guidedTask}
          evaluation={failedEvaluation}
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

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="guided"
          sceneId="oblique-architecture"
          task={guidedTask}
          evaluation={completedEvaluation}
          guidedLessonContext={guidedContext}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("learning-overlay-task-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Feedback — Task completed" })).toHaveAttribute(
      "data-status",
      "completed",
    );
  });

  it("resets to Task, Peek, and unpinned when the learning context changes", () => {
    const { rerender } = renderPanel();
    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="free"
          sceneId="table-tilt"
          task={null}
          evaluation={null}
          guidedLessonContext={null}
        />
      </MemoryRouter>,
    );

    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getPanel()).toHaveAttribute("data-pinned", "false");
    expect(getRail()).toHaveAccessibleName("Open Task and Feedback");

    rerender(
      <MemoryRouter>
        <LearningOverlayPanel
          mode="guided"
          sceneId="oblique-architecture"
          task={guidedTask}
          evaluation={null}
          guidedLessonContext={guidedContext}
        />
      </MemoryRouter>,
    );
    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps completion discoverable on the open guided drawer without switching away from Task", () => {
    renderPanel("guided", completedEvaluation);

    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(getRail()).toHaveAccessibleName("Task and Feedback — Task completed");
    expect(getRail().querySelector(".learning-overlay-panel__completion-cue")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /^Task$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Feedback — Task completed" })).toHaveAttribute(
      "data-status",
      "completed",
    );
  });

  it("pins the drawer, supports unpinning, and closes back to Peek", () => {
    renderPanel("free");
    openDrawer();

    const pin = screen.getByRole("button", { name: "Keep Task and Feedback open" });
    expect(pin).toHaveAttribute("title", "Keep Task and Feedback open");
    expect(pin.querySelector(".material-symbols-outlined")).toHaveTextContent("push_pin");
    expect(pin.querySelectorAll("span:not(.material-symbols-outlined)")).toHaveLength(0);
    fireEvent.click(pin);
    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(pin).toHaveAttribute("aria-pressed", "true");

    vi.useFakeTimers();
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    act(() => vi.advanceTimersByTime(500));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");

    const unpin = screen.getByRole("button", { name: "Allow Task and Feedback to auto-hide" });
    expect(unpin).toHaveAttribute("title", "Allow Task and Feedback to auto-hide");
    expect(unpin.querySelector(".material-symbols-outlined")).toHaveTextContent("keep");
    expect(unpin.querySelectorAll("span:not(.material-symbols-outlined)")).toHaveLength(0);
    fireEvent.click(unpin);
    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
    const close = screen.getByRole("button", { name: "Close Task and Feedback" });
    expect(close).toHaveAttribute("title", "Close Task and Feedback");
    expect(close.querySelector(".material-symbols-outlined")).toHaveTextContent("close");
    expect(close.querySelectorAll("span:not(.material-symbols-outlined)")).toHaveLength(0);
    fireEvent.click(close);

    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getPanel()).toHaveAttribute("data-pinned", "false");
    expect(getRail()).toHaveFocus();
  });

  it("closes with Escape and returns focus to the rail", () => {
    renderPanel();
    openDrawer();
    getDrawer().focus();

    fireEvent.keyDown(getDrawer(), { key: "Escape" });

    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    expect(getRail()).toHaveFocus();
  });

  it("does not close when focus moves between drawer descendants", () => {
    renderPanel("free");
    openDrawer();
    const task = screen.getByRole("button", { name: /^Task$/ });
    const feedback = screen.getByRole("button", { name: /^Feedback$/ });

    vi.useFakeTimers();
    fireEvent.blur(task, { relatedTarget: feedback });
    act(() => vi.advanceTimersByTime(500));

    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
  });

  it("keeps the transient drawer open while the focused rail remains active", () => {
    renderPanel("free");
    const rail = getRail();
    fireEvent.focus(rail);
    rail.focus();

    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
    expect(rail).toHaveFocus();

    vi.useFakeTimers();
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    act(() => vi.advanceTimersByTime(500));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");

    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    act(() => vi.advanceTimersByTime(500));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
    outside.remove();
  });

  it("keeps the transient drawer open while a drawer descendant remains focused", () => {
    renderPanel("free");
    openDrawer();
    screen.getByRole("button", { name: /^Task$/ }).focus();

    vi.useFakeTimers();
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    act(() => vi.advanceTimersByTime(500));

    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
  });

  it("cancels a pending transient close when the pointer re-enters", () => {
    renderPanel("free");
    openDrawer();
    vi.useFakeTimers();

    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerEnter(getDrawer(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(200));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");

    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    act(() => vi.advanceTimersByTime(400));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
  });

  it("clears a pending close timer when unmounted", () => {
    vi.useFakeTimers();
    const { unmount } = renderPanel("free");
    openDrawer();
    fireEvent.pointerMove(window, { pointerType: "mouse", clientX: 999, clientY: 999 });
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps touch-open drawers stable until explicitly closed", () => {
    renderPanel("free");
    const rail = getRail();
    fireEvent.pointerDown(rail, { pointerType: "touch" });
    fireEvent.click(rail);
    fireEvent.pointerLeave(getDrawer(), { pointerType: "touch" });

    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
    fireEvent.click(screen.getByRole("button", { name: "Close Task and Feedback" }));
    expect(getPanel()).toHaveAttribute("data-drawer-state", "peek");
  });

  it("keeps Task and Feedback available in Free Practice", () => {
    renderPanel("free");
    openDrawer();

    expect(screen.getByTestId("learning-overlay-task-view")).toHaveTextContent("Free practice");
    expect(screen.queryByText("✓")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Feedback$/ }));
    expect(screen.getByTestId("learning-overlay-feedback-view")).toHaveTextContent(
      "Live observation",
    );
  });

  it("localizes the drawer controls", async () => {
    renderPanel("guided", completedEvaluation);
    await i18n.changeLanguage("zh-HK");

    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(getPanel()).toHaveAttribute("data-pinned", "true");
    expect(screen.getByRole("region", { name: "任務及回饋" })).toBeInTheDocument();
    const views = screen.getByRole("group", { name: "任務及回饋檢視" });
    expect(within(views).getByRole("button", { name: /^任務$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const feedback = within(views).getByRole("button", { name: "回饋 — 任務完成" });
    expect(feedback).toHaveAttribute("aria-pressed", "false");
    expect(feedback).toHaveAttribute(
      "data-status",
      "completed",
    );
    expect(screen.getByRole("region", { name: "任務" })).toBeInTheDocument();

    const unpin = screen.getByRole("button", { name: "允許任務及回饋自動隱藏" });
    expect(unpin).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "關閉任務及回饋" })).toBeInTheDocument();

    fireEvent.click(unpin);
    const pin = screen.getByRole("button", { name: "保持任務及回饋開啟" });
    expect(getPanel()).toHaveAttribute("data-drawer-state", "transient");
    expect(pin).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pin);
    expect(getPanel()).toHaveAttribute("data-drawer-state", "pinned");
    expect(screen.getByRole("button", { name: "允許任務及回饋自動隱藏" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
