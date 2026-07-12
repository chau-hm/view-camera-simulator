import { calculateFocusTargetDisplaySharpness } from "../../components/simulator/focusTargetDisplay";

test("exact focus returns 100", () => {
  expect(calculateFocusTargetDisplaySharpness({ sharpness: 1 })).toBe(100);
});

test("monotonic with normalized defocus", () => {
  const a = calculateFocusTargetDisplaySharpness({ normalizedDefocus: 0.0 });
  const b = calculateFocusTargetDisplaySharpness({ normalizedDefocus: 0.5 });
  const c = calculateFocusTargetDisplaySharpness({ normalizedDefocus: 2.0 });
  expect(a).toBeGreaterThanOrEqual(b);
  expect(b).toBeGreaterThanOrEqual(c);
});

test("clamps to 0-100 and handles unresolved", () => {
  expect(calculateFocusTargetDisplaySharpness({})).toBe(0);
  expect(calculateFocusTargetDisplaySharpness({ sharpness: -1 })).toBe(0);
  expect(calculateFocusTargetDisplaySharpness({ sharpness: 2 })).toBe(100);
});
