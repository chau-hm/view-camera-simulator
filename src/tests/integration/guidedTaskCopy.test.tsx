import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FeedbackPanel } from "../../components/simulator/FeedbackPanel";
import { TaskPanel } from "../../components/simulator/TaskPanel";
import {
  getCriterionResultMessageRef,
  getGuidedTaskCopy,
} from "../../core/tasks/guidedTaskCopyKeys";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { changeLocale, i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";
import { guidedTaskMessageKeys } from "../../i18n/guidedTaskMessageKeys";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";

const guidedTaskIds = ["rise-01", "tilt-01", "swing-01", "mirror-shift-01"] as const;

const resetLocale = async () => {
  cleanup();
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
};

const getGuidedTask = (taskId: (typeof guidedTaskIds)[number]): TaskDefinition => {
  const task = getTaskById(taskId);
  if (!task) throw new Error(`Missing guided task: ${taskId}`);
  return task;
};

const makeEvaluation = (
  task: TaskDefinition,
  secondaryCriterionId = task.criteria[0]?.id,
): TaskEvaluation => {
  const copy = getGuidedTaskCopy(task);
  return {
    taskId: task.id,
    status: "failed",
    score: 0,
    criteria: task.criteria.map((criterion) => ({
      criterionId: criterion.id,
      label: copy.criteria[criterion.id],
      passed: false,
      score: 0,
      message: getCriterionResultMessageRef(criterion, false),
    })),
    primaryFeedback:
      copy.feedback.primary[task.criteria[0]?.id ?? ""] ?? copy.feedback.defaultFailPrimary,
    secondaryFeedback: secondaryCriterionId
      ? [copy.feedback.secondary[secondaryCriterionId] ?? { key: guidedTaskMessageKeys.common.genericSecondary }]
      : [],
  };
};

const makePassedEvaluation = (task: TaskDefinition): TaskEvaluation => {
  const copy = getGuidedTaskCopy(task);
  return {
    ...makeEvaluation(task),
    status: "passed",
    score: 1,
    primaryFeedback: copy.feedback.passPrimary,
    secondaryFeedback: copy.feedback.passSecondary ? [copy.feedback.passSecondary] : [],
    criteria: task.criteria.map((criterion) => ({
      criterionId: criterion.id,
      label: copy.criteria[criterion.id],
      passed: true,
      score: 1,
      message: getCriterionResultMessageRef(criterion, true),
    })),
    finalCameraState: {
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      focusDistanceMm: 3800,
      aperture: 11,
      frontShiftMm: -55,
      mirrorShiftLessonState: { rigLateralMm: 2000 },
    },
  };
};

const renderGuidedTask = (
  taskId: (typeof guidedTaskIds)[number],
  secondaryCriterionId?: string,
) => {
  const task = getGuidedTask(taskId);
  render(
    <>
      <TaskPanel task={task} sceneId={task.sceneId} />
      <FeedbackPanel
        mode="guided"
        sceneId={task.sceneId}
        task={task}
        evaluation={makeEvaluation(task, secondaryCriterionId)}
      />
    </>,
  );
};

beforeEach(resetLocale);
afterEach(resetLocale);

describe("Guided Task message contract", () => {
  it.each(guidedTaskIds)("maps %s without locale-specific fallback text", (taskId) => {
    const task = getGuidedTask(taskId);
    const copy = getGuidedTaskCopy(task);

    expect(copy.title.key).toMatch(/^tasks\./);
    expect(copy.objective.key).toMatch(/^tasks\./);
    expect(copy.notes.length).toBeGreaterThan(0);
    expect(copy.notes.every((note) => note.key.startsWith("tasks."))).toBe(true);
    expect(copy.feedback.passPrimary.key).toMatch(/^tasks\./);
    expect(copy.feedback.defaultFailPrimary.key).toMatch(/^tasks\./);
    expect(Object.keys(copy.criteria)).toEqual(task.criteria.map((criterion) => criterion.id));
    expect(Object.keys(copy.feedback.primary)).toEqual(task.criteria.map((criterion) => criterion.id));
    expect(Object.keys(copy.feedback.secondary)).toEqual(task.criteria.map((criterion) => criterion.id));
    expect(Object.values(copy.criteria).every((message) => message.key.startsWith("tasks."))).toBe(true);
    expect(Object.values(copy.feedback.primary).every((message) => message.key.startsWith("tasks."))).toBe(true);
    expect(Object.values(copy.feedback.secondary).every((message) => message.key.startsWith("tasks."))).toBe(true);
  });
});

describe("Guided Task presentation", () => {
  it("renders representative English teaching relationships for all four tasks", () => {
    renderGuidedTask("rise-01");
    expect(document.body).toHaveTextContent(/Front Rise/);
    expect(document.body).toHaveTextContent(/camera level/);
    expect(document.body).toHaveTextContent(/whole-camera viewpoint/);

    cleanup();
    renderGuidedTask("tilt-01");
    expect(document.body).toHaveTextContent(/Front Tilt/);
    expect(document.body).toHaveTextContent(/plane of sharp focus/);
    expect(document.body).toHaveTextContent(/f\/11 or f\/22/);

    cleanup();
    renderGuidedTask("swing-01", "swing-allowed-aperture");
    expect(document.body).toHaveTextContent(/negative Front Swing/);
    expect(document.body).toHaveTextContent(/plane of sharp focus/);
    expect(document.body).toHaveTextContent(/Top view/);

    cleanup();
    renderGuidedTask("mirror-shift-01", "mirror-viewpoint-retained");
    expect(document.body).toHaveTextContent(/whole camera sideways/);
    expect(document.body).toHaveTextContent(/changed viewpoint/);
    expect(document.body).toHaveTextContent(/opposite Front Shift/);
    expect(document.body).toHaveTextContent(/mirror framing/);
    expect(document.body).toHaveTextContent(/parallax/);
    expect(screen.getAllByText("Guided task").length).toBeGreaterThan(0);
    expect(screen.getByText("Allowed controls:")).toBeInTheDocument();
  });

  it("renders representative zh-HK teaching relationships and structural labels", async () => {
    changeLocale("zh-HK");

    renderGuidedTask("rise-01");
    await waitFor(() => expect(document.body).toHaveTextContent(/前組上移/));
    expect(document.body).toHaveTextContent(/構圖/);
    expect(document.body).toHaveTextContent(/視點/);
    expect(document.body).toHaveTextContent(/引導任務/);
    expect(document.body).toHaveTextContent(/允許的控制項目/);

    cleanup();
    renderGuidedTask("tilt-01");
    expect(document.body).toHaveTextContent(/前組傾斜/);
    expect(document.body).toHaveTextContent(/清晰焦平面/);

    cleanup();
    renderGuidedTask("swing-01", "swing-allowed-aperture");
    expect(document.body).toHaveTextContent(/前組擺動/);
    expect(document.body).toHaveTextContent(/清晰焦平面/);
    expect(document.body).toHaveTextContent(/俯視幾何圖/);

    cleanup();
    renderGuidedTask("mirror-shift-01", "mirror-viewpoint-retained");
    expect(document.body).toHaveTextContent(/視點/);
    expect(document.body).toHaveTextContent(/構圖/);
    expect(document.body).toHaveTextContent(/前組橫移/);
    expect(document.body).toHaveTextContent(/視差/);
    expect(document.body).toHaveTextContent(/進行中/);
  });

  it("switches an existing evaluation at render time without reevaluation", async () => {
    const task = getGuidedTask("mirror-shift-01");
    render(
      <FeedbackPanel
        mode="guided"
        sceneId={task.sceneId}
        task={task}
        evaluation={makeEvaluation(task, "mirror-viewpoint-retained")}
      />,
    );

    expect(document.body).toHaveTextContent(/Move the whole camera sideways/);
    expect(document.body).toHaveTextContent(/parallax/);

    changeLocale("zh-HK");
    await waitFor(() => {
      expect(document.body).toHaveTextContent(/將整部相機向側面移動/);
      expect(document.body).toHaveTextContent(/視差/);
    });
  });

  it("localizes the Guided completion summary labels", async () => {
    const task = getGuidedTask("mirror-shift-01");
    render(
      <FeedbackPanel
        mode="guided"
        sceneId={task.sceneId}
        task={task}
        evaluation={makePassedEvaluation(task)}
      />,
    );

    expect(document.body).toHaveTextContent(/Final settings/);
    expect(document.body).toHaveTextContent(/Front Rise/);
    expect(document.body).toHaveTextContent(/Camera Position/);
    expect(document.body).toHaveTextContent(/Front Shift/);

    changeLocale("zh-HK");
    await waitFor(() => {
      expect(document.body).toHaveTextContent(/最後設定/);
      expect(document.body).toHaveTextContent(/前組上移/);
      expect(document.body).toHaveTextContent(/相機位置/);
      expect(document.body).toHaveTextContent(/前組橫移/);
    });
  });

  it("uses Guided-specific waiting copy when no evaluation exists", async () => {
    const task = getGuidedTask("rise-01");
    render(
      <FeedbackPanel
        mode="guided"
        sceneId={task.sceneId}
        task={task}
        evaluation={null}
      />,
    );

    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/Follow the task instructions/);
    expect(document.body).not.toHaveTextContent(/Explore the scene without a scored task/);

    changeLocale("zh-HK");
    await waitFor(() => {
      expect(screen.getByText("尚未開始")).toBeInTheDocument();
      expect(document.body).toHaveTextContent(/按照任務指示調整允許的控制項目/);
    });
    expect(document.body).not.toHaveTextContent(/探索場景，不設評分任務/);
  });
});
