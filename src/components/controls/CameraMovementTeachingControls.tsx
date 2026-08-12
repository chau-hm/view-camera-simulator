import { useCallback, useId, type ChangeEvent } from "react";
import { useAppStore } from "../../state/appStore";
import { UI_COPY } from "../../ui/copy";
import {
  formatCameraMovementLessonReadout,
  type CameraMovementLessonPhysicalMovement,
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
const FRAMING_MIN = -1;
const FRAMING_MAX = 1;
const FRAMING_STEP = 0.01;

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

const verticalFramingValueText = (
  activeStandard: ActiveStandard,
  framingT: number,
): string => {
  const standard = activeStandard === "front" ? "Front" : "Rear";
  if (framingT === 0) return `${standard} standard, middle framing`;
  const direction = framingT < 0 ? "lower" : "upper";
  const percent = Math.round(Math.abs(framingT) * 100);
  return percent === 100
    ? `${standard} standard, ${direction} framing`
    : `${standard} standard, ${percent}% toward ${direction} framing`;
};

const signedTiltText = (tiltDeg: number): string =>
  tiltDeg === 0 ? "0.0°" : tiltDeg < 0 ? `-${Math.abs(tiltDeg).toFixed(1)}°` : `+${tiltDeg.toFixed(1)}°`;

export const CameraMovementTeachingControls = () => {
  const viewpointSliderId = useId();
  const viewpointHelpId = useId();
  const tiltSliderId = useId();
  const tiltHelpId = useId();
  const framingSliderId = useId();
  const framingHelpId = useId();
  const statusId = useId();

  const lessonState = useAppStore(
    (state) => state.camera.cameraMovementLessonState ?? DEFAULT_CAMERA_MOVEMENT_LESSON_STATE,
  );
  const setLessonState = useAppStore((state) => state.setCameraMovementLessonState);
  const frontRiseMm = useAppStore((state) => state.camera.frontRiseMm);
  const rearRiseMm = useAppStore((state) => state.camera.rearRiseMm);

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

  const handleTiltStandardChange = useCallback(
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

  const handleVerticalFramingStandardChange = useCallback(
    (activeStandard: ActiveStandard) => {
      setLessonState({
        study: "vertical-framing",
        viewpointT: 0,
        activeStandard,
        tiltDeg: 0,
        framingT: lessonState.study === "vertical-framing" ? lessonState.framingT : 0,
      });
    },
    [lessonState.framingT, lessonState.study, setLessonState],
  );

  const handleVerticalFramingChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const framingT = Number(event.currentTarget.value);
      if (!Number.isFinite(framingT)) return;
      setLessonState({
        study: "vertical-framing",
        viewpointT: 0,
        activeStandard: lessonState.activeStandard,
        tiltDeg: 0,
        framingT,
      });
    },
    [lessonState.activeStandard, setLessonState],
  );

  const physicalMovement: CameraMovementLessonPhysicalMovement = {
    frontRiseMm,
    rearRiseMm,
  };
  const currentReadout = formatCameraMovementLessonReadout(lessonState, physicalMovement);

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
              onChange={() => handleTiltStandardChange("front")}
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
              onChange={() => handleTiltStandardChange("rear")}
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

      <section className="camera-movement-controls__section" aria-labelledby={`${framingSliderId}-heading`}>
        <h4 id={`${framingSliderId}-heading`} className="camera-movement-controls__heading">
          {UI_COPY.controls.verticalFramingTitle}
        </h4>
        <p id={framingHelpId} className="camera-movement-controls__copy">
          {UI_COPY.controls.verticalFramingCopy}
        </p>
        <fieldset
          className="camera-movement-controls__standard"
          aria-label={UI_COPY.controls.verticalFramingGroupLabel}
        >
          <legend>Standard</legend>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="camera-movement-vertical-framing-standard"
              value="front"
              checked={lessonState.activeStandard === "front"}
              onChange={() => handleVerticalFramingStandardChange("front")}
            />
            <span>{UI_COPY.controls.tiltFrontStandard}</span>
          </label>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="camera-movement-vertical-framing-standard"
              value="rear"
              checked={lessonState.activeStandard === "rear"}
              onChange={() => handleVerticalFramingStandardChange("rear")}
            />
            <span>{UI_COPY.controls.tiltRearStandard}</span>
          </label>
        </fieldset>
        <label className="control-label" htmlFor={framingSliderId}>
          <span>Vertical framing</span>
          <span>{verticalFramingValueText(lessonState.activeStandard, lessonState.framingT)}</span>
        </label>
        <input
          id={framingSliderId}
          className="range-slider camera-movement-controls__slider"
          type="range"
          min={FRAMING_MIN}
          max={FRAMING_MAX}
          step={FRAMING_STEP}
          value={lessonState.framingT}
          aria-label="Vertical framing"
          aria-valuetext={verticalFramingValueText(lessonState.activeStandard, lessonState.framingT)}
          aria-describedby={framingHelpId}
          onChange={handleVerticalFramingChange}
        />
        <div className="camera-movement-controls__range-labels" role="group" aria-label="Vertical framing positions">
          <span>{UI_COPY.controls.verticalFramingLower}</span>
          <span>{UI_COPY.controls.verticalFramingMiddle}</span>
          <span>{UI_COPY.controls.verticalFramingUpper}</span>
        </div>
      </section>

      <div id={statusId} className="camera-movement-controls__status" role="status" aria-live="polite" aria-atomic="true">
        {currentReadout.label}{currentReadout.value ? ` · ${currentReadout.value}` : ""}
      </div>

    </section>
  );
};
