import { useEffect, useRef, useState } from "react";
import { DiagramLegend } from "../geometry/DiagramPrimitives";
import { computeOpticalSectionData } from "../geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../geometry/geometryPresentationProfiles";
import { OpticalDepthStrip } from "../geometry/OpticalDepthStrip";
import OpticalSectionDiagram from "../geometry/OpticalSectionDiagram";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { UI_COPY } from "../../ui/copy";

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

  // Delegate projection to shared opticalSectionProjection helper (pass depth window)
  const projection = computeOpticalSectionData({ opticsState, scene, svgWidth: svgSize.width, svgHeight: svgSize.height, depthWindow });
  // projection is passed to OpticalSectionDiagram which consumes all needed fields
  const { sectionOrigin, sectionDepthDir, isInfinity } = projection;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {showHeader !== false ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{UI_COPY.simulator.geometryTitle}</h2>
          <div role="group" aria-label="Geometry view" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className={geometryView === "side" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={geometryView === "side"} onClick={() => setGeometryView("side")}>Side</button>
            <button className={geometryView === "top" ? "btn btn--compact btn--primary" : "btn btn--compact btn--secondary"} aria-pressed={geometryView === "top"} onClick={() => setGeometryView("top")}>Top</button>
          </div>
        </div>
      ) : null}

      <p style={{ marginTop: 6, marginBottom: 8 }}>
        {geometryView === "side" ? "Side view" : "Top view"} | Rise: {(riseMm ?? 0).toFixed(1)} mm | {UI_COPY.simulator.tiltLabel}: {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}° | {UI_COPY.simulator.swingLabel}: {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°
      </p>

      {/* Diagram container: this will expand to available space in floating panel */}
      <div ref={diagramRef} style={{ flex: 1, minHeight: 0 }}>
        <OpticalSectionDiagram projection={projection} geometryView={geometryView} profile={profile} scene={scene} opticsState={opticsState} svgWidth={svgSize.width} svgHeight={svgSize.height} />
      </div>

      {/* Optical depth strip (controlled by presentation profile) */}
      {profile.showDepthStrip ? (
        <OpticalDepthStrip opticsState={opticsState} sectionOrigin={sectionOrigin} sectionDepthDir={sectionDepthDir} depthWindow={depthWindow} profile={profile} />
      ) : null}

      {/* optional small explanatory caption under depth strip when profile requests it */}
      {profile.showDepthStrip ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.7)' }}>Amber lines: optical axis and FOV boundary rays.</div>
        </div>
      ) : null}

      {/* Render DiagramLegend only when the profile requests it */}
      {profile.showSwatchLegend ? (
        <DiagramLegend isInfinity={isInfinity} hasNearDof={!!opticsState.depthOfFieldNearPlane} hasFarDof={!!opticsState.depthOfFieldFarPlane && !isInfinity} hasTargets={scene.focusTargets.length > 0} />
      ) : null}
    </section>
  );
};
