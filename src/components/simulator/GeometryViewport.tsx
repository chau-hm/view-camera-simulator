import { useEffect, useRef, useState } from "react";
import { DiagramLegend } from "../geometry/DiagramPrimitives";
import { computeOpticalSectionData, getScheimpflugConstructionWindow } from "../geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../geometry/geometryPresentationProfiles";
import { OpticalDepthStrip } from "../geometry/OpticalDepthStrip";
import OpticalSectionDiagram from "../geometry/OpticalSectionDiagram";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { UI_COPY } from "../../ui/copy";
import { supportsScheimpflugConstruction } from "../../render/scheimpflugSceneSupport";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
  geometryView: GeometryView;
  scene: SceneDefinition;
  riseMm?: number;
  showHeader?: boolean;
};

const SVG_WIDTH = 460;
const SVG_HEIGHT = 280;

import { useAppStore } from "../../state/appStore";

export const GeometryViewport = ({ opticsState, geometryView, scene, riseMm, showHeader }: GeometryViewportProps) => {
  const setGeometryView = useAppStore((s) => s.setGeometryView);

  // Responsive diagram sizing: measure the diagram container and auto-fit SVG to available space
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const [svgSize, setSvgSize] = useState({ width: SVG_WIDTH, height: SVG_HEIGHT });
  const [fitMode, setFitMode] = useState<"scene" | "construction">("scene");
  const supportsConstruction = supportsScheimpflugConstruction(scene.id);
  const effectiveGeometryView =
    !supportsConstruction && geometryView === "scheimpflug" ? "side" : geometryView;
  const effectiveFitMode = supportsConstruction ? fitMode : "scene";

  useEffect(() => {
    if (!supportsConstruction) {
      if (geometryView === "scheimpflug") setGeometryView("side");
      if (fitMode === "construction") setFitMode("scene");
    }
  }, [fitMode, geometryView, setGeometryView, supportsConstruction]);

  useEffect(() => {
    const el = diagramRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      // maintain aspect ratio from defaults
      const aspect = SVG_HEIGHT / SVG_WIDTH;
      const w = Math.max(200, Math.floor(rect.width));
      const h = Math.max(120, Math.floor(rect.height));

      // Prefer filling available width and limiting height by container, preserving aspect
      const computedH = Math.min(h, Math.round(w * aspect));
      setSvgSize({ width: w, height: computedH });
    };

    // Initial
    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => updateSize());
      ro.observe(el);
      return () => ro.disconnect();
    }

    // Fallback: window resize
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [diagramRef, scene]);

  // Use presentation profile to control rendering choices (replace scattered scene-id checks)
  const profile = getGeometryPresentationProfile(scene);
  const constructionWindow = getScheimpflugConstructionWindow(opticsState);

  // derive stable depth window for projection from profile
  let depthWindow: { minMm: number; maxMm: number };
  if (profile.depthWindow.mode === 'fixed') {
    depthWindow = { minMm: profile.depthWindow.minMm, maxMm: profile.depthWindow.maxMm };
  } else {
    const m = profile.depthWindow.marginMm;
    const minDepth = Math.min(-250, scene.bounds.min.z - m);
    const maxDepth = scene.bounds.max.z + m;
    depthWindow = { minMm: minDepth, maxMm: maxDepth };
  }
  if (effectiveFitMode === "construction" && constructionWindow) {
    depthWindow = {
      minMm: constructionWindow.depth.minMm,
      maxMm: constructionWindow.depth.maxMm,
    };
  }

  const lateralWindow =
    effectiveFitMode === "construction" && constructionWindow
      ? {
          ...profile.lateralWindow,
          scheimpflug: {
            minMm: constructionWindow.lateral.minMm,
            maxMm: constructionWindow.lateral.maxMm,
          },
        }
      : profile.lateralWindow;

  // Delegate projection to shared opticalSectionProjection helper (pass depth window)
  const projection = computeOpticalSectionData({
    opticsState,
    scene,
    svgWidth: svgSize.width,
    svgHeight: svgSize.height,
    depthWindow,
    lateralWindow,
    paddingPx: profile.diagramPaddingPx,
  });
  // projection is passed to OpticalSectionDiagram which consumes all needed fields
  const { sectionOrigin, sectionDepthDir, isInfinity } = projection;

  return (
    <section data-geometry-fit={effectiveFitMode} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        {supportsConstruction ? <button
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
        </button> : null}
      </div>

      <p style={{ marginTop: 6, marginBottom: 8 }}>
        {effectiveGeometryView === "side" ? "Side view" : effectiveGeometryView === "top" ? "Top view" : "Perpendicular Scheimpflug section"} | Rise: {(riseMm ?? 0).toFixed(1)} mm | {UI_COPY.simulator.tiltLabel}: {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}° | {UI_COPY.simulator.swingLabel}: {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°
      </p>

      {/* Diagram container: this will expand to available space in floating panel */}
      <div ref={diagramRef} style={{ flex: 1, minHeight: 0 }}>
        <OpticalSectionDiagram projection={projection} geometryView={effectiveGeometryView} profile={profile} scene={scene} opticsState={opticsState} svgWidth={svgSize.width} svgHeight={svgSize.height} />
      </div>

      {/* Optical depth strip (controlled by presentation profile) */}
      {profile.showDepthStrip ? (
        <OpticalDepthStrip opticsState={opticsState} sectionOrigin={sectionOrigin} sectionDepthDir={sectionDepthDir} depthWindow={depthWindow} profile={profile} />
      ) : null}

      {/* optional small explanatory caption under depth strip when profile requests it */}
      {profile.showDepthStrip ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.7)' }}>Amber lines: optical axis and FOV boundary rays.</div>
          {effectiveGeometryView === "scheimpflug" ? (
            <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.7)' }}>
              {opticsState.lensFilmHingeLine
                ? "Film, lens and focus planes meet along one line. This section views that line end-on."
                : "At zero tilt and swing the film and lens planes are parallel. Apply a movement to reveal their common Scheimpflug line and perpendicular section."}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Render DiagramLegend only when the profile requests it */}
      {profile.showSwatchLegend ? (
        <DiagramLegend isInfinity={isInfinity} hasNearDof={!!opticsState.depthOfFieldNearPlane} hasFarDof={!!opticsState.depthOfFieldFarPlane && !isInfinity} hasTargets={scene.focusTargets.length > 0} />
      ) : null}
    </section>
  );
};
