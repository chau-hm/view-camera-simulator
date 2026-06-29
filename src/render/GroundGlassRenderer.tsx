type GroundGlassRendererProps = {
  assistEnabled: boolean;
};

export const GroundGlassRenderer = ({ assistEnabled }: GroundGlassRendererProps) => {
  const transform = assistEnabled ? "none" : "scale(-1, -1)";
  return (
    <div
      style={{
        height: 180,
        border: "1px solid #d1d5db",
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        transform,
      }}
    >
      Ground glass preview
    </div>
  );
};
