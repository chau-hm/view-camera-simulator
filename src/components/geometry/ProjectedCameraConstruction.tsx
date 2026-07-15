import type { PlaneSegment, ScreenPoint } from "./opticalSectionProjection";

type ProjectedCameraConstructionProps = {
  physicalPlaneSegments: PlaneSegment[];
  filmCenter: ScreenPoint;
  lensCenter: ScreenPoint;
  displayMode?: "compact" | "construction";
};

const segmentFor = (segments: PlaneSegment[], id: "physical-film" | "physical-lens") =>
  segments.find((segment) => segment.id === id);

/**
 * A projection-derived camera glyph shared by Side, Top, and Scheimpflug sections.
 * Styling changes by display mode; segment geometry always comes from the active
 * section's physical film/lens plane projections.
 */
export const ProjectedCameraConstruction = ({
  physicalPlaneSegments,
  filmCenter,
  lensCenter,
  displayMode = "compact",
}: ProjectedCameraConstructionProps) => {
  const filmSegment = segmentFor(physicalPlaneSegments, "physical-film");
  const lensSegment = segmentFor(physicalPlaneSegments, "physical-lens");
  if (!filmSegment || !lensSegment) return null;

  const segmentWidth = displayMode === "construction" ? 5 : 4;
  const markerRadius = displayMode === "construction" ? 4 : 3;

  return (
    <g
      data-testid="projected-camera-construction"
      data-camera-display-mode={displayMode}
    >
      <line
        data-testid="physical-bellows-connector"
        x1={filmCenter.x}
        y1={filmCenter.y}
        x2={lensCenter.x}
        y2={lensCenter.y}
        stroke="#94a3b8"
        strokeWidth={2}
        strokeDasharray="4 3"
        aria-label="Simplified bellows connector"
      />
      {[filmSegment, lensSegment].map((segment) => (
        <line
          key={segment.id}
          data-testid={`${segment.id}-segment`}
          x1={segment.p1.x}
          y1={segment.p1.y}
          x2={segment.p2.x}
          y2={segment.p2.y}
          stroke={segment.color}
          strokeWidth={segmentWidth}
          strokeLinecap="round"
        />
      ))}
      <circle
        data-testid="physical-film-centre"
        cx={filmCenter.x}
        cy={filmCenter.y}
        r={markerRadius}
        fill="none"
        stroke={filmSegment.color}
        strokeWidth={2}
      />
      <circle
        data-testid="physical-lens-centre"
        cx={lensCenter.x}
        cy={lensCenter.y}
        r={markerRadius}
        fill="none"
        stroke={lensSegment.color}
        strokeWidth={2}
      />
    </g>
  );
};

export default ProjectedCameraConstruction;
