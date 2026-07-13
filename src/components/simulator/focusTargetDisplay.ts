import type { FocusTargetSharpness } from '../../types/optics';

// Map physical FocusTargetSharpness to a display integer 0..100
export function calculateFocusTargetDisplaySharpness(target: Partial<FocusTargetSharpness> | { id?: string; sharpness?: number; normalizedDefocus?: number }): number {
  // Prefer canonical sharpness when provided (0..1)
  if (typeof target.sharpness === 'number' && isFinite(target.sharpness)) {
    const v = Math.round(clamp(target.sharpness * 100, 0, 100));
    return v;
  }

  // Fallback: try normalizedDefocus -> map to sharpness using simple 1/(1+|d|) curve
  if (typeof target.normalizedDefocus === 'number' && isFinite(target.normalizedDefocus)) {
    const d = Math.abs(target.normalizedDefocus);
    // mapping: exact focus (0) -> 100, larger defocus reduces toward 0
    const s = 1 / (1 + d);
    return Math.round(clamp(s * 100, 0, 100));
  }

  // unresolved target
  return 0;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
