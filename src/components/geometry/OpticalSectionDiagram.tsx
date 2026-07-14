import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import type { GeometryPresentationProfile } from "./geometryPresentationProfiles";
import {
  buildDofPolygonPoints,
  type OpticalSectionData,
  type PlaneSegment,
} from "./opticalSectionProjection";
import { getLocalTargetLabelPlacement } from "./labelPlacement";

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

        {profile.showTabletopGuide && geometryView === "side" && scene.compositionTargets[0]
          ? (() => {
              const subjectBounds = scene.compositionTargets[0].worldBounds;
              const tabletopY = (subjectBounds.min.y + subjectBounds.max.y) / 2;
              const near = view.projectWorldPoint({ x: 0, y: tabletopY, z: subjectBounds.min.z });
              const far = view.projectWorldPoint({ x: 0, y: tabletopY, z: subjectBounds.max.z });
              return (
                <g data-testid="tabletop-guide">
                  <line
                    x1={near.x}
                    y1={near.y}
                    x2={far.x}
                    y2={far.y}
                    stroke="#92400e"
                    strokeWidth={3}
                  />
                  <text
                    x={far.x - 4}
                    y={far.y + 18}
                    fontSize={12}
                    fill="#78350f"
                    textAnchor="end"
                  >
                    Tabletop
                  </text>
                </g>
              );
            })()
          : null}

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

        {geometryView === "scheimpflug" && showCameraConstruction
          ? view.physicalPlaneSegments.map((segment) => (
              <g key={segment.id} data-testid={`plane-line-${segment.id}`}>
                <line
                  data-testid={`scheimpflug-${segment.id}-segment`}
                  x1={segment.p1.x}
                  y1={segment.p1.y}
                  x2={segment.p2.x}
                  y2={segment.p2.y}
                  stroke={segment.color}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
              </g>
            ))
          : null}

        {geometryView === "scheimpflug" && showCameraConstruction ? (() => {
          const filmCenter = view.projectWorldPoint(opticsState.filmCenterWorld);
          const lensCenter = view.projectWorldPoint(opticsState.lensCenterWorld);
          return (
            <g data-testid="scheimpflug-camera-construction">
              <line
                x1={filmCenter.x}
                y1={filmCenter.y}
                x2={lensCenter.x}
                y2={lensCenter.y}
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="4 3"
                aria-label="Simplified bellows connector"
              />
              <circle data-testid="scheimpflug-film-centre" cx={filmCenter.x} cy={filmCenter.y} r={4} fill="#0284c7" />
              <circle data-testid="scheimpflug-lens-centre" cx={lensCenter.x} cy={lensCenter.y} r={4} fill="#334155" />
            </g>
          );
        })() : null}

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

        {geometryView !== "scheimpflug" && displayMode !== "subject-field" ? (() => {
          const filmSegment = segments.find((segment) => segment.id === "film");
          const filmCenter = filmSegment
            ? {
                x: (filmSegment.p1.x + filmSegment.p2.x) / 2,
                y: (filmSegment.p1.y + filmSegment.p2.y) / 2,
              }
            : view.projectWorldPoint(opticsState.filmCenterWorld);
          const lensCenter = view.projectWorldPoint(opticsState.lensCenterWorld);
          const rearWidth = geometryView === "top" ? 8 : 12;
          const rearHeight = geometryView === "top" ? 24 : 28;
          const frontWidth = geometryView === "top" ? 10 : 14;
          const frontHeight = geometryView === "top" ? 28 : 32;
          return (
            <g data-testid="generic-camera-glyphs">
              <rect
                x={filmCenter.x - rearWidth / 2}
                y={filmCenter.y - rearHeight / 2}
                width={rearWidth}
                height={rearHeight}
                fill="#1f2937"
                opacity={0.9}
              />
              <rect
                x={lensCenter.x - frontWidth / 2}
                y={lensCenter.y - frontHeight / 2}
                width={frontWidth}
                height={frontHeight}
                fill="#475569"
                opacity={0.95}
              />
              {geometryView === "top" ? (
                <circle cx={lensCenter.x} cy={lensCenter.y} r={4} fill="#111827" opacity={0.9} />
              ) : null}
            </g>
          );
        })() : null}

        {showSubjectTargets ? scene.focusTargets.map((target) => {
          const position = view.projectWorldPoint(target.worldPosition);
          const labelText =
            scene.id === "table-tilt"
              ? target.id === "near-cup"
                ? "Near card"
                : target.id === "mid-notebook"
                  ? "Middle notebook"
                  : "Far chart"
              : /near/i.test(target.id)
                ? "Near board"
                : /far/i.test(target.id)
                  ? "Far board"
                  : "Target";
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
