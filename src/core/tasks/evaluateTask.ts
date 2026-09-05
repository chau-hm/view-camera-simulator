import { feedbackEngine } from "./feedbackEngine";
import { getCriterionResultMessageRef, getGuidedTaskCopy } from "./guidedTaskCopyKeys";
import {
  evaluateFocusTargets,
  resolvePhysicalTaskPatchSharpness,
} from "./evaluateFocusTargets";
import { isStandardFrameLevel } from "../optics/calculateRearStandardFrame";
import {
  calculateCompositionCoverage,
  calculateCompositionCoverageByTarget,
  calculateProjectedCompositionCoverageByTarget,
} from "../optics/calculateCompositionCoverage";
import { deriveOpticsState } from "../optics/deriveOpticsState";
import {
  measureMirrorShiftTeachingState,
  resolveMirrorShiftTeachingState,
} from "../../scenes/mirrorShiftCalibration";
import { evaluateInteriorCornerGuidedCriterion } from "../../scenes/interiorCornerGuidedLesson";
import type { CameraState } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { TaskCriteriaEvaluation, TaskDefinition, TaskEvaluation, MovementAxis } from "../../types/task";

const movementValue = (camera: CameraState, movement: MovementAxis): number => {
  switch (movement) {
    case "rise":
      return camera.frontRiseMm;
    case "tilt":
      return camera.frontTiltDeg;
    case "swing":
      return camera.frontSwingDeg;
  }
};

type MirrorShiftEvaluationMeasurements = ReturnType<typeof measureMirrorShiftTeachingState>;

const hasMirrorShiftCriteria = (task: TaskDefinition): boolean =>
  task.criteria.some(
    (criterion) =>
      criterion.type === "mirror-reflection-clear" ||
      criterion.type === "mirror-framing-restored" ||
      criterion.type === "mirror-viewpoint-retained",
  );

const resolveMirrorShiftNeutralOptics = (
  camera: CameraState,
  scene: SceneDefinition,
): DerivedOpticsState => {
  const neutral = resolveMirrorShiftTeachingState("neutral");
  return deriveOpticsState(
    {
      ...camera,
      ...scene.cameraPreset,
      activeSceneId: scene.id,
      activeTaskId: null,
      mode: "free",
      frontRiseMm: 0,
      frontShiftMm: neutral.frontShiftMm,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      focusMode: "finite",
      lastFiniteFocusDepthMm: scene.cameraPreset.focusDistanceMm,
      mirrorShiftLessonState: {
        rigLateralMm: neutral.rigLateralMm,
      },
    },
    scene,
  );
};

const resolveMirrorShiftMeasurements = (
  camera: CameraState,
  scene: SceneDefinition,
  opticsState: DerivedOpticsState,
): { current: MirrorShiftEvaluationMeasurements; neutral: MirrorShiftEvaluationMeasurements } => {
  const currentValues = {
    rigLateralMm:
      camera.mirrorShiftLessonState?.rigLateralMm ??
      opticsState.cameraRigTransform.rigOriginWorld.x,
    frontShiftMm: camera.frontShiftMm,
  };
  const neutralValues = resolveMirrorShiftTeachingState("neutral");
  return {
    current: measureMirrorShiftTeachingState(opticsState, currentValues),
    neutral: measureMirrorShiftTeachingState(
      resolveMirrorShiftNeutralOptics(camera, scene),
      neutralValues,
    ),
  };
};

const finite = (value: number): boolean => Number.isFinite(value);

const boundedRatio = (value: number, denominator: number): number =>
  finite(value) && finite(denominator) && denominator > 0
    ? Math.max(0, Math.min(1, value / denominator))
    : 0;

