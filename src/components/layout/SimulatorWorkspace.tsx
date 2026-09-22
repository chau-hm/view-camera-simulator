import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLessonZeroStep,
  isLessonZeroStepComplete,
  resolveLessonZeroCameraPresentation,
  resolveLessonZeroViewportInspectionTarget,
} from "../../app/anatomyLesson";
import { getCameraControlTeachingDefinition } from "../../app/cameraControlTeaching";
import { getGuidedLessonContext } from "../../app/guidedLesson";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";
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
import { guidedLessonMessageKeys } from "../../i18n/guidedLessonMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { AppBrand } from "./AppBrand";
import { LanguageSelector } from "./LanguageSelector";
import { Link } from "react-router-dom";
import { ApertureControl } from "../controls/ApertureControl";
import { MacroFocusReadout } from "../simulator/MacroFocusReadout";
import { FocusControl } from "../controls/FocusControl";
import { LensControl } from "../controls/LensControl";
import { CameraMovementTeachingControls } from "../controls/CameraMovementTeachingControls";
import { MovementControls } from "../controls/MovementControls";
import { MovementSelector } from "../controls/MovementSelector";
import { SingleMovementControl } from "../controls/SingleMovementControl";
import { ResetControls } from "../controls/ResetControls";
import { MirrorShiftCameraPositionControl } from "../controls/MirrorShiftCameraPositionControl";
import { MirrorShiftFrontShiftControl } from "../controls/MirrorShiftFrontShiftControl";
import { GeometryViewport } from "../simulator/GeometryViewport";
import { GroundGlassViewport } from "../simulator/GroundGlassViewport";
import { FocusDistributionPanel, type FocusTargetMetric } from "../simulator/FocusDistributionPanel";
import { LearningOverlayPanel } from "../simulator/LearningOverlayPanel";
import { resolveLearnerReadoutPolicy } from "../simulator/learnerReadoutPolicy";
import { OpticalDebugPanel } from "../simulator/OpticalDebugPanel";
import { SceneViewport } from "../simulator/SceneViewport";
import { AnatomyLessonPanel } from "../simulator/AnatomyLessonPanel";
import { AnatomyControlTeachingPanel } from "../simulator/AnatomyControlTeachingPanel";
import { resolvePhysicalFocusTargetPresentationMetric } from "../../render/postprocessing/FocusAssistPass";
import {
  projectSceneFocusTargetsToGroundGlass,
  resolveGroundGlassPreviewMode,
} from "../../render/groundGlassTargetProjection";
import { resolveCameraMovementLatticeRenderModel } from "../../render/cameraMovementLatticeRenderModel";
import { calculateCameraMovementProjectionDiagnostics } from "../../scenes/cameraMovementProjectionDiagnostics";
import { resolveCameraMovementLessonPresentationTargetRegion } from "../../scenes/cameraMovementLessonState";
import { evaluateInteriorCornerRiseComposition } from "../../scenes/interiorCornerRiseComposition";
import { evaluateInteriorCornerSwingFocus } from "../../scenes/interiorCornerSwingFocus";
import type {
  GroundGlassRttRuntimeInfoByChannel,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "../../render/groundGlassRttDimensions";
import type { SceneGraphCapacityMetrics } from "../../render/sceneCapacityProfiling";
import { CameraMovementCalibrationWorkbench } from "../simulator/CameraMovementCalibrationWorkbench";
import { resolveMacroBellowsExtensionTeaching } from "../../scenes/macroBellowsExtensionTeaching";
import { resolveMacroDepthOfFieldTeaching } from "../../scenes/macroDepthOfFieldTeaching";
import { resolveMacroObliquePlaneTeaching } from "../../scenes/macroObliquePlaneTeaching";
import { resolveMacroCompoundMovementsTeaching } from "../../scenes/macroCompoundMovementsTeaching";
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
  const [viewportSubjectCapacity, setViewportSubjectCapacity] =
    useState<SceneGraphCapacityMetrics | null>(null);
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
  const anatomyLessonScrollRef = useRef<HTMLDivElement | null>(null);
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
        (guidedLessonEnabled && sceneId !== "interior-corner") ||
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
  useEffect(() => {
    setViewportSubjectCapacity(null);
  }, [safeScene.id]);
  const presentationRegion =
    safeScene.id === "understanding-camera-movements" && camera.cameraMovementLessonState
      ? resolveCameraMovementLessonPresentationTargetRegion(camera.cameraMovementLessonState)
      : targetRegion;
  const publicSceneEntry = getPublicSceneEntryById(sceneId);
  const activeSceneTitle = publicSceneEntry ? t(publicSceneEntry.titleKey) : sceneId;
  const activeLessonContext = publicSceneEntry?.lesson?.kind === "anatomy"
    ? t(simulatorMessageKeys.headerContext.lesson)
    : mode === "guided"
      ? t(guidedLessonMessageKeys.common.title)
      : t(simulatorMessageKeys.headerContext.freeExploration);
  const isAnatomyLesson = anatomyLessonEnabled && sceneId === "view-camera-anatomy";
  useEffect(() => {
    if (!isAnatomyLesson) return;
    if (anatomyLessonScrollRef.current) anatomyLessonScrollRef.current.scrollTop = 0;
  }, [anatomyStepIndex, isAnatomyLesson]);

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
  const interiorCornerGuidedLesson = guidedLessonContext?.lessonId === "interior-corner";
  const opticsState = selectDerivedOpticsState(
    camera,
    effectiveCameraMovementCalibration,
  );
  const macroFocusMetrics = useMemo(() => {
    if (!safeScene.macroFocusMetricsCapability?.enabled) return null;
    const { fallbackApplied, focusObjectDistanceMm, imageDistanceMm } = opticsState.diagnostics;
    if (fallbackApplied || focusObjectDistanceMm == null || imageDistanceMm == null) return null;
    return deriveMacroFocusMetrics({
      focalLengthMm: camera.focalLengthMm,
      objectDistanceMm: focusObjectDistanceMm,
      imageDistanceMm,
    });
  }, [camera.focalLengthMm, opticsState.diagnostics, safeScene.macroFocusMetricsCapability]);
  const macroTeaching = useMemo(
    () =>
      resolveMacroBellowsExtensionTeaching({
        capability: safeScene.macroTeachingCapability,
        metrics: macroFocusMetrics,
        focusObjectDistanceMm: opticsState.diagnostics.focusObjectDistanceMm,
      }),
    [macroFocusMetrics, opticsState.diagnostics.focusObjectDistanceMm, safeScene.macroTeachingCapability],
  );
  const macroDepthTeaching = useMemo(
    () =>
      resolveMacroDepthOfFieldTeaching({
        capability: safeScene.macroTeachingCapability,
        focusObjectDistanceMm: opticsState.diagnostics.focusObjectDistanceMm,
        aperture: camera.aperture,
        focusTargets: opticsState.focusTargets,
      }),
    [
      camera.aperture,
      opticsState.diagnostics.focusObjectDistanceMm,
      opticsState.focusTargets,
      safeScene.macroTeachingCapability,
    ],
  );
  const macroObliqueTeaching = useMemo(
    () =>
      resolveMacroObliquePlaneTeaching({
        capability: safeScene.macroTeachingCapability,
        frontTiltDeg: camera.frontTiltDeg,
        focusObjectDistanceMm: opticsState.diagnostics.focusObjectDistanceMm,
        focusTargets: opticsState.focusTargets,
      }),
    [
      camera.frontTiltDeg,
      opticsState.diagnostics.focusObjectDistanceMm,
      opticsState.focusTargets,
      safeScene.macroTeachingCapability,
    ],
  );
  const macroCompoundTeaching = useMemo(
    () =>
      resolveMacroCompoundMovementsTeaching({
        capability: safeScene.macroTeachingCapability,
        frontTiltDeg: camera.frontTiltDeg,
        frontSwingDeg: camera.frontSwingDeg,
        focusObjectDistanceMm: opticsState.diagnostics.focusObjectDistanceMm,
        focusTargets: opticsState.focusTargets,
      }),
    [
      camera.frontSwingDeg,
      camera.frontTiltDeg,
      opticsState.diagnostics.focusObjectDistanceMm,
      opticsState.focusTargets,
      safeScene.macroTeachingCapability,
    ],
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
  const taskCanChangeAperture =
    mode === "guided" && task?.enabledControls.includes("aperture") === true;
  const apertureLocked = controlPolicy.aperture === "fixed" && !taskCanChangeAperture;
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

  const focusControlEnabled = enabledControls.has("focusDistance") && !focusLocked;
  const focusControlLockReason = focusLocked
    ? t(simulatorMessageKeys.controls.focusFixedReason)
    : lockReason;
  const apertureControlEnabled = enabledControls.has("aperture") && !apertureLocked;
  const apertureControlLockReason = apertureLocked
    ? t(simulatorMessageKeys.controls.apertureFixedReason)
    : lockReason;
  const showCommonMovementControls =
    !movementLocked &&
    !showPublicTeachingControls &&
    !(safeScene.movementCapabilities?.selectionMode === "single" && selectedMovement);
  const availableMovements = safeScene.movementCapabilities?.available;
  const hideUnavailableMovementControls = safeScene.movementCapabilities?.hideUnavailableControls === true;
  const showRiseMovement =
    !hideUnavailableMovementControls || !availableMovements || availableMovements.includes("frontRiseMm");
  const showTiltMovement =
    !hideUnavailableMovementControls || !availableMovements || availableMovements.includes("frontTiltDeg");
  const showSwingMovement =
    !hideUnavailableMovementControls || !availableMovements || availableMovements.includes("frontSwingDeg");
  const commonMovementHasDisabledControl =
    showCommonMovementControls &&
    ((showRiseMovement && !enabledControls.has("rise")) ||
      (showTiltMovement && !enabledControls.has("tilt")) ||
      (showSwingMovement && !enabledControls.has("swing")));
  const hasSharedControlLockReason =
    (commonMovementHasDisabledControl && Boolean(lockReason)) ||
    (!focusControlEnabled && focusControlLockReason === lockReason && Boolean(lockReason)) ||
    (!apertureControlEnabled && apertureControlLockReason === lockReason && Boolean(lockReason));
  const sharedControlLockReasonId = useId();

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
  const learningOverlay = !isAnatomyLesson ? (
    <LearningOverlayPanel
      mode={mode}
      sceneId={safeScene.id}
      task={task}
      evaluation={evaluation}
      guidedLessonContext={guidedLessonContext}
      freeCompositionEvaluation={interiorCornerRiseEvaluation}
      freeFocusEvaluation={interiorCornerFocusEvaluation}
      macroTeaching={macroTeaching}
      macroDepthTeaching={macroDepthTeaching}
      macroObliqueTeaching={macroObliqueTeaching}
      macroCompoundTeaching={macroCompoundTeaching}
    />
  ) : null;
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
  const groundGlassPreviewMode = resolveGroundGlassPreviewMode(camera.groundGlassAssistEnabled);
  const focusTargetReadouts = useMemo(
    () => {
      const projectedTargets = projectSceneFocusTargetsToGroundGlass({
        sceneDef: safeScene,
        opticsState,
        aperture: camera.aperture,
        previewMode: groundGlassPreviewMode,
      });
      const projectedTargetById = new Map(projectedTargets.map((target) => [target.id, target]));

      return opticsState.focusTargets.map((target) => {
        const metric = resolvePhysicalFocusTargetPresentationMetric(target, tableTiltFocusMetric);
        const projection = projectedTargetById.get(target.id);
        return {
          id: target.id,
          status: metric.status,
          sharpnessPercent: Math.round(metric.sharpness * 100),
          displayUv: projection?.displayUv ?? null,
          visible: projection?.visible ?? false,
        };
      });
    },
    [camera.aperture, groundGlassPreviewMode, opticsState, safeScene, tableTiltFocusMetric],
  );
  const learnerReadoutPolicy = useMemo(
    () => resolveLearnerReadoutPolicy({ hasFocusTargets: focusTargetReadouts.length > 0 }),
    [focusTargetReadouts.length],
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

        <div className="simulator-header__context">
          <div className="simulator-header__lesson-title">{activeSceneTitle}</div>
          <div className="simulator-header__lesson-context">{activeLessonContext}</div>
        </div>

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

          <div className={`simulator-viewport-context${viewportExpanded ? " simulator-viewport-context--expanded" : ""}`}>
          <div className={`simulator-viewport-grid${viewportExpanded ? " simulator-viewport-grid--expanded" : ""}`}>
            {(!viewportExpanded || sceneExpanded) && <div
              key="scene"
              className={`simulator-card simulator-workspace-grid__scene simulator-workspace-grid__primary${sceneExpanded ? " simulator-card--expanded simulator-workspace-grid__active" : ""}`}
              data-workspace-slot="scene"
            >
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
                cameraPresentation={anatomyPresentation}
                cameraInspectionTarget={anatomyViewportInspectionTarget}
                initialViewFocus={isAnatomyLesson ? "camera" : undefined}
                suppressOpticalOverlays={isAnatomyLesson}
                viewResetKey={
                  isAnatomyLesson
                    ? `${anatomyViewportInspectionTarget ?? "stable-camera"}:${anatomyViewResetNonce}`
                    : undefined
                }
                onSubjectCapacityChange={setViewportSubjectCapacity}
                showHeader={false}
                learningOverlay={!groundGlassExpanded && !geometryExpanded ? learningOverlay : null}
              />
            </div>}

            {(!viewportExpanded || groundGlassExpanded) && <div
              key="groundGlass"
              className={`simulator-card simulator-workspace-grid__ground-glass simulator-workspace-grid__primary${groundGlassExpanded ? " simulator-card--expanded simulator-workspace-grid__active" : ""}`}
              aria-label={t(simulatorMessageKeys.viewport.groundGlassColumnLabel)}
              data-workspace-slot="ground-glass"
            >
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
                learningOverlay={groundGlassExpanded ? learningOverlay : null}
              />
            </div>}

            {!isAnatomyLesson && (!viewportExpanded || geometryExpanded) && (
              <div
                key="geometry"
                className={`simulator-card simulator-workspace-grid__geometry${geometryExpanded ? " simulator-card--expanded simulator-workspace-grid__active" : ""}`}
                data-workspace-slot="geometry"
              >
                <GeometryViewport
                  opticsState={opticsState}
                  geometryView={camera.geometryView}
                  onGeometryViewChange={setGeometryView}
                  focalLengthMm={camera.focalLengthMm}
                  scene={safeScene}
                  riseMm={camera.frontRiseMm}
                  movementSummary={teachingReadout ? `${teachingReadout.label}${teachingReadout.value ? ` · ${teachingReadout.value}` : ""}` : null}
                  expanded={geometryExpanded}
                  restoreFocusOnCollapse={restoreViewportFocus}
                  onRequestExpand={() => requestViewportExpansion("geometry")}
                  onRequestRestore={requestViewportRestore}
                />
              </div>
            )}

            {!viewportExpanded && !isAnatomyLesson && learnerReadoutPolicy.showFocusTargets && focusTargetReadouts.length > 0 ? (
              <div key="focusDistribution" className="simulator-workspace-grid__focus" data-workspace-slot="focus-distribution">
                <FocusDistributionPanel
                  sceneId={safeScene.id}
                  focusTargets={focusTargetReadouts}
                  metric={focusTargetMetric}
                  previewMode={groundGlassPreviewMode}
                  closestTargetId={closestPointTargetId}
                />
              </div>
            ) : null}
          </div>

          </div>

          {!viewportExpanded && !isAnatomyLesson && <>
            {/* Optical Debug remains in normal flow below the learner readouts. */}
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
              viewportSubjectCapacity={viewportSubjectCapacity}
            />
            </div>
          </>}

        </main>

        {/* Right aside: independent scroll */}
        <aside className="simulator-aside">
          {isAnatomyLesson ? (
            <div ref={anatomyLessonScrollRef} className="simulator-aside__lesson">
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
            </div>
          ) : (
            <>
              <div className="simulator-aside__scroll">
                <section aria-label={t(simulatorMessageKeys.controls.cameraControls)}>
            <div className="aside-header">
              <h3 style={{ margin: 0 }}>{t(simulatorMessageKeys.controls.cameraControls)}</h3>
            </div>

            {hasSharedControlLockReason ? (
              <p id={sharedControlLockReasonId} className="control-help camera-controls__lock-reason">
                <span aria-hidden="true">🔒</span>
                <span>{lockReason}</span>
              </p>
            ) : null}

            <div className="camera-controls__sections">
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

              {safeScene.focalLengthCapability?.enabled && !calibrationEnabled ? (
                <div className="sim-section">
                  <LensControl capability={safeScene.focalLengthCapability} opticsState={opticsState} />
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
                  <MovementControls
                    riseEnabled={enabledControls.has("rise")}
                    tiltEnabled={enabledControls.has("tilt")}
                    swingEnabled={enabledControls.has("swing")}
                    showRise={showRiseMovement}
                    showTilt={showTiltMovement}
                    showSwing={showSwingMovement}
                    lockReason={lockReason}
                    lockReasonId={commonMovementHasDisabledControl ? sharedControlLockReasonId : undefined}
                    showLockReason={!hasSharedControlLockReason}
                    showTitle={false}
                  />
                </div>
              )) : null}

              <div className="sim-section">
                <FocusControl
                  focusEnabled={focusControlEnabled}
                  lockReason={focusControlLockReason}
                  lockReasonId={!focusControlEnabled && focusControlLockReason === lockReason ? sharedControlLockReasonId : undefined}
                  showLockReason={focusControlLockReason !== lockReason || !hasSharedControlLockReason}
                  showInfinityReset={!infinityResetHidden}
                />
              </div>

              <div className="sim-section">
                <ApertureControl
                  apertureEnabled={apertureControlEnabled}
                  lockReason={apertureControlLockReason}
                  lockReasonId={!apertureControlEnabled && apertureControlLockReason === lockReason ? sharedControlLockReasonId : undefined}
                  showLockReason={apertureControlLockReason !== lockReason || !hasSharedControlLockReason}
                />
              </div>

              {(interiorCornerGuidedLesson
                ? task !== null
                : !movementLocked || task !== null || safeScene.cameraRigTranslationCapability?.enabled) && (
                <div className="sim-section reset" style={{ paddingBottom: 0 }}>
                  <div className="sim-section-label">{t(simulatorMessageKeys.controls.resetTitle)}</div>
                  <ResetControls
                    showTitle={false}
                    showMovementReset={!interiorCornerGuidedLesson && (!movementLocked || safeScene.cameraRigTranslationCapability?.enabled === true)}
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
              </div>

              {safeScene.macroFocusMetricsCapability?.enabled && macroFocusMetrics && (
                <div className="simulator-aside__macro">
                  <MacroFocusReadout
                    diagnostics={opticsState.diagnostics}
                    focalLengthMm={camera.focalLengthMm}
                    metrics={macroFocusMetrics}
                    teachingCapability={safeScene.macroTeachingCapability}
                  />
                </div>
              )}
            </>
          )}
        </aside>
      </div>

    </div>
  );
};
