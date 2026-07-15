/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  calculateGroundGlassAnchoredPan,
  denormalizeGroundGlassPan,
  GROUND_GLASS_ZOOM_SCALE,
  normalizeGroundGlassPan,
  type GroundGlassPanOffset,
} from "./groundGlassStageTransform";

const ZOOM_SCALE = GROUND_GLASS_ZOOM_SCALE;

export const GROUND_GLASS_POINTER_THRESHOLDS_PX = {
  mouse: 8,
  pen: 10,
  touch: 12,
} as const;

export const getGroundGlassPointerThresholdPx = (pointerType?: string): number => {
  if (pointerType === "touch") return GROUND_GLASS_POINTER_THRESHOLDS_PX.touch;
  if (pointerType === "pen") return GROUND_GLASS_POINTER_THRESHOLDS_PX.pen;
  return GROUND_GLASS_POINTER_THRESHOLDS_PX.mouse;
};

type PanOffset = GroundGlassPanOffset;
const ZERO_PAN: PanOffset = { x: 0, y: 0 };

const PANEL_WIDTH_PX = 500;
const PANEL_HEIGHT_PX = 400;

type DragState = {
  pointerId: number | null;
  pointerType: string;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
  moved: boolean;
  captured: boolean;
};

const createIdleDragState = (): DragState => ({
  pointerId: null,
  pointerType: "mouse",
  startX: 0,
  startY: 0,
  startPanX: 0,
  startPanY: 0,
  moved: false,
  captured: false,
});

type GroundGlassStageProps = {
  zoomEnabled?: boolean;
  imageLayer: ReactNode;
  fixedOverlayLayer?: ReactNode;
  onZoomChange?: (nextZoomed: boolean) => void;
  /** Changes when navigation or preview state must discard the current interaction. */
  interactionResetKey?: string;
};

