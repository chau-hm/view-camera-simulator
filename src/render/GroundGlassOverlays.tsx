import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "../i18n";
import { simulatorMessageKeys } from "../i18n/simulatorMessageKeys";
import { formatMillimeter } from "../utils/formatters";
import type { GroundGlassPhysicalGrid } from "./groundGlassPhysicalGrid";

export const GroundGlassTransformedOverlays = ({
  gridEnabled,
  rawDebug,
  physicalGrid,
}: {
  gridEnabled: boolean;
  rawDebug?: boolean;
  /** Optional physical film grid; absent preserves the legacy decorative grid. */
  physicalGrid?: GroundGlassPhysicalGrid | null;
}): ReactNode | null => {
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
          data-testid="ground-glass-grid"
          data-grid-mode={physicalGrid ? "physical" : "decorative"}
          data-grid-spacing-x-px={physicalGrid?.spacingXPx}
          data-grid-spacing-y-px={physicalGrid?.spacingYPx}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(to right, rgba(59,130,246,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.2) 1px, transparent 1px)",
            backgroundSize: physicalGrid
              ? `${physicalGrid.spacingXPx}px ${physicalGrid.spacingYPx}px`
              : "20px 20px",
            backgroundPosition: physicalGrid
              ? `${physicalGrid.originXPx}px ${physicalGrid.originYPx}px`
              : undefined,
            backgroundRepeat: "repeat",
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
  scaleCue,
}: {
  isInfinityFocus: boolean;
  lastFiniteFocusDepthMm?: number;
  focusDistanceLabel: string;
  scaleCue?: string;
}): ReactNode | null => {
  const { t } = useTranslation();

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
        {t(simulatorMessageKeys.focusOverlay.preview)}
      </div>

      <div
        data-testid="ground-glass-focus-label"
        className="groundglass-focus-label"
        style={{
          position: "absolute",
          top: 48,
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
            <div>{t(simulatorMessageKeys.focusOverlay.infinity)}</div>
            {lastFiniteFocusDepthMm && (
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                {t(simulatorMessageKeys.focusOverlay.lastFinite, { distance: formatMillimeter(lastFiniteFocusDepthMm) })}
              </div>
            )}
          </div>
        ) : (
          <div>{focusDistanceLabel}</div>
        )}
      </div>

      {scaleCue ? <div data-testid="ground-glass-scale-cue" className="groundglass-scale-cue">{scaleCue}</div> : null}

    </>
  );
};
