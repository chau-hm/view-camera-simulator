import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLessonZeroStep,
  isLessonZeroStepComplete,
  resolveLessonZeroCameraPresentation,
  resolveLessonZeroViewportInspectionTarget,
} from "../../app/anatomyLesson";
import { getCameraControlTeachingDefinition } from "../../app/cameraControlTeaching";
import { getGuidedLessonContext } from "../../app/guidedLesson";
import { getPublicSceneEntryById } from "../../app/publicScenes";
import { evaluateTask } from "../../core/tasks/evaluateTask";
import { getTaskById } from "../../core/tasks/taskRegistry";
import { getSceneById } from "../../scenes/definitions";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { useAppStore } from "../../state/appStore";
import {
  selectDerivedOpticsState,
  selectEffectiveCameraMovementCalibration,
} from "../../state/selectors";
import type { SimulatorMode } from "../../types/camera";
import type { RenderQualityProfile } from "../../types/ui";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { AppBrand } from "./AppBrand";
import { LanguageSelector } from "./LanguageSelector";
import { Link } from "react-router-dom";
import { ApertureControl } from "../controls/ApertureControl";
import { FocusControl } from "../controls/FocusControl";
import { CameraMovementTeachingControls } from "../controls/CameraMovementTeachingControls";
import { MovementControls } from "../controls/MovementControls";
import { MovementSelector } from "../controls/MovementSelector";
import { SingleMovementControl } from "../controls/SingleMovementControl";
import { ResetControls } from "../controls/ResetControls";
import { MirrorShiftCameraPositionControl } from "../controls/MirrorShiftCameraPositionControl";
import { MirrorShiftFrontShiftControl } from "../controls/MirrorShiftFrontShiftControl";
import { FeedbackPanel } from "../simulator/FeedbackPanel";
import { GeometryViewport } from "../simulator/GeometryViewport";
import { GroundGlassViewport } from "../simulator/GroundGlassViewport";
import {
  CurrentSettingsReadout,
  FocusTargetsReadout,
  type FocusTargetMetric,
} from "../simulator/GroundGlassReadouts";
import { resolveLearnerReadoutPolicy } from "../simulator/learnerReadoutPolicy";
import { OpticalDebugPanel } from "../simulator/OpticalDebugPanel";
import { SceneViewport } from "../simulator/SceneViewport";
import { AnatomyLessonPanel } from "../simulator/AnatomyLessonPanel";
import { AnatomyControlTeachingPanel } from "../simulator/AnatomyControlTeachingPanel";
import { TaskPanel } from "../simulator/TaskPanel";
import { GuidedLessonProgress } from "../simulator/GuidedLessonProgress";
import { resolvePhysicalFocusTargetPresentationMetric } from "../../render/postprocessing/FocusAssistPass";
import { resolveCameraMovementLatticeRenderModel } from "../../render/cameraMovementLatticeRenderModel";
import { calculateCameraMovementProjectionDiagnostics } from "../../scenes/cameraMovementProjectionDiagnostics";
import { resolveCameraMovementLessonPresentationTargetRegion } from "../../scenes/cameraMovementLessonState";
import { evaluateInteriorCornerRiseComposition } from "../../scenes/interiorCornerRiseComposition";
import { evaluateInteriorCornerSwingFocus } from "../../scenes/interiorCornerSwingFocus";
import type {
  GroundGlassRttRuntimeInfoByChannel,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "../../render/groundGlassRttDimensions";
import { CameraMovementCalibrationWorkbench } from "../simulator/CameraMovementCalibrationWorkbench";
import {
  formatCameraMovementLessonReadout,
  formatCameraMovementPublicReadout,
  matchCameraMovementTeachingCase,
  type CameraMovementPublicCaseId,
} from "../../scenes/cameraMovementPublicTeaching";

type SimulatorWorkspaceProps = {
  mode: SimulatorMode;
  sceneId: string;
  taskId: string | null;
  guidedLessonEnabled?: boolean;
  anatomyLessonEnabled?: boolean;
  calibrationEnabled?: boolean;
  simulateAssetFailure: boolean;
};

export type ExpandedViewport = "scene" | "groundGlass" | "geometry" | null;

export const SimulatorWorkspace = ({
  mode,
  sceneId,
  taskId,
  guidedLessonEnabled = false,
  anatomyLessonEnabled = false,
  calibrationEnabled = false,
  simulateAssetFailure,
}: SimulatorWorkspaceProps) => {
  const { t } = useTranslation();
  const setMode = useAppStore((state) => state.setMode);
  const setActiveScene = useAppStore((state) => state.setActiveScene);
  const setActiveTask = useAppStore((state) => state.setActiveTask);
  const resetMovements = useAppStore((state) => state.resetMovements);
  const setFocusStandard = useAppStore((state) => state.setFocusStandard);
  const setCurrentTaskEvaluation = useAppStore((state) => state.setCurrentTaskEvaluation);
  const setGroundGlassAssistEnabled = useAppStore(
    (state) => state.setGroundGlassAssistEnabled,
  );
  const clearCameraMovementCalibrationSession = useAppStore(
    (state) => state.clearCameraMovementCalibrationSession,
  );
  const clearSimulatorRouteInitialization = useAppStore(
    (state) => state.clearSimulatorRouteInitialization,
  );
  const camera = useAppStore((state) => state.camera);
  const setGeometryView = useAppStore((state) => state.setGeometryView);
  const targetRegion = useAppStore((state) => state.scene.targetRegion);
  const calibrationSession = useAppStore(
    (state) => state.cameraMovementCalibrationSession,
  );
  const effectiveCameraMovementCalibration = useAppStore(
    selectEffectiveCameraMovementCalibration,
  );
  const selectedMovement = useAppStore((state) => state.selectedMovement);
  const overlayMenuResetGeneration = useAppStore(
    (state) => state.ui.overlayMenuResetGeneration,
  );
  const [renderQuality, setRenderQuality] = useState<RenderQualityProfile>("high");
  const [requestedScheimpflugConstruction, setRequestedScheimpflugConstruction] = useState(false);
  const [expandedViewport, setExpandedViewport] = useState<ExpandedViewport>(null);
  const [restoreViewportFocus, setRestoreViewportFocus] = useState(true);
  const [anatomyStepIndex, setAnatomyStepIndex] = useState(0);
  const [anatomyShowSmallAperture, setAnatomyShowSmallAperture] = useState(false);
  const [anatomyViewResetNonce, setAnatomyViewResetNonce] = useState(0);
  const geometryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const previousExpandedViewportRef = useRef<ExpandedViewport>(null);
  // All registered scenes still available through engine registry
  // const allScenes = getAllScenes();
  const task = taskId ? getTaskById(taskId) ?? null : null;
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    [],
  );

  useEffect(() => {
    // initialize route: apply scene presets (free) or task initialCameraState (guided) once when route changes
    const initRoute = (modeParam: SimulatorMode, sceneParam: string, taskParam: string | null | undefined) => {
      const initializeSimulatorRoute = useAppStore.getState().initializeSimulatorRoute;
      if (initializeSimulatorRoute) {
        initializeSimulatorRoute({
          mode: modeParam,
          sceneId: sceneParam,
          taskId: taskParam ?? null,
          calibrationEnabled,
          lessonEntry: guidedLessonEnabled || anatomyLessonEnabled,
        });
      } else {
        // fall back to individual setters if the initialize action isn't available
        setMode(modeParam);
        setActiveScene(sceneParam);
        setActiveTask(taskParam ?? null);
      }
    };

    initRoute(mode, sceneId, taskId);
  }, [
    calibrationEnabled,
    anatomyLessonEnabled,
    guidedLessonEnabled,
    mode,
    sceneId,
    setActiveScene,
    setActiveTask,
    setMode,
    taskId,
  ]);

  useEffect(
    () => () => {
      if (calibrationEnabled) clearCameraMovementCalibrationSession();
      // Restore Neutral on leave-and-return for the public teaching routes
      // that require a fresh entry. Other free scenes intentionally preserve
      // their in-memory state on leave-and-return.
      if (
        guidedLessonEnabled ||
        anatomyLessonEnabled ||
        (sceneId === "understanding-camera-movements" &&
          mode === "free" &&
          !calibrationEnabled)
      ) {
        clearSimulatorRouteInitialization();
      }
    },
    [
      calibrationEnabled,
      anatomyLessonEnabled,
      clearCameraMovementCalibrationSession,
      clearSimulatorRouteInitialization,
      guidedLessonEnabled,
      mode,
      sceneId,
    ],
  );

  useEffect(() => {
    setRestoreViewportFocus(false);
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.matches('.btn--viewport-action[data-viewport-expanded="true"]')
    ) {
      activeElement.blur();
    }
    setExpandedViewport(null);
    setRequestedScheimpflugConstruction(false);
  }, [anatomyLessonEnabled, guidedLessonEnabled, mode, sceneId, taskId]);

  useEffect(() => {
    setAnatomyStepIndex(0);
    setAnatomyShowSmallAperture(false);
    setAnatomyViewResetNonce((value) => value + 1);
  }, [anatomyLessonEnabled, mode, sceneId, taskId]);

  const requestViewportExpansion = useCallback((viewport: Exclude<ExpandedViewport, null>) => {
    setRestoreViewportFocus(true);
    setExpandedViewport(viewport);
  }, []);

  const requestViewportRestore = useCallback(() => {
    setRestoreViewportFocus(true);
    setExpandedViewport(null);
  }, []);

  useEffect(() => {
    const previousExpandedViewport = previousExpandedViewportRef.current;
    previousExpandedViewportRef.current = expandedViewport;

    if (expandedViewport !== null) return;
    if (previousExpandedViewport !== "geometry" || !restoreViewportFocus) return;

    const frame = window.requestAnimationFrame(() => geometryTriggerRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [expandedViewport, restoreViewportFocus]);

  useEffect(() => {
    if (expandedViewport === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        requestViewportRestore();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expandedViewport, requestViewportRestore]);

  const scene = getSceneById(camera.activeSceneId);
  const safeScene = scene ?? architectureRiseScene;
  const presentationRegion =
    safeScene.id === "understanding-camera-movements" && camera.cameraMovementLessonState
      ? resolveCameraMovementLessonPresentationTargetRegion(camera.cameraMovementLessonState)
      : targetRegion;
  const publicSceneEntry = getPublicSceneEntryById(sceneId);
  const isAnatomyLesson = anatomyLessonEnabled && sceneId === "view-camera-anatomy";
  const anatomyStep = getLessonZeroStep(anatomyStepIndex);
  const anatomyViewportInspectionTarget = isAnatomyLesson
    ? resolveLessonZeroViewportInspectionTarget(anatomyStep)
    : undefined;
  const anatomyPresentation = isAnatomyLesson
    ? resolveLessonZeroCameraPresentation(anatomyStep, anatomyShowSmallAperture)
    : undefined;
  const anatomyControlDefinition =
    isAnatomyLesson && anatomyStep.controlTeachingId
      ? getCameraControlTeachingDefinition(anatomyStep.controlTeachingId)
      : null;
  const anatomyStepComplete =
    !isAnatomyLesson || isLessonZeroStepComplete(anatomyStep, camera);
  const guidedLessonContext = useMemo(
    () =>
      guidedLessonEnabled && publicSceneEntry
        ? getGuidedLessonContext({
            entry: publicSceneEntry,
            mode,
            sceneId,
            taskId,
            search: "?lesson=1",
          })
        : null,
    [guidedLessonEnabled, mode, publicSceneEntry, sceneId, taskId],
  );
  const interiorCornerGuidedObserve =
    guidedLessonContext?.lessonId === "interior-corner" &&
    guidedLessonContext.stage === "observe";
  const activeSingleMovement =
    safeScene.movementCapabilities?.selectionMode === "single"
      ? selectedMovement
      : null;

  const opticsState = selectDerivedOpticsState(
    camera,
    effectiveCameraMovementCalibration,
  );
  const activeTeachingCaseId = useMemo<CameraMovementPublicCaseId | null>(() => {
    if (
      camera.activeSceneId !== "understanding-camera-movements" ||
      calibrationSession.active
    ) {
      return null;
    }
    return matchCameraMovementTeachingCase({
      anchor: camera.viewpointAnchor,
      targetRegion,
      camera,
    });
  }, [
    camera,
    calibrationSession.active,
    targetRegion,
  ]);
  const teachingReadout = useMemo(
    () =>
      camera.cameraMovementLessonState
        ? formatCameraMovementLessonReadout(
            camera.cameraMovementLessonState,
            {
              frontRiseMm: camera.frontRiseMm,
              rearRiseMm: camera.rearRiseMm,
            },
          )
        : activeTeachingCaseId
          ? formatCameraMovementPublicReadout(activeTeachingCaseId)
          : null,
    [
      activeTeachingCaseId,
      camera.cameraMovementLessonState,
      camera.frontRiseMm,
      camera.rearRiseMm,
    ],
  );
  const cameraMovementCalibrationDiagnostics = useMemo(() => {
    if (
      !calibrationEnabled ||
      mode !== "free" ||
      sceneId !== "understanding-camera-movements"
    ) {
      return undefined;
    }
    const renderModel = resolveCameraMovementLatticeRenderModel(
      effectiveCameraMovementCalibration,
    );
    return calculateCameraMovementProjectionDiagnostics({
      effectiveCalibration: effectiveCameraMovementCalibration,
      lattice: renderModel.lattice,
      calibrationIdentity: {
        sessionActive: calibrationSession.active,
        revision: calibrationSession.revision,
        geometryId: renderModel.geometryId,
      },
      currentAnchor: camera.viewpointAnchor,
      targetRegion,
      opticsState,
    });
  }, [
    calibrationEnabled,
    calibrationSession.active,
    calibrationSession.revision,
    camera.viewpointAnchor,
    effectiveCameraMovementCalibration,
    mode,
    opticsState,
    sceneId,
    targetRegion,
  ]);
  const lockReason = t(simulatorMessageKeys.controls.guidedControlLockedReason);
  const controlPolicy = safeScene.cameraControlPolicy ?? {};
  const movementLocked = controlPolicy.movement === "fixed";
  const focusLocked = controlPolicy.focusDistance === "fixed";
  const apertureLocked = controlPolicy.aperture === "fixed";
  const infinityResetHidden = controlPolicy.infinityReset === false;
  const [rawRttDebug, setRawRttDebug] = useState(false);
  const showPublicTeachingControls =
    sceneId === "understanding-camera-movements" &&
    mode === "free" &&
    !calibrationEnabled;

  // enabled controls currently depend only on mode, task metadata, and active scene.
  // Avoid depending on the entire camera object because movement/focus changes should not recompute this set.
  const enabledControls = useMemo(() => {
    const focusFundamentals = camera.activeSceneId === "focus-fundamentals-two-targets";
    if (focusFundamentals) {
      return new Set(["focusDistance", "aperture", "geometryView", "grid"]);
    }

    if (interiorCornerGuidedObserve) {
      return new Set(["geometryView", "grid"]);
    }

    if (mode === "free" || !task) {
      const controls = new Set(["geometryView", "grid"]);
      const availableMovements = safeScene.movementCapabilities?.available;
      if (!availableMovements) {
        controls.add("rise");
        controls.add("tilt");
        controls.add("swing");
      } else {
        availableMovements.forEach((movement) => {
          if (movement === "frontRiseMm") controls.add("rise");
          if (movement === "frontShiftMm") controls.add("frontShift");
          if (movement === "frontTiltDeg") controls.add("tilt");
          if (movement === "frontSwingDeg") controls.add("swing");
        });
      }
      if (!focusLocked) controls.add("focusDistance");
      if (!apertureLocked) controls.add("aperture");
      return controls;
    }
    return new Set([...task.enabledControls]);
  }, [
    apertureLocked,
    camera.activeSceneId,
    focusLocked,
    interiorCornerGuidedObserve,
    mode,
    safeScene,
    task,
  ]);

  const evaluation = useMemo(() => (task ? evaluateTask(task, safeScene, camera, opticsState) : null), [camera, opticsState, safeScene, task]);
  const interiorCornerRiseEvaluation = useMemo(
    () =>
      mode === "free" && task === null && safeScene.id === "interior-corner"
        ? evaluateInteriorCornerRiseComposition(opticsState)
        : null,
    [mode, opticsState, safeScene.id, task],
  );
  const interiorCornerFocusEvaluation = useMemo(
    () =>
      mode === "free" && task === null && safeScene.id === "interior-corner"
        ? evaluateInteriorCornerSwingFocus(opticsState, camera.aperture)
        : null,
    [camera.aperture, mode, opticsState, safeScene.id, task],
  );
  useEffect(() => {
    setCurrentTaskEvaluation(evaluation);
  }, [evaluation, setCurrentTaskEvaluation]);

  // RTT runtime info
  const rttRuntimeInfo = useAppStore((s) => s.groundGlassRttRuntimeInfo);
  const originalRttRuntimeInfo = useAppStore(
    (s) => s.groundGlassRttRuntimeInfoByChannel?.["camera-movement-original"] ?? null,
  );
  const currentRttRuntimeInfo = useAppStore(
    (s) => s.groundGlassRttRuntimeInfoByChannel?.["camera-movement-current"] ?? null,
  );
  const setGroundGlassRttRuntimeInfo = useAppStore(
    (state) => state.setGroundGlassRttRuntimeInfo,
  );
  const setGroundGlassRttRuntimeInfoForChannel = useAppStore(
    (state) => state.setGroundGlassRttRuntimeInfoForChannel,
  );
  const groundGlassRuntimeInfoByChannel = useMemo<GroundGlassRttRuntimeInfoByChannel>(
    () => ({
      default: rttRuntimeInfo ?? null,
      "camera-movement-original": originalRttRuntimeInfo,
      "camera-movement-current": currentRttRuntimeInfo,
    }),
    [currentRttRuntimeInfo, originalRttRuntimeInfo, rttRuntimeInfo],
  );
  const onGroundGlassRuntimeInfoChange = useCallback<GroundGlassRttRuntimeInfoChangeHandler>(
    (channel, info, ownerId) => {
      if (channel === "default") {
        setGroundGlassRttRuntimeInfo(info, ownerId);
      } else {
        setGroundGlassRttRuntimeInfoForChannel(channel, info, ownerId);
      }
    },
    [setGroundGlassRttRuntimeInfo, setGroundGlassRttRuntimeInfoForChannel],
  );

  const tableTiltFocusMetric =
    safeScene.id === "table-tilt" && mode === "free" ? "point" : "patch";
  const focusTargetReadouts = useMemo(
    () =>
      opticsState.focusTargets.map((target) => {
        const metric = resolvePhysicalFocusTargetPresentationMetric(target, tableTiltFocusMetric);
        return {
          id: target.id,
          status: metric.status,
          sharpnessPercent: Math.round(metric.sharpness * 100),
        };
      }),
    [opticsState.focusTargets, tableTiltFocusMetric],
  );
  const learnerReadoutPolicy = useMemo(
    () => resolveLearnerReadoutPolicy(safeScene.id, { hasFocusTargets: focusTargetReadouts.length > 0 }),
    [focusTargetReadouts.length, safeScene.id],
  );
  const focusTargetMetric: FocusTargetMetric =
    tableTiltFocusMetric === "point" ? "point" : safeScene.id === "table-tilt" ? "patch" : "focus";
  const closestPointTargetId = useMemo(() => {
    if (safeScene.id !== "table-tilt" || mode !== "free") return undefined;
    return opticsState.focusTargets.reduce<string | undefined>((closestId, target) => {
      if (!closestId) return target.id;
      const closest = opticsState.focusTargets.find((candidate) => candidate.id === closestId);
      return resolvePhysicalFocusTargetPresentationMetric(target, "point").sharpness >
        (closest ? resolvePhysicalFocusTargetPresentationMetric(closest, "point").sharpness : -1)
        ? target.id
        : closestId;
    }, undefined);
  }, [mode, opticsState.focusTargets, safeScene.id]);

  const setInfinityFocus = useAppStore((state) => state.setInfinityFocus);

  const resetAnatomyLesson = useCallback(() => {
    setAnatomyStepIndex(0);
    setAnatomyShowSmallAperture(false);
    setAnatomyViewResetNonce((value) => value + 1);
    clearSimulatorRouteInitialization();
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "view-camera-anatomy",
      taskId: null,
      lessonEntry: true,
    });
  }, [clearSimulatorRouteInitialization]);
  const handleAnatomyStepIndexChange = useCallback(
    (nextIndex: number) => {
      const nextStep = getLessonZeroStep(nextIndex);
      const leavingOrEnteringControls =
        anatomyStep.section === "controls" || nextStep.section === "controls";

      if (leavingOrEnteringControls) {
        resetMovements();
      }

      if (nextStep.controlTeachingId) {
        const definition = getCameraControlTeachingDefinition(nextStep.controlTeachingId);
        if (definition.kind === "focus") {
          setFocusStandard(definition.focusStandard);
        }
      }

      setAnatomyShowSmallAperture(false);
      setAnatomyViewResetNonce((value) => value + 1);
      setAnatomyStepIndex(nextIndex);
    },
    [anatomyStep.section, resetMovements, setFocusStandard],
  );
  const sceneExpanded = expandedViewport === "scene";
  const groundGlassExpanded = expandedViewport === "groundGlass";
  const geometryExpanded = expandedViewport === "geometry";
  const viewportExpanded = expandedViewport !== null;

  if (!scene) {
    return (
      <p>
        {t(simulatorMessageKeys.viewport.unknownScenePrefix)}: {sceneId}
      </p>
    );
  }

  return (
    <div className="simulator-shell" data-reduced-motion={reducedMotion ? "true" : "false"}>
      {/* Header */}
      <header className="simulator-header">
        <AppBrand />

        <div className="sim-header-actions">
          <Link className="btn btn--ghost" to="/scenes">{t(simulatorMessageKeys.viewport.allScenes)}</Link>
          <LanguageSelector />
        </div>
      </header>

      {/* Body: main (scrollable) + aside (scrollable) */}
      <div role="region" aria-label={t(simulatorMessageKeys.viewport.bodyLabel)} className="simulator-body">
        {/* Main area: single scroll container for the active viewport(s) */}
        <main className={`simulator-main${viewportExpanded ? " simulator-main--viewport-expanded" : ""}`}>
          {!viewportExpanded && !isAnatomyLesson && opticsState.diagnostics.fallbackApplied && (
            <p role="alert">{t(simulatorMessageKeys.viewport.opticsFallbackPrefix)}: {opticsState.diagnostics.errorMessage}</p>
          )}

          <div className={`simulator-viewport-grid${viewportExpanded ? " simulator-viewport-grid--expanded" : ""}`}>
            {(!viewportExpanded || sceneExpanded) && <div className={`simulator-card${sceneExpanded ? " simulator-card--expanded" : ""}`}>
              <div className="simulator-card-header">
                <div className="panel-icon" aria-hidden="true">
                  <span className="material-symbols-outlined" aria-hidden="true">view_in_ar</span>
                </div>
                <h2 className="simulator-card-title">{t(simulatorMessageKeys.viewport.sceneTitle)}</h2>
              </div>

              <SceneViewport
                overlayMenuResetGeneration={overlayMenuResetGeneration}
                scene={safeScene}
                opticsState={opticsState}
                renderQuality={renderQuality}
                setRenderQuality={setRenderQuality}
                requestedScheimpflugConstruction={requestedScheimpflugConstruction}
                onToggleScheimpflugConstruction={() => setRequestedScheimpflugConstruction((state) => !state)}
                simulateAssetFailure={simulateAssetFailure}
                expanded={sceneExpanded}
                restoreFocusOnCollapse={restoreViewportFocus}
                onRequestExpand={() => requestViewportExpansion("scene")}
                onRequestRestore={requestViewportRestore}
                geometryTriggerRef={geometryTriggerRef}
                onToggleGeometryPanel={(trigger) => {
                  geometryTriggerRef.current = trigger;
                  requestViewportExpansion("geometry");
                }}
                cameraPresentation={anatomyPresentation}
                cameraInspectionTarget={anatomyViewportInspectionTarget}
                initialViewFocus={isAnatomyLesson ? "camera" : undefined}
                suppressOpticalOverlays={isAnatomyLesson}
                viewResetKey={
                  isAnatomyLesson
                    ? `${anatomyViewportInspectionTarget ?? "stable-camera"}:${anatomyViewResetNonce}`
                    : undefined
                }
                showHeader={false}
              />
            </div>}

            {(!viewportExpanded || groundGlassExpanded) && <div className={`simulator-card${groundGlassExpanded ? " simulator-card--expanded" : ""}`} aria-label={t(simulatorMessageKeys.viewport.groundGlassColumnLabel)}>
              <div className="simulator-card-header">
                <div className="panel-icon panel-icon--muted" aria-hidden="true">
                  <span className="material-symbols-outlined" aria-hidden="true">center_focus_strong</span>
                </div>
                <h2 className="simulator-card-title">{t(simulatorMessageKeys.viewport.groundGlassTitle)}</h2>
              </div>

              <GroundGlassViewport
                opticsState={opticsState}
                scene={safeScene}
                runtimeInfoByChannel={groundGlassRuntimeInfoByChannel}
                onRuntimeInfoChange={onGroundGlassRuntimeInfoChange}
                groundGlassAssistEnabled={camera.groundGlassAssistEnabled}
                onGroundGlassAssistEnabledChange={setGroundGlassAssistEnabled}
                gridEnabled={camera.gridEnabled}
                canToggleGrid={enabledControls.has("grid")}
                riseMm={camera.frontRiseMm}
                tiltDeg={camera.frontTiltDeg}
                swingDeg={camera.frontSwingDeg}
                focusDistanceMm={camera.focusDistanceMm}
                aperture={camera.aperture}
                renderQuality={renderQuality}
                focalLengthMm={camera.focalLengthMm}
                lastFiniteFocusDepthMm={camera.lastFiniteFocusDepthMm}
                effectiveCameraMovementCalibration={effectiveCameraMovementCalibration}
                presentationRegion={presentationRegion}
                lockReason={lockReason}
                rawRttDebug={rawRttDebug}
                focusMetric={tableTiltFocusMetric}
                showHeader={false}
                interactionResetKey={`${mode}:${sceneId}:${taskId ?? "free"}`}
                expanded={groundGlassExpanded}
                restoreFocusOnCollapse={restoreViewportFocus}
                onRequestExpand={() => requestViewportExpansion("groundGlass")}
                onRequestRestore={requestViewportRestore}
              />
            </div>}

            {geometryExpanded && (
              <div className="simulator-card simulator-card--expanded">
                <GeometryViewport
                  opticsState={opticsState}
                  geometryView={camera.geometryView}
                  onGeometryViewChange={setGeometryView}
                  focalLengthMm={camera.focalLengthMm}
                  scene={scene}
                  riseMm={camera.frontRiseMm}
                  movementSummary={teachingReadout ? `${teachingReadout.label}${teachingReadout.value ? ` · ${teachingReadout.value}` : ""}` : null}
                  expanded={geometryExpanded}
                  onRequestRestore={requestViewportRestore}
                />
              </div>
            )}
          </div>

          {!viewportExpanded && !isAnatomyLesson && <>
            {/* Row 1: scene-aware learner readouts */}
            <div className={`simulator-primary-info-grid${learnerReadoutPolicy.showFocusTargets && focusTargetReadouts.length > 0 ? "" : " simulator-primary-info-grid--single"}`}>
            <CurrentSettingsReadout
              riseMm={camera.frontRiseMm}
              tiltDeg={camera.frontTiltDeg}
              swingDeg={camera.frontSwingDeg}
              focusDistanceMm={camera.focusDistanceMm}
              aperture={camera.aperture as number}
              renderQuality={renderQuality}
              activeMovement={activeSingleMovement ? { field: activeSingleMovement, value: (() => {
                switch (activeSingleMovement) {
                  case "frontRiseMm": return camera.frontRiseMm;
                  case "frontShiftMm": return camera.frontShiftMm;
                  case "rearRiseMm": return camera.rearRiseMm;
                  case "rearShiftMm": return camera.rearShiftMm;
                  case "frontTiltDeg": return camera.frontTiltDeg;
                  case "rearTiltDeg": return camera.rearTiltDeg;
                  case "frontSwingDeg": return camera.frontSwingDeg;
                  case "rearSwingDeg": return camera.rearSwingDeg;
                }
              })() } : null}
              teachingReadout={teachingReadout}
              focusStandard={camera.activeSceneId === "focus-fundamentals-two-targets" ? camera.focusStandard : undefined}
              settingsVariant={learnerReadoutPolicy.settingsVariant}
              cameraPositionMm={camera.mirrorShiftLessonState?.rigLateralMm}
              frontShiftMm={camera.frontShiftMm}
            />

            {learnerReadoutPolicy.showFocusTargets && focusTargetReadouts.length > 0 ? (
              <FocusTargetsReadout
                focusTargets={focusTargetReadouts}
                metric={focusTargetMetric}
                closestTargetId={closestPointTargetId}
              />
            ) : null}
            </div>

            {/* Row 2: Task | Feedback (each wrapped in a card shell provided by Workspace) */}
            <div className="simulator-task-feedback-grid">
            <div className="simulator-info-card simulator-info-card--task">
              <h4>{t(simulatorMessageKeys.task.title)}</h4>
              {guidedLessonContext ? (
                <GuidedLessonProgress context={guidedLessonContext} evaluation={evaluation} />
              ) : null}
              {guidedLessonContext?.stage === "observe" ? null : (
                <TaskPanel task={task} sceneId={safeScene.id} showTitle={false} />
              )}
            </div>
            <div className="simulator-info-card simulator-info-card--feedback">
              <h4>{t(simulatorMessageKeys.feedback.title)}</h4>
              <FeedbackPanel
                mode={mode}
                sceneId={safeScene.id}
                task={task}
                evaluation={evaluation}
                freeCompositionEvaluation={interiorCornerRiseEvaluation}
                freeFocusEvaluation={interiorCornerFocusEvaluation}
                showTitle={false}
              />
            </div>
            </div>

            {/* Row 3: Optical Debug, full width (component owns its single card shell) */}
            <div className="simulator-debug-row">
            <OpticalDebugPanel
              sceneId={camera.activeSceneId}
              mode={camera.mode}
              taskId={camera.activeTaskId}
              opticsState={opticsState}
              focalLengthMm={camera.focalLengthMm}
              focusDistanceMm={camera.focusDistanceMm}
              aperture={camera.aperture as number}
              renderQuality={renderQuality}
              rttRuntimeInfo={rttRuntimeInfo}
            />
            </div>
          </>}

        </main>

        {/* Right aside: independent scroll */}
        <aside className="simulator-aside">
          {isAnatomyLesson ? (
            <AnatomyLessonPanel
              stepIndex={anatomyStepIndex}
              onStepIndexChange={handleAnatomyStepIndexChange}
              showSmallAperture={anatomyShowSmallAperture}
              onShowSmallApertureChange={setAnatomyShowSmallAperture}
              onReset={resetAnatomyLesson}
              canAdvance={anatomyStepComplete}
              controlContent={
                anatomyControlDefinition ? (
                  <AnatomyControlTeachingPanel
                    definition={anatomyControlDefinition}
                    complete={anatomyStepComplete}
                  />
                ) : null
              }
            />
          ) : <>
          <section aria-label={t(simulatorMessageKeys.controls.cameraControls)}>
            <div className="aside-header">
              <h3 style={{ margin: 0 }}>{t(simulatorMessageKeys.controls.cameraControls)}</h3>
              {!infinityResetHidden && (<button className="btn btn--secondary" type="button" onClick={setInfinityFocus}>{t(simulatorMessageKeys.controls.infinityReset)}</button>)}
            </div>

            <div style={{ marginTop: 8 }}>
              {safeScene.cameraRigTranslationCapability?.enabled ? (
                <div className="sim-section">
                  <MirrorShiftCameraPositionControl />
                </div>
              ) : null}

              {safeScene.cameraFrontShiftCapability?.enabled ? (
                <div className="sim-section">
                  <MirrorShiftFrontShiftControl />
                </div>
              ) : null}

              {!movementLocked ? (showPublicTeachingControls ? (
                <div className="sim-section">
                  <CameraMovementTeachingControls />
                </div>
              ) : (safeScene.movementCapabilities?.selectionMode === "single" && selectedMovement) ? (
                <>
                  <div className="sim-section">
                    <MovementSelector
                      available={safeScene.movementCapabilities.available}
                      selected={selectedMovement}
                    />
                  </div>
                  <div className="sim-section">
                    <SingleMovementControl movement={selectedMovement} />
                  </div>
                </>
              ) : (
                <div className="sim-section">
                  <div className="sim-section-label">{t(simulatorMessageKeys.controls.movementTitle)}</div>
                  <MovementControls riseEnabled={enabledControls.has("rise")} tiltEnabled={enabledControls.has("tilt")} swingEnabled={enabledControls.has("swing")} lockReason={lockReason} showTitle={false} />
                </div>
              )) : null}

              <div className="sim-section">
                <div className="sim-section-label">{t(simulatorMessageKeys.controls.focusTitle)}</div>
                <FocusControl focusEnabled={enabledControls.has("focusDistance") && !focusLocked} lockReason={focusLocked ? t(simulatorMessageKeys.controls.focusFixedReason) : lockReason} showTitle={false} />
              </div>

              <div className="sim-section">
                <div className="sim-section-label">{t(simulatorMessageKeys.controls.apertureTitle)}</div>
                <ApertureControl apertureEnabled={enabledControls.has("aperture") && !apertureLocked} lockReason={apertureLocked ? t(simulatorMessageKeys.controls.apertureFixedReason) : lockReason} showTitle={false} />
              </div>

              {(!movementLocked || task !== null || safeScene.cameraRigTranslationCapability?.enabled) && (
                <div className="sim-section reset" style={{ paddingBottom: 0 }}>
                  <div className="sim-section-label">{t(simulatorMessageKeys.controls.resetTitle)}</div>
                  <ResetControls
                    showTitle={false}
                    showMovementReset={!movementLocked || safeScene.cameraRigTranslationCapability?.enabled === true}
                    restartHref={
                      guidedLessonContext?.lessonId === "interior-corner"
                        ? `/simulator/free/${sceneId}?lesson=1`
                        : undefined
                    }
                  />
                </div>
              )}
            </div>

          </section>

          <section aria-label="Developer Tools" className="developer-tools">
            <h3 style={{ margin: 0 }}>Developer Tools</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: 8 }}>
              <label className="developer-tools__control">
                <input className="form-checkbox" type="checkbox" checked={rawRttDebug} onChange={(e) => setRawRttDebug(e.target.checked)} />
                Raw RTT — bypass DOF
              </label>
              {rawRttDebug ? (
                <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.7)', marginTop: 6 }}>Depth-of-field and focus blur are disabled in Raw RTT mode.</div>
              ) : null}
              {calibrationEnabled && mode === "free" && sceneId === "understanding-camera-movements" ? <CameraMovementCalibrationWorkbench diagnostics={cameraMovementCalibrationDiagnostics} /> : null}
            </div>
          </section>
          </>}
        </aside>
      </div>

    </div>
  );
};
