import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  calculateGroundGlassAnchoredPan,
  denormalizeGroundGlassPan,
  GROUND_GLASS_ZOOM_SCALE,
  normalizeGroundGlassPan,
  type GroundGlassPanOffset,
} from "./groundGlassStageTransform";

// Zoom and gesture constants (stable references)
const ZOOM_SCALE = GROUND_GLASS_ZOOM_SCALE;
const CLICK_THRESHOLD_PX = 5; // movement threshold to distinguish click vs drag

type PanOffset = GroundGlassPanOffset;
const ZERO_PAN: PanOffset = { x: 0, y: 0 };

const PANEL_WIDTH_PX = 500;
const PANEL_HEIGHT_PX = 400;

type GroundGlassStageProps = {
  zoomEnabled?: boolean;
  imageLayer: ReactNode; // content that should receive the zoom/pan transform
  fixedOverlayLayer?: ReactNode; // content that stays fixed (labels, focus ring)
  onToggleZoom?: () => void;
};

export const GroundGlassStage = ({ zoomEnabled, imageLayer, fixedOverlayLayer, onToggleZoom }: GroundGlassStageProps) => {
  // Pan is stored as a normalized value in [-1, 1]. Pixel bounds are derived
  // from the current viewport, so a resize cannot leave stale out-of-range pan.
  const [normalizedPan, setNormalizedPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number | null; startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean; captured: boolean }>({ pointerId: null, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false, captured: false });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: PANEL_WIDTH_PX, height: PANEL_HEIGHT_PX });

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setViewportSize({ width: r.width, height: r.height });
    };
    update();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    }
    return () => {
      if (ro) ro.disconnect();
    };
  }, [panelRef]);

  // reset pan when zoom is turned off (defensive cleanup)
  useEffect(() => {
    if (!zoomEnabled) {
      setNormalizedPan({ ...ZERO_PAN });
    }
  }, [zoomEnabled]);

  // Use effective pan so unzoomed rendering never shows a non-zero translation
  const zoomScale = zoomEnabled ? ZOOM_SCALE : 1;
  const effectivePan = zoomEnabled
    ? denormalizeGroundGlassPan(normalizedPan, viewportSize, zoomScale)
    : ZERO_PAN;
  const transform = `translate3d(${effectivePan.x}px, ${effectivePan.y}px, 0) scale(${zoomScale})`;

  const isInteractiveDescendant = (target: EventTarget | null, root: Element | null): boolean => {
    if (!(target instanceof Element)) return false;
    const found = target.closest(
      "button, a, input, select, textarea, summary, [role='button']",
    );
    // If the closest interactive element is the root itself, it's not a descendant control.
    if (!found) return false;
    if (root && found === root) return false;
    return true;
  };

  // Single activation function used for click and keyboard
  const activateZoom = (anchor?: { clientX: number; clientY: number }) => {
    if (zoomEnabled) {
      // reset pan immediately for a clean zoom-out visual
      setNormalizedPan({ ...ZERO_PAN });
      onToggleZoom?.();
      return;
    }

    // zooming in
    if (anchor && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
      setNormalizedPan(calculateGroundGlassAnchoredPan(anchor.clientX, anchor.clientY, rect));
    } else {
      // centered zoom
      setNormalizedPan({ ...ZERO_PAN });
    }

    onToggleZoom?.();
  };

  // keyboard handlers
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Space or Enter toggles zoom when focused — centered anchor
      e.preventDefault();
      e.stopPropagation();
      activateZoom();
    }
  };

  // click handler is the single activation path for mouse
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isInteractiveDescendant(event.target, event.currentTarget as Element)) return;
    // Pointer activations are handled on pointer-up so drag and click cannot
    // leave a stale "suppress next click" flag. Keep synthetic/AT clicks.
    if ((event.detail ?? 0) > 0) return;
    activateZoom();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // only primary
    if (isInteractiveDescendant(e.target, e.currentTarget as Element)) return;

    // record start coords
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.startPanX = normalizedPan.x;
    dragRef.current.startPanY = normalizedPan.y;
    dragRef.current.moved = false;

    // If zoom is enabled, capture pointer to receive moves outside element
    const el = e.currentTarget as HTMLElement;
    if (zoomEnabled) {
      try { el.setPointerCapture(e.pointerId); dragRef.current.captured = true; } catch { dragRef.current.captured = false; }
    }

    // prepare dragging state only when movement exceeds threshold
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const dist = Math.hypot(dx, dy);
    if (!dragRef.current.moved && dist > CLICK_THRESHOLD_PX) {
      dragRef.current.moved = true;
    }

    if (zoomEnabled && dragRef.current.moved) {
      // begin actual pan
      if (!isDragging) setIsDragging(true);
      const startPanPx = denormalizeGroundGlassPan(
        { x: dragRef.current.startPanX, y: dragRef.current.startPanY },
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
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const el = e.currentTarget as HTMLElement;
    if (dragRef.current.captured) {
      try { el.releasePointerCapture(e.pointerId); } catch (err) { void err; }
      dragRef.current.captured = false;
    }

    const wasMoved = dragRef.current.moved;

    // finish drag
    dragRef.current.pointerId = null;
    dragRef.current.moved = false;
    setIsDragging(false);

    if (!wasMoved) {
      activateZoom({ clientX: e.clientX, clientY: e.clientY });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const el = e.currentTarget as HTMLElement;
    if (dragRef.current.captured) {
      try { el.releasePointerCapture(e.pointerId); } catch (err) { void err; }
      dragRef.current.captured = false;
    }
    dragRef.current.pointerId = null;
    dragRef.current.moved = false;
    setIsDragging(false);
  };

  const handleLostPointerCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current.pointerId = null;
    dragRef.current.moved = false;
    dragRef.current.captured = false;
    setIsDragging(false);
  };

  return (
    <div
      ref={panelRef}
      role="button"
      tabIndex={0}
      data-zoomed={zoomEnabled ? 'true' : 'false'}
      aria-label={zoomEnabled ? 'Zoom out Ground Glass' : 'Zoom in Ground Glass'}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5 / 4",
        border: "1px solid #d1d5db",
        borderRadius: 8,
        overflow: "hidden",
        cursor: zoomEnabled ? (isDragging ? "grabbing" : "zoom-out") : "zoom-in",
        outline: 'none',
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
    >
      {/* image stage (transformed by pan/zoom) */}
      <div style={{ position: "absolute", inset: 0, transform, transformOrigin: "center", pointerEvents: 'none' }} className={zoomEnabled ? 'groundglass-stage groundglass-stage--zoomed' : 'groundglass-stage'}>{imageLayer}</div>
      {/* fixed overlays that don't receive pan/zoom */}
      <div style={{ pointerEvents: 'none' }}>{fixedOverlayLayer}</div>
    </div>
  );
};
