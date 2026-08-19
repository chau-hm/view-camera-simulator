import { useCallback, useId, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAppStore } from "../../state/appStore";
import "../../i18n";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
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

const viewpointValueText = (viewpointT: number, t: TFunction): string => {
  if (viewpointT === 0) return t(simulatorMessageKeys.controls.viewpointValueNeutral);
  const percent = Math.round(Math.abs(viewpointT) * 100);
  if (viewpointT < 0) {
    return percent === 100
      ? t(simulatorMessageKeys.controls.viewpointValueLower)
      : t(simulatorMessageKeys.controls.viewpointValueTowardLower, { percent });
  }
  return percent === 100
    ? t(simulatorMessageKeys.controls.viewpointValueHigher)
    : t(simulatorMessageKeys.controls.viewpointValueTowardHigher, { percent });
};

const tiltValueText = (activeStandard: ActiveStandard, tiltDeg: number, t: TFunction): string => {
  const standard = t(
    activeStandard === "front"
      ? simulatorMessageKeys.controls.frontStandard
      : simulatorMessageKeys.controls.rearStandard,
  );
  if (tiltDeg === 0) return t(simulatorMessageKeys.controls.tiltValueZero, { standard });
  return t(simulatorMessageKeys.controls.tiltValueSigned, {
    standard,
    direction: t(
      tiltDeg < 0
        ? simulatorMessageKeys.controls.tiltNegativeValue
        : simulatorMessageKeys.controls.tiltPositiveValue,
    ),
    degrees: Math.abs(tiltDeg).toFixed(1),
  });
};

const verticalFramingValueText = (
  activeStandard: ActiveStandard,
  framingT: number,
  t: TFunction,
): string => {
  const standard = t(
    activeStandard === "front"
      ? simulatorMessageKeys.controls.frontStandard
      : simulatorMessageKeys.controls.rearStandard,
  );
  const position = t(
    framingT > 0
      ? simulatorMessageKeys.controls.framingUpperValue
      : framingT < 0
        ? simulatorMessageKeys.controls.framingLowerValue
        : simulatorMessageKeys.controls.framingMiddleValue,
  );
  const percent = Math.round(Math.abs(framingT) * 100);
  return percent === 0 || percent === 100
    ? t(simulatorMessageKeys.controls.framingValue, { standard, position })
    : t(simulatorMessageKeys.controls.framingValueToward, { standard, percent, position });
};

const signedTiltText = (tiltDeg: number): string =>
  tiltDeg === 0 ? "0.0°" : tiltDeg < 0 ? `-${Math.abs(tiltDeg).toFixed(1)}°` : `+${tiltDeg.toFixed(1)}°`;

