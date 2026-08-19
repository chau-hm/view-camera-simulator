import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DiagramLegend } from "../geometry/DiagramPrimitives";
import {
  computeOpticalSectionData,
  getScheimpflugConstructionWindow,
} from "../geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../geometry/geometryPresentationProfiles";
import { getPreferredSubjectGeometryView } from "../geometry/getPreferredSubjectGeometryView";
import { OpticalDepthStrip } from "../geometry/OpticalDepthStrip";
import OpticalSectionDiagram from "../geometry/OpticalSectionDiagram";
import { MirrorShiftTeachingDiagram } from "../geometry/MirrorShiftTeachingDiagram";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import "../../i18n";
import { readoutMessageKeys } from "../../i18n/readoutMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { supportsScheimpflugConstruction } from "../../render/scheimpflugSceneSupport";
import { useAppStore } from "../../state/appStore";
import { deriveFocusFundamentalsReferenceOptics } from "../../scenes/focusFundamentalsPresentation";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
  geometryView: GeometryView;
  scene: SceneDefinition;
  riseMm?: number;
  showHeader?: boolean;
  expanded?: boolean;
  onRequestRestore?: () => void;
  /** Public teaching movement summary for the active case. */
  movementSummary?: string | null;
};

const SVG_WIDTH = 460;
const SVG_HEIGHT = 280;

