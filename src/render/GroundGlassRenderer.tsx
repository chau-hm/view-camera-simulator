import { useEffect, useMemo, useRef, useState } from "react";
import type { ApertureValue } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type { RenderQualityProfile } from "../types/ui";
import { UI_COPY } from "../ui/copy";
import { formatDegrees, formatMillimeter } from "../utils/formatters";
import { createFocusAssistPass } from "./postprocessing/FocusAssistPass";
import { createGroundGlassDofPipeline } from "./groundGlassPipeline";
import { createDepthOfFieldPass } from "./postprocessing/DepthOfFieldPass";
import { getRenderQualitySettings } from "./renderQuality";
import { formatPerformanceSample } from "../utils/performance";

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
  onFrameRateSample?: (sampleFps: number) => void;
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
  onFrameRateSample,
}: GroundGlassRendererProps) => {
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState<{ xPercent: number; yPercent: number }>({
    xPercent: 50,
    yPercent: 50,
  });
  const [frameRate, setFrameRate] = useState<number | null>(null);
  const frameRateSampleCallbackRef = useRef(onFrameRateSample);
  const projection = opticsState.groundGlassProjection;
  const invertHorizontal = assistEnabled ? false : projection.invertHorizontal;
  const invertVertical = assistEnabled ? false : projection.invertVertical;
  const scaleX = invertHorizontal ? -1 : 1;
  const scaleY = invertVertical ? -1 : 1;
  const transform = `scale(${scaleX}, ${scaleY})`;
  const pipeline = useMemo(
    () => createGroundGlassDofPipeline(opticsState, PANEL_WIDTH_PX, PANEL_HEIGHT_PX, renderQuality),
    [opticsState, renderQuality],
  );
  const qualitySettings = useMemo(() => getRenderQualitySettings(renderQuality), [renderQuality]);
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
  useEffect(() => {
    frameRateSampleCallbackRef.current = onFrameRateSample;
  }, [onFrameRateSample]);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      return undefined;
    }

    let frameCount = 0;
    let sampleStart = 0;
    let rafId = 0;

    const loop = (time: number) => {
      if (sampleStart === 0) {
        sampleStart = time;
      }

      frameCount += 1;
      const elapsed = time - sampleStart;
      if (elapsed >= 500) {
        const fps = (frameCount * 1000) / elapsed;
        setFrameRate(fps);
        frameRateSampleCallbackRef.current?.(fps);
        frameCount = 0;
        sampleStart = time;
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const blurOpacity = Math.min(0.85, dofSample.blurStrength * 1.2);
  const backgroundPositionY = `${pipeline.verticalFrameOffsetPx}px`;
  const zoomScale = zoomEnabled ? 1.9 : 1;

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
            background:
              "linear-gradient(160deg, rgba(15,23,42,0.95), rgba(71,85,105,0.92) 50%, rgba(15,23,42,0.95))",
            backgroundPositionY,
            transform,
            transformOrigin: "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoomScale})`,
            transformOrigin: `${zoomOrigin.xPercent}% ${zoomOrigin.yPercent}%`,
          }}
        >
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
        <span>{UI_COPY.performance.groundGlassFpsLabel}: {formatPerformanceSample(frameRate, "FPS")}</span>
      </div>
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