export const CameraMovementTeachingControls = () => {
  const { t } = useTranslation();
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
  const currentStatusText = (() => {
    switch (lessonState.study) {
      case "viewpoint":
        {
          const value = viewpointValueText(lessonState.viewpointT, t);
          const label = lessonState.viewpointT === 0
            ? t(simulatorMessageKeys.controls.viewpointValueNeutral)
            : t(
              lessonState.viewpointT < 0
                ? simulatorMessageKeys.controls.viewpointValueLower
                : simulatorMessageKeys.controls.viewpointValueHigher,
            );
          return value === label ? label : `${label} · ${value}`;
        }
      case "tilt":
        return `${t(
          lessonState.activeStandard === "front"
            ? simulatorMessageKeys.controls.frontTiltValue
            : simulatorMessageKeys.controls.rearTiltValue,
        )} · ${signedTiltText(lessonState.tiltDeg)}`;
      case "vertical-framing": {
        const positionKey =
          lessonState.framingT > 0
            ? simulatorMessageKeys.controls.framingUpperStatus
            : lessonState.framingT < 0
              ? simulatorMessageKeys.controls.framingLowerStatus
              : simulatorMessageKeys.controls.framingMiddleStatus;
        const movement = currentReadout.value.split(" · ")[1] ?? "";
        return `${t(
          lessonState.activeStandard === "front"
            ? simulatorMessageKeys.controls.frontStandard
            : simulatorMessageKeys.controls.rearStandard,
        )} · ${t(positionKey)} · ${movement}`;
      }
    }
  })();

  return (
    <section aria-label={t(simulatorMessageKeys.controls.cameraMovementTitle)} className="camera-movement-controls">
      <h3 className="sim-section-label">{t(simulatorMessageKeys.controls.cameraMovementTitle)}</h3>
      <p className="camera-movement-controls__intro">{t(simulatorMessageKeys.controls.cameraMovementIntro)}</p>

      <section className="camera-movement-controls__section" aria-labelledby={`${viewpointSliderId}-heading`}>
        <h4 id={`${viewpointSliderId}-heading`} className="camera-movement-controls__heading">
          {t(simulatorMessageKeys.controls.viewpointTitle)}
        </h4>
        <p id={viewpointHelpId} className="camera-movement-controls__copy">
          {t(simulatorMessageKeys.controls.viewpointCopy)}
        </p>
        <label className="control-label" htmlFor={viewpointSliderId}>
          <span>{t(simulatorMessageKeys.controls.viewpointTitle)}</span>
          <span>{viewpointValueText(lessonState.viewpointT, t)}</span>
        </label>
        <input
          id={viewpointSliderId}
          className="range-slider camera-movement-controls__slider"
          type="range"
          min={VIEWPOINT_MIN}
          max={VIEWPOINT_MAX}
          step={VIEWPOINT_STEP}
          value={lessonState.viewpointT}
          aria-label={t(simulatorMessageKeys.controls.viewpointTitle)}
          aria-valuetext={viewpointValueText(lessonState.viewpointT, t)}
          aria-describedby={viewpointHelpId}
          onChange={handleViewpointChange}
        />
        <div className="camera-movement-controls__range-labels" role="group" aria-label={t(simulatorMessageKeys.controls.viewpointPositionsLabel)}>
          <span>{t(simulatorMessageKeys.controls.viewpointLower)}</span>
          <span>{t(simulatorMessageKeys.controls.viewpointNeutral)}</span>
          <span>{t(simulatorMessageKeys.controls.viewpointHigher)}</span>
        </div>
      </section>

      <section className="camera-movement-controls__section" aria-labelledby={`${tiltSliderId}-heading`}>
        <h4 id={`${tiltSliderId}-heading`} className="camera-movement-controls__heading">
          {t(simulatorMessageKeys.controls.tiltTitle)}
        </h4>
        <p id={tiltHelpId} className="camera-movement-controls__copy">
          {t(simulatorMessageKeys.controls.tiltCopy)}
        </p>
        <fieldset className="camera-movement-controls__standard" aria-label={t(simulatorMessageKeys.controls.tiltStandardGroupLabel)}>
          <legend>{t(simulatorMessageKeys.controls.standardLabel)}</legend>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="camera-movement-tilt-standard"
              value="front"
              checked={lessonState.activeStandard === "front"}
              onChange={() => handleTiltStandardChange("front")}
            />
            <span>{t(simulatorMessageKeys.controls.frontStandard)}</span>
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
            <span>{t(simulatorMessageKeys.controls.rearStandard)}</span>
          </label>
        </fieldset>
        <label className="control-label" htmlFor={tiltSliderId}>
          <span>{t(simulatorMessageKeys.controls.tiltTitle)}</span>
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
          aria-label={t(simulatorMessageKeys.controls.tiltTitle)}
          aria-valuetext={tiltValueText(lessonState.activeStandard, lessonState.tiltDeg, t)}
          aria-describedby={tiltHelpId}
          onChange={handleTiltChange}
        />
        <div className="camera-movement-controls__range-labels" role="group" aria-label={t(simulatorMessageKeys.controls.tiltPositionsLabel)}>
          <span>{t(simulatorMessageKeys.controls.tiltNegative)} {signedTiltText(-TILT_LIMIT_DEG)}</span>
          <span>{t(simulatorMessageKeys.controls.tiltZero)}</span>
          <span>{t(simulatorMessageKeys.controls.tiltPositive)} {signedTiltText(TILT_LIMIT_DEG)}</span>
        </div>
      </section>

      <section className="camera-movement-controls__section" aria-labelledby={`${framingSliderId}-heading`}>
        <h4 id={`${framingSliderId}-heading`} className="camera-movement-controls__heading">
          {t(simulatorMessageKeys.controls.verticalFramingTitle)}
        </h4>
        <p id={framingHelpId} className="camera-movement-controls__copy">
          {t(simulatorMessageKeys.controls.verticalFramingCopy)}
        </p>
        <fieldset
          className="camera-movement-controls__standard"
          aria-label={t(simulatorMessageKeys.controls.verticalFramingGroupLabel)}
        >
          <legend>{t(simulatorMessageKeys.controls.standardLabel)}</legend>
          <label className="choice-label">
            <input
              className="form-radio"
              type="radio"
              name="camera-movement-vertical-framing-standard"
              value="front"
              checked={lessonState.activeStandard === "front"}
              onChange={() => handleVerticalFramingStandardChange("front")}
            />
            <span>{t(simulatorMessageKeys.controls.frontStandard)}</span>
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
            <span>{t(simulatorMessageKeys.controls.rearStandard)}</span>
          </label>
        </fieldset>
        <label className="control-label" htmlFor={framingSliderId}>
          <span>{t(simulatorMessageKeys.controls.verticalFramingControlLabel)}</span>
          <span>{verticalFramingValueText(lessonState.activeStandard, lessonState.framingT, t)}</span>
        </label>
        <input
          id={framingSliderId}
          className="range-slider camera-movement-controls__slider"
          type="range"
          min={FRAMING_MIN}
          max={FRAMING_MAX}
          step={FRAMING_STEP}
          value={lessonState.framingT}
          aria-label={t(simulatorMessageKeys.controls.verticalFramingControlLabel)}
          aria-valuetext={verticalFramingValueText(lessonState.activeStandard, lessonState.framingT, t)}
          aria-describedby={framingHelpId}
          onChange={handleVerticalFramingChange}
        />
        <div className="camera-movement-controls__range-labels" role="group" aria-label={t(simulatorMessageKeys.controls.verticalFramingPositionsLabel)}>
          <span>{t(simulatorMessageKeys.controls.verticalFramingLower)}</span>
          <span>{t(simulatorMessageKeys.controls.verticalFramingMiddle)}</span>
          <span>{t(simulatorMessageKeys.controls.verticalFramingUpper)}</span>
        </div>
      </section>

      <div id={statusId} className="camera-movement-controls__status" role="status" aria-live="polite" aria-atomic="true">
        {currentStatusText}
      </div>

    </section>
  );
};
