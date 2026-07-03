/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState, useRef } from "react";
import { GroundGlassRTT } from "./GroundGlassRTT";
import { projectWorldPointToGroundGlass } from "./groundGlassProjection";
import type { ApertureValue } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
export { projectWorldPointToGroundGlass } from "./groundGlassProjection";
import type { RenderQualityProfile } from "../types/ui";
import { UI_COPY } from "../ui/copy";
import { formatDegrees, formatMillimeter } from "../utils/formatters";
import { createFocusAssistPass } from "./postprocessing/FocusAssistPass";
import { createGroundGlassDofPipeline } from "./groundGlassPipeline";
import { createDepthOfFieldPass } from "./postprocessing/DepthOfFieldPass";
import { getRenderQualitySettings } from "./renderQuality";
import { calculateFocusPlaneDistanceMm, calculateApertureBlurStrength } from "./groundGlassPipeline";
import { focusPlaneWidthMm, focusPlaneHeightMm, verticalFovDegreesFromImageDistance, cocDiameterMm } from "../core/optics/thinLensModel";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { getSceneById } from "../scenes/definitions";

type GroundGlassRendererProps = {
  opticsState: DerivedOpticsState;
  assistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
  focusDistanceMm: number;
  aperture: ApertureValue;
  renderQuality: RenderQualityProfile;
  sceneId?: string;
};

const PANEL_WIDTH_PX = 500;
const PANEL_HEIGHT_PX = 400;

const statusLabelMap = {
  sharp: UI_COPY.render.focusStatusSharp,
  acceptable: UI_COPY.render.focusStatusAcceptable,
  soft: UI_COPY.render.focusStatusSoft,
} as const;

const statusPatternGlyph = {
  solid: "■",
  hatch: "▒",
  cross: "✕",
} as const;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));



