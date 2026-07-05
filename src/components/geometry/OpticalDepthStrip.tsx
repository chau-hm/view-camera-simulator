import type { DerivedOpticsState } from '../../types/optics';

type Props = {
  opticsState: DerivedOpticsState;
  sectionOrigin: { x: number; y: number; z: number };
  sectionDepthDir: { x: number; y: number; z: number };
};

export const OpticalDepthStrip = ({ opticsState, sectionOrigin, sectionDepthDir }: Props) => {
  const fmt = (d: number | null) => {
    if (d === null) return '∞';
    if (d < 1000) return `${Math.round(d)} mm`;
    return `${(d/1000).toFixed(1)} m`;
  };

  const chips: { key: string; label: string; color: string }[] = [];
  // Film datum at 0 mm
  chips.push({ key: 'film', label: `Film 0 mm`, color: '#0284c7' });
  const sectionOriginVec = sectionOrigin;
  const sectionDir = sectionDepthDir;
  const lensDepth = opticsState ? (sectionDir && sectionOriginVec ? (
    (sectionDir.x||0, sectionDir.y||0, sectionDir.z||0),
    // compute scalar distance along depth dir
    (
      ((opticsState.lensCenterWorld.x - sectionOriginVec.x) * sectionDir.x) + ((opticsState.lensCenterWorld.y - sectionOriginVec.y) * sectionDir.y) + ((opticsState.lensCenterWorld.z - sectionOriginVec.z) * sectionDir.z)
    )
  ) : 0) : 0;
  chips.push({ key: 'lens', label: `Lens ${fmt(lensDepth)}`, color: '#475569' });

  if (opticsState.depthOfFieldNearPlane) {
    const d = ((opticsState.depthOfFieldNearPlane.point.x - sectionOriginVec.x) * sectionDir.x) + ((opticsState.depthOfFieldNearPlane.point.y - sectionOriginVec.y) * sectionDir.y) + ((opticsState.depthOfFieldNearPlane.point.z - sectionOriginVec.z) * sectionDir.z);
    chips.push({ key: 'nearDof', label: `Near DOF ${fmt(d)}`, color: '#8b5cf6' });
  }
  if (opticsState.diagnostics?.isInfinityFocus) {
    chips.push({ key: 'focus', label: `Focus ∞`, color: '#16a34a' });
  } else if (opticsState.focusPlane) {
    const d = ((opticsState.focusPlane.point.x - sectionOriginVec.x) * sectionDir.x) + ((opticsState.focusPlane.point.y - sectionOriginVec.y) * sectionDir.y) + ((opticsState.focusPlane.point.z - sectionOriginVec.z) * sectionDir.z);
    chips.push({ key: 'focus', label: `Focus ${fmt(d)}`, color: '#16a34a' });
  }
  if (opticsState.depthOfFieldFarPlane) {
    if (opticsState.diagnostics?.isInfinityFocus) chips.push({ key: 'farDof', label: `Far DOF ∞`, color: '#8b5cf6' });
    else {
      const d = ((opticsState.depthOfFieldFarPlane.point.x - sectionOriginVec.x) * sectionDir.x) + ((opticsState.depthOfFieldFarPlane.point.y - sectionOriginVec.y) * sectionDir.y) + ((opticsState.depthOfFieldFarPlane.point.z - sectionOriginVec.z) * sectionDir.z);
      chips.push({ key: 'farDof', label: `Far DOF ${fmt(d)}`, color: '#8b5cf6' });
    }
  }

  return (
    <div aria-label="Optical depth order" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
      {chips.map((c) => (
        <div key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 0 rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.03)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color, display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#0f172a' }}>{c.label}</span>
        </div>
      ))}
    </div>
  );
};

export default OpticalDepthStrip;
