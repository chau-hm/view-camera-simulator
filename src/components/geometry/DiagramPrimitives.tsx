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
  label: string;
  stroke: string;
  dashed?: boolean;
};

export const PlaneLine = ({ plane, label, stroke, dashed = false, ...shared }: PlaneLineProps) => {
  const line = planeLineWorldEndpoints(plane, shared.view, shared.bounds);
  const start = worldToDiagramPoint(line.start, shared.view, shared.bounds, shared.width, shared.height);
  const end = worldToDiagramPoint(line.end, shared.view, shared.bounds, shared.width, shared.height);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <text x={mid.x + 6} y={mid.y - 6} fontSize={11} fill={stroke}>
        {label}
      </text>
    </g>
  );
};

type RayLineProps = PrimitiveSharedProps & {
  start: Vec3;
  end: Vec3;
  label: string;
  stroke: string;
};

export const RayLine = ({ start, end, label, stroke, ...shared }: RayLineProps) => {
  const startPoint = worldToDiagramPoint(start, shared.view, shared.bounds, shared.width, shared.height);
  const endPoint = worldToDiagramPoint(end, shared.view, shared.bounds, shared.width, shared.height);
  const mid = { x: (startPoint.x + endPoint.x) / 2, y: (startPoint.y + endPoint.y) / 2 };

  return (
    <g>
      <line x1={startPoint.x} y1={startPoint.y} x2={endPoint.x} y2={endPoint.y} stroke={stroke} strokeWidth={1.5} />
      <text x={mid.x + 6} y={mid.y + 10} fontSize={10} fill={stroke}>
        {label}
      </text>
    </g>
  );
};

type PointMarkerProps = PrimitiveSharedProps & {
  point: Vec3;
  label: string;
  fill: string;
};

export const PointMarker = ({ point, label, fill, ...shared }: PointMarkerProps) => {
  const p = worldToDiagramPoint(point, shared.view, shared.bounds, shared.width, shared.height);
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={4} fill={fill} />
      <text x={p.x + 6} y={p.y - 6} fontSize={10} fill={fill}>
        {label}
      </text>
    </g>
  );
};

type RegionProps = PrimitiveSharedProps & {
  nearPlane: Plane;
  farPlane: Plane;
  fill: string;
  label: string;
};

export const Region = ({ nearPlane, farPlane, fill, label, ...shared }: RegionProps) => {
  const near = planeLineWorldEndpoints(nearPlane, shared.view, shared.bounds);
  const far = planeLineWorldEndpoints(farPlane, shared.view, shared.bounds);
  const points = [
    worldToDiagramPoint(near.start, shared.view, shared.bounds, shared.width, shared.height),
    worldToDiagramPoint(near.end, shared.view, shared.bounds, shared.width, shared.height),
    worldToDiagramPoint(far.end, shared.view, shared.bounds, shared.width, shared.height),
    worldToDiagramPoint(far.start, shared.view, shared.bounds, shared.width, shared.height),
  ];
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 },
  );

  return (
    <g>
      <polygon points={pointString} fill={fill} fillOpacity={0.15} stroke={fill} strokeDasharray="4 3" />
      <text x={center.x + 4} y={center.y} fontSize={10} fill={fill}>
        {label}
      </text>
    </g>
  );
};

export const DiagramLegend = () => (
  <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: 12 }}>
    <li>Film plane (blue)</li>
    <li>Lens plane (slate)</li>
    <li>Focus plane (green)</li>
    <li>DOF region (violet area)</li>
    <li>Optical axis (amber ray)</li>
  </ul>
);
