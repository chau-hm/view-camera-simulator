import { useEffect, useRef, useState } from "react";
import { DiagramLegend } from "../geometry/DiagramPrimitives";
import {
  computeOpticalSectionData,
  getScheimpflugConstructionWindow,
} from "../geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../geometry/geometryPresentationProfiles";
import { OpticalDepthStrip } from "../geometry/OpticalDepthStrip";
import OpticalSectionDiagram from "../geometry/OpticalSectionDiagram";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { UI_COPY } from "../../ui/copy";
import { supportsScheimpflugConstruction } from "../../render/scheimpflugSceneSupport";
import { useAppStore } from "../../state/appStore";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
  geometryView: GeometryView;
  scene: SceneDefinition;
  riseMm?: number;
  showHeader?: boolean;
};

const SVG_WIDTH = 460;
const SVG_HEIGHT = 280;

export const GeometryViewport = ({ opticsState, geometryView, scene, riseMm, showHeader }: GeometryViewportProps) => {
  const setGeometryView = useAppStore((state) => state.setGeometryView);
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const [svgSize, setSvgSize] = useState({ width: SVG_WIDTH, height: SVG_HEIGHT });
  const [fitMode, setFitMode] = useState<"scene" | "construction">("scene");
  const supportsConstruction = supportsScheimpflugConstruction(scene.id);
  const effectiveGeometryView =
    !supportsConstruction && geometryView === "scheimpflug" ? "side" : geometryView;

  useEffect(() => {
    if (!supportsConstruction) {
      if (geometryView === "scheimpflug") setGeometryView("side");
      if (fitMode === "construction") setFitMode("scene");
    }
  }, [fitMode, geometryView, setGeometryView, supportsConstruction]);

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

  const profile = getGeometryPresentationProfile(scene);
  const constructionWindow = getScheimpflugConstructionWindow(opticsState);

  useEffect(() => {
    if (fitMode === "construction" && !constructionWindow) setFitMode("scene");
  }, [constructionWindow, fitMode]);

  const sceneDepthWindow =
    profile.depthWindow.mode === "fixed"
      ? { minMm: profile.depthWindow.minMm, maxMm: profile.depthWindow.maxMm }
      : {
          minMm: Math.min(-250, scene.bounds.min.z - profile.depthWindow.marginMm),
          maxMm: scene.bounds.max.z + profile.depthWindow.marginMm,
        };

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
  const subjectGeometryView: GeometryView =
    Math.abs(opticsState.diagnostics.swingAngleDeg) > Math.abs(opticsState.diagnostics.tiltAngleDeg)
      ? "top"
      : "side";
  const constructionLayoutActive = fitMode === "construction" && Boolean(cameraProjection);
  const effectiveFitMode = constructionLayoutActive ? "construction" : "scene";
  const { sectionOrigin, sectionDepthDir, isInfinity } = sceneProjection;

  return (
    <section
      className="geometry-viewport"
      data-geometry-fit={effectiveFitMode}
      data-construction-layout={constructionLayoutActive ? "split" : "single"}
      data-camera-construction-visible={constructionLayoutActive ? "true" : "false"}
      data-subject-field-visible={constructionLayoutActive ? "true" : "false"}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {showHeader !== false ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{UI_COPY.simulator.geometryTitle}</h2>
          <div role="group" aria-label="Geometry view" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className={effectiveGeometryView === "side" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={effectiveGeometryView === "side"} onClick={() => setGeometryView("side")}>Side</button>
            <button className={effectiveGeometryView === "top" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={effectiveGeometryView === "top"} onClick={() => setGeometryView("top")}>Top</button>
            {supportsConstruction ? (
              <button className={effectiveGeometryView === "scheimpflug" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={effectiveGeometryView === "scheimpflug"} onClick={() => setGeometryView("scheimpflug")}>Scheimpflug Section</button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div role="group" aria-label="Geometry framing" style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button
          type="button"
          className={effectiveFitMode === "scene" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"}
          aria-pressed={effectiveFitMode === "scene"}
          onClick={() => setFitMode("scene")}
        >
          Fit Scene
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
            Fit Construction
          </button>
        ) : null}
      </div>

      <p style={{ marginTop: 6, marginBottom: 8 }}>
        {constructionLayoutActive
          ? "Scheimpflug construction and subject relationship"
          : effectiveGeometryView === "side"
            ? "Side view"
            : effectiveGeometryView === "top"
              ? "Top view"
              : "Perpendicular Scheimpflug section"} | Rise: {(riseMm ?? 0).toFixed(1)} mm | {UI_COPY.simulator.tiltLabel}: {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}° | {UI_COPY.simulator.swingLabel}: {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°
      </p>

      <div ref={diagramRef} className="geometry-diagram-container" style={{ flex: 1, minHeight: 0 }}>
        {constructionLayoutActive && cameraProjection ? (
          <div className="geometry-construction-split" data-testid="geometry-construction-split">
            <section className="geometry-construction-region" data-testid="camera-construction-region">
              <h3>Camera construction — enlarged</h3>
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
            <div className="geometry-construction-continuation" aria-label="Continues to subject field">
              <span aria-hidden="true">⋯</span>
              <span>continues to subject field</span>
              <span aria-hidden="true">››</span>
            </div>
            <section className="geometry-construction-region" data-testid="subject-field-region">
              <h3>Subject field</h3>
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
          />
        )}
      </div>

      {profile.showDepthStrip ? (
        <OpticalDepthStrip opticsState={opticsState} sectionOrigin={sectionOrigin} sectionDepthDir={sectionDepthDir} depthWindow={sceneDepthWindow} profile={profile} />
      ) : null}

      {profile.showDepthStrip ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "rgba(15,23,42,0.7)" }}>Amber lines: optical axis and FOV boundary rays.</div>
          {constructionLayoutActive ? (
            <div style={{ fontSize: 12, color: "rgba(15,23,42,0.7)" }}>
              Each labelled region uses its own linear scale. The enlarged camera construction continues to the true-distance subject field.
            </div>
          ) : effectiveGeometryView === "scheimpflug" ? (
            <div style={{ fontSize: 12, color: "rgba(15,23,42,0.7)" }}>
              {opticsState.lensFilmHingeLine
                ? "Film, lens and focus planes meet along one line. This section views that line end-on."
                : "At zero tilt and swing the film and lens planes are parallel. Apply a movement to reveal their common Scheimpflug line and perpendicular section."}
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
