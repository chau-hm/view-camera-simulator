import type { ProjectedGroundGlassTarget } from "./groundGlassTargetProjection";

export type LegacyGroundGlassSceneProps = {
  sceneId?: string;
  sceneHasFocusTargets: boolean;
  projectedTargets: ProjectedGroundGlassTarget[];
  blurRadiusPx: number;
  sceneShiftX: number;
  sceneShiftY: number;
  sceneRotationDeg: number;
  focusScale: number;
  riseMm: number;
  tiltDeg: number;
  swingDeg: number;
};

export const LegacyGroundGlassScene = ({
  sceneId,
  sceneHasFocusTargets,
  projectedTargets,
  blurRadiusPx,
  sceneShiftX,
  sceneShiftY,
  sceneRotationDeg,
  focusScale,
  riseMm,
  tiltDeg,
  swingDeg,
}: LegacyGroundGlassSceneProps) => {
  return (
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
        willChange: "transform",
      }}
    >
      {sceneHasFocusTargets && projectedTargets.length > 0 ? (
        <>
          {projectedTargets.map((pt) => (
            <div
              key={pt.id}
              data-testid={`ground-glass-target-${pt.id}`}
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
                opacity: 1 - Math.max(0, Math.min(1, pt.blurStrengthAtTarget)) * 0.7,
              }}
            />
          ))}
        </>
      ) : !sceneId || sceneId === "architecture-rise" ? (
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
      ) : null}

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
  );
};
