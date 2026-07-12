import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useSimulatorSuitability } from "../../hooks/useSimulatorSuitability";

// Helper to mock matchMedia
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
function mockMatchMedia(matchesMap: Record<string, boolean>) {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  const mm = (query: string) => {
    const obj: any = {
      media: query,
      matches: !!matchesMap[query],
      addEventListener: (_ev: string, fn: (e: any) => void) => {
        listeners[query] = listeners[query] || [];
        listeners[query].push(fn);
      },
      removeEventListener: (_ev: string, fn: (e: any) => void) => {
        listeners[query] = (listeners[query] || []).filter((f) => f !== fn);
      },
      dispatch: (matches: boolean) => {
        obj.matches = matches;
        (listeners[query] || []).forEach((fn) => fn({ matches }));
      },
    };
    return obj;
  };

  // @ts-ignore
  window.matchMedia = mm;
  return { listeners, mm };
}

describe("useSimulatorSuitability", () => {
  let origInnerWidth: number;
  let origMatchMedia: any;

  beforeEach(() => {
    origInnerWidth = (window as any).innerWidth;
    origMatchMedia = (window as any).matchMedia;
  });

  afterEach(() => {
    (window as any).innerWidth = origInnerWidth;
    (window as any).matchMedia = origMatchMedia;
    vi.restoreAllMocks();
  });

  it("returns no warning for wide desktop (1280, fine pointer)", () => {
    (window as any).innerWidth = 1280;
    mockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { result } = renderHook(() => useSimulatorSuitability());
    expect(result.current.shouldWarn).toBe(false);
    expect(result.current.isNarrowViewport).toBe(false);
  });

  it("warns for narrow desktop window (800, fine pointer)", () => {
    (window as any).innerWidth = 800;
    mockMatchMedia({ "(max-width: 899px)": true, "(pointer: coarse)": false });

    const { result } = renderHook(() => useSimulatorSuitability());
    expect(result.current.shouldWarn).toBe(true);
    expect(result.current.isNarrowViewport).toBe(true);
  });

  it("warns for mobile/tablet like device (390, coarse pointer)", () => {
    (window as any).innerWidth = 390;
    mockMatchMedia({ "(max-width: 899px)": true, "(pointer: coarse)": true });

    const { result } = renderHook(() => useSimulatorSuitability());
    expect(result.current.shouldWarn).toBe(true);
    expect(result.current.isLikelyMobileOrTablet).toBe(true);
  });

  it("does not warn for wide touch-capable desktop (1280, coarse pointer)", () => {
    (window as any).innerWidth = 1280;
    mockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": true });

    const { result } = renderHook(() => useSimulatorSuitability());
    expect(result.current.shouldWarn).toBe(false);
    expect(result.current.isLikelyMobileOrTablet).toBe(true);
  });

  it("is safe when matchMedia is missing", () => {
    (window as any).innerWidth = 1024;
    // remove matchMedia
    // @ts-ignore
    delete window.matchMedia;

    const { result } = renderHook(() => useSimulatorSuitability());
    expect(typeof result.current.shouldWarn).toBe("boolean");
  });

  it("updates on resize and cleans listeners", async () => {
    (window as any).innerWidth = 1000;
    const { mm } = mockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { result, unmount } = renderHook(() => useSimulatorSuitability());
    expect(result.current.shouldWarn).toBe(false);

    // simulate narrow
    (window as any).innerWidth = 800;
    act(() => {
      // when underlying media query changes, dispatch the change
      mm("(max-width: 899px)").dispatch(true);
      window.dispatchEvent(new Event("resize"));
    });

    // allow effect to run
    // wait for the hook to update
    await waitFor(() => {
      expect(result.current.viewportWidth).toBe(800);
    });

    unmount();
    // ensure no errors when unmounted
  });
});