export const evaluateTask = (
  task: TaskDefinition,
  scene: SceneDefinition,
  camera: CameraState,
  opticsState: DerivedOpticsState,
): TaskEvaluation => {
  const guidedCopy = getGuidedTaskCopy(task);
  const compositionCoverageByTarget = calculateCompositionCoverageByTarget(scene, opticsState);
  const projectedCompositionCoverageByTarget = calculateProjectedCompositionCoverageByTarget(
    scene,
    opticsState,
  );
  const compositionCoverage = calculateCompositionCoverage(scene, opticsState);
  const mirrorShiftMeasurements = hasMirrorShiftCriteria(task)
    ? resolveMirrorShiftMeasurements(camera, scene, opticsState)
    : null;

  const criteria: TaskCriteriaEvaluation[] = task.criteria.map((criterion) => {
    switch (criterion.type) {
      case "focus-targets-sharp": {
        const passed = evaluateFocusTargets(
          opticsState.focusTargets,
          criterion.targetIds,
          criterion.minimumSharpness,
        );
        const targetScores = criterion.targetIds.map((targetId) => {
          const target = opticsState.focusTargets.find((entry) => entry.id === targetId);
          return resolvePhysicalTaskPatchSharpness(target) ?? 0;
        });
        const score = targetScores.length === 0 ? 0 : Math.min(...targetScores);
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score,
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "movement-used": {
        const value = Math.abs(movementValue(camera, criterion.movement));
        const passed = value >= criterion.minimumAbs;
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: Math.min(1, value / Math.max(criterion.minimumAbs, 1e-9)),
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "focus-used": {
        const initialFocusDistanceMm =
          task.initialCameraState?.focusDistanceMm ?? scene.cameraPreset.focusDistanceMm;
        const value = Math.abs(camera.focusDistanceMm - initialFocusDistanceMm);
        const passed = value >= criterion.minimumAbsMm;
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: Math.min(1, value / Math.max(criterion.minimumAbsMm, 1e-9)),
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "movement-range": {
        const rawValue = movementValue(camera, criterion.movement);
        const value = criterion.valueMode === "signed" ? rawValue : Math.abs(rawValue);
        const passed = value >= criterion.min && value <= criterion.max;
        const inRangeScore =
          criterion.valueMode === "signed"
            ? (() => {
                const rangeSpan = Math.max(Math.abs(criterion.max - criterion.min), 1e-9);
                const distanceToRange =
                  value < criterion.min
                    ? criterion.min - value
                    : value > criterion.max
                      ? value - criterion.max
                      : 0;
                return passed ? 1 : 1 - distanceToRange / rangeSpan;
              })()
            : passed
              ? 1
              : value < criterion.min
                ? value / Math.max(criterion.min, 1e-9)
                : criterion.max / value;
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: Math.max(0, Math.min(1, inRangeScore)),
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "allowed-aperture": {
        const passed = criterion.allowedApertures.includes(camera.aperture);
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: passed ? 1 : 0,
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "composition-visible": {
        const score =
          criterion.coverageMode === "projected-corners"
            ? projectedCompositionCoverageByTarget[criterion.targetId] ?? 0
            : compositionCoverageByTarget[criterion.targetId] ?? 0;
        const passed = score >= criterion.minimumCoverage;
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score,
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "camera-level": {
        const passed = isStandardFrameLevel(opticsState.rearStandardFrame);
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: passed ? 1 : 0,
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "interior-corner-rise-composition":
      case "interior-corner-swing-orientation":
      case "interior-corner-wall-focus":
      case "interior-corner-focus-preserved": {
        const result = evaluateInteriorCornerGuidedCriterion(criterion, camera, opticsState);
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed: result.passed,
          score: result.score,
          message: getCriterionResultMessageRef(criterion, result.passed),
        };
      }
      case "mirror-reflection-clear": {
        const reflection = mirrorShiftMeasurements?.current.cameraReflection;
        const passed = Boolean(
          reflection?.valid &&
            !reflection.intersectsMirrorAperture &&
            finite(reflection.clearanceMm) &&
            reflection.clearanceMm >= criterion.minimumClearanceMm,
        );
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: reflection?.valid
            ? boundedRatio(reflection.clearanceMm, criterion.minimumClearanceMm)
            : 0,
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "mirror-framing-restored": {
        const currentCenter = mirrorShiftMeasurements?.current.mirrorCenter.uRaw;
        const neutralCenter = mirrorShiftMeasurements?.neutral.mirrorCenter.uRaw;
        const centerError =
          finite(currentCenter ?? Number.NaN) && finite(neutralCenter ?? Number.NaN)
            ? Math.abs((currentCenter as number) - (neutralCenter as number))
            : Number.NaN;
        const passed =
          finite(centerError) &&
          centerError <= criterion.maximumCenterErrorNormalized;
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: finite(centerError)
            ? Math.max(
                0,
                1 - boundedRatio(centerError, criterion.maximumCenterErrorNormalized),
              )
            : 0,
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
      case "mirror-viewpoint-retained": {
        const currentSeparation =
          mirrorShiftMeasurements?.current.reflectedPropSeparationNormalized;
        const neutralSeparation =
          mirrorShiftMeasurements?.neutral.reflectedPropSeparationNormalized;
        const parallaxDelta =
          finite(currentSeparation ?? Number.NaN) && finite(neutralSeparation ?? Number.NaN)
            ? Math.abs((currentSeparation as number) - (neutralSeparation as number))
            : Number.NaN;
        const passed =
          finite(parallaxDelta) &&
          parallaxDelta >= criterion.minimumParallaxDeltaNormalized;
        return {
          criterionId: criterion.id,
          label: guidedCopy.criteria[criterion.id],
          passed,
          score: boundedRatio(parallaxDelta, criterion.minimumParallaxDeltaNormalized),
          message: getCriterionResultMessageRef(criterion, passed),
        };
      }
    }
  });

  const requiredCriteria = criteria;
  const passed = requiredCriteria.every((criterion) => criterion.passed);
  const passedCount = requiredCriteria.filter((criterion) => criterion.passed).length;
  const score = requiredCriteria.length === 0 ? 0 : Math.round((passedCount / requiredCriteria.length) * 100);
  const status: TaskEvaluation["status"] = passed ? "passed" : "failed";

  const evaluation: TaskEvaluation = {
    taskId: task.id,
    status,
    score,
    criteria,
    primaryFeedback: guidedCopy.feedback.defaultFailPrimary,
    secondaryFeedback: [],
    finalCameraState: {
      frontRiseMm: camera.frontRiseMm,
      frontTiltDeg: camera.frontTiltDeg,
      frontSwingDeg: camera.frontSwingDeg,
      focusDistanceMm: camera.focusDistanceMm,
      aperture: camera.aperture,
      frontShiftMm: camera.frontShiftMm,
      mirrorShiftLessonState: camera.mirrorShiftLessonState,
    },
  };
  const feedback = feedbackEngine(task, evaluation, {
    camera,
    opticsState,
    scene,
    compositionCoverage,
    compositionCoverageByTarget,
  });
  evaluation.primaryFeedback = feedback.primaryFeedback;
  evaluation.secondaryFeedback = feedback.secondaryFeedback;
  return evaluation;
};
