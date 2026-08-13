import type { DerivedOpticsState } from "../../types/optics";
import { resolveMirrorShiftTeachingDiagramModel } from "../../scenes/mirrorShiftTeachingGeometry";

type Props = {
  neutralOptics: DerivedOpticsState;
  currentOptics: DerivedOpticsState;
};

type Point2 = { x: number; y: number };
type DiagramBounds = { min: { x: number; z: number }; max: { x: number; z: number } };

const VIEW_WIDTH = 620;
const VIEW_HEIGHT = 330;
const PADDING = 34;

const toScreen = (
  point: { x: number; z: number },
  bounds: { min: { x: number; z: number }; max: { x: number; z: number } },
): Point2 => ({
  x:
    PADDING +
    ((point.x - bounds.min.x) / (bounds.max.x - bounds.min.x || 1)) *
      (VIEW_WIDTH - PADDING * 2),
  y:
    VIEW_HEIGHT -
    PADDING -
    ((point.z - bounds.min.z) / (bounds.max.z - bounds.min.z || 1)) *
      (VIEW_HEIGHT - PADDING * 2),
});

const line = (
  start: { x: number; z: number },
  end: { x: number; z: number },
  bounds: DiagramBounds,
) => {
  const p1 = toScreen(start, bounds);
  const p2 = toScreen(end, bounds);
  return { p1, p2 };
};

