export const APPROX_CHAR_WIDTH = 6.5;
export const LABEL_OFFSET_X = 10;
export const LABEL_OFFSET_Y = 10;
export const FONT_SIZE = 12;

export const getLocalTargetLabelPlacement = ({ targetX, targetY, text, svgWidth, svgHeight, safeMargin }: { targetX: number; targetY: number; text: string; svgWidth: number; svgHeight: number; safeMargin: number; }) => {
  const approxW = Math.min(132, text.length * APPROX_CHAR_WIDTH);
  const approxH = FONT_SIZE;

  // default: right and slightly above
  let lx = targetX + LABEL_OFFSET_X;
  let ly = targetY - LABEL_OFFSET_Y;
  let anchor: 'start' | 'end' = 'start';

  const overflowRight = lx + approxW > svgWidth - safeMargin;
  const overflowTop = ly < safeMargin;

  if (overflowRight && !overflowTop) {
    // place left and slightly above: x is the right edge for end anchor
    lx = targetX - LABEL_OFFSET_X;
    anchor = 'end';
  } else if (!overflowRight && overflowTop) {
    // place right and below
    ly = targetY + LABEL_OFFSET_Y + (approxH / 2);
  } else if (overflowRight && overflowTop) {
    // left and below
    lx = targetX - LABEL_OFFSET_X;
    ly = targetY + LABEL_OFFSET_Y + (approxH / 2);
    anchor = 'end';
  }

  // Ensure vertical fit: if the chosen below position exceeds svgHeight - safeMargin, prefer above
  if (ly + approxH > svgHeight - safeMargin) {
    // try the corresponding above position
    const altLy = targetY - LABEL_OFFSET_Y;
    if (altLy >= safeMargin) {
      ly = altLy;
    } else {
      // neither above nor below fits fully; clamp within safe bounds
      const minY = safeMargin + FONT_SIZE;
      const maxY = svgHeight - safeMargin;
      ly = Math.min(Math.max(ly, minY), maxY);
    }
  }

  // Clamp horizontally to SVG edges using rendered bounds depending on anchor
  if (anchor === 'start') {
    // rendered left = lx, rendered right = lx + approxW
    if (lx < safeMargin) lx = safeMargin;
    if (lx + approxW > svgWidth - safeMargin) lx = svgWidth - safeMargin - approxW;
  } else {
    // anchor === 'end' -> rendered left = lx - approxW, rendered right = lx
    if (lx - approxW < safeMargin) lx = safeMargin + approxW;
    if (lx > svgWidth - safeMargin) lx = svgWidth - safeMargin;
  }

  // Final clamp vertically
  if (ly < safeMargin) ly = safeMargin + FONT_SIZE;
  if (ly > svgHeight - safeMargin) ly = svgHeight - safeMargin;

  return { x: lx, y: ly, anchor };
};
