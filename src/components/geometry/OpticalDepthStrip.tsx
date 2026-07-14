import type { DerivedOpticsState } from '../../types/optics';
import type { GeometryPresentationProfile } from './geometryPresentationProfiles';

type Props = {
  opticsState: DerivedOpticsState;
  sectionOrigin: { x: number; y: number; z: number };
  sectionDepthDir: { x: number; y: number; z: number };
  depthWindow: { minMm: number; maxMm: number };
  profile: GeometryPresentationProfile;
};

export const OpticalDepthStrip = ({ opticsState, sectionOrigin, sectionDepthDir, depthWindow, profile }: Props) => {
  const fmt = (d: number | null) => {
    if (d === null) return '∞';
    if (d < 1000) return `${Math.round(d)} mm`;
    return `${(d/1000).toFixed(1)} m`;
  };

  // Build items with their physical rear-datum depth values (in mm)
  const items: { key: string; label: string; color: string; depth: number | null; isInfinity?: boolean }[] = [];

  // Film datum: by definition at section origin depth = 0
  items.push({ key: 'film', label: 'Film', color: '#0284c7', depth: 0 });

  const depthAlong = (pt: { x: number; y: number; z: number }) => (((pt.x - sectionOrigin.x) * sectionDepthDir.x) + ((pt.y - sectionOrigin.y) * sectionDepthDir.y) + ((pt.z - sectionOrigin.z) * sectionDepthDir.z));

  items.push({ key: 'lens', label: 'Lens', color: '#475569', depth: depthAlong(opticsState.lensCenterWorld) });

  if (opticsState.depthOfFieldNearPlane) {
    // Near DOF shown as a DOF limit (blue)
    items.push({ key: 'nearDof', label: 'DOF limit', color: '#0284c7', depth: depthAlong(opticsState.depthOfFieldNearPlane.point) });
  }

  const isInfinityFocus = !!opticsState.diagnostics?.isInfinityFocus;

  if (isInfinityFocus) {
    // In real infinity focus mode, focusPlane and far DOF are physically infinite/absent
    // but the depth strip should explicitly show the infinity chips for Focus and Far DOF.
    items.push({ key: 'focus', label: 'Focus', color: '#16a34a', depth: null, isInfinity: true });
    items.push({ key: 'farDof', label: 'Far DOF', color: '#8b5cf6', depth: null, isInfinity: true });
  } else {
    if (opticsState.focusPlane) {
      items.push({ key: 'focus', label: 'Focus', color: '#16a34a', depth: depthAlong(opticsState.focusPlane.point) });
    }

    if (opticsState.depthOfFieldFarPlane) {
      items.push({ key: 'farDof', label: 'Far DOF', color: '#8b5cf6', depth: depthAlong(opticsState.depthOfFieldFarPlane.point) });
    }
  }

  // This is the film-plane / lens-plane common line, not the Hinge Rule line.
  if (profile.showScheimpflugIntersection && opticsState.lensFilmHingeLine) {
    items.push({ key: 'scheimpflug', label: 'Scheimpflug intersection', color: '#7c3aed', depth: depthAlong(opticsState.lensFilmHingeLine.point) });
  }

  // Sort finite items by increasing depth (null/infinite go last)
  items.sort((a, b) => {
    const da = a.depth === null ? Number.POSITIVE_INFINITY : a.depth;
    const db = b.depth === null ? Number.POSITIVE_INFINITY : b.depth;
    return da - db;
  });

  // Render chips; if an item's finite depth lies outside the current depth window, show continuation text
  const chips = items.map((it) => {
    if (it.depth === null) {
      // explicit infinity item
      return { key: it.key, color: it.color, text: `${it.label} ∞` };
    }
    if (it.depth < depthWindow.minMm) {
      return { key: it.key, color: it.color, text: `${it.label} < ${fmt(depthWindow.minMm)}` };
    }
    if (it.depth > depthWindow.maxMm) {
      return { key: it.key, color: it.color, text: `${it.label} > ${fmt(depthWindow.maxMm)}` };
    }
    return { key: it.key, color: it.color, text: `${it.label} ${fmt(it.depth)}` };
  });
  return (
    <div aria-label="Optical depth order" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
      {chips.map((c) => (
        <div key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 0 rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.03)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color, display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#0f172a' }}>{c.text}</span>
        </div>
      ))}
    </div>
  );
};

export default OpticalDepthStrip;
