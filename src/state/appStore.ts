import { create } from "zustand";
import { getTaskById } from "../core/tasks/taskRegistry";
import { clamp } from "../core/math/clamps";
import { getSceneById, getSceneFocusDistanceRange } from "../scenes/definitions";
import type {
  ApertureValue,
  CameraState,
  CameraMovementLessonState,
  GeometryView,
  SimulatorMode,
  FocusStandard,
} from "../types/camera";
import type {
  CameraMovementField,
  SceneFocusStandardCapability,
} from "../types/scene";
import type { TaskEvaluation } from "../types/task";
import {
  CAMERA_CONSTANTS,
  DEFAULT_CAMERA_STATE,
  DEFAULT_CAMERA_BODY_PIVOT_WORLD,
  DEFAULT_CAMERA_RIG_PLACEMENT,
  clampStandardShiftMm,
  isApertureValue,
} from "../utils/constants";
import {
  DEFAULT_SHOW_OPTICAL_GEOMETRY,
  resolveInitialOpticalGeometryVisibility,
} from "./sceneViewDefaults";
import {
  DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
  type CameraMovementSceneCalibration,
  type CameraMovementTargetRegion,
} from "../scenes/cameraMovementSceneCalibration";
import {
  resolveCameraRigViewpointAnchor,
} from "../scenes/cameraRigViewpointGeometry";
import type { CameraRigViewpointAnchor } from "../types/optics";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "../scenes/cameraMovementSceneCalibration";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  CAMERA_MOVEMENT_WORKBENCH_BOUNDS,
  resolveEffectiveCameraMovementCalibration,
  validateEffectiveCameraMovementCalibration,
  type CameraMovementCalibrationOverrides,
  type EffectiveCameraMovementCalibration,
  type CalibrationValidationResult,
} from "../scenes/cameraMovementEffectiveCalibration";
import {
  buildCameraMovementTeachingCasePatch,
  CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
  type CameraMovementPublicCaseId,
} from "../scenes/cameraMovementPublicTeaching";
import {
  DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
  resolveCameraMovementLessonState,
} from "../scenes/cameraMovementLessonState";
import { getPublicSceneEntryById } from "../app/publicScenes";
import { INTERIOR_CORNER_GUIDED_TASK_IDS } from "../scenes/interiorCornerGuidedLesson";
import { INTERIOR_CORNER_CALIBRATION_APERTURE } from "../scenes/interiorCornerSwingFocus";
import {
  clampMirrorShiftRigLateralMm,
  DEFAULT_MIRROR_SHIFT_LESSON_STATE,
  resolveMirrorShiftRigPlacement,
} from "../scenes/mirrorShiftLessonState";

const getFocusStandardCapability = (
  sceneId: string,
): SceneFocusStandardCapability | undefined =>
  getSceneById(sceneId)?.focusStandardCapability;

export const supportsFocusStandard = (sceneId: string): boolean => {
  const capability = getFocusStandardCapability(sceneId);
  return Boolean(capability?.enabled);
};

export const getFocusStandardDefault = (sceneId: string): FocusStandard => {
  const capability = getFocusStandardCapability(sceneId);
  return capability?.defaultStandard ?? "front";
};

const defaultControlState = {
  focalLengthMm: DEFAULT_CAMERA_STATE.focalLengthMm,
  frontRiseMm: DEFAULT_CAMERA_STATE.frontRiseMm,
  frontShiftMm: DEFAULT_CAMERA_STATE.frontShiftMm,
  frontTiltDeg: DEFAULT_CAMERA_STATE.frontTiltDeg,
  frontSwingDeg: DEFAULT_CAMERA_STATE.frontSwingDeg,
  rearRiseMm: DEFAULT_CAMERA_STATE.rearRiseMm,
  rearShiftMm: DEFAULT_CAMERA_STATE.rearShiftMm,
  rearTiltDeg: DEFAULT_CAMERA_STATE.rearTiltDeg,
  rearSwingDeg: DEFAULT_CAMERA_STATE.rearSwingDeg,
  focusDistanceMm: DEFAULT_CAMERA_STATE.focusDistanceMm,
  aperture: DEFAULT_CAMERA_STATE.aperture,
};

const clampFocusDistanceForScene = (
  sceneId: string,
  value: number,
  focalLengthMm: number = defaultControlState.focalLengthMm,
) => {
  const range = getSceneFocusDistanceRange(sceneId, focalLengthMm);
  return clamp(value, range.min, range.max);
};

/** Resolve the declared finite-focus baseline for a selectable-focus scene. */
const resolveSceneFocusDefaults = (
  sceneId: string,
): Pick<CameraState, "focusStandard" | "focusDistanceMm" | "focusMode" | "lastFiniteFocusDepthMm"> => {
  const scene = getSceneById(sceneId);
  const focalLengthMm = scene?.cameraPreset.focalLengthMm ?? defaultControlState.focalLengthMm;
  const focusDistanceMm = clampFocusDistanceForScene(
    sceneId,
    scene?.cameraPreset.focusDistanceMm ?? defaultControlState.focusDistanceMm,
    focalLengthMm,
  );
  return {
    focusStandard: getFocusStandardDefault(sceneId),
    focusDistanceMm,
    focusMode: "finite",
    lastFiniteFocusDepthMm: focusDistanceMm,
  };
};

/** Resolve the default movement for a scene, if any. */
const resolveDefaultMovement = (sceneId: string): CameraMovementField | null => {
  const scene = getSceneById(sceneId);
  return scene?.movementCapabilities?.selectionMode === "single"
    ? scene.movementCapabilities.defaultMovement
    : null;
};

const isCanonicalMovementAvailable = (
  sceneId: string,
  movement: CameraMovementField,
): boolean => {
  const scene = getSceneById(sceneId);
  return Boolean(
    scene?.movementCapabilities?.available.includes(movement) ||
      (movement === "frontShiftMm" && scene?.cameraFrontShiftCapability?.enabled),
  );
};

const resolveCameraBodyReset = (sceneId: string): Pick<CameraState, "cameraBodyPitchDeg" | "cameraBodyPivotWorld"> => {
  const scene = getSceneById(sceneId);
  return {
    cameraBodyPitchDeg:
      scene?.cameraBodyPitchCapability?.enabled && Number.isFinite(scene.cameraPreset.cameraBodyPitchDeg)
        ? (scene.cameraPreset.cameraBodyPitchDeg as number)
        : 0,
    cameraBodyPivotWorld:
      scene?.cameraBodyPitchCapability?.enabled && scene.cameraPreset.cameraBodyPivotWorld
        ? scene.cameraPreset.cameraBodyPivotWorld
        : DEFAULT_CAMERA_BODY_PIVOT_WORLD,
  };
};

const isCameraMovementsScene = (sceneId: string) => sceneId === "understanding-camera-movements";

const isCameraMovementCalibrationRoute = (
  mode: CameraState["mode"],
  sceneId: string,
  calibrationEnabled: boolean,
): boolean =>
  mode === "free" &&
  sceneId === "understanding-camera-movements" &&
  calibrationEnabled;

const isGuidedLessonObserveRoute = (
  mode: CameraState["mode"],
  sceneId: string,
  taskId: string | null | undefined,
  lessonEntry: boolean,
): boolean =>
  lessonEntry &&
  mode === "free" &&
  Boolean(
    getPublicSceneEntryById(sceneId)?.guidedLesson ||
      getPublicSceneEntryById(sceneId)?.lesson?.kind === "anatomy",
  ) &&
  taskId == null;

/**
 * The Interior Corner lesson is one in-session photographic state spread over
 * several task routes. A task route may therefore be entered in either
 * direction without reapplying its neutral task preset. Direct entry is not
 * considered a session and is initialized normally (later lesson deep links
 * are guarded by the route page).
 */
