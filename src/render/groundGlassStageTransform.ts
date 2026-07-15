export type GroundGlassPanOffset = { x: number; y: number };

export const GROUND_GLASS_ZOOM_SCALE = 1.9;

export const getGroundGlassPanBounds = (
  viewport: { width: number; height: number },
  scale: number,
): GroundGlassPanOffset => ({
  x: Math.max(0, (viewport.width * (scale - 1)) / 2),
  y: Math.max(0, (viewport.height * (scale - 1)) / 2),
});

export const normalizeGroundGlassPan = (
  panPx: GroundGlassPanOffset,
  viewport: { width: number; height: number },
  scale: number,
): GroundGlassPanOffset => {
  const bounds = getGroundGlassPanBounds(viewport, scale);
  return {
    x: bounds.x > 0 ? Math.max(-1, Math.min(1, panPx.x / bounds.x)) : 0,
    y: bounds.y > 0 ? Math.max(-1, Math.min(1, panPx.y / bounds.y)) : 0,
  };
};

export const denormalizeGroundGlassPan = (
  normalizedPan: GroundGlassPanOffset,
  viewport: { width: number; height: number },
  scale: number,
): GroundGlassPanOffset => {
  const bounds = getGroundGlassPanBounds(viewport, scale);
  return {
    x: Math.max(-1, Math.min(1, normalizedPan.x)) * bounds.x,
    y: Math.max(-1, Math.min(1, normalizedPan.y)) * bounds.y,
  };
};

export const calculateGroundGlassAnchoredPan = (
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  scale = GROUND_GLASS_ZOOM_SCALE,
): GroundGlassPanOffset => {
  const offsetX = clientX - (rect.left + rect.width / 2);
  const offsetY = clientY - (rect.top + rect.height / 2);
  return normalizeGroundGlassPan(
    {
      x: -(scale - 1) * offsetX,
      y: -(scale - 1) * offsetY,
    },
    { width: rect.width, height: rect.height },
    scale,
  );
};