export const GroundGlassStage = ({
  zoomEnabled = false,
  imageLayer,
  fixedOverlayLayer,
  onZoomChange,
  interactionResetKey,
}: GroundGlassStageProps) => {
  // Pan is normalized to the current viewport, so resize only needs to update
  // the viewport bounds; denormalization always produces a newly clamped value.
  const [normalizedPan, setNormalizedPan] = useState<PanOffset>(ZERO_PAN);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState>(createIdleDragState());
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({
    width: PANEL_WIDTH_PX,
    height: PANEL_HEIGHT_PX,
  });

  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const releaseCurrentPointerCapture = useCallback(() => {
    const gesture = dragRef.current;
    const pointerId = gesture.pointerId;
    const wasCaptured = gesture.captured;

    // Clear first: releasePointerCapture can synchronously emit
    // lostpointercapture, which must not operate on stale gesture state.
    dragRef.current = createIdleDragState();
    if (wasCaptured && pointerId !== null && panelRef.current) {
      try {
        panelRef.current.releasePointerCapture(pointerId);
      } catch {
        // Capture can already be gone after a browser-level cancellation.
      }
    }
  }, []);

  const resetGroundGlassInteraction = useCallback(() => {
    releaseCurrentPointerCapture();
    setIsDragging(false);
    setNormalizedPan(ZERO_PAN);
    onZoomChange?.(false);
  }, [onZoomChange, releaseCurrentPointerCapture]);

  // Navigation/preview changes reset synchronously before paint. Zoom-out does
  // not depend on this effect; all user reset paths call the same function.
  useLayoutEffect(() => {
    resetGroundGlassInteraction();
  }, [interactionResetKey, resetGroundGlassInteraction]);

  // Keep externally controlled unzoomed state internally centered too.
  useLayoutEffect(() => {
    if (!zoomEnabled) {
      releaseCurrentPointerCapture();
      setIsDragging(false);
      setNormalizedPan(ZERO_PAN);
    }
  }, [releaseCurrentPointerCapture, zoomEnabled]);

  useEffect(
    () => () => {
      releaseCurrentPointerCapture();
    },
    [releaseCurrentPointerCapture],
  );

  const zoomScale = zoomEnabled ? ZOOM_SCALE : 1;
  const effectivePan = zoomEnabled
    ? denormalizeGroundGlassPan(normalizedPan, viewportSize, zoomScale)
    : ZERO_PAN;
  const transform = `translate3d(${effectivePan.x}px, ${effectivePan.y}px, 0) scale(${zoomScale})`;

  const isInteractiveDescendant = (target: EventTarget | null, root: Element | null): boolean => {
    if (!(target instanceof Element)) return false;
    const found = target.closest("button, a, input, select, textarea, summary, [role='button']");
    return Boolean(found && (!root || found !== root));
  };

  const requestZoomIn = (anchor?: { clientX: number; clientY: number }) => {
    releaseCurrentPointerCapture();
    setIsDragging(false);
    if (anchor && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
      setNormalizedPan(calculateGroundGlassAnchoredPan(anchor.clientX, anchor.clientY, rect));
    } else {
      setNormalizedPan(ZERO_PAN);
    }
    onZoomChange?.(true);
  };

  const activateCurrentZoomAction = (anchor?: { clientX: number; clientY: number }) => {
    if (zoomEnabled) resetGroundGlassInteraction();
    else requestZoomIn(anchor);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && zoomEnabled) {
      event.preventDefault();
      event.stopPropagation();
      resetGroundGlassInteraction();
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      event.stopPropagation();
      activateCurrentZoomAction();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractiveDescendant(event.target, event.currentTarget)) return;
    // Physical pointer activation is handled once, on pointer-up. Retain the
    // detail=0 path for assistive-technology/synthetic keyboard activation.
    if (event.detail > 0) return;
    activateCurrentZoomAction();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (isInteractiveDescendant(event.target, event.currentTarget)) return;

    dragRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || "mouse",
      startX: event.clientX,
      startY: event.clientY,
      startPanX: normalizedPan.x,
      startPanY: normalizedPan.y,
      moved: false,
      captured: false,
    };

    if (zoomEnabled) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current.captured = true;
      } catch {
        dragRef.current.captured = false;
      }
    }
    setIsDragging(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = dragRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (
      !gesture.moved &&
      Math.hypot(dx, dy) > getGroundGlassPointerThresholdPx(gesture.pointerType)
    ) {
      gesture.moved = true;
    }

    if (!zoomEnabled || !gesture.moved) return;
    setIsDragging(true);
    const startPanPx = denormalizeGroundGlassPan(
      { x: gesture.startPanX, y: gesture.startPanY },
      viewportSize,
      ZOOM_SCALE,
    );
    setNormalizedPan(
      normalizeGroundGlassPan(
        { x: startPanPx.x + dx, y: startPanPx.y + dy },
        viewportSize,
        ZOOM_SCALE,
      ),
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = dragRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    const wasMoved =
      gesture.moved ||
      Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >
        getGroundGlassPointerThresholdPx(gesture.pointerType);
    releaseCurrentPointerCapture();
    setIsDragging(false);
    if (!wasMoved) {
      activateCurrentZoomAction({ clientX: event.clientX, clientY: event.clientY });
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    resetGroundGlassInteraction();
  };

  const handleLostPointerCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    resetGroundGlassInteraction();
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={panelRef}
        role="button"
        tabIndex={0}
        data-zoomed={zoomEnabled ? "true" : "false"}
        data-pan-x={effectivePan.x}
        data-pan-y={effectivePan.y}
        data-scale={zoomScale}
        data-normalized-pan-x={normalizedPan.x}
        data-normalized-pan-y={normalizedPan.y}
        data-dragging={isDragging ? "true" : "false"}
        data-pointer-active={dragRef.current.pointerId === null ? "false" : "true"}
        data-pointer-captured={dragRef.current.captured ? "true" : "false"}
        aria-label={zoomEnabled ? "Zoom out Ground Glass" : "Zoom in Ground Glass"}
        onKeyDown={handleKeyDown}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "5 / 4",
          border: "1px solid #d1d5db",
          borderRadius: 8,
          overflow: "hidden",
          cursor: zoomEnabled ? (isDragging ? "grabbing" : "zoom-out") : "zoom-in",
          outline: "none",
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
      >
        <div
          data-testid="ground-glass-image-layer"
          style={{
            position: "absolute",
            inset: 0,
            transform,
            transformOrigin: "center",
            pointerEvents: "none",
          }}
          className={zoomEnabled ? "groundglass-stage groundglass-stage--zoomed" : "groundglass-stage"}
        >
          {imageLayer}
        </div>
        <div style={{ pointerEvents: "none" }}>{fixedOverlayLayer}</div>
      </div>

      <button
        type="button"
        className="btn btn--compact btn--secondary groundglass-view-control"
        aria-label={zoomEnabled ? "Reset Ground Glass view" : "Zoom in Ground Glass view"}
        onClick={zoomEnabled ? resetGroundGlassInteraction : () => requestZoomIn()}
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 4,
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.25)",
        }}
      >
        {zoomEnabled ? "Reset view" : "Zoom in"}
      </button>
    </div>
  );
};
