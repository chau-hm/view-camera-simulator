import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GuidedLessonContext } from "../../app/guidedLesson";
import { guidedTaskMessageKeys } from "../../i18n/guidedTaskMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import type { InteriorCornerRiseCompositionEvaluation } from "../../scenes/interiorCornerRiseComposition";
import type { InteriorCornerSwingFocusEvaluation } from "../../scenes/interiorCornerSwingFocus";
import type { SimulatorMode } from "../../types/camera";
import type { TaskDefinition, TaskEvaluation } from "../../types/task";
import type { MacroBellowsExtensionTeachingModel } from "../../scenes/macroBellowsExtensionTeaching";
import { FeedbackPanel } from "./FeedbackPanel";
import { GuidedLessonProgress } from "./GuidedLessonProgress";
import { TaskPanel } from "./TaskPanel";

type LearningOverlayView = "task" | "feedback";
type LearningDrawerState = "peek" | "transient" | "pinned" | "flow";

const CLOSE_DELAY_MS = 400;
const NARROW_LAYOUT_QUERY = "(max-width: 900px)";
const HOVER_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

const resolveNarrowLayout = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(NARROW_LAYOUT_QUERY).matches
    : false;

const resolveHoverCapablePointer = (pointerType?: string): boolean => {
  if (pointerType === "touch") return false;
  if (pointerType === "mouse") return true;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(HOVER_POINTER_QUERY).matches;
};

const useNarrowLayout = (): boolean => {
  const [narrowLayout, setNarrowLayout] = useState(resolveNarrowLayout);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(NARROW_LAYOUT_QUERY);
    const handleChange = () => setNarrowLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  return narrowLayout;
};

type LearningOverlayPanelProps = {
  mode: SimulatorMode;
  sceneId: string;
  task: TaskDefinition | null;
  evaluation: TaskEvaluation | null;
  guidedLessonContext: GuidedLessonContext | null;
  freeCompositionEvaluation?: InteriorCornerRiseCompositionEvaluation | null;
  freeFocusEvaluation?: InteriorCornerSwingFocusEvaluation | null;
  macroTeaching?: MacroBellowsExtensionTeachingModel | null;
};