const shouldPreserveInteriorCornerGuidedState = (
  state: {
    camera: Pick<CameraState, "activeSceneId" | "activeTaskId">;
    lastInitializedRouteKey?: string | null;
  },
  mode: CameraState["mode"],
  sceneId: string,
  taskId: string | null | undefined,
  lessonEntry: boolean,
): boolean => {
  if (
    !lessonEntry ||
    mode !== "guided" ||
    sceneId !== "interior-corner" ||
    taskId == null ||
    state.camera.activeSceneId !== sceneId ||
    !state.lastInitializedRouteKey?.endsWith(":lesson")
  ) {
    return false;
  }

  const guidedTaskIds = getPublicSceneEntryById(sceneId)?.guidedTaskIds;
  if (!guidedTaskIds?.length) return false;

  const currentTaskId = state.camera.activeTaskId;
  const nextTaskIsKnown = guidedTaskIds.includes(taskId);
  if (!nextTaskIsKnown) return false;

  // The only task transition from the neutral Observe route is Compose. A
  // later task requires an already active Interior Corner task session.
  if (currentTaskId == null) {
    return (
      taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.compose &&
      state.lastInitializedRouteKey.startsWith(`free:${sceneId}:`)
    );
  }

  return guidedTaskIds.includes(currentTaskId);
};

const resolveGuidedLessonObserveFocus = (
  sceneId: string,
): Pick<CameraState, "focusMode" | "focusDistanceMm" | "lastFiniteFocusDepthMm"> => {
  const scene = getSceneById(sceneId);
  const focalLengthMm = scene?.cameraPreset.focalLengthMm ?? defaultControlState.focalLengthMm;
  const focusDistanceMm = clampFocusDistanceForScene(
    sceneId,
    scene?.cameraPreset.focusDistanceMm ?? defaultControlState.focusDistanceMm,
    focalLengthMm,
  );
  return {
    focusMode: "finite",
    focusDistanceMm,
    lastFiniteFocusDepthMm: focusDistanceMm,
  };
};

/**
 * Resolve the immutable optical calibration used while a route is being
 * initialized. Public teaching uses the production baseline; an active
 * calibration workbench keeps its accepted effective calibration instead of
 * falling back to the scene preset.
 */
const resolveCameraMovementRouteCalibration = (
  state: Pick<AppStore, "camera" | "cameraMovementCalibrationSession">,
  calibrationRoute: boolean,
) =>
  calibrationRoute &&
  state.camera.activeSceneId === "understanding-camera-movements" &&
  state.cameraMovementCalibrationSession.active
    ? state.cameraMovementCalibrationSession.effectiveCalibration
    : CAMERA_MOVEMENT_CALIBRATION_BASELINE;

const resolveRigPlacement = (
  sceneId: string,
  anchor: CameraRigViewpointAnchor = "mid",
  calibration: CameraMovementSceneCalibration = CAMERA_MOVEMENT_SCENE_CALIBRATION,
): CameraState["cameraRigPlacement"] => {
  if (sceneId === "mirror-shift") {
    return resolveMirrorShiftRigPlacement(0);
  }
  if (!isCameraMovementsScene(sceneId)) return { ...DEFAULT_CAMERA_RIG_PLACEMENT };
  const resolved = resolveCameraRigViewpointAnchor(calibration.cameraRig, anchor);
  return { ...resolved, rigOriginWorld: { ...resolved.rigOriginWorld } };
};

/** Project continuous lesson state into the legacy camera fields consumed by all renderers. */
const resolveCameraMovementLessonCamera = (
  camera: CameraState,
  lessonState: CameraMovementLessonState,
  calibration: CameraMovementSceneCalibration = CAMERA_MOVEMENT_SCENE_CALIBRATION,
): CameraState => {
  const derived = resolveCameraMovementLessonState(
    lessonState,
    calibration.cameraRig,
  );
  return {
    ...camera,
    frontShiftMm: 0,
    cameraMovementLessonState: derived.lessonState,
    frontRiseMm: derived.frontRiseMm,
    frontTiltDeg: derived.frontTiltDeg,
    frontSwingDeg: derived.frontSwingDeg,
    rearRiseMm: derived.rearRiseMm,
    rearShiftMm: 0,
    rearTiltDeg: derived.rearTiltDeg,
    rearSwingDeg: 0,
    cameraBodyPitchDeg: derived.cameraBodyPitchDeg,
    viewpointAnchor: derived.viewpointAnchor,
    cameraRigPlacement: {
      ...derived.cameraRigPlacement,
      rigOriginWorld: { ...derived.cameraRigPlacement.rigOriginWorld },
    },
  };
};

const mergeCalibrationOverrides = (
  current: CameraMovementCalibrationOverrides,
  patch: CameraMovementCalibrationOverrides,
): CameraMovementCalibrationOverrides => ({
  geometry: { ...current.geometry, ...patch.geometry },
  optics: { ...current.optics, ...patch.optics },
  rig: { ...current.rig, ...patch.rig },
  presentation: { ...current.presentation, ...patch.presentation },
});

const zeroStandardMovements = (camera: CameraState): CameraState => ({
  ...camera,
  frontRiseMm: 0,
  frontShiftMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  rearRiseMm: 0,
  rearShiftMm: 0,
  rearTiltDeg: 0,
  rearSwingDeg: 0,
  cameraBodyPitchDeg: 0,
  cameraMovementLessonState: undefined,
});

/** Whether the scene enforces at-most-one active movement. */
const isSingleMovementScene = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.movementCapabilities?.selectionMode === "single";
};

/** Zero other supported movement fields when a single-movement scene sets one. */
const enforceSingleMovement = (
  camera: CameraState,
  sceneId: string,
  field: CameraMovementField,
): CameraState => {
  if (!isSingleMovementScene(sceneId)) return camera;
  return {
    ...camera,
    frontRiseMm: field === "frontRiseMm" ? camera.frontRiseMm : 0,
    frontShiftMm: field === "frontShiftMm" ? camera.frontShiftMm : 0,
    rearRiseMm: field === "rearRiseMm" ? camera.rearRiseMm : 0,
    rearShiftMm: field === "rearShiftMm" ? camera.rearShiftMm : 0,
    frontTiltDeg: field === "frontTiltDeg" ? camera.frontTiltDeg : 0,
    rearTiltDeg: field === "rearTiltDeg" ? camera.rearTiltDeg : 0,
    frontSwingDeg: field === "frontSwingDeg" ? camera.frontSwingDeg : 0,
    rearSwingDeg: field === "rearSwingDeg" ? camera.rearSwingDeg : 0,
  };
};

/** Restore camera state from the active scene preset for movement-comparison scenes. */
const resolveScenePresetReset = (
  sceneId: string,
): Partial<CameraState> => {
  const scene = getSceneById(sceneId);
  if (
    !scene?.movementCapabilities &&
    scene?.cameraControlPolicy?.movement !== "fixed"
  ) {
    return {};
  }
  const preset = scene.cameraPreset;
  return {
    ...(preset.focalLengthMm === undefined ? {} : { focalLengthMm: preset.focalLengthMm }),
    frontRiseMm: preset.frontRiseMm,
    frontShiftMm: isCanonicalMovementAvailable(sceneId, "frontShiftMm")
      ? preset.frontShiftMm ?? 0
      : 0,
    frontTiltDeg: preset.frontTiltDeg,
    frontSwingDeg: preset.frontSwingDeg,
    rearRiseMm: preset.rearRiseMm,
    rearShiftMm: isCanonicalMovementAvailable(sceneId, "rearShiftMm")
      ? preset.rearShiftMm
      : 0,
    rearTiltDeg: preset.rearTiltDeg,
    rearSwingDeg: isCanonicalMovementAvailable(sceneId, "rearSwingDeg")
      ? preset.rearSwingDeg
      : 0,
    focusDistanceMm: preset.focusDistanceMm,
    aperture: preset.aperture,
    focusMode: "finite",
  };
};

type SceneRuntimeState = {
  activeSceneId: string;
  /** Presentation-only target region for Understanding Camera Movements. */
  targetRegion: CameraMovementTargetRegion;
};

type TaskRuntimeState = {
  activeTaskId: string | null;
  currentTaskEvaluation: TaskEvaluation | null;
};

type UIState = {
  mode: SimulatorMode;
  geometryView: GeometryView;
  groundGlassAssistEnabled: boolean;
  gridEnabled: boolean;
  showOpticalGeometry: boolean;
  overlayMenuResetGeneration: number;
};

