import { DiagramLegend } from "../geometry/DiagramPrimitives";
import { computeOpticalSectionData, vecDot, vecSub, vecAdd, vecScale } from "../geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../geometry/geometryPresentationProfiles";
import { OpticalDepthStrip } from "../geometry/OpticalDepthStrip";
import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState, Vec3 } from "../../types/optics";
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


  const SAFE_MARGIN = 10;
  const LABEL_GAP = 5;
  const SVG_W = SVG_WIDTH;
  const SVG_H = SVG_HEIGHT;

  // Delegate projection to shared opticalSectionProjection helper
  const projection = computeOpticalSectionData(opticsState, scene, SVG_W, SVG_H);
  const { sectionOrigin, sectionDepthDir, lensCenter, sideSegments, topSegments, sideFovDirs, topFovDirs, depthToX, mapLateralToY, mapLateralToYTop, isInfinity, diagramMinDepthMm, diagramMaxDepthMm } = projection;

  type Annotation = {
    id: string;
    text: string;
    color: string;
    anchor: { x: number; y: number };
    priority: number;
    preferred?: string[];
  };

  // Use presentation profile to control rendering choices (replace scattered scene-id checks)
  const profile = getGeometryPresentationProfile(scene);
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
    if (geometryView === "side") {
      exclusionBoxes.push({ id: `target-${t.id}`, x: tx - 12, y: ty - 22, w: 24, h: 40 });
    } else {
      // top view: narrow vertical plate exclusion
      exclusionBoxes.push({ id: `target-${t.id}`, x: tx - 3, y: ty - 9, w: 6, h: 18 });
    }
  }
  // focus point
  if (opticsState.focusPlane) {
    const fp = opticsState.focusPlane.point;
    const depth = vecDot(vecSub(fp, sectionOrigin), sectionDepthDir);
    const fx = depthToX(depth);
    const fy = geometryView === "side" ? mapLateralToY(fp.y) : mapLateralToYTop(fp.x);
    exclusionBoxes.push({ id: "focus-point", x: fx - 8, y: fy - 8, w: 16, h: 16 });
  }

  // Focus Fundamentals: deterministic, semantic layout
  const layoutFocusFundamentalsAnnotations = () => {
    const results: { ann: Annotation; x: number; y: number; w: number; h: number }[] = [];
    const occupied: { x: number; y: number; w: number; h: number }[] = [...exclusionBoxes];

    const insideSafe = (x: number, y: number, w: number, h: number) => x >= SAFE_MARGIN && y >= SAFE_MARGIN && x + w <= SVG_W - SAFE_MARGIN && y + h <= SVG_H - SAFE_MARGIN;
    const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => !(a.x + a.w + LABEL_GAP < b.x || b.x + b.w + LABEL_GAP < a.x || a.y + a.h + LABEL_GAP < b.y || b.y + b.h + LABEL_GAP < a.y);
    const containsPoint = (box: { x: number; y: number; w: number; h: number }, pt: { x: number; y: number }) => pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;

    const tryPlace = (ann: Annotation, x: number, y: number, w: number, h: number) => {
      const box = { x, y, w, h };
      if (!insideSafe(x, y, w, h)) return false;
      for (const occ of occupied) if (intersects(box, occ)) return false;
      for (const other of annotations) if (other.id !== ann.id && containsPoint(box, other.anchor)) return false;
      occupied.push(box);
      results.push({ ann, x, y, w, h });
      return true;
    };

    const fallbackToLane = (ann: Annotation) => {
      const h = 18;
      const lanes: { [k: string]: { x1: number; x2: number; curY: number } } = {
        topLeft: { x1: 12, x2: 145, curY: SAFE_MARGIN },
        topCenter: { x1: 155, x2: 300, curY: SAFE_MARGIN },
        topRight: { x1: 315, x2: SVG_W - 12, curY: SAFE_MARGIN },
        bottomLeft: { x1: 12, x2: 145, curY: SVG_H - SAFE_MARGIN - h },
        bottomCenter: { x1: 155, x2: 300, curY: SVG_H - SAFE_MARGIN - h },
        bottomRight: { x1: 315, x2: SVG_W - 12, curY: SVG_H - SAFE_MARGIN - h },
      };
      const sidePref = ann.anchor.x < SVG_W * 0.33 ? 'Left' : (ann.anchor.x > SVG_W * 0.67 ? 'Right' : 'Center');
      const vert = ann.anchor.y < SVG_H / 2 ? 'top' : 'bottom';
      const candidates = [`${vert}${sidePref}`, `${vert}Center`, `${vert}Left`, `${vert}Right`];
      for (const k of candidates) {
        const lane = lanes[k as string];
        const laneWidth = lane.x2 - lane.x1 - 8;
        const px = lane.x1 + 8;
        const py = lane.curY;
        if (!insideSafe(px, py, Math.min(132, laneWidth), h)) { lane.curY += h + 4; continue; }
        const box = { x: px, y: py, w: Math.min(132, laneWidth), h };
        let collide = false; for (const occ of occupied) if (intersects(box, occ)) { collide = true; break; }
        if (collide) { lane.curY += h + 4; continue; }
        occupied.push(box); results.push({ ann, x: box.x, y: box.y, w: box.w, h: box.h }); lane.curY += h + 4; return true;
      }
      return false;
    };

    // Semantic order: camera (film, lens), targets (near, far), focus/DOF (nearDof, focusPlane, farDof)
    const filmAnn = annotations.find((a) => a.id === 'film');
    if (filmAnn) {
      const w = filmAnn.text.length * 6.5 + 16; const h = 18;
      const x = filmAnn.anchor.x - w - 6; const y = filmAnn.anchor.y + 6;
      if (!tryPlace(filmAnn, x, y, w, h)) fallbackToLane(filmAnn);
    }
    const lensAnn = annotations.find((a) => a.id === 'lens');
    if (lensAnn) {
      const w = lensAnn.text.length * 6.5 + 16; const h = 18;
      const x = lensAnn.anchor.x + 6; const y = lensAnn.anchor.y - h - 6;
      if (!tryPlace(lensAnn, x, y, w, h)) fallbackToLane(lensAnn);
    }

    const nearTarget = annotations.find((a) => /near/i.test(a.text));
    const farTarget = annotations.find((a) => /far/i.test(a.text));
    if (nearTarget) {
      const w = nearTarget.text.length * 6.5 + 16; const h = 18;
      const x = nearTarget.anchor.x + 6; const y = nearTarget.anchor.y - h - 6;
      if (!tryPlace(nearTarget, x, y, w, h)) { const x2 = nearTarget.anchor.x + 6; const y2 = nearTarget.anchor.y + 6; if (!tryPlace(nearTarget, x2, y2, w, h)) fallbackToLane(nearTarget); }
    }
    if (farTarget) {
      const w = farTarget.text.length * 6.5 + 16; const h = 18;
      const x = farTarget.anchor.x + 6; const y = farTarget.anchor.y - h - 6;
      if (!tryPlace(farTarget, x, y, w, h)) { const x2 = farTarget.anchor.x + 6; const y2 = farTarget.anchor.y + 6; if (!tryPlace(farTarget, x2, y2, w, h)) fallbackToLane(farTarget); }
    }

    const nearDofAnn = annotations.find((a) => a.id === 'nearDof');
    const focusAnn = annotations.find((a) => a.id === 'focusPlane');
    const farDofAnn = annotations.find((a) => a.id === 'farDof');
    if (nearDofAnn) {
      const w = nearDofAnn.text.length * 6.5 + 16; const h = 18;
      const x = nearDofAnn.anchor.x - w / 2; const y = nearDofAnn.anchor.y + 6;
      if (!tryPlace(nearDofAnn, x, y, w, h)) fallbackToLane(nearDofAnn);
    }
    if (focusAnn) {
      const w = focusAnn.text.length * 6.5 + 16; const h = 18;
      const x = focusAnn.anchor.x + 6; const y = focusAnn.anchor.y - h - 6;
      if (!tryPlace(focusAnn, x, y, w, h)) fallbackToLane(focusAnn);
    }
    if (farDofAnn) {
      const w = farDofAnn.text.length * 6.5 + 16; const h = 18;
      const x = farDofAnn.anchor.x - w / 2; const y = farDofAnn.anchor.y - h - 6;
      if (!tryPlace(farDofAnn, x, y, w, h)) fallbackToLane(farDofAnn);
    }

    return results;
  };

  const genericPlace = () => {
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    const results: { ann: Annotation; x: number; y: number; w: number; h: number }[] = [];
    const insideSafe = (x: number, y: number, w: number, h: number) => x >= SAFE_MARGIN && y >= SAFE_MARGIN && x + w <= SVG_W - SAFE_MARGIN && y + h <= SVG_H - SAFE_MARGIN;
    const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => !(a.x + a.w + LABEL_GAP < b.x || b.x + b.w + LABEL_GAP < a.x || a.y + a.h + LABEL_GAP < b.y || b.y + b.h + LABEL_GAP < a.y);
    const containsPoint = (box: { x: number; y: number; w: number; h: number }, pt: { x: number; y: number }) => pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;

    for (const ann of annotations) {
      const textLen = ann.text.length; const w = textLen * 6.5 + 16; const h = 18;
      const candidates = [
        { x: ann.anchor.x + 6, y: ann.anchor.y - h - 6 },
        { x: ann.anchor.x + 6, y: ann.anchor.y + 6 },
        { x: ann.anchor.x - w - 6, y: ann.anchor.y - h - 6 },
        { x: ann.anchor.x - w - 6, y: ann.anchor.y + 6 },
      ];
      let placed = false;
      for (const c of candidates) {
        const box = { x: c.x, y: c.y, w, h };
        if (!insideSafe(box.x, box.y, box.w, box.h)) continue;
        let ok = true; for (const occ of occupied) if (intersects(box, occ)) { ok = false; break; }
        if (!ok) continue;
        let blocked = false; for (const ex of exclusionBoxes) if (intersects(box, ex) || containsPoint(box, { x: ex.x + ex.w / 2, y: ex.y + ex.h / 2 })) { blocked = true; break; }
        if (blocked) continue;
        for (const other of annotations) if (other.id !== ann.id && containsPoint(box, other.anchor)) { blocked = true; break; }
        if (blocked) continue;
        occupied.push(box); results.push({ ann, x: box.x, y: box.y, w, h }); placed = true; break;
      }
      if (!placed) {
        // simple lane fallback
        const lanes: { [k: string]: { x1: number; x2: number; curY: number } } = {
          topLeft: { x1: 12, x2: 145, curY: SAFE_MARGIN }, topCenter: { x1: 155, x2: 300, curY: SAFE_MARGIN }, topRight: { x1: 315, x2: SVG_W - 12, curY: SAFE_MARGIN },
          bottomLeft: { x1: 12, x2: 145, curY: SVG_H - SAFE_MARGIN - h }, bottomCenter: { x1: 155, x2: 300, curY: SVG_H - SAFE_MARGIN - h }, bottomRight: { x1: 315, x2: SVG_W - 12, curY: SVG_H - SAFE_MARGIN - h },
        };
        const vert = ann.anchor.y < SVG_H / 2 ? 'top' : 'bottom';
        const sidePref = ann.anchor.x < SVG_W * 0.33 ? 'Left' : (ann.anchor.x > SVG_W * 0.67 ? 'Right' : 'Center');
        const candidates = [`${vert}${sidePref}`, `${vert}Center`, `${vert}Left`, `${vert}Right`];
        let placed2 = false;
        for (const k of candidates) {
          const lane = lanes[k as string]; const laneWidth = lane.x2 - lane.x1 - 8; const px = lane.x1 + 8; const py = lane.curY;
          const box = { x: px, y: py, w: Math.min(132, laneWidth), h };
          let collide = false; for (const occ of occupied) if (intersects(box, occ)) { collide = true; break; }
          if (collide) { lane.curY += h + 4; continue; }
          occupied.push(box); results.push({ ann, x: box.x, y: box.y, w: box.w, h: box.h }); lane.curY += h + 4; placed2 = true; break;
        }
        if (!placed2) { /* give up — place off to right */ const px = SVG_W - 140; const py = SAFE_MARGIN; const box = { x: px, y: py, w: 132, h }; occupied.push(box); results.push({ ann, x: box.x, y: box.y, w: box.w, h: box.h }); }
      }
    }
    return results;
  };

  const placed = profile.annotationMode === 'minimal' ? layoutFocusFundamentalsAnnotations() : genericPlace();

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
                    <line x1={x1} y1={axisY} x2={x2} y2={axisY} stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="6 4" opacity={0.95} />
                    {/* Optical axis label: for Focus Fundamentals we render a single fixed axis label in the annotations block; for other scenes render it here */}
                    {profile.showOpticalAxisLabel ? (
                      <text x={x1 + 8} y={axisY - 6} fontSize={11} fill="#f59e0b">Optical axis</text>
                    ) : null}
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
                // top view: vertical plates (same visual language as side view)
                const rw = 8; const rh = 24;
                const rx = filmCenter.x - rw / 2; const ry = filmCenter.y - rh / 2;
                const fw = 10; const fh = 28;
                const fx = lensX - fw / 2; const fy = lensY - fh / 2;
                return (
                  <g>
                    <rect x={rx} y={ry} width={rw} height={rh} fill="#1f2937" opacity={0.9} />
                    <rect x={fx} y={fy} width={fw} height={fh} fill="#475569" opacity={0.95} />
                    {/* small lens disc at lens center */}
                    <circle cx={lensX} cy={lensY} r={4} fill="#111827" opacity={0.9} />
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
              // top view: vertical card glyph (narrow plate)
                return (
                  <g key={t.id}>
                   <rect x={x - 3} y={y - 9} width={6} height={18} fill="#0f766e" />
                   <line x1={x} y1={y + 9} x2={x} y2={y + 13} stroke="#0b5e54" strokeWidth={1} />
                 </g>
               );
              })}
 
              {/* 8) Focus point marker */}              {!isInfinity && opticsState.focusPlane && (() => {
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
          {profile.annotationMode === 'minimal' ? (
            <g>
              {/* Single fixed Optical axis label (lower-left) if profile requests it */}
              {profile.showOpticalAxisLabel ? <text x={16} y={SVG_H - 12} fontSize={11} fill="#f59e0b">Optical axis</text> : null}

              {/* Only simple Near/Far board labels placed close to their glyphs (no leader lines, no cards) if requested */}
              {profile.targetLabelMode === 'short-local' ? (
                scene.focusTargets.map((t) => {
                  const depth = vecDot(vecSub(t.worldPosition, sectionOrigin), sectionDepthDir);
                  const x = depthToX(depth);
                  const y = geometryView === 'side' ? mapLateralToY(t.worldPosition.y) : mapLateralToYTop(t.worldPosition.x);
                  const isNear = /near/i.test(t.id);
                  const text = isNear ? 'Near board' : /far/i.test(t.id) ? 'Far board' : 'Target';
                  // default placement: right and slightly above
                  let lx = x + 10;
                  let ly = y - 10;
                  let anchorEnd: 'start' | 'end' = 'start';
                  // if label would overflow right edge, flip to left
                  const APPROX_MAX_W = 90;
                  if (lx + APPROX_MAX_W > SVG_W - SAFE_MARGIN) { lx = x - 10; anchorEnd = 'end'; }
                  // clamp vertically into safe margin
                  if (ly < SAFE_MARGIN) ly = SAFE_MARGIN + 4;
                  if (ly > SVG_H - SAFE_MARGIN) ly = SVG_H - SAFE_MARGIN - 4;
                  return (
                    <text key={`lbl-${t.id}`} x={lx} y={ly} fontSize={12} fill="#064e3b" textAnchor={anchorEnd}>{text}</text>
                  );
                })
              ) : null}
            </g>
          ) : (
            // generic annotations (existing placed cards + leaders)
            placed.map((p) => (
              <g key={p.ann.id}>
                {/* routed leader line with elbow to nearest label edge */}
                {
                  (() => {
                    const ax = p.ann.anchor.x; const ay = p.ann.anchor.y;
                    const lx = p.x; const ly = p.y; const lw = p.w; const lh = p.h;
                    // determine label edge point
                    let edgeX = lx + lw / 2; let edgeY = ly + lh / 2;
                    // if label is mostly right of anchor -> use left edge
                    if (lx > ax) { edgeX = lx; edgeY = ly + lh / 2; }
                    // if label is mostly left of anchor -> use right edge
                    else if (lx + lw < ax) { edgeX = lx + lw; edgeY = ly + lh / 2; }
                    // if label above anchor -> use bottom edge
                    if (ly + lh < ay) { edgeX = lx + lw / 2; edgeY = ly + lh; }
                    // if label below anchor -> use top edge
                    else if (ly > ay) { edgeX = lx + lw / 2; edgeY = ly; }

                    // choose elbow point (offset from anchor toward label direction)
                    let mx = ax; let my = ay;
                    const gap = 8;
                    if (edgeY < ay) {
                      // label is above anchor -> go vertically up then to label bottom
                      mx = ax; my = edgeY + gap;
                    } else if (edgeY > ay) {
                      // label is below anchor
                      mx = ax; my = edgeY - gap;
                    } else if (edgeX > ax) {
                      // label right
                      mx = edgeX - gap; my = ay;
                    } else {
                      // label left
                      mx = edgeX + gap; my = ay;
                    }
                    return <polyline points={`${ax},${ay} ${mx},${my} ${edgeX},${edgeY}`} stroke={p.ann.color} strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                  })()
                }
                {/* label background */}
                <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={4} ry={4} fill="#ffffff" stroke="rgba(0,0,0,0.06)" />
                <text x={p.x + 8} y={p.y + p.h - 4} fontSize={11} fill={p.ann.color}>{p.ann.text}</text>
              </g>
            ))
          )}
        </g>
      </svg>

      {/* Optical depth strip (controlled by presentation profile) */}
      {profile.showDepthStrip ? (
        <OpticalDepthStrip opticsState={opticsState} sectionOrigin={sectionOrigin} sectionDepthDir={sectionDepthDir} />
      ) : null}

      {/* optional small explanatory caption under depth strip when profile requests it */}
      {profile.showDepthStrip ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: 'rgba(15,23,42,0.7)' }}>Amber lines: optical axis and FOV boundary rays.</div>
        </div>
      ) : null}

      {/* Render DiagramLegend only when the profile requests it */}
      {profile.showSwatchLegend ? (
        <DiagramLegend isInfinity={isInfinity} hasNearDof={!!opticsState.depthOfFieldNearPlane} hasFarDof={!!opticsState.depthOfFieldFarPlane && !isInfinity} hasTargets={scene.focusTargets.length > 0} />
      ) : null}
    </section>
  );
};
