import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type GroundGlassStageProps = {
  zoomEnabled?: boolean;
  imageLayer: ReactNode; // content that should receive the zoom/pan transform
  fixedOverlayLayer?: ReactNode; // content that stays fixed (labels, focus ring)
  onToggleZoom?: () => void;
};

export const GroundGlassStage = ({ zoomEnabled, imageLayer, fixedOverlayLayer, onToggleZoom }: GroundGlassStageProps) => {
  const PANEL_WIDTH_PX = 500;
  const PANEL_HEIGHT_PX = 400;
  const [zoomPan, setZoomPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number | null; startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean; captured: boolean }>({ pointerId: null, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false, captured: false });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({ width: PANEL_WIDTH_PX, height: PANEL_HEIGHT_PX });
  const CLICK_THRESHOLD_PX = 5; // movement threshold to distinguish click vs drag

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

  // reset pan when zoom is turned off
  useEffect(() => {
    if (!zoomEnabled) {
      setZoomPan({ x: 0, y: 0 });
    }
  }, [zoomEnabled]);
  
  const zoomScale = zoomEnabled ? 1.9 : 1;
  const transform = `translate3d(${zoomPan.x}px, ${zoomPan.y}px, 0) scale(${zoomScale})`;

  // keyboard handlers
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Space or Enter toggles zoom when focused
      e.preventDefault();
      e.stopPropagation();
      onToggleZoom?.();
    }
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
      onClick={() => {
        // Only toggle via click when not dragging (drag handled via pointer events)
        if (isDragging) return;
        onToggleZoom?.();
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return; // only primary
        const target = e.target as HTMLElement;
        // ignore if clicking on interactive controls inside overlays
        if (target.closest("button") || target.closest('a') || target.closest('input')) return;

        // record start coords
        dragRef.current.pointerId = e.pointerId;
        dragRef.current.startX = e.clientX;
        dragRef.current.startY = e.clientY;
        dragRef.current.startPanX = zoomPan.x;
        dragRef.current.startPanY = zoomPan.y;
        dragRef.current.moved = false;

        // If zoom is enabled, capture pointer to receive moves outside element
        const el = e.currentTarget as HTMLElement;
        if (zoomEnabled) {
          try { el.setPointerCapture(e.pointerId); dragRef.current.captured = true; } catch { dragRef.current.captured = false; }
        }

        // prepare dragging state only when movement exceeds threshold
        // set isDragging to false initially
        setIsDragging(false);
      }}
      onPointerMove={(e) => {
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
          const desiredX = dragRef.current.startPanX + dx;
          const desiredY = dragRef.current.startPanY + dy;
          const maxPanX = (viewportSize.width * (zoomScale - 1)) / 2;
          const maxPanY = (viewportSize.height * (zoomScale - 1)) / 2;
          const clampedX = Math.max(-maxPanX, Math.min(maxPanX, desiredX));
          const clampedY = Math.max(-maxPanY, Math.min(maxPanY, desiredY));
          setZoomPan({ x: clampedX, y: clampedY });
        }
      }}
      onPointerUp={(e) => {
        if (dragRef.current.pointerId !== e.pointerId) return;
        const el = e.currentTarget as HTMLElement;
        if (dragRef.current.captured) {
          try { el.releasePointerCapture(e.pointerId); } catch (err) { void err; }
          dragRef.current.captured = false;
        }

        // if movement below threshold treat as click and toggle zoom
        if (!dragRef.current.moved) {
          onToggleZoom?.();
        }

        // finish drag
        dragRef.current.pointerId = null;
        dragRef.current.moved = false;
        setIsDragging(false);
      }}
      onPointerCancel={(e) => {
        if (dragRef.current.pointerId !== e.pointerId) return;
        const el = e.currentTarget as HTMLElement;
        if (dragRef.current.captured) {
          try { el.releasePointerCapture(e.pointerId); } catch (err) { void err; }
          dragRef.current.captured = false;
        }
        dragRef.current.pointerId = null;
        dragRef.current.moved = false;
        setIsDragging(false);
      }}
    >
      {/* image stage (transformed by pan/zoom) */}
      <div style={{ position: "absolute", inset: 0, transform, transformOrigin: "center", pointerEvents: 'none' }} className={zoomEnabled ? 'groundglass-stage groundglass-stage--zoomed' : 'groundglass-stage'}>{imageLayer}</div>
      {/* fixed overlays that don't receive pan/zoom */}
      <div style={{ pointerEvents: 'none' }}>{fixedOverlayLayer}</div>
    </div>
  );
};