export type CameraMovementCalibrationSession = Readonly<{
  active: boolean;
  revision: number;
  draftResetGeneration: number;
  overrides: CameraMovementCalibrationOverrides;
  effectiveCalibration: EffectiveCameraMovementCalibration;
  /** Validation of the accepted effective calibration only. */
  validation: CalibrationValidationResult;
  /** Validation from the last rejected proposal; never describes effectiveCalibration. */
  rejectedProposalValidation: CalibrationValidationResult | null;
}>;


/** Check if focusDistance is locked by the active scene's cameraControlPolicy. */
const isFocusDistanceLocked = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.focusDistance === "fixed";
};

/** Check if standard movement controls are locked by the active scene. */
const isMovementLocked = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.movement === "fixed";
};

/** Check if aperture is locked by the active scene's cameraControlPolicy. */
const isApertureLocked = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.aperture === "fixed";
};

/** A guided task may explicitly unlock a scene-fixed aperture for its final stage. */
const isTaskApertureEnabled = (
  sceneId: string,
  taskId: string | null | undefined,
): boolean => {
  if (!taskId) return false;
  const task = getTaskById(taskId);
  return Boolean(
    task &&
      task.mode === "guided" &&
      task.sceneId === sceneId &&
      task.enabledControls.includes("aperture"),
  );
};

/** Resolve a locked scene's aperture from its canonical camera preset. */
const resolveSceneAperture = (
  sceneId: string,
  fallback: ApertureValue,
  taskId?: string | null,
): ApertureValue => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.aperture === "fixed" &&
    !isTaskApertureEnabled(sceneId, taskId)
    ? scene.cameraPreset.aperture
    : fallback;
};

/** Check if infinity reset is disallowed by the active scene. */
const isInfinityResetDisallowed = (sceneId: string): boolean => {
  const scene = getSceneById(sceneId);
  return scene?.cameraControlPolicy?.infinityReset === false;
};

import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
} from "../render/groundGlassRttDimensions";
import type { InteractiveLatticeRuntimeInfo } from "../render/cameraMovementLatticeRuntime";

export type AppStore = {
  camera: CameraState;
  scene: SceneRuntimeState;
  task: TaskRuntimeState;
  ui: UIState;
  /** The currently selected movement for single-active scenes. */
  selectedMovement: CameraMovementField | null;
  /** Route-based initialization key. */
  lastInitializedRouteKey?: string | null;
  /** Optional runtime diagnostics for RTT scenes. */
  groundGlassRttRuntimeInfo?: GroundGlassRttRuntimeInfo | null;
  groundGlassRttRuntimeInfoByChannel?: Partial<
    Record<GroundGlassRttChannel, GroundGlassRttRuntimeInfo | null>
  >;
  /** Actual mounted interactive lattice diagnostics; null when not mounted. */
  interactiveLatticeRuntimeInfo?: InteractiveLatticeRuntimeInfo | null;
  cameraMovementCalibrationSession: CameraMovementCalibrationSession;

  /**
   * Publish or clear default-channel RTT diagnostics. When ownerId is given,
   * a clear only succeeds if that owner still owns the channel.
   */
  setGroundGlassRttRuntimeInfo: (
    info: GroundGlassRttRuntimeInfo | null,
    ownerId?: string,
  ) => void;
  setGroundGlassRttRuntimeInfoForChannel: (
    channel: GroundGlassRttChannel,
    info: GroundGlassRttRuntimeInfo | null,
    ownerId?: string,
  ) => void;
  setInteractiveLatticeRuntimeInfo: (info: InteractiveLatticeRuntimeInfo | null) => void;
  setCurrentTaskEvaluation: (evaluation: TaskEvaluation | null) => void;
  setMode: (mode: SimulatorMode) => void;
  setActiveScene: (sceneId: string) => void;
  setActiveTask: (taskId: string | null) => void;
  /** Set the canonical continuous lesson state for Understanding Camera Movements. */
  setCameraMovementLessonState: (lessonState: CameraMovementLessonState) => void;
  setMirrorShiftRigLateralMm: (value: number) => void;
  setFrontShiftMm: (value: number) => void;
  setCameraBodyPitchDeg: (value: number) => void;
  setCameraMovementViewpointAnchor: (anchor: CameraRigViewpointAnchor) => void;
  initializeSimulatorRoute: (init: {
    mode: SimulatorMode;
    sceneId: string;
    taskId?: string | null;
    calibrationEnabled?: boolean;
    lessonEntry?: boolean;
  }) => void;

  /** Set the currently active movement for single-active scenes. Zeros all canonical standard movements first. */
  setSelectedMovement: (movement: CameraMovementField) => void;

  setRise: (value: number) => void;
  setTilt: (value: number) => void;
  setSwing: (value: number) => void;
  setRearRise: (value: number) => void;
  setRearShift: (value: number) => void;
  setRearTilt: (value: number) => void;
  setRearSwing: (value: number) => void;

  setFocusDistance: (value: number) => void;
  setFocusStandard: (focusStandard: FocusStandard) => void;
  setInfinityFocus: () => void;
  setAperture: (value: ApertureValue) => void;
  setGeometryView: (value: GeometryView) => void;
  toggleGroundGlassAssist: () => void;
  setGroundGlassAssistEnabled: (enabled: boolean) => void;
  toggleGrid: () => void;
  setShowOpticalGeometry: (enabled: boolean) => void;
  resetMovements: () => void;
  restartTask: () => void;
  resetCamera: () => void;
  setCameraMovementCalibrationActive: (active: boolean) => void;
  updateCameraMovementCalibration: (overrides: CameraMovementCalibrationOverrides) => boolean;
  clearCameraMovementCalibrationValidation: () => void;
  resetCameraMovementCalibration: () => void;
  clearCameraMovementCalibrationSession: () => void;
  setCameraMovementTargetRegion: (region: CameraMovementTargetRegion) => void;
  /** Apply one canonical PR #32 teaching case in a single state transaction. */
  applyCameraMovementTeachingCase: (caseId: CameraMovementPublicCaseId) => void;
  /** Clear the route-initialization guard so a remount re-initializes the route. */
  clearSimulatorRouteInitialization: () => void;
};

const createCalibrationSession = (
  active = false,
  draftResetGeneration = 0,
): CameraMovementCalibrationSession => {
  const effectiveCalibration = resolveEffectiveCameraMovementCalibration(CAMERA_MOVEMENT_CALIBRATION_BASELINE);
  return {
    active,
    revision: 0,
    draftResetGeneration,
    overrides: {},
    effectiveCalibration,
    validation: validateEffectiveCameraMovementCalibration(effectiveCalibration),
    rejectedProposalValidation: null,
  };
};

