import { useCallback, useId, type ChangeEvent } from "react";
import { useAppStore } from "../../state/appStore";
import { UI_COPY } from "../../ui/copy";
import {
  formatCameraMovementLessonReadout,
  matchCameraMovementTeachingCase,
  type CameraMovementPublicCaseId,
} from "../../scenes/cameraMovementPublicTeaching";
import {
  CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
} from "../../scenes/cameraMovementLessonState";
import type { ActiveStandard } from "../../types/camera";
import { CAMERA_CONTROL_STEPS } from "../../utils/constants";

const VIEWPOINT_MIN = -1;
const VIEWPOINT_MAX = 1;
const VIEWPOINT_STEP = 0.01;
const TILT_LIMIT_DEG = CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.tiltDeg;

const VERTICAL_FRAMING_CASES = [
  {
    id: "C1-front-rise",
    label: UI_COPY.controls.teachingC1Name,
    copy: UI_COPY.controls.teachingC1Copy,
  },
  {
    id: "C2-rear-rise",
    label: UI_COPY.controls.teachingC2Name,
    copy: UI_COPY.controls.teachingC2Copy,
  },
  {
    id: "D1-front-fall",
    label: UI_COPY.controls.teachingD1Name,
    copy: UI_COPY.controls.teachingD1Copy,
  },
  {
    id: "D2-rear-fall",
    label: UI_COPY.controls.teachingD2Name,
    copy: UI_COPY.controls.teachingD2Copy,
  },
] as const satisfies ReadonlyArray<{
  id: Extract<CameraMovementPublicCaseId, "C1-front-rise" | "C2-rear-rise" | "D1-front-fall" | "D2-rear-fall">;
  label: string;
  copy: string;
}>;

const viewpointValueText = (viewpointT: number): string => {
  if (viewpointT === 0) return "Neutral viewpoint";
  const direction = viewpointT < 0 ? "lower" : "higher";
  const percent = Math.round(Math.abs(viewpointT) * 100);
  return percent === 100
    ? `${direction[0].toUpperCase()}${direction.slice(1)} viewpoint`
    : `${percent}% toward ${direction} viewpoint`;
};

const tiltValueText = (activeStandard: ActiveStandard, tiltDeg: number): string => {
  const standard = activeStandard === "front" ? "Front" : "Rear";
  if (tiltDeg === 0) return `${standard} standard, zero tilt`;
  const direction = tiltDeg < 0 ? "negative" : "positive";
  return `${standard} standard, ${direction} ${Math.abs(tiltDeg).toFixed(1)} degrees`;
};

const signedTiltText = (tiltDeg: number): string =>
  tiltDeg === 0 ? "0.0°" : tiltDeg < 0 ? `-${Math.abs(tiltDeg).toFixed(1)}°` : `+${tiltDeg.toFixed(1)}°`;

