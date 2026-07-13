import type { OpticalSectionData } from './opticalSectionProjection';
import type { GeometryPresentationProfile } from './geometryPresentationProfiles';
import type { SceneDefinition } from '../../types/scene';
import type { DerivedOpticsState } from '../../types/optics';

import { getLocalTargetLabelPlacement } from './labelPlacement';

type Props = {
  projection: OpticalSectionData;
  geometryView: 'side' | 'top';
  profile: GeometryPresentationProfile;
  scene: SceneDefinition;
  opticsState: DerivedOpticsState;
  svgWidth: number;
  svgHeight: number;
};

export const OpticalSectionDiagram = ({ projection, geometryView, profile, scene, opticsState, svgWidth, svgHeight }: Props) => {
  const { sectionOrigin, sectionDepthDir, lensCenter, sideSegments, topSegments, sideFovDirs, topFovDirs, depthToX, mapLateralToY, mapLateralToYTop, isInfinity, diagramMinDepthMm, diagramMaxDepthMm } = projection;

  const segments = geometryView === 'side' ? sideSegments : topSegments;
  const fovDirs = geometryView === 'side' ? sideFovDirs : topFovDirs;

  const SAFE_MARGIN = 10;

  return (
    <svg data-testid={`geometry-svg-${geometryView}`} viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" style={{ border: '1px solid #d1d5db', borderRadius: 8, background: '#f8fafc' }}>
      <g>
        {/* FOV rays */}
        {fovDirs.map((d, i) => {
          const farPointWorld = { x: lensCenter.x + d.x * (diagramMaxDepthMm * 1.2), y: lensCenter.y + d.y * (diagramMaxDepthMm * 1.2), z: lensCenter.z + d.z * (diagramMaxDepthMm * 1.2) };
          const depthFar = ((farPointWorld.x - sectionOrigin.x) * sectionDepthDir.x) + ((farPointWorld.y - sectionOrigin.y) * sectionDepthDir.y) + ((farPointWorld.z - sectionOrigin.z) * sectionDepthDir.z);
          const xFar = depthToX(depthFar);
          const yFar = geometryView === 'side' ? mapLateralToY(farPointWorld.y) : mapLateralToYTop(farPointWorld.x);
          const depthLens = ((lensCenter.x - sectionOrigin.x) * sectionDepthDir.x) + ((lensCenter.y - sectionOrigin.y) * sectionDepthDir.y) + ((lensCenter.z - sectionOrigin.z) * sectionDepthDir.z);
          const xLens = depthToX(depthLens);
          const yLens = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
          return <line key={`fov-${i}`} x1={xLens} y1={yLens} x2={xFar} y2={yFar} stroke="#f59e0b" strokeWidth={1} opacity={0.85} />;
        })}

        {/* Optical axis */}
        {(() => {
          const axisY = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);
          const x1 = depthToX(diagramMinDepthMm);
          const x2 = depthToX(diagramMaxDepthMm);
          const labelX = scene.id === "table-tilt" ? x1 + (x2 - x1) * 0.12 : x1 + 8;
          return (
            <g>
              <line x1={x1} y1={axisY} x2={x2} y2={axisY} stroke="#f59e0b" strokeWidth={1.2} strokeDasharray="6 4" opacity={0.95} />
              {profile.showOpticalAxisLabel ? <text x={labelX} y={axisY - 8} fontSize={11} fill="#b45309">Optical axis</text> : null}
            </g>
          );
        })()}

        {/* Table Tilt teaching reference: the physical tabletop span anchors the
            focus/DOF helpers to the subject instead of the floor-sized bounds. */}
        {profile.showTabletopGuide && geometryView === 'side' && scene.compositionTargets[0] ? (() => {
          const subjectBounds = scene.compositionTargets[0].worldBounds;
          const tabletopY = (subjectBounds.min.y + subjectBounds.max.y) / 2;
          const depthForZ = (z: number) => (
            ((-sectionOrigin.x) * sectionDepthDir.x) +
            ((tabletopY - sectionOrigin.y) * sectionDepthDir.y) +
            ((z - sectionOrigin.z) * sectionDepthDir.z)
          );
          const x1 = depthToX(depthForZ(subjectBounds.min.z));
          const x2 = depthToX(depthForZ(subjectBounds.max.z));
          const y = mapLateralToY(tabletopY);
          return (
            <g data-testid="tabletop-guide">
              <line x1={x1} y1={y} x2={x2} y2={y} stroke="#92400e" strokeWidth={3} />
              <text x={x2 - 4} y={y + 18} fontSize={12} fill="#78350f" textAnchor="end">Tabletop</text>
            </g>
          );
        })() : null}

        {/* DOF region */}
        {(!isInfinity && opticsState.depthOfFieldNearPlane && opticsState.depthOfFieldFarPlane) && (() => {
          const near = segments.find((s) => s.id === 'nearDof');
          const far = segments.find((s) => s.id === 'farDof');
          if (near && far) {
            const points = `${near.p1.x},${near.p1.y} ${near.p2.x},${near.p2.y} ${far.p2.x},${far.p2.y} ${far.p1.x},${far.p1.y}`;
            return <polygon data-testid="dof-region" points={points} fill="#8b5cf6" opacity={profile.dofFillOpacity} stroke="#8b5cf6" />;
          }
          return null;
        })()}

        {/* Film and lens segments */}
        {segments.map((s) => (
          <line key={s.id} x1={s.p1.x} y1={s.p1.y} x2={s.p2.x} y2={s.p2.y} stroke={s.color} strokeWidth={2} strokeDasharray={s.id === 'focus' ? '6 4' : undefined} aria-label={`${s.id} plane`} data-testid={s.id === 'film' ? 'plane-line-film' : s.id === 'lens' ? 'plane-line-lens' : s.id === 'focus' ? 'plane-line-focus' : undefined} />
        ))}

        {scene.id === "table-tilt" && geometryView === "side" && (() => {
          const focus = segments.find((segment) => segment.id === "focus");
          if (!focus) return null;
          const minX = Math.min(focus.p1.x, focus.p2.x);
          const maxX = Math.max(focus.p1.x, focus.p2.x);
          const labelX = minX + Math.min(120, (maxX - minX) * 0.15);
          const labelY = focus.p1.x < focus.p2.x ? focus.p1.y : focus.p2.y;
          return <text x={labelX} y={labelY - 10} fontSize={12} fontWeight={600} fill="#15803d">Focus plane</text>;
        })()}

        {/* Camera glyphs */}
        {(() => {
          const filmSeg = segments.find((s) => s.id === 'film');
          const filmCenter = filmSeg ? { x: (filmSeg.p1.x + filmSeg.p2.x) / 2, y: (filmSeg.p1.y + filmSeg.p2.y) / 2 } : { x: depthToX(((opticsState.filmCenterWorld.x - sectionOrigin.x) * sectionDepthDir.x) + ((opticsState.filmCenterWorld.y - sectionOrigin.y) * sectionDepthDir.y) + ((opticsState.filmCenterWorld.z - sectionOrigin.z) * sectionDepthDir.z)), y: geometryView === 'side' ? mapLateralToY(opticsState.filmCenterWorld.y) : mapLateralToYTop(opticsState.filmCenterWorld.x) };
          const depthLens = ((lensCenter.x - sectionOrigin.x) * sectionDepthDir.x) + ((lensCenter.y - sectionOrigin.y) * sectionDepthDir.y) + ((lensCenter.z - sectionOrigin.z) * sectionDepthDir.z);
          const lensX = depthToX(depthLens);
          const lensY = geometryView === 'side' ? mapLateralToY(lensCenter.y) : mapLateralToYTop(lensCenter.x);

          if (geometryView === 'side') {
            const rw = 12; const rh = 28; const rx = filmCenter.x - rw / 2; const ry = filmCenter.y - rh / 2;
            const fw = 14; const fh = 32; const fx = lensX - fw / 2; const fy = lensY - fh / 2;
            return (
              <g>
                <rect x={rx} y={ry} width={rw} height={rh} fill="#1f2937" opacity={0.9} />
                <rect x={fx} y={fy} width={fw} height={fh} fill="#475569" opacity={0.95} />
              </g>
            );
          }

          const rw = 8; const rh = 24; const rx = filmCenter.x - rw / 2; const ry = filmCenter.y - rh / 2;
          const fw = 10; const fh = 28; const fx = lensX - fw / 2; const fy = lensY - fh / 2;
          return (
            <g>
              <rect x={rx} y={ry} width={rw} height={rh} fill="#1f2937" opacity={0.9} />
              <rect x={fx} y={fy} width={fw} height={fh} fill="#475569" opacity={0.95} />
              <circle cx={lensX} cy={lensY} r={4} fill="#111827" opacity={0.9} />
            </g>
          );
        })()}

        {/* Targets */}
        {scene.focusTargets.map((t) => {
          const depth = ((t.worldPosition.x - sectionOrigin.x) * sectionDepthDir.x) + ((t.worldPosition.y - sectionOrigin.y) * sectionDepthDir.y) + ((t.worldPosition.z - sectionOrigin.z) * sectionDepthDir.z);
          const x = depthToX(depth);
          const y = geometryView === 'side' ? mapLateralToY(t.worldPosition.y) : mapLateralToYTop(t.worldPosition.x);
          const labelText = scene.id === "table-tilt"
            ? t.id === "near-cup"
              ? "Near stripe"
              : t.id === "mid-notebook"
                ? "Middle lines"
                : "Far chart"
            : /near/i.test(t.id)
              ? "Near board"
              : /far/i.test(t.id)
                ? "Far board"
                : "Target";
          if (geometryView === 'side') {
            const placement = getLocalTargetLabelPlacement({ targetX: x, targetY: y, text: labelText, svgWidth, svgHeight, safeMargin: SAFE_MARGIN });
            return (
              <g key={t.id} data-testid={`geometry-target-${t.id}`}>
                <rect x={x - 6} y={y - 20} width={12} height={16} fill="#0f766e" />
                <rect x={x - 2} y={y - 4} width={4} height={8} fill="#6b7280" />
                {profile.targetLabelMode === 'short-local' ? (
                  <text x={placement.x} y={placement.y} fontSize={12} fill="#064e3b" textAnchor={placement.anchor}>{labelText}</text>
                ) : null}
              </g>
            );
          }
          const placementTop = getLocalTargetLabelPlacement({ targetX: x, targetY: y, text: labelText, svgWidth, svgHeight, safeMargin: SAFE_MARGIN });
          return (
            <g key={t.id} data-testid={`geometry-target-${t.id}`}>
              <rect x={x - 3} y={y - 9} width={6} height={18} fill="#0f766e" />
              <line x1={x} y1={y + 9} x2={x} y2={y + 13} stroke="#0b5e54" strokeWidth={1} />
              {profile.targetLabelMode === 'short-local' ? (
                <text x={placementTop.x} y={placementTop.y} fontSize={12} fill="#064e3b" textAnchor={placementTop.anchor}>{labelText}</text>
              ) : null}
            </g>
          );
        })}

        {/* Focus point */}
        {!isInfinity && opticsState.focusPlane && (() => {
          const fp = opticsState.focusPlane!.point;
          const depth = ((fp.x - sectionOrigin.x) * sectionDepthDir.x) + ((fp.y - sectionOrigin.y) * sectionDepthDir.y) + ((fp.z - sectionOrigin.z) * sectionDepthDir.z);
          const x = depthToX(depth);
          const y = geometryView === 'side' ? mapLateralToY(fp.y) : mapLateralToYTop(fp.x);
          return <circle cx={x} cy={y} r={4} fill="#dc2626" />;
        })()}

        {/* hinge */}
        {profile.showHingeMarker && opticsState.lensFilmHingeLine && (() => {
          const h = opticsState.lensFilmHingeLine.point;
          const depth = ((h.x - sectionOrigin.x) * sectionDepthDir.x) + ((h.y - sectionOrigin.y) * sectionDepthDir.y) + ((h.z - sectionOrigin.z) * sectionDepthDir.z);
          const x = depthToX(depth);
          const y = geometryView === 'side' ? mapLateralToY(h.y) : mapLateralToYTop(h.x);
          return <circle cx={x} cy={y} r={3} fill="#7c3aed" />;
        })()}
      </g>
    </svg>
  );
};

export default OpticalSectionDiagram;