export const useAppStore = create<AppStore>((set) => ({
  camera: DEFAULT_CAMERA_STATE,
  scene: {
    activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId,
    targetRegion: DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
  },
  task: {
    activeTaskId: DEFAULT_CAMERA_STATE.activeTaskId,
    currentTaskEvaluation: null,
  },
  ui: {
    mode: DEFAULT_CAMERA_STATE.mode,
    geometryView: DEFAULT_CAMERA_STATE.geometryView,
    groundGlassAssistEnabled: DEFAULT_CAMERA_STATE.groundGlassAssistEnabled,
    gridEnabled: DEFAULT_CAMERA_STATE.gridEnabled,
    showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY,
    overlayMenuResetGeneration: 0,
  },
  selectedMovement: null,
  lastInitializedRouteKey: null,
  groundGlassRttRuntimeInfo: null,
  groundGlassRttRuntimeInfoByChannel: {},
  interactiveLatticeRuntimeInfo: null,
  cameraMovementCalibrationSession: createCalibrationSession(),

  setGroundGlassRttRuntimeInfo: (info, ownerId) =>
    set((state) => {
      const current = state.groundGlassRttRuntimeInfo;
      const requestedOwnerId = ownerId ?? info?.ownerId;
      // A cleanup from an older renderer must not clear a replacement that
      // has already published into the shared default channel.
      if (
        info === null &&
        requestedOwnerId !== undefined &&
        current?.ownerId !== undefined &&
        current.ownerId !== requestedOwnerId
      ) {
        return {};
      }
      const nextInfo =
        info === null || requestedOwnerId === undefined
          ? info
          : { ...info, ownerId: requestedOwnerId };
      return { groundGlassRttRuntimeInfo: nextInfo };
    }),
  setGroundGlassRttRuntimeInfoForChannel: (channel, info, ownerId) =>
    set((state) => {
      const current = state.groundGlassRttRuntimeInfoByChannel?.[channel];
      const requestedOwnerId = ownerId ?? info?.ownerId;
      // Apply the same compare-before-clear rule independently per channel so
      // Original and Current panes cannot tear down one another's diagnostics.
      if (
        info === null &&
        requestedOwnerId !== undefined &&
        current?.ownerId !== undefined &&
        current.ownerId !== requestedOwnerId
      ) {
        return {};
      }
      const nextInfo =
        info === null || requestedOwnerId === undefined
          ? info
          : { ...info, ownerId: requestedOwnerId };
      return {
        groundGlassRttRuntimeInfoByChannel: {
          ...state.groundGlassRttRuntimeInfoByChannel,
          [channel]: nextInfo,
        },
      };
    }),
  setInteractiveLatticeRuntimeInfo: (info) =>
    set(() => ({ interactiveLatticeRuntimeInfo: info })),

  setCameraMovementCalibrationActive: (active) =>
    set((state) => {
      const mayActivate =
        state.camera.activeSceneId === "understanding-camera-movements" &&
        state.ui.mode === "free";
      if (active && !mayActivate) return {};
      if (active && !state.cameraMovementCalibrationSession.active) {
        return {
          cameraMovementCalibrationSession: createCalibrationSession(
            true,
            state.cameraMovementCalibrationSession.draftResetGeneration + 1,
          ),
        };
      }
      return {
        cameraMovementCalibrationSession: {
          ...state.cameraMovementCalibrationSession,
          active,
          rejectedProposalValidation: null,
        },
      };
    }),

  updateCameraMovementCalibration: (overrides) => {
    let accepted = false;
    set((state) => {
      if (
        !state.cameraMovementCalibrationSession.active ||
        state.camera.activeSceneId !== "understanding-camera-movements" ||
        state.ui.mode !== "free"
      ) {
        return {};
      }
      const mergedOverrides = mergeCalibrationOverrides(
        state.cameraMovementCalibrationSession.overrides,
        overrides,
      );
      const effectiveCalibration = resolveEffectiveCameraMovementCalibration(
        CAMERA_MOVEMENT_CALIBRATION_BASELINE,
        mergedOverrides,
      );
      const validation = validateEffectiveCameraMovementCalibration(effectiveCalibration);
      if (!validation.valid) {
        return {
          cameraMovementCalibrationSession: {
            ...state.cameraMovementCalibrationSession,
            rejectedProposalValidation: validation,
          },
        };
      }
      accepted = true;
      return {
        camera: {
          ...state.camera,
          focalLengthMm: effectiveCalibration.optics.provisionalFocalLengthMm,
          focusDistanceMm: effectiveCalibration.optics.provisionalFocusDistanceMm,
          focusMode: "finite",
          lastFiniteFocusDepthMm:
            effectiveCalibration.optics.provisionalFocusDistanceMm,
          cameraRigPlacement: resolveRigPlacement(
            state.camera.activeSceneId,
            state.camera.viewpointAnchor,
            effectiveCalibration,
          ),
        },
        cameraMovementCalibrationSession: {
          active: true,
          revision: state.cameraMovementCalibrationSession.revision + 1,
          draftResetGeneration:
            state.cameraMovementCalibrationSession.draftResetGeneration,
          overrides: mergedOverrides,
          effectiveCalibration,
          validation,
          rejectedProposalValidation: null,
        },
      };
    });
    return accepted;
  },

  clearCameraMovementCalibrationValidation: () =>
    set((state) => ({
      cameraMovementCalibrationSession: {
        ...state.cameraMovementCalibrationSession,
        validation: validateEffectiveCameraMovementCalibration(
          state.cameraMovementCalibrationSession.effectiveCalibration,
        ),
        rejectedProposalValidation: null,
      },
    })),

  resetCameraMovementCalibration: () =>
    set((state) => {
      const baseline = resolveEffectiveCameraMovementCalibration(
        CAMERA_MOVEMENT_CALIBRATION_BASELINE,
      );
      return {
      camera: {
        ...state.camera,
        focalLengthMm: baseline.optics.provisionalFocalLengthMm,
        focusDistanceMm: baseline.optics.provisionalFocusDistanceMm,
        focusMode: "finite",
        lastFiniteFocusDepthMm: baseline.optics.provisionalFocusDistanceMm,
        frontRiseMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearShiftMm: 0,
        rearTiltDeg: 0,
        rearSwingDeg: 0,
        frontShiftMm: 0,
        cameraBodyPitchDeg: 0,
        viewpointAnchor: "mid",
        cameraRigPlacement: resolveRigPlacement(
          "understanding-camera-movements",
          "mid",
          baseline,
        ),
      },
      scene: {
        ...state.scene,
        targetRegion: baseline.presentation.defaultTargetRegion,
      },
      selectedMovement: resolveDefaultMovement("understanding-camera-movements"),
      cameraMovementCalibrationSession: createCalibrationSession(
        true,
        state.cameraMovementCalibrationSession.draftResetGeneration + 1,
      ),
      };
    }),

  clearCameraMovementCalibrationSession: () =>
    set((state) => ({
      cameraMovementCalibrationSession: createCalibrationSession(
        false,
        state.cameraMovementCalibrationSession.draftResetGeneration + 1,
      ),
      lastInitializedRouteKey: null,
    })),

  setCameraMovementTargetRegion: (region) =>
    set((state) =>
      state.camera.activeSceneId === "understanding-camera-movements" &&
      (region === "upper" || region === "middle" || region === "lower")
        ? {
            camera: { ...state.camera, cameraMovementLessonState: undefined },
            scene: { ...state.scene, targetRegion: region },
          }
        : {},
    ),

  applyCameraMovementTeachingCase: (caseId) =>
    set((state) => {
      if (state.camera.activeSceneId !== "understanding-camera-movements") return {};
      if (state.cameraMovementCalibrationSession.active) return {};
      if (!(caseId in CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES)) return {};
      const patch = buildCameraMovementTeachingCasePatch(caseId);
      const lessonCamera = resolveCameraMovementLessonCamera(
        state.camera,
        patch.lessonState,
      );
      const finiteFocusMetadata = Number.isFinite(state.camera.focusDistanceMm)
        ? { focusMode: "finite" as const, lastFiniteFocusDepthMm: state.camera.focusDistanceMm }
        : Number.isFinite(state.camera.lastFiniteFocusDepthMm)
          ? {
              focusMode: "finite" as const,
              lastFiniteFocusDepthMm: state.camera.lastFiniteFocusDepthMm,
            }
          : { focusMode: "finite" as const };
      return {
        camera: {
          ...lessonCamera,
          ...finiteFocusMetadata,
        },
        scene: { ...state.scene, targetRegion: patch.targetRegion },
      };
    }),

  clearSimulatorRouteInitialization: () =>
    set(() => ({ lastInitializedRouteKey: null })),

  setCurrentTaskEvaluation: (evaluation) =>
    set((state) => ({
      task: { ...state.task, currentTaskEvaluation: evaluation },
    })),

  setMode: (mode) =>
    set((state) => ({
      camera: {
        ...state.camera,
        mode,
        aperture: resolveSceneAperture(state.camera.activeSceneId, state.camera.aperture),
      },
      ui: { ...state.ui, mode },
    })),

  setActiveScene: (sceneId) =>
    set((state) => {
      const scene = getSceneById(sceneId);
      const focalLengthMm =
        scene?.cameraPreset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm;
      return {
        camera: {
          ...state.camera,
          ...resolveCameraBodyReset(sceneId),
          frontShiftMm: isCanonicalMovementAvailable(sceneId, "frontShiftMm")
            ? scene?.cameraPreset.frontShiftMm ?? 0
            : 0,
          rearShiftMm: isCanonicalMovementAvailable(sceneId, "rearShiftMm")
            ? scene?.cameraPreset.rearShiftMm ?? 0
            : 0,
          rearSwingDeg: isCanonicalMovementAvailable(sceneId, "rearSwingDeg")
            ? scene?.cameraPreset.rearSwingDeg ?? 0
            : 0,
          viewpointAnchor: "mid",
          cameraRigPlacement: resolveRigPlacement(sceneId),
          mirrorShiftLessonState:
            sceneId === "mirror-shift"
              ? DEFAULT_MIRROR_SHIFT_LESSON_STATE
              : undefined,
          cameraMovementLessonState:
            isCameraMovementsScene(sceneId) &&
            !state.cameraMovementCalibrationSession.active
              ? DEFAULT_CAMERA_MOVEMENT_LESSON_STATE
              : undefined,
          activeSceneId: sceneId,
          ...(scene?.cameraControlPolicy?.movement === "fixed"
            ? {
                frontRiseMm: 0,
                frontTiltDeg: 0,
                frontSwingDeg: 0,
                rearRiseMm: 0,
                rearShiftMm: 0,
                rearTiltDeg: 0,
                rearSwingDeg: 0,
                cameraMovementLessonState: undefined,
              }
            : {}),
          focalLengthMm:
            focalLengthMm,
          aperture: resolveSceneAperture(sceneId, state.camera.aperture),
          focusDistanceMm: clampFocusDistanceForScene(
            sceneId,
            state.camera.focusDistanceMm,
            focalLengthMm,
          ),
          ...(supportsFocusStandard(sceneId)
            ? { focusStandard: getFocusStandardDefault(sceneId) }
            : {}),
        },
        scene: {
          activeSceneId: sceneId,
          targetRegion: DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
        },
        task: { ...state.task, currentTaskEvaluation: null },
        ui: { ...state.ui, showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY },
        cameraMovementCalibrationSession: createCalibrationSession(
          false,
          state.cameraMovementCalibrationSession.draftResetGeneration + 1,
        ),
      };
    }),

  setActiveTask: (taskId) =>
    set((state) => ({
      camera: { ...state.camera, activeTaskId: taskId },
      task: {
        ...state.task,
        activeTaskId: taskId,
        currentTaskEvaluation: null,
      },
    })),

  setCameraMovementLessonState: (lessonState) =>
    set((state) => {
      if (
        !isCameraMovementsScene(state.camera.activeSceneId) ||
        state.cameraMovementCalibrationSession.active
      ) {
        return {};
      }
      const camera = resolveCameraMovementLessonCamera(
        state.camera,
        lessonState,
      );
      const derived = resolveCameraMovementLessonState(
        camera.cameraMovementLessonState ?? DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
        CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig,
      );
      return {
        camera,
        scene: { ...state.scene, targetRegion: derived.targetRegion },
      };
    }),

  setMirrorShiftRigLateralMm: (value) =>
    set((state) => {
      if (
        state.camera.activeSceneId !== "mirror-shift" ||
        !Number.isFinite(value)
      ) {
        return {};
      }
      const rigLateralMm = clampMirrorShiftRigLateralMm(value);
      return {
        camera: {
          ...state.camera,
          mirrorShiftLessonState: { rigLateralMm },
          cameraRigPlacement: resolveMirrorShiftRigPlacement(rigLateralMm),
        },
      };
    }),

  setFrontShiftMm: (value) =>
    set((state) => {
      const scene = getSceneById(state.camera.activeSceneId);
      if (
        !isCanonicalMovementAvailable(state.camera.activeSceneId, "frontShiftMm") ||
        !Number.isFinite(value) ||
        (isMovementLocked(state.camera.activeSceneId) &&
          !scene?.cameraFrontShiftCapability?.enabled)
      ) {
        return {};
      }
      if (
        !scene?.cameraFrontShiftCapability?.enabled &&
        state.camera.viewpointAnchor !== "mid" &&
        isCameraMovementsScene(state.camera.activeSceneId)
      ) {
        return {};
      }
      const camera = {
        ...state.camera,
        frontShiftMm: clampStandardShiftMm(value),
        cameraMovementLessonState: undefined,
      };
      return {
        camera: scene?.cameraFrontShiftCapability?.enabled
          ? camera
          : enforceSingleMovement(camera, state.camera.activeSceneId, "frontShiftMm"),
        selectedMovement:
          !scene?.cameraFrontShiftCapability?.enabled && isSingleMovementScene(state.camera.activeSceneId)
            ? "frontShiftMm"
            : state.selectedMovement,
      };
    }),

  setCameraBodyPitchDeg: (value) =>
    set((state) => {
      const bounds = CAMERA_MOVEMENT_WORKBENCH_BOUNDS.movements.cameraBodyPitchDeg;
      if (
        state.camera.activeSceneId !== "understanding-camera-movements" ||
        !Number.isFinite(value) ||
        value < bounds.min ||
        value > bounds.max
      ) return {};
      return {
        camera: {
          ...state.camera,
          cameraBodyPitchDeg: value,
          cameraMovementLessonState: undefined,
        },
      };
    }),

  setCameraMovementViewpointAnchor: (anchor) =>
    set((state) => {
      if (!isCameraMovementsScene(state.camera.activeSceneId)) return {};
      if (anchor !== "mid" && anchor !== "high" && anchor !== "low") return {};
      const camera = zeroStandardMovements(state.camera);
      const calibration = state.cameraMovementCalibrationSession.active
        ? state.cameraMovementCalibrationSession.effectiveCalibration
        : CAMERA_MOVEMENT_SCENE_CALIBRATION;
      return {
        camera: {
          ...camera,
          viewpointAnchor: anchor,
          cameraRigPlacement: resolveRigPlacement(
            state.camera.activeSceneId,
            anchor,
            calibration,
          ),
          cameraMovementLessonState: undefined,
        },
        selectedMovement: resolveDefaultMovement(state.camera.activeSceneId),
      };
    }),

  initializeSimulatorRoute: (init) =>
    set((state) => {
      const {
        mode,
        sceneId,
        taskId,
        calibrationEnabled = false,
        lessonEntry = false,
      } = init;
      const routeKey = `${mode}:${sceneId}:${taskId ?? ""}:${calibrationEnabled ? "calibration" : ""}:${lessonEntry ? "lesson" : ""}`;
      if (state.lastInitializedRouteKey === routeKey) {
        return {
          camera: {
            ...state.camera,
            mode,
            activeTaskId: taskId ?? null,
            aperture: resolveSceneAperture(
              sceneId,
              state.camera.aperture,
              taskId,
            ),
          },
          scene: { ...state.scene, activeSceneId: sceneId },
          task: { ...state.task, activeTaskId: taskId ?? null },
          ui: { ...state.ui, mode },
        };
      }

      const calibrationRoute = isCameraMovementCalibrationRoute(
        mode,
        sceneId,
        calibrationEnabled,
      );
      const routeCalibration = resolveCameraMovementRouteCalibration(
        state,
        calibrationRoute,
      );
      const cameraMovementRoute = isCameraMovementsScene(sceneId);
      const preserveInteriorCornerLessonState = shouldPreserveInteriorCornerGuidedState(
        state,
        mode,
        sceneId,
        taskId,
        lessonEntry,
      );

      let nextCamera: CameraState = { ...state.camera };
      const routeTask = taskId ? getTaskById(taskId) : undefined;
      const routeMirrorShiftLessonState =
        sceneId === "mirror-shift"
          ? routeTask?.initialCameraState?.mirrorShiftLessonState ??
            DEFAULT_MIRROR_SHIFT_LESSON_STATE
          : undefined;
      const routeFrontShiftMm =
        isCanonicalMovementAvailable(sceneId, "frontShiftMm")
          ? routeTask?.initialCameraState?.frontShiftMm ??
            getSceneById(sceneId)?.cameraPreset.frontShiftMm ??
            0
          : 0;
      const routeRearShiftMm =
        isCanonicalMovementAvailable(sceneId, "rearShiftMm")
          ? routeTask?.initialCameraState?.rearShiftMm ??
            getSceneById(sceneId)?.cameraPreset.rearShiftMm ??
            0
          : 0;
      const routeRearSwingDeg =
        isCanonicalMovementAvailable(sceneId, "rearSwingDeg")
          ? routeTask?.initialCameraState?.rearSwingDeg ??
            getSceneById(sceneId)?.cameraPreset.rearSwingDeg ??
            0
          : 0;

      if (!preserveInteriorCornerLessonState) {
        try {
          const scene = getSceneById(sceneId);
          if (scene) {
            const preset = scene.cameraPreset ?? {};
            nextCamera = {
              ...nextCamera,
              ...resolveCameraBodyReset(sceneId),
              focalLengthMm:
                preset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm,
              ...preset,
              activeSceneId: sceneId,
            };
          } else {
            nextCamera.activeSceneId = sceneId;
          }
        } catch {
          nextCamera.activeSceneId = sceneId;
        }
      } else {
        nextCamera.activeSceneId = sceneId;
      }

      if (taskId) {
        if (preserveInteriorCornerLessonState) {
          nextCamera.activeTaskId = taskId;
        } else {
          try {
            const task = routeTask;
            if (task && task.initialCameraState) {
              nextCamera = {
                ...nextCamera,
                ...task.initialCameraState,
                activeTaskId: taskId,
              };
            } else {
              nextCamera.activeTaskId = taskId;
            }
          } catch {
            nextCamera.activeTaskId = taskId;
          }
        }
      }

      // Understanding Camera Movements is a finite-focus teaching route. Its
      // focus values come from the canonical production calibration, or from
      // the accepted workbench calibration when entering that route. This is
      // deliberately scoped to this scene so other scenes retain their own
      // infinity/finite focus policy.
      if (cameraMovementRoute) {
        nextCamera = {
          ...nextCamera,
          focalLengthMm: routeCalibration.optics.provisionalFocalLengthMm,
          focusDistanceMm: routeCalibration.optics.provisionalFocusDistanceMm,
          focusMode: "finite",
          lastFiniteFocusDepthMm:
            routeCalibration.optics.provisionalFocusDistanceMm,
        };
      }

      if (supportsFocusStandard(sceneId) && !preserveInteriorCornerLessonState) {
        nextCamera = {
          ...nextCamera,
          ...resolveSceneFocusDefaults(sceneId),
        };
      }

      nextCamera = {
        ...nextCamera,
        aperture: resolveSceneAperture(sceneId, nextCamera.aperture, taskId),
      };

      // Returning to Align Focus from the final aperture stage must restore
      // the open calibration aperture without disturbing the solved Rise,
      // Swing, or Focus values.
      if (
        preserveInteriorCornerLessonState &&
        taskId === INTERIOR_CORNER_GUIDED_TASK_IDS.alignFocus
      ) {
        nextCamera = {
          ...nextCamera,
          aperture: INTERIOR_CORNER_CALIBRATION_APERTURE,
        };
      }

      // Guided Lesson Observe is the explicit neutral entry point for every
      // configured public lesson. Restore finite focus metadata as well as the
      // scene preset so a prior Free Practice state cannot leak into Observe.
      if (
        isGuidedLessonObserveRoute(
          mode,
          sceneId,
          taskId,
          lessonEntry,
        )
      ) {
        nextCamera = {
          ...nextCamera,
          frontRiseMm: 0,
          frontTiltDeg: 0,
          frontSwingDeg: 0,
          rearRiseMm: 0,
          rearShiftMm: 0,
          rearTiltDeg: 0,
          rearSwingDeg: 0,
          ...resolveGuidedLessonObserveFocus(sceneId),
          activeTaskId: null,
        };
      }

      nextCamera = {
        ...nextCamera,
        mode,
        activeTaskId: taskId ?? null,
        frontShiftMm: routeFrontShiftMm,
        rearShiftMm: routeRearShiftMm,
        rearSwingDeg: routeRearSwingDeg,
        viewpointAnchor: "mid",
        cameraRigPlacement:
          sceneId === "mirror-shift"
            ? resolveMirrorShiftRigPlacement(
                routeMirrorShiftLessonState?.rigLateralMm ?? 0,
              )
            : resolveRigPlacement(sceneId, "mid", routeCalibration),
        cameraBodyPitchDeg: 0,
        cameraMovementLessonState: undefined,
        mirrorShiftLessonState: routeMirrorShiftLessonState,
      };

      if (cameraMovementRoute && !calibrationRoute) {
        nextCamera = resolveCameraMovementLessonCamera(
          nextCamera,
          DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
          routeCalibration,
        );
      }

      if (!cameraMovementRoute && Number.isFinite(nextCamera.focusDistanceMm)) {
        const focusDistanceMm = clampFocusDistanceForScene(
          sceneId,
          nextCamera.focusDistanceMm,
          nextCamera.focalLengthMm,
        );
        nextCamera = {
          ...nextCamera,
          focusDistanceMm,
          ...(nextCamera.focusMode === "finite"
            ? { lastFiniteFocusDepthMm: focusDistanceMm }
            : {}),
        };
      }

      const defaultMovement = resolveDefaultMovement(sceneId);

      const nextCalibrationSession = calibrationRoute
        ? state.cameraMovementCalibrationSession.active &&
          state.camera.activeSceneId === sceneId
          ? state.cameraMovementCalibrationSession
          : createCalibrationSession(
              true,
              state.cameraMovementCalibrationSession.draftResetGeneration + 1,
            )
        : createCalibrationSession(
            false,
            state.cameraMovementCalibrationSession.draftResetGeneration + 1,
          );

      const nextUi = {
        ...state.ui,
        mode,
        showOpticalGeometry: resolveInitialOpticalGeometryVisibility(routeTask),
      };

      return {
        camera: nextCamera,
        scene: {
          activeSceneId: sceneId,
          targetRegion: DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
        },
        task: {
          ...state.task,
          activeTaskId: taskId ?? null,
          currentTaskEvaluation: null,
        },
        ui: nextUi,
        selectedMovement: defaultMovement,
        lastInitializedRouteKey: routeKey,
        cameraMovementCalibrationSession: nextCalibrationSession,
      };
    }),

  setSelectedMovement: (movement) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId)
        ? {}
        : {
            camera: {
              ...state.camera,
              frontRiseMm: 0,
              frontShiftMm: 0,
              frontTiltDeg: 0,
              frontSwingDeg: 0,
              rearRiseMm: 0,
              rearShiftMm: 0,
              rearTiltDeg: 0,
              rearSwingDeg: 0,
              cameraMovementLessonState: undefined,
            },
            selectedMovement: movement,
          },
    ),

  setRise: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId)
        ? {}
        : {
            ...(state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
              ? {}
              : {
                  camera: enforceSingleMovement(
                    {
                      ...state.camera,
                      cameraMovementLessonState: undefined,
                      frontRiseMm: clamp(
                        value,
                        CAMERA_CONSTANTS.riseMinMm,
                        CAMERA_CONSTANTS.riseMaxMm,
                      ),
                    },
                    state.camera.activeSceneId,
                    "frontRiseMm",
                  ),
                  selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                    ? "frontRiseMm"
                    : state.selectedMovement,
                }),
          },
    ),

  setTilt: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId)
        ? {}
        : {
            ...(state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
              ? {}
              : {
                  camera: enforceSingleMovement(
                    {
                      ...state.camera,
                      cameraMovementLessonState: undefined,
                      frontTiltDeg: clamp(
                        value,
                        CAMERA_CONSTANTS.tiltMinDeg,
                        CAMERA_CONSTANTS.tiltMaxDeg,
                      ),
                    },
                    state.camera.activeSceneId,
                    "frontTiltDeg",
                  ),
                  selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                    ? "frontTiltDeg"
                    : state.selectedMovement,
                }),
          },
    ),

  setSwing: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId)
        ? {}
        : {
            ...(state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
              ? {}
              : {
                  camera: enforceSingleMovement(
                    {
                      ...state.camera,
                      cameraMovementLessonState: undefined,
                      frontSwingDeg: clamp(
                        value,
                        CAMERA_CONSTANTS.swingMinDeg,
                        CAMERA_CONSTANTS.swingMaxDeg,
                      ),
                    },
                    state.camera.activeSceneId,
                    "frontSwingDeg",
                  ),
                  selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                    ? "frontSwingDeg"
                    : state.selectedMovement,
                }),
          },
    ),

  setRearRise: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId)
        ? {}
        : {
            ...(state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
              ? {}
              : {
                  camera: enforceSingleMovement(
                    {
                      ...state.camera,
                      cameraMovementLessonState: undefined,
                      rearRiseMm: clamp(
                        value,
                        CAMERA_CONSTANTS.riseMinMm,
                        CAMERA_CONSTANTS.riseMaxMm,
                      ),
                    },
                    state.camera.activeSceneId,
                    "rearRiseMm",
                  ),
                  selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                    ? "rearRiseMm"
                    : state.selectedMovement,
                }),
          },
    ),

  setRearShift: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId) ||
      !isCanonicalMovementAvailable(state.camera.activeSceneId, "rearShiftMm") ||
      !Number.isFinite(value)
        ? {}
        : state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
          ? {}
          : {
              camera: enforceSingleMovement(
                {
                  ...state.camera,
                  cameraMovementLessonState: undefined,
                  rearShiftMm: clampStandardShiftMm(value),
                },
                state.camera.activeSceneId,
                "rearShiftMm",
              ),
              selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                ? "rearShiftMm"
                : state.selectedMovement,
            },
    ),

  setRearTilt: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId)
        ? {}
        : {
            ...(state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
              ? {}
              : {
                  camera: enforceSingleMovement(
                    {
                      ...state.camera,
                      cameraMovementLessonState: undefined,
                      rearTiltDeg: clamp(
                        value,
                        CAMERA_CONSTANTS.tiltMinDeg,
                        CAMERA_CONSTANTS.tiltMaxDeg,
                      ),
                    },
                    state.camera.activeSceneId,
                    "rearTiltDeg",
                  ),
                  selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                    ? "rearTiltDeg"
                    : state.selectedMovement,
                }),
          },
    ),

  setRearSwing: (value) =>
    set((state) =>
      isMovementLocked(state.camera.activeSceneId) ||
      !isCanonicalMovementAvailable(state.camera.activeSceneId, "rearSwingDeg") ||
      !Number.isFinite(value)
        ? {}
        : state.camera.viewpointAnchor !== "mid" && isCameraMovementsScene(state.camera.activeSceneId)
          ? {}
          : {
              camera: enforceSingleMovement(
                {
                  ...state.camera,
                  cameraMovementLessonState: undefined,
                  rearSwingDeg: clamp(
                    value,
                    CAMERA_CONSTANTS.swingMinDeg,
                    CAMERA_CONSTANTS.swingMaxDeg,
                  ),
                },
                state.camera.activeSceneId,
                "rearSwingDeg",
              ),
              selectedMovement: isSingleMovementScene(state.camera.activeSceneId)
                ? "rearSwingDeg"
                : state.selectedMovement,
            },
    ),

  setFocusDistance: (value) =>
    set((state) => {
      if (isFocusDistanceLocked(state.camera.activeSceneId)) return {};
      const resolvedFocusDistanceMm = Number.isFinite(value)
        ? clampFocusDistanceForScene(
            state.camera.activeSceneId,
            value,
            state.camera.focalLengthMm,
          )
        : value;
      return {
        camera: {
          ...state.camera,
          focusDistanceMm: resolvedFocusDistanceMm,
          focusMode: Number.isFinite(value) ? "finite" : state.camera.focusMode,
          lastFiniteFocusDepthMm: Number.isFinite(value)
            ? resolvedFocusDistanceMm
            : state.camera.lastFiniteFocusDepthMm,
        },
      };
    }),

  setFocusStandard: (focusStandard) =>
    set((state) => {
      if (
        (focusStandard !== "front" && focusStandard !== "rear") ||
        !supportsFocusStandard(state.camera.activeSceneId)
      ) {
        return {};
      }
      return {
        camera: {
          ...state.camera,
          focusStandard,
        },
      };
    }),

  setInfinityFocus: () =>
    set((state) => {
      if (isInfinityResetDisallowed(state.camera.activeSceneId)) return {};
      const defaultMovement = resolveDefaultMovement(state.camera.activeSceneId);
      return {
        camera: {
          ...state.camera,
          focusMode: "infinity",
          lastFiniteFocusDepthMm: Number.isFinite(state.camera.focusDistanceMm)
            ? state.camera.focusDistanceMm
            : (state.camera.lastFiniteFocusDepthMm ??
              state.camera.focusDistanceMm),
          frontRiseMm: 0,
          frontShiftMm: 0,
          frontTiltDeg: 0,
          frontSwingDeg: 0,
          rearRiseMm: 0,
          rearShiftMm: 0,
          rearTiltDeg: 0,
          rearSwingDeg: 0,
          cameraMovementLessonState: undefined,
        },
        selectedMovement: defaultMovement,
      };
    }),

  setAperture: (value) =>
    set((state) => {
      const sceneId = state.camera.activeSceneId;
      const taskId = state.camera.activeTaskId ?? state.task.activeTaskId;
      const taskApertureEnabled =
        state.camera.mode === "guided" && isTaskApertureEnabled(sceneId, taskId);
      const canChangeAperture = !isApertureLocked(sceneId) || taskApertureEnabled;
      return {
        camera: {
          ...state.camera,
          aperture: canChangeAperture && isApertureValue(value)
            ? value
            : resolveSceneAperture(
                sceneId,
                state.camera.aperture,
                taskApertureEnabled ? taskId : null,
              ),
        },
      };
    }),

  setGeometryView: (value) =>
    set((state) => ({
      camera: { ...state.camera, geometryView: value },
      ui: { ...state.ui, geometryView: value },
    })),

  toggleGroundGlassAssist: () =>
    set((state) => ({
      camera: {
        ...state.camera,
        groundGlassAssistEnabled: !state.camera.groundGlassAssistEnabled,
      },
      ui: {
        ...state.ui,
        groundGlassAssistEnabled: !state.ui.groundGlassAssistEnabled,
      },
    })),

  setGroundGlassAssistEnabled: (enabled: boolean) =>
    set((state) => ({
      camera: {
        ...state.camera,
        groundGlassAssistEnabled: enabled,
      },
      ui: {
        ...state.ui,
        groundGlassAssistEnabled: enabled,
      },
    })),

  toggleGrid: () =>
    set((state) => ({
      camera: { ...state.camera, gridEnabled: !state.camera.gridEnabled },
      ui: { ...state.ui, gridEnabled: !state.ui.gridEnabled },
    })),

  setShowOpticalGeometry: (enabled) =>
    set((state) => ({
      ui: { ...state.ui, showOpticalGeometry: enabled },
    })),

  resetMovements: () =>
    set((state) => {
      const sceneId = state.camera.activeSceneId;
      const defaultMovement = resolveDefaultMovement(sceneId);
      const scenePreset = resolveScenePresetReset(sceneId);
      const publicTeachingActive =
        isCameraMovementsScene(sceneId) &&
        !state.cameraMovementCalibrationSession.active;
      // For the public Understanding Camera Movements route, Reset Movements
      // applies the complete Neutral teaching case (mid anchor, middle target,
      // zero movements, zero body pitch) and never preserves a stale high/low
      // anchor or rig placement.
      if (publicTeachingActive) {
        const neutral = buildCameraMovementTeachingCasePatch("neutral");
        const neutralCamera = resolveCameraMovementLessonCamera(
          state.camera,
          neutral.lessonState,
        );
        return {
          camera: neutralCamera,
          scene: { ...state.scene, targetRegion: neutral.targetRegion },
          task: { ...state.task, currentTaskEvaluation: null },
          selectedMovement: defaultMovement,
        };
      }
      const selectableFocusReset = supportsFocusStandard(sceneId);
      // For all other scenes (and the calibration route), use the scene preset
      // or global default state.
      const resetValues = Object.keys(scenePreset).length > 0
        ? scenePreset
        : defaultControlState;
      const preserveCalibrationOptics =
        state.cameraMovementCalibrationSession.active &&
        isCameraMovementsScene(sceneId);
      const focalLengthMm = preserveCalibrationOptics
        ? state.camera.focalLengthMm
        : resetValues.focalLengthMm ?? state.camera.focalLengthMm;
      return {
        camera: {
          ...state.camera,
          ...resolveCameraBodyReset(sceneId),
          ...resetValues,
          focusDistanceMm: clampFocusDistanceForScene(
            sceneId,
            preserveCalibrationOptics
              ? state.camera.focusDistanceMm
              : resetValues.focusDistanceMm ??
                  defaultControlState.focusDistanceMm,
            focalLengthMm,
          ),
          focalLengthMm,
          aperture: resolveSceneAperture(
            sceneId,
            (resetValues as Partial<CameraState>).aperture ?? state.camera.aperture,
            state.task.activeTaskId,
          ),
          cameraBodyPitchDeg: 0,
          cameraRigPlacement:
            sceneId === "mirror-shift"
              ? resolveMirrorShiftRigPlacement(0)
              : state.camera.cameraRigPlacement,
          cameraMovementLessonState: undefined,
          mirrorShiftLessonState:
            sceneId === "mirror-shift"
              ? DEFAULT_MIRROR_SHIFT_LESSON_STATE
              : undefined,
          ...(selectableFocusReset ? resolveSceneFocusDefaults(sceneId) : {}),
        },
        task: { ...state.task, currentTaskEvaluation: null },
        selectedMovement: defaultMovement,
      };
    }),

  restartTask: () =>
    set((state) => {
      const activeTask = state.task.activeTaskId
        ? getTaskById(state.task.activeTaskId)
        : undefined;
      const nextSceneId =
        activeTask?.sceneId ?? state.scene.activeSceneId;
      const nextMode = activeTask?.mode ?? state.ui.mode;
      const nextControlState =
        activeTask?.initialCameraState
          ?? (Object.keys(resolveScenePresetReset(nextSceneId)).length > 0
            ? resolveScenePresetReset(nextSceneId)
            : defaultControlState);
      const preserveCalibration =
        state.cameraMovementCalibrationSession.active &&
        isCameraMovementsScene(nextSceneId) &&
        nextMode === "free";
      const activeCalibration = preserveCalibration
        ? state.cameraMovementCalibrationSession.effectiveCalibration
        : CAMERA_MOVEMENT_SCENE_CALIBRATION;
      const nextFocalLengthMm = preserveCalibration
        ? activeCalibration.optics.provisionalFocalLengthMm
        : (nextControlState as Partial<CameraState>).focalLengthMm ??
          state.camera.focalLengthMm;
      const presetFocusDistanceMm = (nextControlState as Partial<Record<string, number>>).focusDistanceMm
        ?? defaultControlState.focusDistanceMm;
      const focusDistanceMm = clampFocusDistanceForScene(
        nextSceneId,
        presetFocusDistanceMm,
        nextFocalLengthMm,
      );
      const nextGeometryView =
        activeTask?.initialCameraState?.geometryView ??
        state.camera.geometryView;
      const nextGroundGlassAssistEnabled =
        activeTask?.initialCameraState?.groundGlassAssistEnabled ??
        state.camera.groundGlassAssistEnabled;
      const nextGridEnabled =
        activeTask?.initialCameraState?.gridEnabled ??
        state.camera.gridEnabled;
      const nextShowOpticalGeometry =
        resolveInitialOpticalGeometryVisibility(activeTask);
      const nextMirrorShiftLessonState =
        nextSceneId === "mirror-shift"
          ? (nextControlState as Partial<CameraState>).mirrorShiftLessonState ??
            DEFAULT_MIRROR_SHIFT_LESSON_STATE
          : undefined;

      const defaultMovement = resolveDefaultMovement(nextSceneId);
      const selectableFocusRestart = supportsFocusStandard(nextSceneId);

      return {
        camera: {
          ...state.camera,
          activeSceneId: nextSceneId,
          mode: nextMode,
          ...resolveCameraBodyReset(nextSceneId),
          ...nextControlState,
          viewpointAnchor: "mid",
          cameraRigPlacement:
            nextSceneId === "mirror-shift"
              ? resolveMirrorShiftRigPlacement(
                  nextMirrorShiftLessonState?.rigLateralMm ?? 0,
                )
              : resolveRigPlacement(nextSceneId, "mid", activeCalibration),
          geometryView: nextGeometryView,
          groundGlassAssistEnabled: nextGroundGlassAssistEnabled,
          gridEnabled: nextGridEnabled,
          focalLengthMm: nextFocalLengthMm,
          focusDistanceMm: preserveCalibration
            ? activeCalibration.optics.provisionalFocusDistanceMm
            : focusDistanceMm,
          aperture: resolveSceneAperture(
            nextSceneId,
            (nextControlState as Partial<CameraState>).aperture ?? state.camera.aperture,
            activeTask?.id,
          ),
          frontShiftMm: isCanonicalMovementAvailable(nextSceneId, "frontShiftMm")
            ? (nextControlState as Partial<CameraState>).frontShiftMm ??
              getSceneById(nextSceneId)?.cameraPreset.frontShiftMm ??
              0
            : 0,
          rearShiftMm: isCanonicalMovementAvailable(nextSceneId, "rearShiftMm")
            ? (nextControlState as Partial<CameraState>).rearShiftMm ??
              getSceneById(nextSceneId)?.cameraPreset.rearShiftMm ??
              0
            : 0,
          rearSwingDeg: isCanonicalMovementAvailable(nextSceneId, "rearSwingDeg")
            ? (nextControlState as Partial<CameraState>).rearSwingDeg ??
              getSceneById(nextSceneId)?.cameraPreset.rearSwingDeg ??
              0
            : 0,
          ...(selectableFocusRestart ? resolveSceneFocusDefaults(nextSceneId) : {}),
          cameraMovementLessonState:
            isCameraMovementsScene(nextSceneId) && !preserveCalibration
              ? DEFAULT_CAMERA_MOVEMENT_LESSON_STATE
              : undefined,
          mirrorShiftLessonState:
            nextMirrorShiftLessonState,
        },
        scene: {
          activeSceneId: nextSceneId,
          targetRegion: DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
        },
        task: { ...state.task, currentTaskEvaluation: null },
        selectedMovement: defaultMovement,
        ui: {
          ...state.ui,
          mode: nextMode,
          geometryView: nextGeometryView,
          groundGlassAssistEnabled: nextGroundGlassAssistEnabled,
          gridEnabled: nextGridEnabled,
          showOpticalGeometry: nextShowOpticalGeometry,
          overlayMenuResetGeneration: state.ui.overlayMenuResetGeneration + 1,
        },
      };
    }),

  resetCamera: () =>
    set((state) => ({
      camera: DEFAULT_CAMERA_STATE,
      scene: {
        activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId,
        targetRegion: DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
      },
      task: {
        activeTaskId: DEFAULT_CAMERA_STATE.activeTaskId,
        currentTaskEvaluation: null,
      },
      selectedMovement: null,
      lastInitializedRouteKey: null,
      cameraMovementCalibrationSession: createCalibrationSession(
        false,
        state.cameraMovementCalibrationSession.draftResetGeneration + 1,
      ),
      ui: {
        mode: DEFAULT_CAMERA_STATE.mode,
        geometryView: DEFAULT_CAMERA_STATE.geometryView,
        groundGlassAssistEnabled:
          DEFAULT_CAMERA_STATE.groundGlassAssistEnabled,
        gridEnabled: DEFAULT_CAMERA_STATE.gridEnabled,
        showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY,
        overlayMenuResetGeneration: 0,
      },
    })),
}));
