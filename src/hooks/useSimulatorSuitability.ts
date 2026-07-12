import { useEffect, useState } from "react";

export type SimulatorSuitability = {
  shouldWarn: boolean;
  isNarrowViewport: boolean;
  isLikelyMobileOrTablet: boolean;
  viewportWidth: number | null;
};

// Legacy support for older MediaQueryList implementations
type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (ev: MediaQueryListEvent) => void) => void;
};

export function calculateSimulatorSuitability(input: {
  viewportWidth: number | null;
  narrowViewportMatches?: boolean;
  coarsePointerMatches?: boolean;
  userAgentMobile?: boolean;
}): SimulatorSuitability {
  const { viewportWidth, narrowViewportMatches, coarsePointerMatches, userAgentMobile } = input;

  const isNarrowViewport = typeof narrowViewportMatches === "boolean"
    ? narrowViewportMatches
    : (viewportWidth !== null ? viewportWidth < 900 : false);

  const isLikelyMobileOrTablet = typeof coarsePointerMatches === "boolean"
    ? coarsePointerMatches
    : !!(userAgentMobile ?? false);

  const shouldWarn = isNarrowViewport || (isLikelyMobileOrTablet && viewportWidth !== null && viewportWidth < 1024);

  return { shouldWarn, isNarrowViewport, isLikelyMobileOrTablet, viewportWidth };
}

export function useSimulatorSuitability(): SimulatorSuitability {
  const safeMatchMedia = (query: string): MediaQueryList | null => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    try {
      return window.matchMedia(query);
    } catch {
      return null;
    }
  };

  const readUserAgentMobile = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as unknown as { userAgentData?: { mobile?: boolean } };
    return !!(nav.userAgentData?.mobile ?? false);
  };

  const getInitial = (): SimulatorSuitability => {
    const mqNarrow = safeMatchMedia("(max-width: 899px)");
    const mqCoarse = safeMatchMedia("(pointer: coarse)");
    const viewportWidth = typeof window !== "undefined" && typeof window.innerWidth === "number" ? window.innerWidth : null;

    return calculateSimulatorSuitability({
      viewportWidth,
      narrowViewportMatches: mqNarrow ? mqNarrow.matches : undefined,
      coarsePointerMatches: mqCoarse ? mqCoarse.matches : undefined,
      userAgentMobile: readUserAgentMobile(),
    });
  };

  const [state, setState] = useState<SimulatorSuitability>(getInitial);

  useEffect(() => {
    const mqNarrow = safeMatchMedia("(max-width: 899px)") as LegacyMediaQueryList | null;
    const mqCoarse = safeMatchMedia("(pointer: coarse)") as LegacyMediaQueryList | null;

    const recalc = () => {
      const viewportWidth = typeof window !== "undefined" && typeof window.innerWidth === "number" ? window.innerWidth : null;
      const narrowMatches = mqNarrow ? mqNarrow.matches : undefined;
      const coarseMatches = mqCoarse ? mqCoarse.matches : undefined;
      setState(calculateSimulatorSuitability({
        viewportWidth,
        narrowViewportMatches: narrowMatches === undefined ? undefined : narrowMatches,
        coarsePointerMatches: coarseMatches === undefined ? undefined : coarseMatches,
        userAgentMobile: readUserAgentMobile(),
      }));
    };

    // Attach change listeners — use addEventListener when available, fallback to legacy addListener
    const attach = (mql: LegacyMediaQueryList | null, listener: () => void) => {
      if (!mql) return;
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", listener as EventListener);
      } else if (typeof mql.addListener === "function") {
        mql.addListener(listener as any);
      }
    };

    const detach = (mql: LegacyMediaQueryList | null, listener: () => void) => {
      if (!mql) return;
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", listener as EventListener);
      } else if (typeof mql.removeListener === "function") {
        mql.removeListener(listener as any);
      }
    };

    attach(mqNarrow, recalc);
    attach(mqCoarse, recalc);

    const onResize = () => recalc();
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);

    // run initial calculation
    recalc();

    return () => {
      detach(mqNarrow, recalc);
      detach(mqCoarse, recalc);
      if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    };
  }, []);

  return state;
}
