import { describe, expect, it } from 'vitest';
import { calculateFocusTargetDisplaySharpness } from '../../components/simulator/focusTargetDisplay';

describe('focus target display mapping', () => {
  it('exact focus returns 100', () => {
    expect(calculateFocusTargetDisplaySharpness({ sharpness: 1 })).toBe(100);
  });

  it('monotonic with normalized defocus', () => {
    const a = calculateFocusTargetDisplaySharpness({ normalizedDefocus: 0.0 });
    const b = calculateFocusTargetDisplaySharpness({ normalizedDefocus: 0.5 });
    const c = calculateFocusTargetDisplaySharpness({ normalizedDefocus: 2.0 });
    expect(a).toBeGreaterThanOrEqual(b);
    expect(b).toBeGreaterThanOrEqual(c);
  });

  it('clamps to 0-100 and handles unresolved', () => {
    expect(calculateFocusTargetDisplaySharpness({})).toBe(0);
    expect(calculateFocusTargetDisplaySharpness({ sharpness: -1 })).toBe(0);
    expect(calculateFocusTargetDisplaySharpness({ sharpness: 2 })).toBe(100);
  });
});
