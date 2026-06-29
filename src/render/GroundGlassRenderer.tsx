type GroundGlassRendererProps = {
  assistEnabled: boolean;
  focusAssistEnabled: boolean;
  gridEnabled: boolean;
};

export const GroundGlassRenderer = ({ assistEnabled, focusAssistEnabled, gridEnabled }: GroundGlassRendererProps) => {
  const transform = assistEnabled ? "none" : "scale(-1, -1)";
  return (
    <div
      style={{
        position: "relative",
        height: 180,
        border: "1px solid #d1d5db",
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        backgroundImage: gridEnabled
          ? "linear-gradient(to right, rgba(59,130,246,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.2) 1px, transparent 1px)"
          : "none",
        backgroundSize: gridEnabled ? "20px 20px" : "auto",
        transform,
      }}
    >
      Ground glass preview
      {focusAssistEnabled && (
        <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 12, color: "#1d4ed8" }}>Focus assist</span>
      )}
    </div>
  );
};