const Arrow = ({
  start,
  end,
  bounds,
  color,
  label,
  dashed = false,
  testId,
}: {
  start: { x: number; z: number };
  end: { x: number; z: number };
  bounds: DiagramBounds;
  color: string;
  label?: string;
  dashed?: boolean;
  testId?: string;
}) => {
  const { p1, p2 } = line(start, end, bounds);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const left = { x: p2.x - ux * 8 - uy * 4, y: p2.y - uy * 8 + ux * 4 };
  const right = { x: p2.x - ux * 8 + uy * 4, y: p2.y - uy * 8 - ux * 4 };
  return (
    <g data-testid={testId}>
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        strokeWidth={1.7}
        strokeDasharray={dashed ? "6 4" : undefined}
        markerEnd={`url(#mirror-shift-arrow-${color.slice(1)})`}
      />
      <path
        d={`M ${left.x} ${left.y} L ${p2.x} ${p2.y} L ${right.x} ${right.y}`}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
      />
      {label ? (
        <text
          x={(p1.x + p2.x) / 2}
          y={(p1.y + p2.y) / 2 - 8}
          fill={color}
          fontSize={11}
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
};

const CameraStateLayer = ({
  state,
  bounds,
  color,
  dashed,
  label,
  testId,
}: {
  state: ReturnType<typeof resolveMirrorShiftTeachingDiagramModel>["current"];
  bounds: DiagramBounds;
  color: string;
  dashed?: boolean;
  label: string;
  testId: string;
}) => {
  const film = line(state.filmPlane.start, state.filmPlane.end, bounds);
  const lens = line(state.lensPlane.start, state.lensPlane.end, bounds);
  const labelX = dashed ? film.p1.x - 4 : film.p1.x + 4;
  const labelAnchor = dashed ? "end" : "start";
  return (
    <g data-testid={testId} opacity={dashed ? 0.42 : 1}>
      <line x1={film.p1.x} y1={film.p1.y} x2={film.p2.x} y2={film.p2.y} stroke={color} strokeWidth={dashed ? 2 : 3} strokeDasharray={dashed ? "7 5" : undefined} />
      <line x1={lens.p1.x} y1={lens.p1.y} x2={lens.p2.x} y2={lens.p2.y} stroke={color} strokeWidth={dashed ? 2 : 3} strokeDasharray={dashed ? "7 5" : undefined} />
      <text x={labelX} y={film.p1.y - 8} fontSize={11} fill={color} textAnchor={labelAnchor}>{label} film</text>
      <text x={labelX} y={lens.p1.y + 16} fontSize={11} fill={color} textAnchor={labelAnchor}>{label} lens</text>
    </g>
  );
};

export const MirrorShiftTeachingDiagram = ({ neutralOptics, currentOptics }: Props) => {
  const model = resolveMirrorShiftTeachingDiagramModel({ neutralOptics, currentOptics });
  const bounds = { min: { x: model.bounds.min.x, z: model.bounds.min.z }, max: { x: model.bounds.max.x, z: model.bounds.max.z } };
  const mirror = line(model.mirrorPlane.start, model.mirrorPlane.end, bounds);
  const neutralRay = model.neutral.chiefRay;
  const currentRay = model.current.chiefRay;

  return (
    <div className="mirror-shift-teaching-diagram" data-testid="mirror-shift-teaching-diagram">
      <svg
        data-testid="mirror-shift-teaching-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Mirror Shift top-view teaching geometry"
        data-rig-lateral-mm={model.rigLateralMm}
        data-front-shift-mm={model.frontShiftMm}
        data-current-film-x-mm={model.current.filmCenter.x}
        data-current-lens-x-mm={model.current.lensCenter.x}
      >
        <defs>
          <marker id="mirror-shift-arrow-2563eb" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M 0 0 L 6 3 L 0 6 z" fill="#2563eb" /></marker>
          <marker id="mirror-shift-arrow-64748b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M 0 0 L 6 3 L 0 6 z" fill="#64748b" /></marker>
          <marker id="mirror-shift-arrow-d97706" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M 0 0 L 6 3 L 0 6 z" fill="#d97706" /></marker>
          <marker id="mirror-shift-arrow-94a3b8" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M 0 0 L 6 3 L 0 6 z" fill="#94a3b8" /></marker>
        </defs>
        <rect x="0" y="0" width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="#f8fafc" />
        <line data-testid="mirror-shift-mirror-plane" x1={mirror.p1.x} y1={mirror.p1.y} x2={mirror.p2.x} y2={mirror.p2.y} stroke="#0f172a" strokeWidth={5} />
        <text x={mirror.p1.x + 6} y={mirror.p1.y - 10} fill="#0f172a" fontSize={12}>Mirror aperture</text>

        <CameraStateLayer state={model.neutral} bounds={bounds} color="#64748b" dashed label="Neutral" testId="mirror-shift-neutral-camera" />
        <CameraStateLayer state={model.current} bounds={bounds} color="#2563eb" label="Current" testId="mirror-shift-current-camera" />

        {model.rigShiftCue ? (
          <Arrow start={model.rigShiftCue.start} end={model.rigShiftCue.end} bounds={bounds} color="#64748b" label="Camera Position" testId="mirror-shift-rig-shift-cue" />
        ) : null}
        {model.frontShiftCue ? (
          <Arrow start={model.frontShiftCue.start} end={model.frontShiftCue.end} bounds={bounds} color="#2563eb" label="Front Shift" testId="mirror-shift-front-shift-cue" />
        ) : null}

        <Arrow start={neutralRay.mirrorPoint} end={neutralRay.lensPoint} bounds={bounds} color="#94a3b8" dashed testId="mirror-shift-neutral-chief-ray" />
        <Arrow start={currentRay.mirrorPoint} end={currentRay.lensPoint} bounds={bounds} color="#d97706" label="Mirror-centre chief ray" testId="mirror-shift-current-chief-ray" />
        {currentRay.filmPoint ? (
          <Arrow start={currentRay.lensPoint} end={currentRay.filmPoint} bounds={bounds} color="#d97706" testId="mirror-shift-current-chief-ray-film" />
        ) : null}
        {neutralRay.filmPoint ? (
          <Arrow start={neutralRay.lensPoint} end={neutralRay.filmPoint} bounds={bounds} color="#94a3b8" dashed testId="mirror-shift-neutral-chief-ray-film" />
        ) : null}
        <text x={PADDING} y={VIEW_HEIGHT - 10} fontSize={11} fill="#475569">Top view · X lateral · Z optical depth</text>
      </svg>
      <div className="mirror-shift-teaching-diagram__legend" aria-hidden="true">
        <span><i className="mirror-shift-teaching-diagram__swatch mirror-shift-teaching-diagram__swatch--neutral" /> Neutral reference</span>
        <span><i className="mirror-shift-teaching-diagram__swatch mirror-shift-teaching-diagram__swatch--current" /> Current camera</span>
        <span><i className="mirror-shift-teaching-diagram__swatch mirror-shift-teaching-diagram__swatch--ray" /> Mirror-centre chief ray</span>
      </div>
    </div>
  );
};
