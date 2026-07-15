import type { ProjectedGroundGlassTarget } from "./groundGlassTargetProjection";

export type GroundGlassFocusRingProps = {
  sceneId?: string;
  primaryProjectedTarget: ProjectedGroundGlassTarget | null;
  focusRingSize: number;
  focusRingOpacity: number;
  swingDeg: number;
  tiltDeg: number;
};

export const GroundGlassFocusRing = ({ sceneId, primaryProjectedTarget, focusRingSize, focusRingOpacity, swingDeg, tiltDeg }: GroundGlassFocusRingProps) => {
  if (sceneId === "focus-fundamentals-two-targets" || sceneId === "table-tilt") return null;
  const left = primaryProjectedTarget && primaryProjectedTarget.visible ? `${primaryProjectedTarget.leftPercent}%` : `${50 + swingDeg * 0.5}%`;
  const top = primaryProjectedTarget && primaryProjectedTarget.visible ? `${primaryProjectedTarget.topPercent}%` : `${50 - tiltDeg * 0.5}%`;
  const display = primaryProjectedTarget && primaryProjectedTarget.visible ? "block" : "none";

  return (
    <div
      data-testid="ground-glass-focus-ring"
      style={{
        position: "absolute",
        left,
        top,
        display,
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
  );
};