export const GroundGlassRenderer = ({
  opticsState,
  assistEnabled,
  focusAssistEnabled,
  gridEnabled,
  riseMm,
  tiltDeg,
  swingDeg,
  focusDistanceMm,
  aperture,
  renderQuality,
  sceneId,
}: GroundGlassRendererProps) => {
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState<{ xPercent: number; yPercent: number }>({
    xPercent: 50,
    yPercent: 50,
  });
  // Explicit preview modes for Focus Fundamentals: 'raw' (invert both axes) or 'upright' (correct both axes)
  const [previewMode, setPreviewMode] = useState<"raw" | "upright">(sceneId === "focus-fundamentals-two-targets" ? "raw" : assistEnabled ? "upright" : "raw");
  const invertHorizontal = previewMode === "raw" ? true : false;
  const invertVertical = previewMode === "raw" ? true : false;
  const scaleX = invertHorizontal ? -1 : 1;
  const scaleY = invertVertical ? -1 : 1;
  const transform = `scale(${scaleX}, ${scaleY})`;
  const pipeline = useMemo(() => {
    // For the dedicated Focus Fundamentals scene use the thin-lens optical projection
    const useThinLens = sceneId === "focus-fundamentals-two-targets";
    if (useThinLens) {
      // derive image distance from opticsState: filmPlane.distance is the canonical imageDistance when lens fixed
      // However deriveOpticsState does not currently expose imageDistance directly; use distance from lens center to film center
      const imageDistanceMm = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
      return createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality, {
        useThinLens: true,
        focalLengthMm: opticsState.filmPlane.distance ?? 150,
        imageDistanceMm,
        sensorWidthMm: 127,
        sensorHeightMm: 101.6,
      });
    }

    return createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality);
  }, [opticsState, renderQuality, sceneId]);
  const qualitySettings = useMemo(() => getRenderQualitySettings(renderQuality), [renderQuality]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusAssist = useMemo(
    () => createFocusAssistPass({ enabled: focusAssistEnabled, targets: opticsState.focusTargets }),
    [focusAssistEnabled, opticsState.focusTargets],
  );
  const dofSample = useMemo(
    () =>
      createDepthOfFieldPass(
        {
          enabled: true,
          widthPx: PANEL_WIDTH_PX,
          heightPx: PANEL_HEIGHT_PX,
          sampleDepth: 0.55,
          sampleUv: { u: 0.5, v: 0.5 },
          aperture,
          renderQuality,
        },
        opticsState,
      ),
    [aperture, opticsState, renderQuality],
  );

  const blurOpacity = Math.min(0.85, dofSample.blurStrength * 1.2);
  const blurRadiusPx = Math.max(0, dofSample.blurStrength * (qualitySettings.groundGlassScale > 0.8 ? 9 : 6));
  const backgroundPositionY = `${pipeline.verticalFrameOffsetPx}px`;
  const zoomScale = zoomEnabled ? 1.9 : 1;
  // For Focus Fundamentals scene, ignore rise/tilt/swing to maintain a strict no-movement baseline
  const isFocusFundamentals = sceneId === "focus-fundamentals-two-targets";
  const sceneShiftX = isFocusFundamentals ? 0 : clamp(swingDeg * 4 + (assistEnabled ? 0 : pipeline.verticalFrameOffsetPx * 0.2), -60, 60);
  const sceneShiftY = isFocusFundamentals ? 0 : clamp(-riseMm * 2 + tiltDeg * 4 - pipeline.verticalFrameOffsetPx * 0.15, -80, 80);
  const sceneRotationDeg = isFocusFundamentals ? 0 : clamp(tiltDeg * 1.25 + swingDeg * 0.75, -18, 18);
  const focusShift = clamp((focusDistanceMm - 2000) / 4000, -1, 1);
  const focusScale = 1 + focusShift * 0.04;
  const focusRingSize = 68 + dofSample.blurStrength * 56;
  const focusRingOpacity = 0.35 + (1 - dofSample.blurStrength) * 0.45;
  const sceneBackground = `radial-gradient(circle at ${50 + clamp(riseMm * 0.75, -18, 18)}% ${
    48 - clamp(tiltDeg * 2.2, -18, 18)
  }%, rgba(96,165,250,0.34), rgba(30,41,59,0.9) 42%, rgba(15,23,42,0.97) 100%)`;
  const focusDistanceLabel = `${formatMillimeter(focusDistanceMm)} focus / ${dofSample.distanceToFocusPlaneMm.toFixed(1)} mm delta`;

  // Project scene focus targets (if available) into ground-glass UV coordinates for positioning overlays
  const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
  // Compute image distance from lens center to film center (used by thin-lens projection)
  const imageDistanceMm = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);

  const projectedTargets = (sceneDef?.focusTargets ?? []).map((t) => {
    // Use the canonical thin-lens projection helper so canvas/DOM overlays match the RTT rendering
    const p = projectWorldPointToGroundGlass(t.worldPosition, opticsState.lensCenterWorld, imageDistanceMm, CAMERA_CONSTANTS.filmWidthMm, CAMERA_CONSTANTS.filmHeightMm);
    const orientedU = previewMode === "upright" ? 1 - p.uRaw : p.uRaw;
    const orientedV = previewMode === "upright" ? 1 - p.vRaw : p.vRaw;
    const leftPercent = p.visible ? clamp(orientedU * 100, 0, 100) : -999; // off-screen sentinel
    const topPercent = p.visible ? clamp(orientedV * 100, 0, 100) : -999;
    const distanceToFocusPlaneMm = calculateFocusPlaneDistanceMm(t.worldPosition, opticsState.focusPlane);
    const blurStrengthAtTarget = calculateApertureBlurStrength(distanceToFocusPlaneMm, aperture as unknown as number);
    return { id: t.id, leftPercent, topPercent, blurStrengthAtTarget, visible: p.visible };
  });

  // GroundGlassRTT prototype (offscreen three.js render) removed from this file for now.
  // Phase 1 RTT implementation will be moved to src/render/GroundGlassRTT.tsx in a follow-up commit.
  const apertureNumber = typeof aperture === 'number' ? aperture : Number(aperture as unknown as number);

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <strong>{UI_COPY.simulator.groundGlassRenderPipeline}</strong>
        <button type="button" onClick={() => setZoomEnabled((value) => !value)}>
          {zoomEnabled ? UI_COPY.simulator.groundGlassZoomOut : UI_COPY.simulator.groundGlassZoomIn}
        </button>
      </div>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 500,
          aspectRatio: "5 / 4",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          overflow: "hidden",
          cursor: zoomEnabled ? "zoom-out" : "zoom-in",
        }}
        onClick={(event) => {
          if (!zoomEnabled) {
            return;
          }
          const rect = event.currentTarget.getBoundingClientRect();
          const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
          const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
          setZoomOrigin({ xPercent, yPercent });
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: sceneBackground,
            backgroundPosition: `center ${backgroundPositionY}`,
            backgroundRepeat: "no-repeat",
            transform,
            transformOrigin: "center",
          }}
        />
        {/* Preview mode toggle for Focus Fundamentals */}
        {sceneId === "focus-fundamentals-two-targets" && (
          <div style={{ position: "absolute", left: 8, top: 8, zIndex: 10 }}>
            <label style={{ color: "#e5e7eb", fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Preview:</span>
              <button
                type="button"
                onClick={() => setPreviewMode(previewMode === "raw" ? "upright" : "raw")}
                style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", padding: "4px 8px", borderRadius: 6 }}
              >
                {previewMode === "raw" ? "Raw ground glass" : "Upright assist"}
              </button>
            </label>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoomScale})`,
            transformOrigin: `${zoomOrigin.xPercent}% ${zoomOrigin.yPercent}%`,
          }}
        >
        {/* For focus fundamentals show the RTT instead of the legacy canvas */}
        {sceneId === "focus-fundamentals-two-targets" ? (
          <div data-testid="ground-glass-rtt" style={{ position: "absolute", inset: 0 }}>
            {/* GroundGlassRTT renders the real 3D scene to a texture and displays it */}
            <GroundGlassRTT
              opticsState={opticsState}
              sceneId={sceneId}
              widthPx={PANEL_WIDTH_PX}
              heightPx={PANEL_HEIGHT_PX}
              aperture={apertureNumber}
              previewMode={previewMode}
              focusRingRadiusPx={focusRingSize}
              focusRingOpacity={focusRingOpacity}
            />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: `translate(${sceneShiftX}px, ${sceneShiftY}px) rotate(${sceneRotationDeg}deg) scale(${focusScale})`,
              transformOrigin: "center",
            }}
          />
        )}

        <div
          data-testid="ground-glass-scene"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.14) 100%)",
            filter: `blur(${blurRadiusPx}px)`,
            transform: `translate(${sceneShiftX}px, ${sceneShiftY}px) rotate(${sceneRotationDeg}deg) scale(${focusScale})`,
            transformOrigin: "center",
          }}
        >
            {(() => {
              const sceneDef = sceneId ? getSceneById(sceneId) : undefined;
              // If we have a scene definition with focus targets, project those into film UV and render placeholders anchored to them.
              // IMPORTANT: Do not render DOM placeholder target elements for the Focus Fundamentals scene — the RTT pipeline provides the ground-glass imagery.
              if (sceneDef && sceneDef.focusTargets && sceneDef.focusTargets.length > 0) {
                if (sceneId === "focus-fundamentals-two-targets") {
                  return null;
                }

                const topLeft = opticsState.filmPlaneCornersWorld.topLeft;
                const topRight = opticsState.filmPlaneCornersWorld.topRight;
                const bottomLeft = opticsState.filmPlaneCornersWorld.bottomLeft;
                const spanX = topRight.x - topLeft.x;
                const spanY = topLeft.y - bottomLeft.y;

                const projectedTargets = sceneDef.focusTargets.map((t) => {
                  const w = t.worldPosition;
                  const u = spanX === 0 ? 0.5 : (w.x - topLeft.x) / spanX;
                  const v = spanY === 0 ? 0.5 : (topLeft.y - w.y) / spanY;
                  const leftPercent = clamp(u * 100, 0, 100);
                  const topPercent = clamp(v * 100, 0, 100);
                  const distanceToFocusPlaneMm = calculateFocusPlaneDistanceMm(w, opticsState.focusPlane);
                  const blurStrengthAtTarget = calculateApertureBlurStrength(distanceToFocusPlaneMm, aperture as unknown as number);
                  return { id: t.id, leftPercent, topPercent, blurStrengthAtTarget };
                });

                return (
                  <>
                    {projectedTargets.map((pt) => (
                      <div
                        key={pt.id}
                        style={{
                          position: "absolute",
                          left: `${pt.leftPercent}%`,
                          top: `${pt.topPercent}%`,
                          width: sceneId === "architecture-rise" ? "18%" : "10%",
                          height: sceneId === "architecture-rise" ? "48%" : "14%",
                          marginLeft: sceneId === "architecture-rise" ? "-9%" : "-5%",
                          marginTop: sceneId === "architecture-rise" ? "-24%" : "-7%",
                          borderRadius: sceneId === "architecture-rise" ? 10 : 4,
                          background:
                            sceneId === "architecture-rise"
                              ? "linear-gradient(180deg, rgba(148,163,184,0.95), rgba(71,85,105,0.92) 30%, rgba(15,23,42,0.9))"
                              : "rgba(255,255,255,0.9)",
                          boxShadow: pt.blurStrengthAtTarget < 0.35 ? "0 0 18px rgba(255,255,255,0.28)" : "0 4px 8px rgba(0,0,0,0.45)",
                          opacity: 1 - clamp(pt.blurStrengthAtTarget, 0, 1) * 0.7,
                        }}
                      />
                    ))}
                  </>
                );
              }

              // Fallback: previous hard-coded visuals for scenes without targets
              if (!sceneId || sceneId === "architecture-rise") {
                return (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: "18%",
                        top: "20%",
                        width: "20%",
                        height: "58%",
                        borderRadius: 8,
                        background:
                          "linear-gradient(180deg, rgba(148,163,184,0.95), rgba(71,85,105,0.92) 30%, rgba(15,23,42,0.9))",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "16%",
                        bottom: "18%",
                        width: "22%",
                        height: "18%",
                        borderRadius: 999,
                        background: "rgba(17,24,39,0.75)",
                        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.1)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${46 + riseMm * 0.4 + swingDeg * 0.5}%`,
                        top: `${36 - tiltDeg * 1.2}%`,
                        width: "10%",
                        height: "28%",
                        borderRadius: 6,
                        background: "rgba(248,250,252,0.92)",
                        boxShadow: "0 0 18px rgba(255,255,255,0.28)",
                      }}
                    />
                  </>
                );
              }

              return null;
            })()}
            {sceneId === "table-tilt" && (
              <>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(0deg, #78350f 0%, #b45309 60%, transparent 60%)",
                    opacity: 0.85,
                  }}
                />
                {/* Near Cup */}
                <div
                  style={{
                    position: "absolute",
                    left: "22%",
                    bottom: "22%",
                    width: "12%",
                    height: "22%",
                    borderRadius: "4px",
                    background: "linear-gradient(90deg, #60a5fa, #2563eb)",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                  }}
                />
                {/* Middle Notebook */}
                <div
                  style={{
                    position: "absolute",
                    left: "46%",
                    bottom: "34%",
                    width: "18%",
                    height: "14%",
                    transform: "rotate(-12deg)",
                    background: "#f59e0b",
                    borderRadius: "2px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
                  }}
                />
                {/* Far Book */}
                <div
                  style={{
                    position: "absolute",
                    right: "26%",
                    bottom: "44%",
                    width: "14%",
                    height: "10%",
                    background: "#a855f7",
                    borderRadius: "1px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </>
            )}
            {sceneId === "shelf-swing" && (
              <>
                {/* Diagonal shelf line representing the perspective board */}
                <div
                  style={{
                    position: "absolute",
                    left: "10%",
                    top: "52%",
                    width: "80%",
                    height: "4%",
                    transform: "rotate(14deg)",
                    background: "#475569",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                />
                {/* Near shelf item (orange block) */}
                <div
                  style={{
                    position: "absolute",
                    left: "22%",
                    top: "32%",
                    width: "11%",
                    height: "16%",
                    background: "#f97316",
                    borderRadius: "3px",
                    boxShadow: "0 3px 5px rgba(0,0,0,0.25)",
                  }}
                />
                {/* Middle shelf item (green block) */}
                <div
                  style={{
                    position: "absolute",
                    left: "48%",
                    top: "40%",
                    width: "9%",
                    height: "13%",
                    background: "#22c55e",
                    borderRadius: "3px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                />
                {/* Back shelf item (cyan block) */}
                <div
                  style={{
                    position: "absolute",
                    right: "26%",
                    top: "46%",
                    width: "7%",
                    height: "10%",
                    background: "#06b6d4",
                    borderRadius: "3px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                />
              </>
            )}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderLeft: "1px solid rgba(255,255,255,0.35)",
              left: "50%",
              transform: "translateX(-0.5px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderTop: "1px solid rgba(255,255,255,0.35)",
              top: "50%",
              transform: "translateY(-0.5px)",
            }}
          />
          {gridEnabled && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(to right, rgba(59,130,246,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.2) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at center, rgba(255,255,255,0) 0%, rgba(0,0,0,${blurOpacity}) 100%)`,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 11,
            background: "rgba(15,23,42,0.72)",
            color: "#e2e8f0",
          }}
        >
          {UI_COPY.render.groundGlassPreview}
        </div>
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 11,
            background: "rgba(15,23,42,0.72)",
            color: "#e2e8f0",
          }}
        >
          {focusDistanceLabel}
        </div>
        {sceneId !== "focus-fundamentals-two-targets" && (
          <div
            data-testid="ground-glass-focus-ring"
            style={{
              position: "absolute",
              left: `${projectedTargets[0] && projectedTargets[0].visible ? projectedTargets[0].leftPercent : 50 + swingDeg * 0.5}%`,
              top: `${projectedTargets[0] && projectedTargets[0].visible ? projectedTargets[0].topPercent : 50 - tiltDeg * 0.5}%`,
              display: projectedTargets[0] && projectedTargets[0].visible ? "block" : "none",
              width: focusRingSize,
              height: focusRingSize,
              marginLeft: -focusRingSize / 2,
              marginTop: -focusRingSize / 2,
              borderRadius: "50%",
              border: "2px solid rgba(59,130,246,0.7)",
              boxShadow: `0 0 0 10px rgba(59,130,246,${focusRingOpacity * 0.25})`,
              opacity: focusRingOpacity,
              pointerEvents: "none",
            }}
          />
        )}
        {focusAssist.enabled && (
          <span
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              fontSize: 12,
              color: "#1d4ed8",
              background: "rgba(255,255,255,0.85)",
              borderRadius: 4,
              padding: "2px 6px",
            }}
          >
            {UI_COPY.render.focusAssistBadge}
          </span>
        )}
      </div>
      <div style={{ display: "grid", gap: "0.25rem", fontSize: 12 }}>
        <strong>{UI_COPY.simulator.groundGlassCurrentSettings}</strong>
        <span>
          Rise {formatMillimeter(riseMm)} | Tilt {formatDegrees(tiltDeg)} | Swing {formatDegrees(swingDeg)}
        </span>
        <span>
          Focus {formatMillimeter(focusDistanceMm)} | Aperture f/{aperture}
        </span>
        <span>
          Quality {renderQuality} | Color target: {pipeline.colorTarget.widthPx}×{pipeline.colorTarget.heightPx} | Blur
          pass: {pipeline.blurPass.widthPx}×{pipeline.blurPass.heightPx}
        </span>
        <span>
          Color target: {pipeline.colorTarget.textureId}, Depth target: {pipeline.depthTarget.depthTextureId}
        </span>
        <span>
          Camera source: {pipeline.camera.source}, Blur pass: {pipeline.blurPass.widthPx}×
          {pipeline.blurPass.heightPx}, Scale {qualitySettings.groundGlassScale}
        </span>
      </div>

      {/* Thin-lens debug readout for the Focus Fundamentals scene */}
      {sceneId === "focus-fundamentals-two-targets" && (() => {
        const imgDist = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
        const vFov = verticalFovDegreesFromImageDistance(101.6, imgDist);
        const hFov = (2 * Math.atan(127 / (2 * imgDist))) * (180 / Math.PI);
        const focusW = focusPlaneWidthMm(127, focusDistanceMm, imgDist);
        const focusH = focusPlaneHeightMm(101.6, focusDistanceMm, imgDist);

        const nearZ = opticsState.depthOfFieldNearPlane.point.z;
        const farZ = opticsState.depthOfFieldFarPlane.point.z;

        const sceneDef = sceneId ? getSceneById(sceneId) : undefined;

        return (
          <div style={{ display: "grid", gap: "0.125rem", fontSize: 12, borderTop: "1px dashed #e5e7eb", paddingTop: "0.5rem" }}>
            <strong>Focus Fundamentals Debug</strong>
            <span>Focal length: {CAMERA_CONSTANTS.focalLengthMm} mm</span>
            <span>Aperture: f/{aperture}</span>
            <span>Focus distance: {formatMillimeter(focusDistanceMm)}</span>
            <span>Image distance: {imgDist.toFixed(2)} mm</span>
            <span>Sensor: {CAMERA_CONSTANTS.filmWidthMm} × {CAMERA_CONSTANTS.filmHeightMm} mm</span>
            <span>Vertical FOV: {vFov.toFixed(3)}° | Horizontal FOV: {hFov.toFixed(3)}°</span>
            <span>Focus plane dims: {focusW.toFixed(2)} × {focusH.toFixed(2)} mm</span>
            <span>DOF near Z: {nearZ.toFixed(2)} mm | DOF far Z: {farZ.toFixed(2)} mm</span>
            {sceneDef?.focusTargets.map((t) => {
              const coc = cocDiameterMm(CAMERA_CONSTANTS.focalLengthMm, aperture as number, imgDist, t.worldPosition.z);
              return (
                <span key={t.id}>{t.id}: axial depth {t.worldPosition.z} mm | CoC {coc.toFixed(3)} mm</span>
              );
            })}
          </div>
        );
      })()}
      {focusAssist.enabled && (
        <div style={{ display: "grid", gap: "0.25rem", fontSize: 12 }}>
          <strong>{UI_COPY.simulator.groundGlassFocusTargets}</strong>
          {focusAssist.targets.map((target) => (
            <span key={target.id}>
              {statusPatternGlyph[target.pattern]} {target.id} — {target.sharpnessPercent}% ({statusLabelMap[target.status]
              })
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
