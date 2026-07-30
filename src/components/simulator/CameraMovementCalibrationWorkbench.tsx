import { useEffect, useId, useMemo, useState } from "react";
import { useAppStore } from "../../state/appStore";
import {
  buildCameraMovementCalibrationSnapshot,
  CAMERA_MOVEMENT_WORKBENCH_BOUNDS,
  type CameraMovementCalibrationOverrides,
} from "../../scenes/cameraMovementEffectiveCalibration";
import type {
  CameraMovementDiagnosticMetric,
  CameraMovementProjectionDiagnostics,
} from "../../scenes/cameraMovementProjectionDiagnostics";
import { CAMERA_CONSTANTS } from "../../utils/constants";

type NumberFieldProps = Readonly<{
  label: string;
  value: number;
  onCommit: (value: number) => string | null | void;
  step?: number;
  min: number;
  max: number;
  minExclusive?: boolean;
  disabled?: boolean;
  syncKey: number;
}>;

const NumberField = ({
  label,
  value,
  onCommit,
  step = 1,
  min,
  max,
  minExclusive = false,
  disabled = false,
  syncKey,
}: NumberFieldProps) => {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  useEffect(() => {
    setDraft(String(value));
    setError(null);
  }, [syncKey, value]);

  const commit = () => {
    const nextValue = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(nextValue)) {
      setError(`${label} must be a number`);
      return;
    }
    if ((minExclusive ? nextValue <= min : nextValue < min) || nextValue > max) {
      setError(
        minExclusive
          ? `${label} must be greater than ${min} and no more than ${max}`
          : `${label} must be from ${min} to ${max}`,
      );
      return;
    }
    if (nextValue === value) {
      setDraft(String(value));
      setError(null);
      return;
    }
    const rejection = onCommit(nextValue);
    if (typeof rejection === "string") {
      setError(rejection);
      return;
    }
    setError(null);
  };

  return (
    <label className="camera-calibration-workbench__field">
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(String(value));
            setError(null);
            if (error) {
              useAppStore.getState().clearCameraMovementCalibrationValidation();
            }
          }
        }}
      />
      {error ? <span id={errorId} role="alert">{error}</span> : null}
    </label>
  );
};

const metricText = <T,>(
  metric: CameraMovementDiagnosticMetric<T> | undefined,
  format: (value: T) => string = String,
): string =>
  metric?.status === "available"
    ? format(metric.value)
    : metric?.reason ?? "Unavailable";

const vectorText = (value: Readonly<{ x: number; y: number; z: number }>) =>
  `${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)}`;