export const LearningOverlayPanel = ({
  mode,
  sceneId,
  task,
  evaluation,
  guidedLessonContext,
  freeCompositionEvaluation,
  freeFocusEvaluation,
  macroTeaching,
}: LearningOverlayPanelProps) => {
  const { t } = useTranslation();
  const narrowLayout = useNarrowLayout();
  const [activeView, setActiveView] = useState<LearningOverlayView>("task");
  const [drawerState, setDrawerState] = useState<LearningDrawerState>(() =>
    resolveNarrowLayout() ? "flow" : "peek",
  );
  const panelId = useId();
  const drawerId = `${panelId}-drawer`;
  const contentId = `${panelId}-content`;
  const panelRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerStateRef = useRef<LearningDrawerState>(drawerState);
  const suppressRailFocusRef = useRef(false);
  const stableTouchRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const updateDrawerState = useCallback(
    (nextState: LearningDrawerState) => {
      clearCloseTimer();
      drawerStateRef.current = nextState;
      setDrawerState(nextState);
    },
    [clearCloseTimer],
  );

  useEffect(() => {
    setActiveView("task");
    stableTouchRef.current = false;
    updateDrawerState(narrowLayout ? "flow" : "peek");
    suppressRailFocusRef.current = false;
  }, [mode, narrowLayout, sceneId, task?.id, updateDrawerState]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const openDrawer = useCallback(
    (stable = false) => {
      stableTouchRef.current = stable;
      clearCloseTimer();
      if (drawerStateRef.current === "pinned") return;
      const nextState: LearningDrawerState = narrowLayout ? "flow" : "transient";
      drawerStateRef.current = nextState;
      setDrawerState(nextState);
    },
    [clearCloseTimer, narrowLayout],
  );

  const scheduleClose = useCallback(() => {
    if (narrowLayout || stableTouchRef.current || drawerStateRef.current !== "transient") return;
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (!stableTouchRef.current && drawerStateRef.current !== "pinned") {
        drawerStateRef.current = "peek";
        setDrawerState("peek");
      }
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer, narrowLayout]);

  useEffect(() => {
    if (narrowLayout || drawerState !== "transient") return;

    const isInside = (element: HTMLElement | null, x: number, y: number) => {
      if (!element) return false;
      const bounds = element.getBoundingClientRect();
      return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!resolveHoverCapablePointer(event.pointerType)) return;
      if (panelRef.current?.contains(document.activeElement)) {
        clearCloseTimer();
        return;
      }
      if (
        isInside(drawerRef.current, event.clientX, event.clientY) ||
        isInside(railRef.current, event.clientX, event.clientY)
      ) {
        clearCloseTimer();
      } else {
        scheduleClose();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [clearCloseTimer, drawerState, narrowLayout, scheduleClose]);

  const closeDrawer = useCallback(() => {
    stableTouchRef.current = false;
    updateDrawerState("peek");
    if (typeof document !== "undefined" && document.activeElement !== railRef.current) {
      suppressRailFocusRef.current = true;
    }
    const restoreRailFocus = () => railRef.current?.focus({ preventScroll: true });
    restoreRailFocus();
    if (typeof window !== "undefined") window.requestAnimationFrame(restoreRailFocus);
  }, [updateDrawerState]);

  const togglePinned = useCallback(() => {
    if (narrowLayout) return;
    if (drawerStateRef.current === "pinned") {
      updateDrawerState(narrowLayout ? "flow" : "transient");
      return;
    }
    updateDrawerState("pinned");
  }, [narrowLayout, updateDrawerState]);

  const taskLabel = t(simulatorMessageKeys.task.title);
  const feedbackLabel = t(simulatorMessageKeys.feedback.title);
  const hasCompletedEvaluation = mode === "guided" && evaluation?.status === "passed";
  const completedLabel = t(guidedTaskMessageKeys.common.taskCompleted);
  const feedbackButtonLabel = hasCompletedEvaluation
    ? `${feedbackLabel} — ${completedLabel}`
    : feedbackLabel;
  const learningLabel = t(simulatorMessageKeys.learning.title);
  const openLabel = t(simulatorMessageKeys.learning.open);
  const closeLabel = t(simulatorMessageKeys.learning.close);
  const pinLabel = t(simulatorMessageKeys.learning.pin);
  const unpinLabel = t(simulatorMessageKeys.learning.unpin);
  const drawerOpen = drawerState !== "peek";
  const drawerPinned = drawerState === "pinned";
  const railLabel = hasCompletedEvaluation ? `${learningLabel} — ${completedLabel}` : openLabel;

  return (
    <section
      ref={panelRef}
      aria-label={learningLabel}
      className={`learning-overlay-panel learning-overlay-panel--${drawerState}`}
      data-drawer-state={drawerState}
      data-pinned={drawerPinned ? "true" : "false"}
      data-testid="learning-overlay-panel"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (!panelRef.current?.contains(nextTarget)) scheduleClose();
      }}
      onFocusCapture={clearCloseTimer}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !drawerOpen) return;
        event.preventDefault();
        event.stopPropagation();
        closeDrawer();
      }}
    >
      <button
        ref={railRef}
        aria-controls={drawerId}
        aria-expanded={drawerOpen}
        aria-label={railLabel}
        className="learning-overlay-panel__rail"
        type="button"
        onClick={() => openDrawer(stableTouchRef.current)}
        onFocus={() => {
          if (suppressRailFocusRef.current) {
            suppressRailFocusRef.current = false;
            clearCloseTimer();
            return;
          }
          openDrawer(stableTouchRef.current);
        }}
        onPointerDown={(event) => {
          const hoverCapablePointer = resolveHoverCapablePointer(event.pointerType);
          stableTouchRef.current = !hoverCapablePointer;
          if (hoverCapablePointer) event.preventDefault();
        }}
        onPointerEnter={(event) => {
          if (resolveHoverCapablePointer(event.pointerType)) openDrawer();
        }}
      >
        <span className="learning-overlay-panel__rail-label">{learningLabel}</span>
        {hasCompletedEvaluation ? (
          <span aria-hidden="true" className="learning-overlay-panel__completion-cue">
            ✓
          </span>
        ) : null}
      </button>

      <div
        aria-hidden={!drawerOpen}
        ref={drawerRef}
        className="learning-overlay-panel__drawer"
        data-testid="learning-overlay-drawer"
        id={drawerId}
        onPointerEnter={clearCloseTimer}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <header className="learning-overlay-panel__header">
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
          {!narrowLayout ? (
            <div className="learning-overlay-panel__actions">
              <button
                aria-label={drawerPinned ? unpinLabel : pinLabel}
                aria-pressed={drawerPinned}
                className="learning-overlay-panel__action-button"
                title={drawerPinned ? unpinLabel : pinLabel}
                type="button"
                onClick={togglePinned}
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  {drawerPinned ? "keep" : "push_pin"}
                </span>
              </button>
              <button
                aria-label={closeLabel}
                className="learning-overlay-panel__action-button learning-overlay-panel__close-button"
                title={closeLabel}
                type="button"
                onClick={closeDrawer}
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  close
                </span>
              </button>
            </div>
          ) : null}
        </header>

        <div className="learning-overlay-panel__content" id={contentId} tabIndex={0}>
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
                <TaskPanel
                  task={task}
                  sceneId={sceneId}
                  showTitle={false}
                  macroTeaching={macroTeaching}
                />
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
                macroTeaching={macroTeaching}
                showTitle={false}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export type { LearningOverlayPanelProps, LearningOverlayView };