export const CameraMovementTeachingControls = () => {
  const viewpointSliderId = useId();
  const viewpointHelpId = useId();
  const tiltSliderId = useId();
  const tiltHelpId = useId();
  const statusId = useId();

  const lessonState = useAppStore(
    (state) => state.camera.cameraMovementLessonState ?? DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
  );
  const setLessonState = useAppStore((state) => state.setCameraMovementLessonState);
  const applyTeachingCase = useAppStore((state) => state.applyCameraMovementTeachingCase);
  const activeCaseId = useAppStore((state) => {
    if (state.camera.activeSceneId !== "understanding-camera-movements") return null;
    return matchCameraMovementTeachingCase({
      anchor: state.camera.viewpointAnchor,
      targetRegion: state.scene.targetRegion,
      camera: state.camera,
    });
  });

  const handleViewpointChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const viewpointT = Number(event.currentTarget.value);
      if (!Number.isFinite(viewpointT)) return;
      setLessonState({
        study: "viewpoint",
        viewpointT,
        activeStandard: lessonState.activeStandard,
        tiltDeg: 0,
        framingT: 0,
      });
    },
    [lessonState.activeStandard, setLessonState],
  );

  const handleStandardChange = useCallback(
    (activeStandard: ActiveStandard) => {
      setLessonState({
        study: "tilt",
        viewpointT: 0,
        activeStandard,
        tiltDeg: lessonState.study === "tilt" ? lessonState.tiltDeg : 0,
        framingT: 0,
      });
    },
    [lessonState.study, lessonState.tiltDeg, setLessonState],
  );

  const handleTiltChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const tiltDeg = Number(event.currentTarget.value);
      if (!Number.isFinite(tiltDeg)) return;
      setLessonState({
        study: "tilt",
        viewpointT: 0,
        activeStandard: lessonState.activeStandard,
        tiltDeg,
        framingT: 0,
      });
    },
    [lessonState.activeStandard, setLessonState],
  );

  const currentReadout = formatCameraMovementLessonReadout(lessonState, activeCaseId);

  return (
    <section aria-label={UI_COPY.controls.cameraMovementTitle} className="camera-movement-controls">
      <h3 className="sim-section-label">{UI_COPY.controls.cameraMovementTitle}</h3>
      <p className="camera-movement-controls__intro">{UI_COPY.controls.cameraMovementIntro}</p>

      <section className="camera-movement-controls__section" aria-labelledby={`${viewpointSliderId}-heading`}>
        <h4 id={`${viewpointSliderId}-heading`} className="camera-movement-controls__heading">
          {UI_COPY.controls.viewpointTitle}
        </h4>
        <p id={viewpointHelpId} className="camera-movement-controls__copy">
          {UI_COPY.controls.viewpointCopy}
        </p>
        <label className="control-label" htmlFor={viewpointSliderId}>
          <span>Viewpoint</span>
          <span>{viewpointValueText(lessonState.viewpointT)}</span>
        </label>
        <input
          id={viewpointSliderId}
          className="range-slider camera-movement-controls__slider"
          type="range"
          min={VIEWPOINT_MIN}
          max={VIEWPOINT_MAX}
          step={VIEWPOINT_STEP}
          value={lessonState.viewpointT}
          aria-label="Viewpoint"
          aria-valuetext={viewpointValueText(lessonState.viewpointT)}
          aria-describedby={viewpointHelpId}
          onChange={handleViewpointChange}
        />
        <div className="camera-movement-controls__range-labels" role="group" aria-label="Viewpoint positions">
          <span>{UI_COPY.controls.viewpointLower}</span>
          <span>{UI_COPY.controls.viewpointNeutral}</span>
          <span>{UI_COPY.controls.viewpointHigher}</span>
        </div>
      </section>

      <section className="camera-movement-controls__section" aria-labelledby={`${tiltSliderId}-heading`}>
        <h4 id={`${tiltSliderId}-heading`} className="camera-movement-controls__heading">
          {UI_COPY.controls.tiltTitle}
        </h4>
        <p id={tiltHelpId} className="camera-movement-controls__copy">
          {UI_COPY.controls.tiltCopy}
        </p>
        <fieldset className="camera-movement-controls__standard" aria-label="Tilt standard">
          <legend>Standard</legend>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="camera-movement-tilt-standard"
              value="front"
              checked={lessonState.activeStandard === "front"}
              onChange={() => handleStandardChange("front")}
            />
            <span>{UI_COPY.controls.tiltFrontStandard}</span>
          </label>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="camera-movement-tilt-standard"
              value="rear"
              checked={lessonState.activeStandard === "rear"}
              onChange={() => handleStandardChange("rear")}
            />
            <span>{UI_COPY.controls.tiltRearStandard}</span>
          </label>
        </fieldset>
        <label className="control-label" htmlFor={tiltSliderId}>
          <span>Tilt</span>
          <span>{signedTiltText(lessonState.tiltDeg)}</span>
        </label>
        <input
          id={tiltSliderId}
          className="range-slider camera-movement-controls__slider"
          type="range"
          min={-TILT_LIMIT_DEG}
          max={TILT_LIMIT_DEG}
          step={CAMERA_CONTROL_STEPS.tiltDeg}
          value={lessonState.tiltDeg}
          aria-label="Tilt"
          aria-valuetext={tiltValueText(lessonState.activeStandard, lessonState.tiltDeg)}
          aria-describedby={tiltHelpId}
          onChange={handleTiltChange}
        />
        <div className="camera-movement-controls__range-labels" role="group" aria-label="Tilt positions">
          <span>{UI_COPY.controls.tiltNegative} {signedTiltText(-TILT_LIMIT_DEG)}</span>
          <span>{UI_COPY.controls.tiltZero}</span>
          <span>{UI_COPY.controls.tiltPositive} {signedTiltText(TILT_LIMIT_DEG)}</span>
        </div>
      </section>

      <section className="camera-movement-controls__section camera-movement-controls__compatibility" aria-labelledby={`${statusId}-vertical-heading`}>
        <h4 id={`${statusId}-vertical-heading`} className="camera-movement-controls__heading">
          {UI_COPY.controls.verticalFramingTitle}
        </h4>
        <p className="camera-movement-controls__copy">{UI_COPY.controls.verticalFramingCopy}</p>
        <fieldset className="teaching-controls" role="radiogroup" aria-label={UI_COPY.controls.verticalFramingGroupLabel}>
          <legend>{UI_COPY.controls.verticalFramingGroupLabel}</legend>
          <div className="teaching-controls__grid">
            {VERTICAL_FRAMING_CASES.map((option) => (
              <label key={option.id} className="teaching-controls__choice">
                <input
                  type="radio"
                  name="camera-movement-vertical-framing"
                  value={option.id}
                  checked={activeCaseId === option.id}
                  onChange={() => applyTeachingCase(option.id)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div id={statusId} className="camera-movement-controls__status" role="status" aria-live="polite" aria-atomic="true">
        {currentReadout.label}{currentReadout.value ? ` · ${currentReadout.value}` : ""}
      </div>

      {activeCaseId && lessonState.study === "vertical-framing" ? (
        <p className="camera-movement-controls__compatibility-copy">
          {VERTICAL_FRAMING_CASES.find((option) => option.id === activeCaseId)?.copy}
        </p>
      ) : null}
    </section>
  );
};