export const CameraMovementCalibrationWorkbench = ({
  diagnostics,
}: {
  diagnostics?: CameraMovementProjectionDiagnostics;
} = {}) => {
  const session = useAppStore((state) => state.cameraMovementCalibrationSession);
  const update = useAppStore((state) => state.updateCameraMovementCalibration);
  const reset = useAppStore((state) => state.resetCameraMovementCalibration);
  const camera = useAppStore((state) => state.camera);
  const setRise = useAppStore((state) => state.setRise);
  const setTilt = useAppStore((state) => state.setTilt);
  const setSwing = useAppStore((state) => state.setSwing);
  const setRearRise = useAppStore((state) => state.setRearRise);
  const setRearTilt = useAppStore((state) => state.setRearTilt);
  const setPitch = useAppStore((state) => state.setCameraBodyPitchDeg);
  const setAnchor = useAppStore((state) => state.setCameraMovementViewpointAnchor);
  const setTarget = useAppStore((state) => state.setCameraMovementTargetRegion);
  const targetRegion = useAppStore((state) => state.scene.targetRegion);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const overrides = session.overrides;
  const calibration = session.effectiveCalibration;
  const bounds = CAMERA_MOVEMENT_WORKBENCH_BOUNDS;
  const syncKey = session.revision;
  const updateSection = (next: CameraMovementCalibrationOverrides): string | null => {
    const accepted = update({
      geometry: { ...overrides.geometry, ...next.geometry },
      optics: { ...overrides.optics, ...next.optics },
      rig: { ...overrides.rig, ...next.rig },
      presentation: { ...overrides.presentation, ...next.presentation },
    });
    if (accepted) return null;
    return useAppStore
      .getState()
      .cameraMovementCalibrationSession.validation.errors.map((item) => item.message)
      .join("; ") || "The value was rejected by calibration validation";
  };
  const snapshot = useMemo(() => {
    const baselineSnapshot = buildCameraMovementCalibrationSnapshot(calibration);
    return JSON.stringify(
      {
        schemaVersion: baselineSnapshot.schemaVersion,
        calibrationStatus: baselineSnapshot.calibrationStatus,
        geometryAndOpticsUnits: baselineSnapshot.geometryAndOpticsUnits,
        subject: baselineSnapshot.geometry,
        optics: baselineSnapshot.optics,
        cameraRig: baselineSnapshot.rig,
        presentation: baselineSnapshot.presentation,
        currentAnchor: camera.viewpointAnchor,
        targetRegion,
        revision: session.revision,
      },
      null,
      2,
    );
  }, [calibration, camera.viewpointAnchor, session.revision, targetRegion]);
  const copySnapshot = async () => {
    try { await navigator.clipboard.writeText(snapshot); setCopyStatus("copied"); }
    catch { setCopyStatus("failed"); }
  };
  const copyDiagnostics = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(diagnostics ?? { effectiveKey: calibration.effectiveKey, validation: session.validation }, null, 2)); setCopyStatus("copied"); }
    catch { setCopyStatus("failed"); }
  };
  return (
    <section className="camera-calibration-workbench" aria-label="Camera movement calibration workbench">
      <div className="camera-calibration-workbench__header"><div><h4>Camera Movement Calibration</h4><p>Session revision {session.revision} · {session.validation.valid ? "valid" : "invalid"}</p></div><button type="button" className="btn btn--compact" onClick={reset}>Reset calibration</button></div>
      <fieldset><legend>Inspection</legend><p className="camera-calibration-workbench__status" role="status">Calibration session active · Effective key: {calibration.effectiveKey}</p><button type="button" className="btn btn--compact" onClick={copySnapshot}>Copy Effective Calibration JSON</button> <button type="button" className="btn btn--compact" onClick={copyDiagnostics}>Copy Diagnostics JSON</button>{copyStatus !== "idle" && <span role="status">{copyStatus === "copied" ? "Copied to clipboard" : "Clipboard copy failed"}</span>}</fieldset>
      <fieldset><legend>Subject</legend><div className="camera-calibration-workbench__grid"><NumberField label="Columns" {...bounds.subject.columns} syncKey={syncKey} value={calibration.subject.columns} onCommit={(value) => updateSection({ geometry: { columns: value } })} /><NumberField label="Rows" {...bounds.subject.rows} syncKey={syncKey} value={calibration.subject.rows} onCommit={(value) => updateSection({ geometry: { rows: value } })} /><NumberField label="Levels" {...bounds.subject.levels} syncKey={syncKey} value={calibration.subject.levels} onCommit={(value) => updateSection({ geometry: { levels: value } })} /><NumberField label="Cube (mm)" {...bounds.subject.cubeSizeMm} syncKey={syncKey} value={calibration.subject.cubeSizeMm} onCommit={(value) => updateSection({ geometry: { cubeSizeMm: value } })} /><NumberField label="Horizontal gap (mm)" {...bounds.subject.horizontalGapMm} syncKey={syncKey} value={calibration.subject.horizontalGapMm} onCommit={(value) => updateSection({ geometry: { horizontalGapMm: value } })} /><NumberField label="Vertical gap (mm)" {...bounds.subject.verticalGapMm} syncKey={syncKey} value={calibration.subject.verticalGapMm} onCommit={(value) => updateSection({ geometry: { verticalGapMm: value } })} /><NumberField label="Subject distance (mm)" {...bounds.subject.subjectDistanceMm} syncKey={syncKey} value={calibration.subject.originWorld.z} onCommit={(value) => updateSection({ geometry: { subjectDistanceMm: value } })} /></div></fieldset>
      <fieldset><legend>Optics</legend><div className="camera-calibration-workbench__grid"><NumberField label="Focal length (mm)" {...bounds.optics.provisionalFocalLengthMm} syncKey={syncKey} value={calibration.optics.provisionalFocalLengthMm} onCommit={(value) => updateSection({ optics: { provisionalFocalLengthMm: value, focalLengthCandidatesMm: Array.from(new Set([...calibration.optics.focalLengthCandidatesMm, value])) } })} /><NumberField label="Focus distance (mm)" {...bounds.optics.provisionalFocusDistanceMm} syncKey={syncKey} value={calibration.optics.provisionalFocusDistanceMm} onCommit={(value) => updateSection({ optics: { provisionalFocusDistanceMm: value } })} /></div></fieldset>
      <fieldset><legend>Rig</legend><div className="camera-calibration-workbench__grid"><NumberField label="Arc angle (°)" {...bounds.rig.arcAngleDeg} syncKey={syncKey} value={calibration.cameraRig.highArcAngleDeg} onCommit={(value) => updateSection({ rig: { arcAngleDeg: value } })} /><NumberField label="Base pitch (°)" {...bounds.rig.provisionalBasePitchDeg} syncKey={syncKey} value={calibration.cameraRig.provisionalBasePitchDeg} onCommit={(value) => updateSection({ rig: { provisionalBasePitchDeg: value } })} /></div></fieldset>
      <fieldset><legend>Movements</legend><label className="camera-calibration-workbench__field">Viewpoint anchor<select value={camera.viewpointAnchor} onChange={(event) => setAnchor(event.target.value as "mid" | "high" | "low")}><option value="mid">Mid</option><option value="high">High</option><option value="low">Low</option></select></label><div className="camera-calibration-workbench__grid"><NumberField label="Front rise (mm)" min={CAMERA_CONSTANTS.riseMinMm} max={CAMERA_CONSTANTS.riseMaxMm} syncKey={syncKey} disabled={camera.viewpointAnchor !== "mid"} value={camera.frontRiseMm} onCommit={setRise} /><NumberField label="Front tilt (°)" min={CAMERA_CONSTANTS.tiltMinDeg} max={CAMERA_CONSTANTS.tiltMaxDeg} syncKey={syncKey} disabled={camera.viewpointAnchor !== "mid"} value={camera.frontTiltDeg} onCommit={setTilt} /><NumberField label="Front swing (°)" min={CAMERA_CONSTANTS.swingMinDeg} max={CAMERA_CONSTANTS.swingMaxDeg} syncKey={syncKey} disabled={camera.viewpointAnchor !== "mid"} value={camera.frontSwingDeg} onCommit={setSwing} /><NumberField label="Rear rise (mm)" min={CAMERA_CONSTANTS.riseMinMm} max={CAMERA_CONSTANTS.riseMaxMm} syncKey={syncKey} disabled={camera.viewpointAnchor !== "mid"} value={camera.rearRiseMm} onCommit={setRearRise} /><NumberField label="Rear tilt (°)" min={CAMERA_CONSTANTS.tiltMinDeg} max={CAMERA_CONSTANTS.tiltMaxDeg} syncKey={syncKey} disabled={camera.viewpointAnchor !== "mid"} value={camera.rearTiltDeg} onCommit={setRearTilt} /><NumberField label="Camera body pitch (°)" {...bounds.movements.cameraBodyPitchDeg} syncKey={syncKey} value={camera.cameraBodyPitchDeg} onCommit={setPitch} /></div>{camera.viewpointAnchor !== "mid" && <p role="note">Standard movements are disabled at high/low anchors; camera body pitch remains enabled.</p>}</fieldset>
      <fieldset><legend>Target</legend><label className="camera-calibration-workbench__field">Scene target region<select value={targetRegion} onChange={(event) => setTarget(event.target.value as "upper" | "middle" | "lower")}><option value="upper">Upper</option><option value="middle">Middle</option><option value="lower">Lower</option></select></label></fieldset>
      <fieldset><legend>Presentation</legend><div className="camera-calibration-workbench__grid"><NumberField label="Outer vertical weight" {...bounds.presentation.outerVerticalWeight} syncKey={syncKey} step={0.1} value={calibration.presentation.outerVerticalWeight} onCommit={(value) => updateSection({ presentation: { outerVerticalWeight: value } })} /><NumberField label="Outer horizontal weight" {...bounds.presentation.outerHorizontalWeight} syncKey={syncKey} step={0.1} value={calibration.presentation.outerHorizontalWeight} onCommit={(value) => updateSection({ presentation: { outerHorizontalWeight: value } })} /><NumberField label="Internal edge weight" {...bounds.presentation.internalEdgeWeight} syncKey={syncKey} step={0.1} value={calibration.presentation.internalEdgeWeight} onCommit={(value) => updateSection({ presentation: { internalEdgeWeight: value } })} /><NumberField label="Internal edge opacity" {...bounds.presentation.internalEdgeOpacity} syncKey={syncKey} step={0.01} value={calibration.presentation.internalEdgeOpacity} onCommit={(value) => updateSection({ presentation: { internalEdgeOpacity: value } })} /></div></fieldset>
      {diagnostics ? (
        <fieldset>
          <legend>Projection diagnostics</legend>
          <table className="camera-calibration-workbench__diagnostics">
            <tbody>
              <tr><th>Geometry ID</th><td>{metricText(diagnostics.identity.geometryId)}</td></tr>
              <tr><th>Edge count</th><td>{metricText(diagnostics.identity.edgeCount)}</td></tr>
              <tr><th>Anchor</th><td>{diagnostics.currentAnchor}</td></tr>
              <tr><th>Rig origin</th><td>{metricText(diagnostics.worldGeometry.rigOriginWorld, vectorText)}</td></tr>
              <tr><th>Camera-to-target</th><td>{metricText(diagnostics.worldGeometry.lensTargetDistanceMm, (value) => `${value.toFixed(2)} mm`)}</td></tr>
              <tr><th>Target UV</th><td>{metricText(diagnostics.selectedTarget.uv, ({ uv }) => `${uv.u.toFixed(4)}, ${uv.v.toFixed(4)}`)}</td></tr>
              <tr><th>Margins L/R/T/B</th><td>{[diagnostics.marginsUv.left, diagnostics.marginsUv.right, diagnostics.marginsUv.top, diagnostics.marginsUv.bottom].map((metric) => metricText(metric, (value) => value.toFixed(4))).join(" / ")}</td></tr>
              <tr><th>Coverage H/V</th><td>{metricText(diagnostics.coverage.horizontal, (value) => value.toFixed(4))} / {metricText(diagnostics.coverage.vertical, (value) => value.toFixed(4))}</td></tr>
              <tr><th>Convergence</th><td>{metricText(diagnostics.convergence.direction)} · {metricText(diagnostics.convergence.normalizedSignal, (value) => value.toFixed(6))}</td></tr>
              <tr><th>Slopes L/R</th><td>{metricText(diagnostics.convergence.leftVerticalSlope, (value) => value.toFixed(6))} / {metricText(diagnostics.convergence.rightVerticalSlope, (value) => value.toFixed(6))}</td></tr>
              <tr><th>Lens normal</th><td>{metricText(diagnostics.worldGeometry.lensNormalWorld, vectorText)}</td></tr>
              <tr><th>Film normal</th><td>{metricText(diagnostics.worldGeometry.filmNormalWorld, vectorText)}</td></tr>
              <tr><th>Lens-film distance</th><td>{metricText(diagnostics.worldGeometry.lensFilmDistanceMm, (value) => `${value.toFixed(3)} mm`)}</td></tr>
              <tr><th>Projection</th><td>{diagnostics.status.code}</td></tr>
            </tbody>
          </table>
        </fieldset>
      ) : null}
      {!session.validation.valid && <div role="alert">{session.validation.errors.map((error) => <div key={`${error.path}-${error.code}`}>{error.path}: {error.message}</div>)}</div>}
    </section>
  );
};
