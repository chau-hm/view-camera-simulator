import type { GeometryView } from "../../types/camera";
import type { Bounds3, Plane, Vec3 } from "../../types/optics";
import { planeLineWorldEndpoints, worldToDiagramPoint } from "./diagramHelpers";

type PrimitiveSharedProps = {
  view: GeometryView;
  bounds: Bounds3;
  width: number;
  height: number;
};

type PlaneLineProps = PrimitiveSharedProps & {
  plane: Plane;
  stroke: string;
  dashed?: boolean;
  testId?: string;
};

export const PlaneLine = ({ plane, stroke, dashed = false, testId, ...shared }: PlaneLineProps) => {
  const line = planeLineWorldEndpoints(plane, shared.view, shared.bounds);
  const start = worldToDiagramPoint(line.start, shared.view, shared.bounds, shared.width, shared.height);
  const end = worldToDiagramPoint(line.end, shared.view, shared.bounds, shared.width, shared.height);
  const tid = testId ?? `plane-line`;

  return (
    <g>
      <line
        data-testid={tid}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={dashed ? "6 4" : undefined}
      />
    </g>
  );
};

type RayLineProps = PrimitiveSharedProps & {
  start: Vec3;
  end: Vec3;
  stroke: string;
};

export const RayLine = ({ start, end, stroke, ...shared }: RayLineProps) => {
  const startPoint = worldToDiagramPoint(start, shared.view, shared.bounds, shared.width, shared.height);
  const endPoint = worldToDiagramPoint(end, shared.view, shared.bounds, shared.width, shared.height);

  return (
    <g>
      <line x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
};

type PointMarkerProps = PrimitiveSharedProps & {
  point: Vec3;
  fill: string;
};

export const PointMarker = ({ point, fill, ...shared }: PointMarkerProps) => {
  const p = worldToDiagramPoint(point, shared.view, shared.bounds, shared.width, shared.height);
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={4} fill={fill} />
    </g>
  );
};

type RegionProps = PrimitiveSharedProps & {
  nearPlane: Plane;
  farPlane: Plane;
  fill: string;
};

export const Region = ({ nearPlane, farPlane, fill, ...shared }: RegionProps) => {
  const near = planeLineWorldEndpoints(nearPlane, shared.view, shared.bounds);
  const far = planeLineWorldEndpoints(farPlane, shared.view, shared.bounds);
  const points = [
    worldToDiagramPoint(near.start, shared.view, shared.bounds, shared.width, shared.height),
    worldToDiagramPoint(near.end, shared.view, shared.bounds, shared.width, shared.height),
    worldToDiagramPoint(far.end, shared.view, shared.bounds, shared.width, shared.height),
    worldToDiagramPoint(far.start, shared.view, shared.bounds, shared.width, shared.height),
  ];
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <g>
      <polygon points={pointString} fill={fill} fillOpacity={0.15} stroke={fill} strokeDasharray="4 3" />
    </g>
  );
};

type DiagramLegendProps = {
  isInfinity?: boolean;
  hasNearDof?: boolean;
  hasFarDof?: boolean;
  hasTargets?: boolean;
};

export const DiagramLegend = ({ isInfinity = false, hasNearDof = false, hasFarDof = false, hasTargets = false }: DiagramLegendProps) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ width: 12, height: 12, background: "#0284c7", display: "inline-block", borderRadius: 2 }} />
      <span>Film datum</span>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ width: 12, height: 12, background: "#475569", display: "inline-block", borderRadius: 2 }} />
      <span>Lens plane</span>
    </div>
    {!isInfinity && (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 12, height: 12, background: "#16a34a", display: "inline-block", borderRadius: 2 }} />
        <span>Focus plane</span>
      </div>
    )}
    {hasNearDof && (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 12, height: 12, background: "#0284c7", display: "inline-block", borderRadius: 2 }} />
        <span>DOF limit</span>
      </div>
    )}
    {hasFarDof && !isInfinity && (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 12, height: 12, background: "#8b5cf6", display: "inline-block", borderRadius: 2 }} />
        <span>Far DOF</span>
      </div>
    )}
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ width: 12, height: 12, background: "#f59e0b", display: "inline-block", borderRadius: 2 }} />
      <span>Optical axis</span>
    </div>
    {hasTargets && (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ width: 12, height: 12, background: "#0f766e", display: "inline-block", borderRadius: 2 }} />
        <span>Focus targets</span>
      </div>
    )}
  </div>
);
