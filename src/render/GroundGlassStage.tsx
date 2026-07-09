import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type GroundGlassStageProps = {
  zoomEnabled?: boolean;
  imageLayer: ReactNode; // content that should receive the zoom/pan transform
  fixedOverlayLayer?: ReactNode; // content that stays fixed (labels, focus ring)
};

export const GroundGlassStage = ({ zoomEnabled, imageLayer, fixedOverlayLayer }: GroundGlassStageProps) => {
  const PANEL_WIDTH_PX = 500;
  const PANEL_HEIGHT_PX = 400;
  const [zoomPan, setZoomPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number | null; startX: number; startY: number; startPanX: number; startPanY: number }>({ pointerId: null, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
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

  // reset pan when zoom is turned off
  useEffect(() => {
    if (!zoomEnabled) {
      setZoomPan({ x: 0, y: 0 });
    }
  }, [zoomEnabled]);

  const zoomScale = zoomEnabled ? 1.9 : 1;
  const transform = `translate3d(${zoomPan.x}px, ${zoomPan.y}px, 0) scale(${zoomScale})`;

  return (
    <div
      ref={panelRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "5 / 4",
        border: "1px solid #d1d5db",
        borderRadius: 8,
        overflow: "hidden",
        cursor: zoomEnabled ? (isDragging ? "grabbing" : "grab") : "zoom-in",
      }}
      onPointerDown={(e) => {
        if (!zoomEnabled || e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest("button")) return;
        const el = e.currentTarget as HTMLElement;
        try {
          el.setPointerCapture(e.pointerId);
        } catch (captureErr) {
          void captureErr;
        }
        dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, startPanX: zoomPan.x, startPanY: zoomPan.y };
        setIsDragging(true);
      }}
      onPointerMove={(e) => {
        if (!zoomEnabled) return;
        if (!isDragging || dragRef.current.pointerId !== e.pointerId) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const desiredX = dragRef.current.startPanX + dx;
        const desiredY = dragRef.current.startPanY + dy;
        const maxPanX = (viewportSize.width * (zoomScale - 1)) / 2;
        const maxPanY = (viewportSize.height * (zoomScale - 1)) / 2;
        const clampedX = Math.max(-maxPanX, Math.min(maxPanX, desiredX));
        const clampedY = Math.max(-maxPanY, Math.min(maxPanY, desiredY));
        setZoomPan({ x: clampedX, y: clampedY });
      }}
      onPointerUp={(e) => {
        if (!zoomEnabled) return;
        const el = e.currentTarget as HTMLElement;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (releaseErr) {
          void releaseErr;
        }
        dragRef.current.pointerId = null;
        setIsDragging(false);
      }}
      onPointerCancel={(e) => {
        if (!zoomEnabled) return;
        const el = e.currentTarget as HTMLElement;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (cancelErr) {
          void cancelErr;
        }
        dragRef.current.pointerId = null;
        setIsDragging(false);
      }}
    >
      {/* image stage (transformed by pan/zoom) */}
      <div style={{ position: "absolute", inset: 0, transform, transformOrigin: "center" }}>{imageLayer}</div>
      {/* fixed overlays that don't receive pan/zoom */}
      {fixedOverlayLayer}
    </div>
  );
};
