import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { GeometryPresentationProfile } from "./geometryPresentationProfiles";
import {
  buildDofPolygonPoints,
  type OpticalSectionData,
  type PlaneSegment,
} from "./opticalSectionProjection";
import {
  getGeometryGuideLabelPlacement,
  getLocalTargetLabelPlacement,
} from "./labelPlacement";
import { ProjectedCameraConstruction } from "./ProjectedCameraConstruction";
import {
  getSceneGeometryGuides,
  getSceneGeometryTargetLabel,
} from "./sceneGeometryGuides";

type Props = {
  projection: OpticalSectionData;
  geometryView: GeometryView;
  profile: GeometryPresentationProfile;
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  svgWidth: number;
  svgHeight: number;
  displayMode?: "full" | "camera-construction" | "subject-field";
};

const planeTeachingLabel = (segment: PlaneSegment): string | null => {
  if (segment.id === "film") return "Film plane (extended)";
  if (segment.id === "lens") return "Lens plane (extended)";
  if (segment.id === "focus") return "Plane of sharp focus (extended)";
  return null;
};

export const OpticalSectionDiagram = ({
  projection,
  geometryView,
  profile,
  scene,
  opticsState,
  svgWidth,
  svgHeight,
  displayMode = "full",
}: Props) => {
  const view = projection.views[geometryView];
  const segments = view.planeSegments;
  const visibleSegments =
    displayMode === "subject-field"
      ? segments.filter((segment) => ["focus", "nearDof", "farDof"].includes(segment.id))
      : segments;
  const showCameraConstruction = displayMode !== "subject-field";
  const showSubjectTargets = displayMode === "subject-field" || geometryView !== "scheimpflug";
  const { isInfinity } = projection;
  const safeMargin = 10;
  const filmCenter = view.projectWorldPoint(opticsState.filmCenterWorld);
  const lensCenter = view.projectWorldPoint(opticsState.lensCenterWorld);
  const subjectGuides =
    displayMode === "camera-construction"
      ? []
      : getSceneGeometryGuides(scene.id).filter((guide) => guide.view === geometryView);

  return (
    <svg
      data-testid={`geometry-svg-${geometryView}`}
      data-display-mode={displayMode}
      data-projection-linear="true"
      data-depth-min-mm={projection.diagramMinDepthMm}
      data-depth-max-mm={projection.diagramMaxDepthMm}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      width="100%"
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 8,
        background: "#f8fafc",
      }}
    >
      <g>
        {showCameraConstruction ? view.fovSegments.map((segment, index) => (
          <line
            key={`fov-${index}`}
            x1={segment.p1.x}
            y1={segment.p1.y}
            x2={segment.p2.x}
            y2={segment.p2.y}
            stroke="#f59e0b"
            strokeWidth={1}
            opacity={0.85}
          />
        )) : null}

        {view.opticalAxisSegment ? (() => {
          const { p1, p2 } = view.opticalAxisSegment;
          const labelX = p1.x + (p2.x - p1.x) * (scene.id === "table-tilt" ? 0.12 : 0.03);
          const labelY = p1.y + (p2.y - p1.y) * (scene.id === "table-tilt" ? 0.12 : 0.03) - 8;
          return (
            <g>
              <line
                data-testid="optical-axis-line"
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="#f59e0b"
                strokeWidth={1.2}
                strokeDasharray="6 4"
                opacity={0.95}
              />
              {profile.showOpticalAxisLabel ? (
                <text x={labelX} y={labelY} fontSize={11} fill="#b45309">
                  Optical axis
                </text>
              ) : null}
            </g>
          );
        })() : null}

        {subjectGuides.map((guide) => {
          const start = view.projectWorldPoint(guide.startWorld);
          const end = view.projectWorldPoint(guide.endWorld);
          const labelPlacement = getGeometryGuideLabelPlacement({
            start,
            end,
            positionT: guide.labelPositionT,
            offsetPx: guide.labelOffsetPx,
            anchor: guide.labelAnchor,
            text: guide.label,
            svgWidth,
            svgHeight,
            safeMargin,
          });
          return (
            <g key={guide.id} data-testid={guide.testId} data-geometry-guide-id={guide.id}>
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={guide.color}
                strokeWidth={3}
              />
              <text
                data-testid={`${guide.testId}-label`}
                data-guide-label-position-t={labelPlacement.positionT}
                x={labelPlacement.x}
                y={labelPlacement.y}
                fontSize={12}
                fontWeight={600}
                fill={guide.color}
                textAnchor={labelPlacement.anchor}
              >
                {guide.label}
              </text>
            </g>
          );
        })}

        {!isInfinity && opticsState.depthOfFieldNearPlane && opticsState.depthOfFieldFarPlane
          ? (() => {
              const near = segments.find((segment) => segment.id === "nearDof");
              const far = segments.find((segment) => segment.id === "farDof");
              if (!near || !far) return null;
              const points = buildDofPolygonPoints(near, far)
                .map((point) => `${point.x},${point.y}`)
                .join(" ");
              return (
                <polygon
                  data-testid="dof-region"
                  points={points}
                  fill="#8b5cf6"
                  opacity={profile.dofFillOpacity}
                  stroke="#8b5cf6"
                />
              );
            })()
          : null}

        {visibleSegments.map((segment) => {
          const extensionTestId =
            geometryView === "scheimpflug" && segment.id === "film"
              ? "scheimpflug-film-extension"
              : geometryView === "scheimpflug" && segment.id === "lens"
                ? "scheimpflug-lens-extension"
                : undefined;
          return (
            <g key={segment.id} data-testid={extensionTestId}>
              <line
                x1={segment.p1.x}
                y1={segment.p1.y}
                x2={segment.p2.x}
                y2={segment.p2.y}
                stroke={segment.color}
                strokeWidth={geometryView === "scheimpflug" && ["film", "lens", "focus"].includes(segment.id) ? 2.5 : 2}
                strokeDasharray={
                  geometryView === "scheimpflug" && ["film", "lens", "focus"].includes(segment.id)
                    ? "7 5"
                    : segment.id === "focus"
                      ? "6 4"
                      : undefined
                }
                aria-label={`${segment.id} plane`}
                data-testid={
                  segment.id === "film"
                    ? "plane-line-film"
                    : segment.id === "lens"
                      ? "plane-line-lens"
                      : segment.id === "focus"
                        ? "plane-line-focus"
                        : undefined
                }
              />
            </g>
          );
        })}

        {showCameraConstruction ? (
          <ProjectedCameraConstruction
            physicalPlaneSegments={view.physicalPlaneSegments}
            filmCenter={filmCenter}
            lensCenter={lensCenter}
            displayMode={geometryView === "scheimpflug" ? "construction" : "compact"}
          />
        ) : null}

        {geometryView === "scheimpflug" && showCameraConstruction
          ? visibleSegments.map((segment) => {
              const label = planeTeachingLabel(segment);
              if (!label) return null;
              const right = segment.p1.x >= segment.p2.x ? segment.p1 : segment.p2;
              const labelY =
                segment.id === "focus"
                  ? Math.min(svgHeight - safeMargin, right.y + 18)
                  : Math.max(safeMargin + 10, right.y - 8);
              return (
                <text
                  key={`${segment.id}-teaching-label`}
                  x={Math.min(svgWidth - safeMargin, right.x - 5)}
                  y={labelY}
                  fontSize={11}
                  fontWeight={600}
                  fill={segment.color}
                  textAnchor="end"
                >
                  {label}
                </text>
              );
            })
          : null}

        {scene.id === "table-tilt" && geometryView === "side"
          ? (() => {
              const focus = segments.find((segment) => segment.id === "focus");
              if (!focus) return null;
              const left = focus.p1.x < focus.p2.x ? focus.p1 : focus.p2;
              const maxX = Math.max(focus.p1.x, focus.p2.x);
              return (
                <text
                  x={left.x + Math.min(120, (maxX - left.x) * 0.15)}
                  y={left.y - 10}
                  fontSize={12}
                  fontWeight={600}
                  fill="#15803d"
                >
                  Focus plane
                </text>
              );
            })()
          : null}

        {showSubjectTargets ? scene.focusTargets.map((target) => {
          const position = view.projectWorldPoint(target.worldPosition);
          const labelText = getSceneGeometryTargetLabel(scene.id, target.id);
          const placement = getLocalTargetLabelPlacement({
            targetX: position.x,
            targetY: position.y,
            text: labelText,
            svgWidth,
            svgHeight,
            safeMargin,
          });
          if (geometryView === "side") {
            return (
              <g key={target.id} data-testid={`geometry-target-${target.id}`}>
                <rect x={position.x - 6} y={position.y - 20} width={12} height={16} fill="#0f766e" />
                <rect x={position.x - 2} y={position.y - 4} width={4} height={8} fill="#6b7280" />
                {profile.targetLabelMode === "short-local" ? (
                  <text
                    x={placement.x}
                    y={placement.y}
                    fontSize={12}
                    fill="#064e3b"
                    textAnchor={placement.anchor}
                  >
                    {labelText}
                  </text>
                ) : null}
              </g>
            );
          }
          return (
            <g key={target.id} data-testid={`geometry-target-${target.id}`}>
              <rect x={position.x - 3} y={position.y - 9} width={6} height={18} fill="#0f766e" />
              <line
                x1={position.x}
                y1={position.y + 9}
                x2={position.x}
                y2={position.y + 13}
                stroke="#0b5e54"
                strokeWidth={1}
              />
              {profile.targetLabelMode === "short-local" ? (
                <text
                  x={placement.x}
                  y={placement.y}
                  fontSize={12}
                  fill="#064e3b"
                  textAnchor={placement.anchor}
                >
                  {labelText}
                </text>
              ) : null}
            </g>
          );
        }) : null}

        {!isInfinity && opticsState.focusPlane ? (() => {
          const point = view.projectWorldPoint(opticsState.focusPlane.point);
          return <circle cx={point.x} cy={point.y} r={4} fill="#dc2626" />;
        })() : null}

        {profile.showScheimpflugIntersection &&
        geometryView === "scheimpflug" &&
        view.scheimpflugIntersection
          ? (() => {
              const point = view.scheimpflugIntersection!;
              return (
                <g data-testid="scheimpflug-intersection">
                  <circle cx={point.x} cy={point.y} r={5} fill="#7c3aed" />
                  <text x={point.x + 9} y={point.y - 9} fontSize={11} fontWeight={600} fill="#6d28d9">
                    Scheimpflug intersection
                  </text>
                </g>
              );
            })()
          : null}
      </g>
    </svg>
  );
};

export default OpticalSectionDiagram;
