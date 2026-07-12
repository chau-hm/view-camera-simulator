import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useSimulatorSuitability } from "../../hooks/useSimulatorSuitability";

// Stable matchMedia mock that returns the same MQL object per query and
// exposes listener registries for assertions.
function createMockMatchMedia(initial: Record<string, boolean>) {
  const registry: Record<
    string,
    {
      matches: boolean;
      listeners: ((e: MediaQueryListEvent) => void)[];
      addEventListener?: (ev: string, fn: (e: MediaQueryListEvent) => void) => void;
      removeEventListener?: (ev: string, fn: (e: MediaQueryListEvent) => void) => void;
      addListener?: (fn: (e: MediaQueryListEvent) => void) => void;
      removeListener?: (fn: (e: MediaQueryListEvent) => void) => void;
    }
  > = {};

  const mm = (query: string) => {
    if (!registry[query]) {
      registry[query] = {
        matches: !!initial[query],
        listeners: [],
        addEventListener(ev: string, fn: (e: MediaQueryListEvent) => void) {
          registry[query].listeners.push(fn);
        },
        removeEventListener(ev: string, fn: (e: MediaQueryListEvent) => void) {
          registry[query].listeners = registry[query].listeners.filter((l) => l !== fn);
        },
        addListener(fn: (e: MediaQueryListEvent) => void) {
          registry[query].listeners.push(fn);
        },
        removeListener(fn: (e: MediaQueryListEvent) => void) {
          registry[query].listeners = registry[query].listeners.filter((l) => l !== fn);
        },
      } as any;
    }

    const obj: any = {
      media: query,
      get matches() {
        return registry[query].matches;
      },
      set matches(v: boolean) {
        registry[query].matches = v;
      },
      addEventListener: registry[query].addEventListener,
      removeEventListener: registry[query].removeEventListener,
      addListener: registry[query].addListener,
      removeListener: registry[query].removeListener,
      dispatch(matches: boolean) {
        registry[query].matches = matches;
        const event = { matches } as MediaQueryListEvent;
        registry[query].listeners.forEach((fn) => fn(event));
      },
    };

    return obj as MediaQueryList & { dispatch: (m: boolean) => void };
  };

  // @ts-expect-error - replace global for testing
  window.matchMedia = mm;

  return {
    mm,
    registry,
  };
}

describe("useSimulatorSuitability", () => {
  let origInnerWidth: number | undefined;
  let origMatchMedia: any;

  beforeEach(() => {
    origInnerWidth = (window as any).innerWidth;
    origMatchMedia = (window as any).matchMedia;
  });

  afterEach(() => {
    if (typeof origInnerWidth !== "undefined") (window as any).innerWidth = origInnerWidth;
    else delete (window as any).innerWidth;
    // restore original
    (window as any).matchMedia = origMatchMedia;
    vi.restoreAllMocks();
  });

  it("A: coarse-pointer change on wide viewport updates pointer state only", async () => {
    (window as any).innerWidth = 1280;
    const { mm, registry } = createMockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { result, unmount } = renderHook(() => useSimulatorSuitability());

    expect(result.current.isNarrowViewport).toBe(false);
    expect(result.current.isLikelyMobileOrTablet).toBe(false);
    expect(result.current.shouldWarn).toBe(false);

    // Dispatch coarse pointer true
    act(() => {
      (mm("(pointer: coarse)") as any).dispatch(true);
    });

    // pointer state should update; narrow remains false and shouldWarn remains false at wide width
    await waitFor(() => {
      expect(result.current.isLikelyMobileOrTablet).toBe(true);
      expect(result.current.isNarrowViewport).toBe(false);
      expect(result.current.shouldWarn).toBe(false);
    });

    unmount();
    // listeners cleaned
    expect(Object.values(registry).every((r) => r.listeners.length === 0)).toBe(true);
  });

  it("B: narrow-query change with fine pointer triggers warning", async () => {
    (window as any).innerWidth = 1280;
    const { mm, registry } = createMockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { result, unmount } = renderHook(() => useSimulatorSuitability());
    expect(result.current.shouldWarn).toBe(false);

    // change width and dispatch narrow true
    (window as any).innerWidth = 800;
    act(() => {
      (mm("(max-width: 899px)") as any).dispatch(true);
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.isNarrowViewport).toBe(true);
      expect(result.current.isLikelyMobileOrTablet).toBe(false);
      expect(result.current.shouldWarn).toBe(true);
    });

    unmount();
    expect(Object.values(registry).every((r) => r.listeners.length === 0)).toBe(true);
  });

  it("C: narrow query clears when returning to wide width and coarse remains", async () => {
    (window as any).innerWidth = 800;
    const { mm, registry } = createMockMatchMedia({ "(max-width: 899px)": true, "(pointer: coarse)": false });

    const { result, unmount } = renderHook(() => useSimulatorSuitability());
    expect(result.current.isNarrowViewport).toBe(true);

    // go back wide
    (window as any).innerWidth = 1280;
    act(() => {
      (mm("(max-width: 899px)") as any).dispatch(false);
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.isNarrowViewport).toBe(false);
      expect(result.current.shouldWarn).toBe(false);
    });

    // coarse remains unchanged (false)
    expect(result.current.isLikelyMobileOrTablet).toBe(false);

    unmount();
    expect(Object.values(registry).every((r) => r.listeners.length === 0)).toBe(true);
  });

  it("D: coarse pointer at tablet width triggers warning", async () => {
    (window as any).innerWidth = 1000;
    const { mm, registry } = createMockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { result, unmount } = renderHook(() => useSimulatorSuitability());

    // coarse turns on
    act(() => {
      (mm("(pointer: coarse)") as any).dispatch(true);
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.isLikelyMobileOrTablet).toBe(true);
      expect(result.current.shouldWarn).toBe(true);
    });

    unmount();
    expect(Object.values(registry).every((r) => r.listeners.length === 0)).toBe(true);
  });

  it("E: coarse pointer on wide desktop does not warn", async () => {
    (window as any).innerWidth = 1280;
    const { mm, registry } = createMockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { result, unmount } = renderHook(() => useSimulatorSuitability());

    act(() => {
      (mm("(pointer: coarse)") as any).dispatch(true);
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current.isLikelyMobileOrTablet).toBe(true);
      expect(result.current.shouldWarn).toBe(false);
    });

    unmount();
    expect(Object.values(registry).every((r) => r.listeners.length === 0)).toBe(true);
  });

  it("F: listener cleanup removes all registered handlers on unmount", async () => {
    (window as any).innerWidth = 1024;
    const { mm, registry } = createMockMatchMedia({ "(max-width: 899px)": false, "(pointer: coarse)": false });

    const { unmount } = renderHook(() => useSimulatorSuitability());

    // listeners were attached
    expect(Object.values(registry).some((r) => r.listeners.length > 0)).toBe(true);

    unmount();

    // now all listener lists should be empty
    expect(Object.values(registry).every((r) => r.listeners.length === 0)).toBe(true);
  });
});
