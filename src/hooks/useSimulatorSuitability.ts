/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";

export type SimulatorSuitability = {
  shouldWarn: boolean;
  isNarrowViewport: boolean;
  isLikelyMobileOrTablet: boolean;
  viewportWidth: number | null;
};

export function useSimulatorSuitability(): SimulatorSuitability {
  const safeMatchMedia = (query: string): MediaQueryList | null => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    try {
      return window.matchMedia(query);
    } catch {
      return null;
    }
  };

  const getInitial = (): SimulatorSuitability => {
    const mqNarrow = safeMatchMedia("(max-width: 899px)");
    const mqCoarse = safeMatchMedia("(pointer: coarse)");
    const viewportWidth = typeof window !== "undefined" && typeof window.innerWidth === "number" ? window.innerWidth : null;
    const isNarrowViewport = mqNarrow ? mqNarrow.matches : (viewportWidth !== null ? viewportWidth < 900 : false);
    const navigatorUA = typeof navigator !== "undefined" ? (navigator as unknown as { userAgentData?: { mobile?: boolean } }) : undefined;
    const isLikelyMobileOrTablet = mqCoarse ? mqCoarse.matches : !!(navigatorUA?.userAgentData?.mobile ?? false);

    const shouldWarn = isNarrowViewport || (isLikelyMobileOrTablet && viewportWidth !== null && viewportWidth < 1024);

    return { shouldWarn, isNarrowViewport, isLikelyMobileOrTablet, viewportWidth };
  };

  const [state, setState] = useState<SimulatorSuitability>(getInitial);

  useEffect(() => {
    const mqNarrow = safeMatchMedia("(max-width: 899px)");
    const mqCoarse = safeMatchMedia("(pointer: coarse)");

    const handle = (e?: { matches?: boolean }) => {
      const viewportWidth = typeof window !== "undefined" && typeof window.innerWidth === "number" ? window.innerWidth : null;
      const mqNarrowMatches = typeof e?.matches === "boolean" ? e!.matches : (mqNarrow ? mqNarrow.matches : undefined);
      const isNarrowViewport = typeof mqNarrowMatches === "boolean" ? mqNarrowMatches : (viewportWidth !== null ? viewportWidth < 900 : false);
      const mqCoarseMatches = typeof e?.matches === "boolean" ? e!.matches : (mqCoarse ? mqCoarse.matches : undefined);
      const navigatorUA = typeof navigator !== "undefined" ? (navigator as unknown as { userAgentData?: { mobile?: boolean } }) : undefined;
      const isLikelyMobileOrTablet = typeof mqCoarseMatches === "boolean" ? mqCoarseMatches : !!(navigatorUA?.userAgentData?.mobile ?? false);
      const shouldWarn = isNarrowViewport || (isLikelyMobileOrTablet && viewportWidth !== null && viewportWidth < 1024);
      setState({ shouldWarn, isNarrowViewport, isLikelyMobileOrTablet, viewportWidth });
    };

    // listener for media queries
    if (mqNarrow && typeof mqNarrow.addEventListener === "function") {
      mqNarrow.addEventListener("change", handle);
    } else if (mqNarrow && typeof (mqNarrow as any).addListener === "function") {
      (mqNarrow as any).addListener(handle);
    }

    if (mqCoarse && typeof mqCoarse.addEventListener === "function") {
      mqCoarse.addEventListener("change", handle);
    } else if (mqCoarse && typeof (mqCoarse as any).addListener === "function") {
      (mqCoarse as any).addListener(handle);
    }

    // window resize fallback
    const onResize = () => handle();
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);

    // initial
    handle();

    return () => {
      if (mqNarrow && typeof mqNarrow.removeEventListener === "function") {
        mqNarrow.removeEventListener("change", handle);
      } else if (mqNarrow && typeof (mqNarrow as any).removeListener === "function") {
        (mqNarrow as any).removeListener(handle);
      }

      if (mqCoarse && typeof mqCoarse.removeEventListener === "function") {
        mqCoarse.removeEventListener("change", handle);
      } else if (mqCoarse && typeof (mqCoarse as any).removeListener === "function") {
        (mqCoarse as any).removeListener(handle);
      }

      if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
    };
  }, []);

  return state;
}
