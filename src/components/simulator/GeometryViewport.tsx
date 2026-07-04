import { DiagramLegend } from "../geometry/DiagramPrimitives";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState, Vec3, Plane } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { UI_COPY } from "../../ui/copy";

type GeometryViewportProps = {
  opticsState: DerivedOpticsState;
  geometryView: GeometryView;
  scene: SceneDefinition;
};

const SVG_WIDTH = 460;
const SVG_HEIGHT = 280;

import { useAppStore } from "../../state/appStore";

export const GeometryViewport = ({ opticsState, geometryView, scene }: GeometryViewportProps) => {
  const setGeometryView = useAppStore((s) => s.setGeometryView);

  const isInfinity = !!opticsState.diagnostics?.isInfinityFocus;

  const SAFE_MARGIN = 10;
  const LABEL_GAP = 5;
  const SVG_W = SVG_WIDTH;
  const SVG_H = SVG_HEIGHT;

  // === Optical-section projection utilities ===
  type Annotation = {
    id: string;
    text: string;
    color: string;
    anchor: { x: number; y: number };
    priority: number;
    preferred?: string[];
  };

  const lensCenter = opticsState.lensCenterWorld;
  const opticalDir = opticsState.opticalAxis.direction;
  const filmCorners = opticsState.filmPlaneCornersWorld;

  const topMid = { x: (filmCorners.topLeft.x + filmCorners.topRight.x) / 2, y: (filmCorners.topLeft.y + filmCorners.topRight.y) / 2, z: (filmCorners.topLeft.z + filmCorners.topRight.z) / 2 };
  const bottomMid = { x: (filmCorners.bottomLeft.x + filmCorners.bottomRight.x) / 2, y: (filmCorners.bottomLeft.y + filmCorners.bottomRight.y) / 2, z: (filmCorners.bottomLeft.z + filmCorners.bottomRight.z) / 2 };
  const leftMid = { x: (filmCorners.topLeft.x + filmCorners.bottomLeft.x) / 2, y: (filmCorners.topLeft.y + filmCorners.bottomLeft.y) / 2, z: (filmCorners.topLeft.z + filmCorners.bottomLeft.z) / 2 };
  const rightMid = { x: (filmCorners.topRight.x + filmCorners.bottomRight.x) / 2, y: (filmCorners.topRight.y + filmCorners.bottomRight.y) / 2, z: (filmCorners.topRight.z + filmCorners.bottomRight.z) / 2 };

  const vecSub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const vecAdd = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const vecDot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  const vecScale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  const vecLen = (a: Vec3) => Math.hypot(a.x, a.y, a.z) || 1;
  const vecNorm = (a: Vec3): Vec3 => {
    const l = vecLen(a);
    return { x: a.x / l, y: a.y / l, z: a.z / l };
  };

  const intersectRayPlane = (o: Vec3, d: Vec3, plane: Plane) => {
    const denom = vecDot(d, plane.normal);
    if (Math.abs(denom) < 1e-6) return null;
    const t = vecDot(vecSub(plane.point, o), plane.normal) / denom;
    if (!Number.isFinite(t) || t <= 0) return null;
    return vecAdd(o, vecScale(d, t));
  };

  const fovDirFromFilmPoint = (filmPoint: Vec3) => vecNorm(vecSub(lensCenter, filmPoint));
  const axialDepthU = (pt: Vec3) => Math.max(1e-6, vecDot(vecSub(pt, lensCenter), opticalDir));

  const padding = 24;
  const candidateDepths: number[] = [];
  const filmU = axialDepthU(opticsState.filmCenterWorld);
  candidateDepths.push(filmU);
  if (opticsState.focusPlane) candidateDepths.push(axialDepthU(opticsState.focusPlane.point));
  if (opticsState.depthOfFieldNearPlane) candidateDepths.push(axialDepthU(opticsState.depthOfFieldNearPlane.point));
  if (opticsState.depthOfFieldFarPlane) candidateDepths.push(axialDepthU(opticsState.depthOfFieldFarPlane.point));
  for (const t of scene.focusTargets) candidateDepths.push(axialDepthU(t.worldPosition));
  candidateDepths.push(0);

  const minDepth = Math.min(...candidateDepths) - 50;
  let maxDepth = Math.max(...candidateDepths);
  if (opticsState.sceneVisualCapDepthMm) maxDepth = Math.max(maxDepth, opticsState.sceneVisualCapDepthMm);
  maxDepth += 50;

  const depthToX = (U: number) => {
    const t = (U - minDepth) / (maxDepth - minDepth);
    return padding + t * (SVG_WIDTH - padding * 2);
  };

  const bounds = scene.bounds;
  const mapLateralToY = (value: number) => {
    const min = bounds.min.y;
    const max = bounds.max.y;
    const v = (value - min) / (max - min || 1);
    return SVG_HEIGHT - (padding + v * (SVG_HEIGHT - padding * 2));
  };
  const mapLateralToYTop = (value: number) => {
    const min = bounds.min.x;
    const max = bounds.max.x;
    const v = (value - min) / (max - min || 1);
    return SVG_HEIGHT - (padding + v * (SVG_HEIGHT - padding * 2));
  };

  type PlaneSegment = { id: string; p1: { x: number; y: number }; p2: { x: number; y: number }; color: string };
  const sideSegments: PlaneSegment[] = [];
  const topSegments: PlaneSegment[] = [];

  const addPlaneSegment = (plane: Plane, color: string, id: string, filmA: Vec3, filmB: Vec3) => {
    const dirA = fovDirFromFilmPoint(filmA);
    const dirB = fovDirFromFilmPoint(filmB);
    const o = lensCenter;
    const pa = intersectRayPlane(o, dirA, plane);
    const pb = intersectRayPlane(o, dirB, plane);
    if (!pa || !pb) return null;
    const Ua = axialDepthU(pa);
    const Ub = axialDepthU(pb);
    const ya = mapLateralToY(pa.y);
    const yb = mapLateralToY(pb.y);
    const xA = depthToX(Ua);
    const xB = depthToX(Ub);

    // enforce a minimum visible length for educational clarity while preserving center
    const MIN_LEN = 28;
    let outXA = xA;
    let outXB = xB;
    if (Math.abs(xB - xA) < MIN_LEN) {
      const center = (xA + xB) / 2;
      outXA = center - MIN_LEN / 2;
      outXB = center + MIN_LEN / 2;
    }

    sideSegments.push({ id, p1: { x: outXA, y: ya }, p2: { x: outXB, y: yb }, color });
    const yta = mapLateralToYTop(pa.x);
    const ytb = mapLateralToYTop(pb.x);
    const xAt = depthToX(Ua);
    const xBt = depthToX(Ub);
    let outXAt = xAt;
    let outXBt = xBt;
    if (Math.abs(xBt - xAt) < MIN_LEN) {
      const center = (xAt + xBt) / 2;
      outXAt = center - MIN_LEN / 2;
      outXBt = center + MIN_LEN / 2;
    }
    topSegments.push({ id, p1: { x: outXAt, y: yta }, p2: { x: outXBt, y: ytb }, color });
    return true;
  };

  addPlaneSegment(opticsState.filmPlane, "#0284c7", "film", topMid, bottomMid);
  addPlaneSegment(opticsState.lensPlane, "#475569", "lens", topMid, bottomMid);
  if (opticsState.focusPlane) addPlaneSegment(opticsState.focusPlane, "#16a34a", "focus", topMid, bottomMid);
  if (opticsState.depthOfFieldNearPlane) addPlaneSegment(opticsState.depthOfFieldNearPlane, "#8b5cf6", "nearDof", topMid, bottomMid);
  if (opticsState.depthOfFieldFarPlane) addPlaneSegment(opticsState.depthOfFieldFarPlane, "#8b5cf6", "farDof", topMid, bottomMid);

  const sideFovDirs = [fovDirFromFilmPoint(topMid), fovDirFromFilmPoint(bottomMid)];
  const topFovDirs = [fovDirFromFilmPoint(leftMid), fovDirFromFilmPoint(rightMid)];

  const annotations: Annotation[] = [];
  const addAnnotation = (id: string, text: string, color: string, anchorWorld: Vec3, priority: number) => {
    const U = axialDepthU(anchorWorld);
    const x = depthToX(U);
    const y = geometryView === "side" ? mapLateralToY(anchorWorld.y) : mapLateralToYTop(anchorWorld.x);
    annotations.push({ id, text, color, anchor: { x, y }, priority, preferred: ["top-right", "bottom-right", "top-left", "bottom-left"] });
  };

  addAnnotation("film", "Film", "#0284c7", opticsState.filmCenterWorld, 6);
  addAnnotation("lens", "Lens", "#475569", opticsState.lensCenterWorld, 1);
  // optical axis anchor near lens center
  addAnnotation("opticalAxis", "Optical axis", "#f59e0b", opticsState.lensCenterWorld, 4);
  if (opticsState.depthOfFieldNearPlane) addAnnotation("nearDof", "Near DOF", "#8b5cf6", opticsState.depthOfFieldNearPlane.point, 3);
  if (opticsState.focusPlane) addAnnotation("focusPlane", "Focus", "#16a34a", opticsState.focusPlane.point, 2);
  if (opticsState.depthOfFieldFarPlane) addAnnotation("farDof", "Far DOF", "#8b5cf6", opticsState.depthOfFieldFarPlane.point, 3);
  if (opticsState.lensFilmHingeLine) addAnnotation("hinge", "Hinge", "#7c3aed", opticsState.lensFilmHingeLine.point, 8);
  for (const target of scene.focusTargets) {
    const label = /near/i.test(target.id) ? "Near board" : /far/i.test(target.id) ? "Far board" : "Focus target";
    addAnnotation(target.id, label, "#0f766e", target.worldPosition, 5);
  }

  annotations.sort((a, b) => a.priority - b.priority);

  const placed = (() => {
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    const results: { ann: Annotation; x: number; y: number; w: number; h: number; side?: "left" | "right" }[] = [];
    let rightLaneY = SAFE_MARGIN;
    const rightLaneX = SVG_W - 140; // gutter

    const insideSafe = (x: number, y: number, w: number, h: number) => x >= SAFE_MARGIN && y >= SAFE_MARGIN && x + w <= SVG_W - SAFE_MARGIN && y + h <= SVG_H - SAFE_MARGIN;
    const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => !(a.x + a.w + LABEL_GAP < b.x || b.x + b.w + LABEL_GAP < a.x || a.y + a.h + LABEL_GAP < b.y || b.y + b.h + LABEL_GAP < a.y);

    for (const ann of annotations) {
      const textLen = ann.text.length;
      const w = textLen * 6.5 + 16;
      const h = 18;
      const candidates = [
        { x: ann.anchor.x + 6, y: ann.anchor.y - h - 6 }, // top-right
        { x: ann.anchor.x + 6, y: ann.anchor.y + 6 }, // bottom-right
        { x: ann.anchor.x - w - 6, y: ann.anchor.y - h - 6 }, // top-left
        { x: ann.anchor.x - w - 6, y: ann.anchor.y + 6 }, // bottom-left
      ];
      let placedBox = null as null | { x: number; y: number };
      for (const c of candidates) {
        const box = { x: c.x, y: c.y, w, h };
        if (!insideSafe(box.x, box.y, box.w, box.h)) continue;
        let ok = true;
        for (const occ of occupied) {
          if (intersects(box, occ)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          placedBox = { x: box.x, y: box.y };
          occupied.push(box);
          results.push({ ann, x: box.x, y: box.y, w, h });
          break;
        }
      }
      if (!placedBox) {
        // put in right lane stacked
        const x = rightLaneX + 8;
        const y = rightLaneY;
        rightLaneY += h + 4;
        const box = { x, y, w: 132, h };
        occupied.push(box);
        results.push({ ann, x: box.x, y: box.y, w: box.w, h: box.h, side: "right" });
      }
    }
    return results;
  })();

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>{UI_COPY.simulator.geometryTitle}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button aria-pressed={geometryView === "side"} onClick={() => setGeometryView("side")}>Side</button>
          <button aria-pressed={geometryView === "top"} onClick={() => setGeometryView("top")}>Top</button>
        </div>
      </div>
      <p style={{ marginTop: 6, marginBottom: 8 }}>
        {geometryView === "side" ? "Side view" : "Top view"} | {UI_COPY.simulator.tiltLabel}: {opticsState.diagnostics.tiltAngleDeg.toFixed(1)}° | {UI_COPY.simulator.swingLabel}: {opticsState.diagnostics.swingAngleDeg.toFixed(1)}°
      </p>
      <svg
        data-testid={`geometry-svg-${geometryView}`}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        style={{ border: "1px solid #d1d5db", borderRadius: 8, background: "#f8fafc" }}
      >
        {/* Draw primitives (no text labels here) */}
        {/* Render plane segments computed from ray-plane intersections */}
        {(() => {
          const segments = geometryView === "side" ? sideSegments : topSegments;
          return (
            <g>
              {/* DOF region polygon when both near and far planes exist */}
              {(!isInfinity && opticsState.depthOfFieldNearPlane && opticsState.depthOfFieldFarPlane) && (() => {
                const segs = geometryView === 'side' ? sideSegments : topSegments;
                const near = segs.find((s) => s.id === 'nearDof');
                const far = segs.find((s) => s.id === 'farDof');
                if (near && far) {
                  const points = `${near.p1.x},${near.p1.y} ${near.p2.x},${near.p2.y} ${far.p2.x},${far.p2.y} ${far.p1.x},${far.p1.y}`;
                  return <polygon points={points} fill="#8b5cf6" opacity={0.12} stroke="#8b5cf6" />;
                }
                return null;
              })()}

              {segments.map((s) => (
                <line key={s.id} x1={s.p1.x} y1={s.p1.y} x2={s.p2.x} y2={s.p2.y} stroke={s.color} strokeWidth={s.id === 'film' ? 2 : 2} strokeDasharray={s.id === 'focus' ? '6 4' : undefined} data-testid={s.id === 'film' ? 'plane-line-film' : s.id === 'lens' ? 'plane-line-lens' : s.id === 'focus' ? 'plane-line-focus' : undefined} />
              ))}
              {/* FOV rays: draw two primary rays for active view */}
                {/* FOV rays: draw two primary rays for active view (thin, visually secondary) */}
                {(() => {
                  const dirs = geometryView === 'side' ? sideFovDirs : topFovDirs;
                  return dirs.map((d, i) => {
                  const farPointWorld = vecAdd(lensCenter, vecScale(d, maxDepth * 1.2));
                  const U = axialDepthU(farPointWorld);
                  const x = depthToX(U);
                  const y = geometryView === 'side' ? mapLateralToY(farPointWorld.y) : mapLateralToYTop(farPointWorld.x);
                  const lensX = depthToX(0);
                  const lensY = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
                    return <line key={`fov-${i}`} x1={lensX} y1={lensY} x2={x} y2={y} stroke="#f59e0b" strokeWidth={1} opacity={0.85} />;
                });
              })()}

                {/* Camera schematic: rear standard (film) and front standard (lens) */}
                {(() => {
                  const filmSeg = sideSegments.find((s) => s.id === 'film');
                  const filmCenter = filmSeg ? { x: (filmSeg.p1.x + filmSeg.p2.x) / 2, y: (filmSeg.p1.y + filmSeg.p2.y) / 2 } : { x: depthToX(filmU), y: mapLateralToY(opticsState.filmCenterWorld.y) };
                  const lensX = depthToX(0);
                  const lensY = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);

                  // rear standard (side: vertical plate)
                  if (geometryView === 'side') {
                    // rear standard at filmCenter
                    const rw = 12; const rh = 28;
                    const rx = filmCenter.x - rw / 2; const ry = filmCenter.y - rh / 2;
                    // front standard at lens
                    const fw = 14; const fh = 32;
                    const fx = lensX - fw / 2; const fy = lensY - fh / 2;
                    return (
                      <g>
                        <rect x={rx} y={ry} width={rw} height={rh} fill="#1f2937" opacity={0.9} />
                        <rect x={fx} y={fy} width={fw} height={fh} fill="#475569" opacity={0.95} />
                      </g>
                    );
                  } else {
                    // top view: small horizontal plates
                    const rw = 18; const rh = 8;
                    const rx = filmCenter.x - rw / 2; const ry = filmCenter.y - rh / 2;
                    const fw = 20; const fh = 10;
                    const fx = lensX - fw / 2; const fy = lensY - fh / 2;
                    return (
                      <g>
                        <rect x={rx} y={ry} width={rw} height={rh} fill="#1f2937" opacity={0.9} />
                        <rect x={fx} y={fy} width={fw} height={fh} fill="#475569" opacity={0.95} />
                      </g>
                    );
                  }
                })()}

                {/* Targets: schematic board icons */}
                {scene.focusTargets.map((t) => {
                  const U = axialDepthU(t.worldPosition);
                  const x = depthToX(U);
                  const y = geometryView === 'side' ? mapLateralToY(t.worldPosition.y) : mapLateralToYTop(t.worldPosition.x);
                  if (geometryView === 'side') {
                    // small vertical board with base
                    return (
                      <g key={t.id}>
                        <rect x={x - 6} y={y - 20} width={12} height={16} fill="#0f766e" />
                        <rect x={x - 2} y={y - 4} width={4} height={8} fill="#6b7280" />
                      </g>
                    );
                  }
                  // top view: thin card
                  return (
                    <g key={t.id}>
                      <rect x={x - 8} y={y - 3} width={16} height={6} fill="#0f766e" />
                    </g>
                  );
                })}

                {/* Focus point marker */}
                {!isInfinity && opticsState.focusPlane && (() => {
                  const fp = opticsState.focusPlane.point;
                  const U = axialDepthU(fp);
                  const x = depthToX(U);
                  const y = geometryView === 'side' ? mapLateralToY(fp.y) : mapLateralToYTop(fp.x);
                  return <circle cx={x} cy={y} r={4} fill="#dc2626" />;
                })()}

                {/* hinge point */}
                {opticsState.lensFilmHingeLine && (() => {
                  const h = opticsState.lensFilmHingeLine.point;
                  const U = axialDepthU(h);
                  const x = depthToX(U);
                  const y = geometryView === 'side' ? mapLateralToY(h.y) : mapLateralToYTop(h.x);
                  return <circle cx={x} cy={y} r={3} fill="#7c3aed" />;
                })()}

                {/* Optical axis: single dashed amber line left-to-right through lens center */}
                {(() => {
                  const axisY = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
                  const x1 = depthToX(minDepth);
                  const x2 = depthToX(maxDepth);
                  return (
                    <g>
                      <line x1={x1} y1={axisY} x2={x2} y2={axisY} stroke="#f59e0b" strokeWidth={1.6} strokeDasharray="6 4" opacity={0.95} />
                      {/* compact optical axis label at left side */}
                      <text x={x1 + 8} y={axisY - 6} fontSize={11} fill="#f59e0b">Optical axis</text>
                    </g>
                  );
                })()}
                </g>
              );
        })()}

        {/* Annotations layer */}
        <g pointerEvents="none">
          {placed.map((p) => (
            <g key={p.ann.id}>
              {/* leader line */}
              <line x1={p.ann.anchor.x} y1={p.ann.anchor.y} x2={p.x} y2={p.y + p.h / 2} stroke={p.ann.color} strokeWidth={1} />
              {/* label background */}
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={4} ry={4} fill="#ffffff" stroke="rgba(0,0,0,0.06)" />
              <text x={p.x + 8} y={p.y + p.h - 4} fontSize={11} fill={p.ann.color}>{p.ann.text}</text>
            </g>
          ))}
        </g>
      </svg>
      <DiagramLegend isInfinity={isInfinity} hasNearDof={!!opticsState.depthOfFieldNearPlane} hasFarDof={!!opticsState.depthOfFieldFarPlane && !isInfinity} hasTargets={scene.focusTargets.length > 0} />
    </section>
  );
};