export const GeometryViewport = ({
  opticsState,
  geometryView,
  scene,
  riseMm,
  showHeader,
  expanded = false,
  onRequestRestore,
  movementSummary,
}: GeometryViewportProps) => {
  const { t } = useTranslation();
  const setGeometryView = useAppStore((state) => state.setGeometryView);
  const focalLengthMm = useAppStore((state) => state.camera.focalLengthMm);
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const restoreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [svgSize, setSvgSize] = useState({ width: SVG_WIDTH, height: SVG_HEIGHT });
  const [fitMode, setFitMode] = useState<"scene" | "construction">("scene");
  const supportsConstruction = supportsScheimpflugConstruction(scene.id);
  const isMirrorShiftTeaching = scene.id === "mirror-shift";
  const subjectGeometryView = getPreferredSubjectGeometryView({
    sceneId: scene.id,
    tiltDeg: opticsState.diagnostics.tiltAngleDeg,
    swingDeg: opticsState.diagnostics.swingAngleDeg,
  });
  const effectiveGeometryView =
    isMirrorShiftTeaching
      ? "top"
      : !supportsConstruction && geometryView === "scheimpflug"
        ? subjectGeometryView
        : geometryView;

  useEffect(() => {
    if (!supportsConstruction) {
      if (geometryView === "scheimpflug") setGeometryView(subjectGeometryView);
      if (fitMode === "construction") setFitMode("scene");
    }
  }, [fitMode, geometryView, setGeometryView, subjectGeometryView, supportsConstruction]);

  useEffect(() => {
    const element = diagramRef.current;
    if (!element) return;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const aspect = SVG_HEIGHT / SVG_WIDTH;
      const width = Math.max(200, Math.floor(rect.width));
      const height = Math.max(120, Math.floor(rect.height));
      setSvgSize({ width, height: Math.min(height, Math.round(width * aspect)) });
    };
    updateSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [scene.id]);

  useEffect(() => {
    if (!expanded) return;

    const frame = window.requestAnimationFrame(() => restoreTriggerRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  const profile = getGeometryPresentationProfile(scene);
  const constructionWindow = getScheimpflugConstructionWindow(opticsState);

  useEffect(() => {
    if (fitMode !== "construction") return;
    if (!constructionWindow) {
      setFitMode("scene");
      if (geometryView === "scheimpflug") setGeometryView(subjectGeometryView);
      return;
    }
    if (geometryView !== "scheimpflug") setFitMode("scene");
  }, [constructionWindow, fitMode, geometryView, setGeometryView, subjectGeometryView]);

  const sceneDepthWindow = useMemo<{ minMm: number; maxMm: number }>(() => {
    if (profile.depthWindow.mode === "fixed") {
      return { minMm: profile.depthWindow.minMm, maxMm: profile.depthWindow.maxMm };
    }
    return {
      minMm: Math.min(-250, scene.bounds.min.z - profile.depthWindow.marginMm),
      maxMm: scene.bounds.max.z + profile.depthWindow.marginMm,
    };
  }, [profile.depthWindow, scene.bounds]);

  const sceneProjection = computeOpticalSectionData({
    opticsState,
    scene,
    svgWidth: svgSize.width,
    svgHeight: svgSize.height,
    depthWindow: sceneDepthWindow,
    lateralWindow: profile.lateralWindow,
    paddingPx: profile.diagramPaddingPx,
  });

  const splitSvgWidth = Math.max(280, Math.floor((svgSize.width - 72) / 2));
  const splitSvgHeight = Math.max(190, Math.min(250, svgSize.height));

  // Original (zero-movement) optics and projection for camera-movement comparison scenes
  const originalRef = useMemo<{ optics: DerivedOpticsState; projection: typeof sceneProjection } | null>(() => {
    let originalOptics: DerivedOpticsState | null = null;
    if (scene.movementCapabilities) {
      const originalCamera = {
        ...DEFAULT_CAMERA_STATE,
        ...scene.cameraPreset,
        frontRiseMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
        activeSceneId: scene.id,
      };
      originalOptics = deriveOpticsState(originalCamera, scene);
    } else if (scene.id === "focus-fundamentals-two-targets") {
      originalOptics = deriveFocusFundamentalsReferenceOptics(
        opticsState,
        scene,
        focalLengthMm,
      );
    }
    if (!originalOptics) return null;
    const originalProjection = computeOpticalSectionData({
      opticsState: originalOptics,
      scene,
      svgWidth: svgSize.width,
      svgHeight: svgSize.height,
      depthWindow: sceneDepthWindow,
      lateralWindow: profile.lateralWindow,
      paddingPx: profile.diagramPaddingPx,
    });
    return { optics: originalOptics, projection: originalProjection };
  }, [focalLengthMm, opticsState, scene, svgSize.width, svgSize.height, sceneDepthWindow, profile.lateralWindow, profile.diagramPaddingPx]);

  const mirrorShiftNeutralOptics = useMemo<DerivedOpticsState | null>(() => {
    if (!isMirrorShiftTeaching) return null;
    return deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...scene.cameraPreset,
        activeSceneId: scene.id,
        activeTaskId: null,
        mode: "free",
        frontRiseMm: 0,
        frontShiftMm: 0,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        rearRiseMm: 0,
        rearTiltDeg: 0,
        mirrorShiftLessonState: { rigLateralMm: 0 },
      },
      scene,
    );
  }, [isMirrorShiftTeaching, scene]);

const cameraProjection = constructionWindow
    ? computeOpticalSectionData({
        opticsState,
        scene,
        svgWidth: splitSvgWidth,
        svgHeight: splitSvgHeight,
        depthWindow: constructionWindow.depth,
        lateralWindow: {
          ...profile.lateralWindow,
          scheimpflug: constructionWindow.lateral,
        },
        paddingPx: 28,
      })
    : null;
  const subjectProjection = computeOpticalSectionData({
    opticsState,
    scene,
    svgWidth: splitSvgWidth,
    svgHeight: splitSvgHeight,
    depthWindow: sceneDepthWindow,
    lateralWindow: profile.lateralWindow,
    paddingPx: profile.diagramPaddingPx,
  });
  const constructionLayoutActive =
    supportsConstruction &&
    fitMode === "construction" &&
    effectiveGeometryView === "scheimpflug" &&
    Boolean(cameraProjection) &&
    Boolean(constructionWindow);
  const effectiveFitMode = constructionLayoutActive ? "construction" : "scene";
  const { sectionOrigin, sectionDepthDir, isInfinity } = sceneProjection;
  const localizedMovementSummary = movementSummary
    ?.replace("Front tilt", t(readoutMessageKeys.teaching.frontTilt))
    .replace("Rear tilt", t(readoutMessageKeys.teaching.rearTilt))
    .replace("Front rise", t(readoutMessageKeys.teaching.frontRise))
    .replace("Rear rise", t(readoutMessageKeys.teaching.rearRise))
    .replace("Front fall", t(readoutMessageKeys.teaching.frontFall))
    .replace("Rear fall", t(readoutMessageKeys.teaching.rearFall))
    .replace("Higher viewpoint", t(readoutMessageKeys.teaching.higherViewpoint))
    .replace("Lower viewpoint", t(readoutMessageKeys.teaching.lowerViewpoint))
    .replace("Neutral viewpoint", t(readoutMessageKeys.teaching.neutralViewpoint))
    .replace("Body pitch", t(readoutMessageKeys.teaching.bodyPitch));

  return (
    <section
      className={`geometry-viewport${expanded ? " geometry-viewport--expanded" : ""}`}
      data-geometry-fit={effectiveFitMode}
      data-geometry-view={effectiveGeometryView}
      data-construction-valid={constructionWindow ? "true" : "false"}
      data-construction-layout={constructionLayoutActive ? "split" : "single"}
      data-camera-construction-visible={constructionLayoutActive ? "true" : "false"}
      data-subject-field-visible={constructionLayoutActive ? "true" : "false"}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {showHeader !== false ? (
        <div className="geometry-viewport__header">
          <h2 style={{ margin: 0 }}>{t(simulatorMessageKeys.viewport.geometryTitle)}</h2>
          <div className="geometry-viewport__header-actions">
            <div className="geometry-viewport__view-controls" role="group" aria-label={t(simulatorMessageKeys.geometry.viewLabel)}>
              {!isMirrorShiftTeaching ? (
                <button className={effectiveGeometryView === "side" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={effectiveGeometryView === "side"} onClick={() => {
                  setFitMode("scene");
                  setGeometryView("side");
                }}>{t(simulatorMessageKeys.geometry.side)}</button>
              ) : null}
              <button className={effectiveGeometryView === "top" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={effectiveGeometryView === "top"} onClick={() => {
                setFitMode("scene");
                setGeometryView("top");
              }}>{t(simulatorMessageKeys.geometry.top)}</button>
              {supportsConstruction ? (
                <button className={effectiveGeometryView === "scheimpflug" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={effectiveGeometryView === "scheimpflug"} onClick={() => {
                  setFitMode("scene");
                  setGeometryView("scheimpflug");
                }}>{t(simulatorMessageKeys.geometry.scheimpflugSection)}</button>
              ) : null}
            </div>
            {onRequestRestore ? (
              <button
                ref={restoreTriggerRef}
                className="btn btn--icon btn--viewport-action geometry-viewport__restore-action"
                type="button"
                onClick={onRequestRestore}
                aria-label={t(simulatorMessageKeys.viewport.restoreGeometry)}
                title={t(simulatorMessageKeys.viewport.restoreGeometry)}
                data-viewport-expanded="true"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close_fullscreen
                </span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="geometry-viewport__framing-controls" role="group" aria-label={t(simulatorMessageKeys.geometry.framingLabel)}>
        <button
          type="button"
          className={effectiveFitMode === "scene" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"}
          aria-pressed={effectiveFitMode === "scene"}
          onClick={() => {
            setFitMode("scene");
            setGeometryView(subjectGeometryView);
          }}
        >
          {t(simulatorMessageKeys.geometry.fitScene)}
        </button>
        {supportsConstruction ? (
          <button
            type="button"
            className={effectiveFitMode === "construction" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"}
            aria-pressed={effectiveFitMode === "construction"}
            disabled={!constructionWindow}
            onClick={() => {
              setFitMode("construction");
              setGeometryView("scheimpflug");
            }}
          >
            {t(simulatorMessageKeys.geometry.fitConstruction)}
          </button>
        ) : null}
      </div>

      <p style={{ marginTop: 6, marginBottom: 8 }}>
        {constructionLayoutActive
          ? t(simulatorMessageKeys.geometry.constructionAndSubjectRelationship)
          : effectiveGeometryView === "side"
            ? t(simulatorMessageKeys.geometry.sideView)
            : effectiveGeometryView === "top"
              ? t(simulatorMessageKeys.geometry.topView)
              : t(simulatorMessageKeys.geometry.perpendicularScheimpflugSection)}{localizedMovementSummary
            ? ` | ${localizedMovementSummary}`
            : ` | ${t(simulatorMessageKeys.controls.riseLabel)}: ${(riseMm ?? 0).toFixed(1)} mm | ${t(simulatorMessageKeys.controls.tiltLabel)}: ${opticsState.diagnostics.tiltAngleDeg.toFixed(1)}° | ${t(simulatorMessageKeys.controls.swingLabel)}: ${opticsState.diagnostics.swingAngleDeg.toFixed(1)}°`}
      </p>

      <div ref={diagramRef} className="geometry-diagram-container" style={{ flex: 1, minHeight: 0 }}>
        {isMirrorShiftTeaching && mirrorShiftNeutralOptics ? (
          <MirrorShiftTeachingDiagram
            neutralOptics={mirrorShiftNeutralOptics}
            currentOptics={opticsState}
          />
        ) : constructionLayoutActive && cameraProjection ? (
          <div className="geometry-construction-split" data-testid="geometry-construction-split">
            <section className="geometry-construction-region" data-testid="camera-construction-region">
              <h3>{t(simulatorMessageKeys.geometry.cameraConstructionHeading)}</h3>
              <OpticalSectionDiagram
                projection={cameraProjection}
                geometryView="scheimpflug"
                profile={profile}
                scene={scene}
                opticsState={opticsState}
                svgWidth={splitSvgWidth}
                svgHeight={splitSvgHeight}
                displayMode="camera-construction"
              />
            </section>
            <div className="geometry-construction-continuation" aria-label={t(simulatorMessageKeys.geometry.continuesToSubjectField)}>
              <span aria-hidden="true">⋯</span>
              <span>{t(simulatorMessageKeys.geometry.continuesToSubjectField)}</span>
              <span aria-hidden="true">››</span>
            </div>
            <section className="geometry-construction-region" data-testid="subject-field-region">
              <h3>{t(simulatorMessageKeys.geometry.subjectField)}</h3>
              <OpticalSectionDiagram
                projection={subjectProjection}
                geometryView={subjectGeometryView}
                profile={profile}
                scene={scene}
                opticsState={opticsState}
                svgWidth={splitSvgWidth}
                svgHeight={splitSvgHeight}
                displayMode="subject-field"
              />
            </section>
          </div>
        ) : (
          <OpticalSectionDiagram
            projection={sceneProjection}
            geometryView={effectiveGeometryView}
            profile={profile}
            scene={scene}
            opticsState={opticsState}
            svgWidth={svgSize.width}
            svgHeight={svgSize.height}
            referenceProjection={originalRef?.projection ?? null}
              referenceOpticsState={originalRef?.optics ?? null}
          />
        )}
      </div>

      {profile.showDepthStrip ? (
        <OpticalDepthStrip opticsState={opticsState} sectionOrigin={sectionOrigin} sectionDepthDir={sectionDepthDir} depthWindow={sceneDepthWindow} profile={profile} />
      ) : null}

      {profile.showDepthStrip ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "rgba(15,23,42,0.7)" }}>{t(simulatorMessageKeys.geometry.opticalAxisAndFov)}</div>
          {constructionLayoutActive ? (
            <div style={{ fontSize: 12, color: "rgba(15,23,42,0.7)" }}>
              {t(simulatorMessageKeys.geometry.constructionScaleNote)}
            </div>
          ) : effectiveGeometryView === "scheimpflug" ? (
            <div style={{ fontSize: 12, color: "rgba(15,23,42,0.7)" }}>
              {opticsState.lensFilmHingeLine
                ? t(simulatorMessageKeys.geometry.scheimpflugValidNote)
                : t(simulatorMessageKeys.geometry.scheimpflugZeroNote)}
            </div>
          ) : null}
        </div>
      ) : null}

      {profile.showSwatchLegend ? (
        <DiagramLegend isInfinity={isInfinity} hasNearDof={Boolean(opticsState.depthOfFieldNearPlane)} hasFarDof={Boolean(opticsState.depthOfFieldFarPlane && !isInfinity)} hasTargets={scene.focusTargets.length > 0} />
      ) : null}
    </section>
  );
};
