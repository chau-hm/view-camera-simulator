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

  // Optical sections: side uses top/bottom film midpoints, top uses left/right
  type OpticalSection = {
    id: "side" | "top";
    filmA: Vec3;
    filmB: Vec3;
    lateral: (p: Vec3) => number;
  };
  const sectionOrigin = opticsState.filmCenterWorld;
  const sectionDepthDir = opticsState.filmNormalWorld;

  const sections: OpticalSection[] = [
    { id: "side", filmA: topMid, filmB: bottomMid, lateral: (p) => p.y },
    { id: "top", filmA: leftMid, filmB: rightMid, lateral: (p) => p.x },
  ];

  const diagramMinDepthMm = -250;
  const diagramMaxDepthMm = 4000;
  const padding = 24;

  const depthToX = (depthMm: number) => {
    const t = (depthMm - diagramMinDepthMm) / (diagramMaxDepthMm - diagramMinDepthMm);
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

  const projectPlaneIntoSection = (plane: Plane, section: OpticalSection): PlaneSegment | null => {
    const dirA = vecNorm(vecSub(lensCenter, section.filmA));
    const dirB = vecNorm(vecSub(lensCenter, section.filmB));
    const pa = intersectRayPlane(lensCenter, dirA, plane);
    const pb = intersectRayPlane(lensCenter, dirB, plane);
    if (!pa || !pb) return null;
    const depthA = vecDot(vecSub(pa, sectionOrigin), sectionDepthDir);
    const depthB = vecDot(vecSub(pb, sectionOrigin), sectionDepthDir);
    const xA = depthToX(depthA);
    const xB = depthToX(depthB);
    const yA = section.id === "side" ? mapLateralToY(pa.y) : mapLateralToYTop(pa.x);
    const yB = section.id === "side" ? mapLateralToY(pb.y) : mapLateralToYTop(pb.x);
    return { id: plane.distance !== undefined ? String(plane.distance) : "plane", p1: { x: xA, y: yA }, p2: { x: xB, y: yB }, color: "" };
  };

  // Populate segments for both sections independently
  const pushIf = (seg: PlaneSegment | null, target: PlaneSegment[], id: string, color: string) => {
    if (seg) {
      seg.id = id;
      seg.color = color;
      target.push(seg);
    }
  };

  pushIf(projectPlaneIntoSection(opticsState.filmPlane, sections[0]), sideSegments, "film", "#0284c7");
  pushIf(projectPlaneIntoSection(opticsState.filmPlane, sections[1]), topSegments, "film", "#0284c7");
  pushIf(projectPlaneIntoSection(opticsState.lensPlane, sections[0]), sideSegments, "lens", "#475569");
  pushIf(projectPlaneIntoSection(opticsState.lensPlane, sections[1]), topSegments, "lens", "#475569");
  if (opticsState.focusPlane) {
    pushIf(projectPlaneIntoSection(opticsState.focusPlane, sections[0]), sideSegments, "focus", "#16a34a");
    pushIf(projectPlaneIntoSection(opticsState.focusPlane, sections[1]), topSegments, "focus", "#16a34a");
  }
  if (opticsState.depthOfFieldNearPlane) {
    pushIf(projectPlaneIntoSection(opticsState.depthOfFieldNearPlane, sections[0]), sideSegments, "nearDof", "#8b5cf6");
    pushIf(projectPlaneIntoSection(opticsState.depthOfFieldNearPlane, sections[1]), topSegments, "nearDof", "#8b5cf6");
  }
  if (opticsState.depthOfFieldFarPlane) {
    pushIf(projectPlaneIntoSection(opticsState.depthOfFieldFarPlane, sections[0]), sideSegments, "farDof", "#8b5cf6");
    pushIf(projectPlaneIntoSection(opticsState.depthOfFieldFarPlane, sections[1]), topSegments, "farDof", "#8b5cf6");
  }

  // FOV dirs per section
  const sideFovDirs = [vecNorm(vecSub(lensCenter, topMid)), vecNorm(vecSub(lensCenter, bottomMid))];
  const topFovDirs = [vecNorm(vecSub(lensCenter, leftMid)), vecNorm(vecSub(lensCenter, rightMid))];

  const annotations: Annotation[] = [];
  const addAnnotation = (id: string, text: string, color: string, anchorWorld: Vec3, priority: number) => {
    const depth = vecDot(vecSub(anchorWorld, sectionOrigin), sectionDepthDir);
    const x = depthToX(depth);
    const y = geometryView === "side" ? mapLateralToY(anchorWorld.y) : mapLateralToYTop(anchorWorld.x);
    annotations.push({ id, text, color, anchor: { x, y }, priority, preferred: ["top-right", "bottom-right", "top-left", "bottom-left"] });
  };

  addAnnotation("film", "Film", "#0284c7", opticsState.filmCenterWorld, 6);
  addAnnotation("lens", "Lens", "#475569", opticsState.lensCenterWorld, 1);
  // NOTE: Optical axis has a dedicated fixed label rendered beside the axis; do not add it to annotations to avoid duplication.
  if (opticsState.depthOfFieldNearPlane) addAnnotation("nearDof", "Near DOF", "#8b5cf6", opticsState.depthOfFieldNearPlane.point, 3);
  if (opticsState.focusPlane) addAnnotation("focusPlane", "Focus", "#16a34a", opticsState.focusPlane.point, 2);
  if (opticsState.depthOfFieldFarPlane) addAnnotation("farDof", "Far DOF", "#8b5cf6", opticsState.depthOfFieldFarPlane.point, 3);
  if (opticsState.lensFilmHingeLine) addAnnotation("hinge", "Hinge", "#7c3aed", opticsState.lensFilmHingeLine.point, 8);
  for (const target of scene.focusTargets) {
    const label = /near/i.test(target.id) ? "Near board" : /far/i.test(target.id) ? "Far board" : "Focus target";
    addAnnotation(target.id, label, "#0f766e", target.worldPosition, 5);
  }

  annotations.sort((a, b) => a.priority - b.priority);

  // Build exclusion boxes for camera glyphs, boards, focus point so annotations don't cover them
  const exclusionBoxes: { id: string; x: number; y: number; w: number; h: number }[] = [];
  // active segments for current view
  const activeSegments = geometryView === "side" ? sideSegments : topSegments;
  const filmSegActive = activeSegments.find((s) => s.id === "film");
  const filmCenterActive = filmSegActive ? { x: (filmSegActive.p1.x + filmSegActive.p2.x) / 2, y: (filmSegActive.p1.y + filmSegActive.p2.y) / 2 } : { x: depthToX(vecDot(vecSub(opticsState.filmCenterWorld, sectionOrigin), sectionDepthDir)), y: geometryView === "side" ? mapLateralToY(opticsState.filmCenterWorld.y) : mapLateralToYTop(opticsState.filmCenterWorld.x) };
  const lensDepthActive = vecDot(vecSub(lensCenter, sectionOrigin), sectionDepthDir);
  const lensXActive = depthToX(lensDepthActive);
  const lensYActive = geometryView === "side" ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
  // camera glyph boxes
  exclusionBoxes.push({ id: "rear-standard", x: filmCenterActive.x - 14, y: filmCenterActive.y - 18, w: 28, h: 36 });
  exclusionBoxes.push({ id: "front-standard", x: lensXActive - 16, y: lensYActive - 20, w: 32, h: 40 });
  // lens disc
  exclusionBoxes.push({ id: "lens-disc", x: lensXActive - 6, y: lensYActive - 6, w: 12, h: 12 });
  // targets exclusion boxes (approx)
  for (const t of scene.focusTargets) {
    const depth = vecDot(vecSub(t.worldPosition, sectionOrigin), sectionDepthDir);
    const tx = depthToX(depth);
    const ty = geometryView === "side" ? mapLateralToY(t.worldPosition.y) : mapLateralToYTop(t.worldPosition.x);
    exclusionBoxes.push({ id: `target-${t.id}`, x: tx - 12, y: ty - 22, w: 24, h: 40 });
  }
  // focus point
  if (opticsState.focusPlane) {
    const fp = opticsState.focusPlane.point;
    const depth = vecDot(vecSub(fp, sectionOrigin), sectionDepthDir);
    const fx = depthToX(depth);
    const fy = geometryView === "side" ? mapLateralToY(fp.y) : mapLateralToYTop(fp.x);
    exclusionBoxes.push({ id: "focus-point", x: fx - 8, y: fy - 8, w: 16, h: 16 });
  }

  const placed = (() => {
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    const results: { ann: Annotation; x: number; y: number; w: number; h: number; side?: "left" | "right" }[] = [];
    let rightLaneY = SAFE_MARGIN;
    const rightLaneX = SVG_W - 140; // gutter

    const insideSafe = (x: number, y: number, w: number, h: number) => x >= SAFE_MARGIN && y >= SAFE_MARGIN && x + w <= SVG_W - SAFE_MARGIN && y + h <= SVG_H - SAFE_MARGIN;
    const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => !(a.x + a.w + LABEL_GAP < b.x || b.x + b.w + LABEL_GAP < a.x || a.y + a.h + LABEL_GAP < b.y || b.y + b.h + LABEL_GAP < a.y);
    const containsPoint = (box: { x: number; y: number; w: number; h: number }, pt: { x: number; y: number }) => pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;

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
        if (!ok) continue;
        // check exclusion boxes
        for (const ex of exclusionBoxes) {
          if (intersects(box, ex) || containsPoint(box, { x: ex.x + ex.w / 2, y: ex.y + ex.h / 2 })) {
            ok = false; break;
          }
        }
        if (!ok) continue;
        // ensure not covering any other annotation anchor
        for (const other of annotations) {
          if (other.id === ann.id) continue;
          if (containsPoint(box, other.anchor)) { ok = false; break; }
        }
        if (!ok) continue;

        placedBox = { x: box.x, y: box.y };
        occupied.push(box);
        results.push({ ann, x: box.x, y: box.y, w, h });
        break;
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
              {/* 1) FOV rays (thin, visually secondary) */}
              {(() => {
                const dirs = geometryView === 'side' ? sideFovDirs : topFovDirs;
                return dirs.map((d, i) => {
                  const farPointWorld = vecAdd(lensCenter, vecScale(d, diagramMaxDepthMm * 1.2));
                  const depthFar = vecDot(vecSub(farPointWorld, sectionOrigin), sectionDepthDir);
                  const xFar = depthToX(depthFar);
                  const yFar = geometryView === 'side' ? mapLateralToY(farPointWorld.y) : mapLateralToYTop(farPointWorld.x);
                  const depthLens = vecDot(vecSub(lensCenter, sectionOrigin), sectionDepthDir);
                  const xLens = depthToX(depthLens);
                  const yLens = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
                  return <line key={`fov-${i}`} x1={xLens} y1={yLens} x2={xFar} y2={yFar} stroke="#f59e0b" strokeWidth={1} opacity={0.85} />;
                });
              })()}

              {/* 2) Optical axis (dashed amber) */}
              {(() => {
                const axisY = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
                const x1 = depthToX(diagramMinDepthMm);
                const x2 = depthToX(diagramMaxDepthMm);
                return (
                  <g>
                    <line x1={x1} y1={axisY} x2={x2} y2={axisY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.95} />
                    <text x={x1 + 8} y={axisY - 6} fontSize={11} fill="#f59e0b">Optical axis</text>
                  </g>
                );
              })()}

              {/* 3) DOF region polygon when both near and far planes exist */}
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

              {/* 4) Film and lens segments */}
              {segments.map((s) => (
                <line key={s.id} x1={s.p1.x} y1={s.p1.y} x2={s.p2.x} y2={s.p2.y} stroke={s.color} strokeWidth={s.id === 'film' ? 2 : 2} strokeDasharray={s.id === 'focus' ? '6 4' : undefined} data-testid={s.id === 'film' ? 'plane-line-film' : s.id === 'lens' ? 'plane-line-lens' : s.id === 'focus' ? 'plane-line-focus' : undefined} />
              ))}

              {/* 6) Camera schematic: rear standard (film) and front standard (lens) */}
              {(() => {
              const activeSegments = geometryView === 'side' ? sideSegments : topSegments;
              const filmSeg = activeSegments.find((s) => s.id === 'film');
              const filmCenter = filmSeg ? { x: (filmSeg.p1.x + filmSeg.p2.x) / 2, y: (filmSeg.p1.y + filmSeg.p2.y) / 2 } : { x: depthToX(vecDot(vecSub(opticsState.filmCenterWorld, sectionOrigin), sectionDepthDir)), y: geometryView === 'side' ? mapLateralToY(opticsState.filmCenterWorld.y) : mapLateralToYTop(opticsState.filmCenterWorld.x) };
              const depthLens = vecDot(vecSub(lensCenter, sectionOrigin), sectionDepthDir);
              const lensX = depthToX(depthLens);
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
                }
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
              })()}

              {/* 7) Targets: schematic board icons */}
              {scene.focusTargets.map((t) => {
                const depth = vecDot(vecSub(t.worldPosition, sectionOrigin), sectionDepthDir);
                const x = depthToX(depth);
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

              {/* 8) Focus point marker */}
              {!isInfinity && opticsState.focusPlane && (() => {
                const fp = opticsState.focusPlane.point;
                const depth = vecDot(vecSub(fp, sectionOrigin), sectionDepthDir);
                const x = depthToX(depth);
                const y = geometryView === 'side' ? mapLateralToY(fp.y) : mapLateralToYTop(fp.x);
                return <circle cx={x} cy={y} r={4} fill="#dc2626" />;
              })()}

              {/* 9) hinge point */}
              {opticsState.lensFilmHingeLine && (() => {
                const h = opticsState.lensFilmHingeLine.point;
                const depth = vecDot(vecSub(h, sectionOrigin), sectionDepthDir);
                const x = depthToX(depth);
                const y = geometryView === 'side' ? mapLateralToY(h.y) : mapLateralToYTop(h.x);
                return <circle cx={x} cy={y} r={3} fill="#7c3aed" />;
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
