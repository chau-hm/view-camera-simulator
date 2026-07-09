import type { ReactNode } from "react";
import { UI_COPY } from "../ui/copy";
import { formatMillimeter } from "../utils/formatters";

export type GroundGlassOverlaysProps = {
  gridEnabled: boolean;
  rawDebug?: boolean;
  isFocusFundamentals: boolean;
  blurOpacity: number;
  isInfinityFocus: boolean;
  lastFiniteFocusDepthMm?: number;
  focusDistanceLabel: string;
  focusAssistVisible: boolean;
};

export const GroundGlassTransformedOverlays = ({ gridEnabled, rawDebug, isFocusFundamentals, blurOpacity }: { gridEnabled: boolean; rawDebug?: boolean; isFocusFundamentals: boolean; blurOpacity: number }): ReactNode | null => {
  return (
    <>
      {!rawDebug && (
        <>
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
        </>
      )}

      {gridEnabled && !rawDebug && (
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

      {!(isFocusFundamentals || rawDebug) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at center, rgba(255,255,255,0) 0%, rgba(0,0,0,${blurOpacity}) 100%)`,
          }}
        />
      )}
    </>
  );
};

export const GroundGlassFixedOverlays = ({
  isInfinityFocus,
  lastFiniteFocusDepthMm,
  focusDistanceLabel,
  focusAssistVisible,
}: {
  isInfinityFocus: boolean;
  lastFiniteFocusDepthMm?: number;
  focusDistanceLabel: string;
  focusAssistVisible: boolean;
}): ReactNode | null => {
  return (
    <>
      <div
        style={{
          position: "absolute",
          bottom: 8,
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
        {isInfinityFocus ? (
          <div>
            <div>∞ focus</div>
            {lastFiniteFocusDepthMm && (
              <div style={{ fontSize: 10, color: "#94a3b8" }}>Last finite focus: {formatMillimeter(lastFiniteFocusDepthMm)}</div>
            )}
          </div>
        ) : (
          <div>{focusDistanceLabel}</div>
        )}
      </div>

      {focusAssistVisible && (
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
    </>
  );
};
