import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GuidedLessonContext } from "../../app/guidedLesson";
import { guidedTaskMessageKeys } from "../../i18n/guidedTaskMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type { InteriorCornerRiseCompositionEvaluation } from "../../scenes/interiorCornerRiseComposition";
import type { InteriorCornerSwingFocusEvaluation } from "../../scenes/interiorCornerSwingFocus";
import type { SimulatorMode } from "../../types/camera";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";
import { FeedbackPanel } from "./FeedbackPanel";
import { GuidedLessonProgress } from "./GuidedLessonProgress";
import { TaskPanel } from "./TaskPanel";

type LearningOverlayView = "task" | "feedback";

type LearningOverlayPanelProps = {
  mode: SimulatorMode;
  sceneId: string;
  task: TaskDefinition | null;
  evaluation: TaskEvaluation | null;
  guidedLessonContext: GuidedLessonContext | null;
  freeCompositionEvaluation?: InteriorCornerRiseCompositionEvaluation | null;
  freeFocusEvaluation?: InteriorCornerSwingFocusEvaluation | null;
};

export const LearningOverlayPanel = ({
  mode,
  sceneId,
  task,
  evaluation,
  guidedLessonContext,
  freeCompositionEvaluation,
  freeFocusEvaluation,
}: LearningOverlayPanelProps) => {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<LearningOverlayView>("task");
  const [collapsed, setCollapsed] = useState(false);
  const panelId = useId();
  const contentId = `${panelId}-content`;

  useEffect(() => {
    setActiveView("task");
    setCollapsed(false);
  }, [mode, sceneId, task?.id]);

  const taskLabel = t(simulatorMessageKeys.task.title);
  const feedbackLabel = t(simulatorMessageKeys.feedback.title);
  const hasCompletedEvaluation = mode === "guided" && evaluation?.status === "passed";
  const completedLabel = t(guidedTaskMessageKeys.common.taskCompleted);
  const feedbackButtonLabel = hasCompletedEvaluation
    ? `${feedbackLabel} — ${completedLabel}`
    : feedbackLabel;
  const expandLabel = t(simulatorMessageKeys.learning.expand);
  const collapseLabel = t(simulatorMessageKeys.learning.collapse);
  const collapseButtonLabel = collapsed
    ? hasCompletedEvaluation
      ? `${expandLabel} — ${completedLabel}`
      : expandLabel
    : collapseLabel;
  const activeLabel = activeView === "task" ? taskLabel : feedbackLabel;

  return (
    <section
      aria-label={t(simulatorMessageKeys.learning.title)}
      className={`learning-overlay-panel${collapsed ? " learning-overlay-panel--collapsed" : ""}`}
      data-collapsed={collapsed ? "true" : "false"}
      data-testid="learning-overlay-panel"
    >
      <header className="learning-overlay-panel__header">
        {collapsed ? (
          <span className="learning-overlay-panel__collapsed-label">
            {activeLabel}
            {hasCompletedEvaluation ? (
              <span aria-hidden="true" className="learning-overlay-panel__completion-cue">
                ✓
              </span>
            ) : null}
          </span>
        ) : (
          <div
            aria-label={t(simulatorMessageKeys.learning.viewsLabel)}
            className="learning-overlay-panel__views"
            role="group"
          >
            <button
              aria-pressed={activeView === "task"}
              className="learning-overlay-panel__view-button"
              type="button"
              onClick={() => setActiveView("task")}
            >
              {taskLabel}
            </button>
            <button
              aria-label={feedbackButtonLabel}
              aria-pressed={activeView === "feedback"}
              className="learning-overlay-panel__view-button"
              data-status={hasCompletedEvaluation ? "completed" : "in-progress"}
              type="button"
              onClick={() => setActiveView("feedback")}
            >
              {feedbackLabel}
              {hasCompletedEvaluation ? (
                <span aria-hidden="true" className="learning-overlay-panel__completion-cue">
                  ✓
                </span>
              ) : null}
            </button>
          </div>
        )}

        <button
          aria-controls={contentId}
          aria-expanded={!collapsed}
          aria-label={collapseButtonLabel}
          className="learning-overlay-panel__collapse-button"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
        >
          <span>{collapsed ? expandLabel : collapseLabel}</span>
          <span aria-hidden="true" className="material-symbols-outlined">
            {collapsed ? "expand_less" : "expand_more"}
          </span>
        </button>
      </header>

      <div
        className="learning-overlay-panel__content"
        hidden={collapsed}
        id={contentId}
        tabIndex={0}
      >
        {activeView === "task" ? (
          <div
            aria-label={taskLabel}
            className="learning-overlay-panel__view"
            data-testid="learning-overlay-task-view"
          >
            {guidedLessonContext ? (
              <GuidedLessonProgress context={guidedLessonContext} evaluation={evaluation} />
            ) : null}
            {guidedLessonContext?.stage === "observe" ? null : (
              <TaskPanel task={task} sceneId={sceneId} showTitle={false} />
            )}
          </div>
        ) : (
          <div
            aria-label={feedbackLabel}
            className="learning-overlay-panel__view"
            data-testid="learning-overlay-feedback-view"
          >
            <FeedbackPanel
              mode={mode}
              sceneId={sceneId}
              task={task}
              evaluation={evaluation}
              freeCompositionEvaluation={freeCompositionEvaluation}
              freeFocusEvaluation={freeFocusEvaluation}
              showTitle={false}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export type { LearningOverlayPanelProps, LearningOverlayView };
