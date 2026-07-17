export const APPROX_CHAR_WIDTH = 6.5;
export const LABEL_OFFSET_X = 10;
export const LABEL_OFFSET_Y = 10;
export const FONT_SIZE = 12;
export type SvgTextAnchor = "start" | "middle" | "end";

export const getApproximateSvgTextWidth = (text: string): number =>
  Math.min(132, text.length * APPROX_CHAR_WIDTH);

export const getApproximateSvgTextBounds = ({
  x,
  y,
  text,
  anchor,
}: {
  x: number;
  y: number;
  text: string;
  anchor: SvgTextAnchor;
}) => {
  const width = getApproximateSvgTextWidth(text);
  const left = anchor === "start" ? x : anchor === "middle" ? x - width / 2 : x - width;
  return {
    left,
    top: y - FONT_SIZE,
    right: left + width,
    bottom: y,
    width,
    height: FONT_SIZE,
  };
};

export const getGeometryGuideLabelPlacement = ({
  start,
  end,
  positionT = 0.5,
  offsetPx = { x: 0, y: -12 },
  anchor = "middle",
  text,
  svgWidth,
  svgHeight,
  safeMargin,
}: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  positionT?: number;
  offsetPx?: { x: number; y: number };
  anchor?: SvgTextAnchor;
  text: string;
  svgWidth: number;
  svgHeight: number;
  safeMargin: number;
}) => {
  const numericValues = [
    start.x,
    start.y,
    end.x,
    end.y,
    positionT,
    offsetPx.x,
    offsetPx.y,
    svgWidth,
    svgHeight,
    safeMargin,
  ];
  if (!numericValues.every(Number.isFinite)) {
    throw new Error("Geometry guide label placement requires finite values");
  }

  const resolvedPositionT = Math.max(0, Math.min(1, positionT));
  let x = start.x + (end.x - start.x) * resolvedPositionT + offsetPx.x;
  let y = start.y + (end.y - start.y) * resolvedPositionT + offsetPx.y;
  const width = getApproximateSvgTextWidth(text);

  const minimumX =
    anchor === "start"
      ? safeMargin
      : anchor === "middle"
        ? safeMargin + width / 2
        : safeMargin + width;
  const maximumX =
    anchor === "start"
      ? svgWidth - safeMargin - width
      : anchor === "middle"
        ? svgWidth - safeMargin - width / 2
        : svgWidth - safeMargin;
  x = Math.min(Math.max(x, minimumX), maximumX);
  y = Math.min(Math.max(y, safeMargin + FONT_SIZE), svgHeight - safeMargin);

  return { x, y, anchor, positionT: resolvedPositionT };
};

export const getLocalTargetLabelPlacement = ({
  targetX,
  targetY,
  text,
  svgWidth,
  svgHeight,
  safeMargin,
}: {
  targetX: number;
  targetY: number;
  text: string;
  svgWidth: number;
  svgHeight: number;
  safeMargin: number;
}) => {
  const approxW = getApproximateSvgTextWidth(text);
  const approxH = FONT_SIZE;

  // default: right and slightly above
  let lx = targetX + LABEL_OFFSET_X;
  let ly = targetY - LABEL_OFFSET_Y;
  let anchor: "start" | "end" = "start";

  const overflowRight = lx + approxW > svgWidth - safeMargin;
  const overflowTop = ly < safeMargin;

  if (overflowRight && !overflowTop) {
    // place left and slightly above: x is the right edge for end anchor
    lx = targetX - LABEL_OFFSET_X;
    anchor = "end";
  } else if (!overflowRight && overflowTop) {
    // place right and below
    ly = targetY + LABEL_OFFSET_Y + approxH / 2;
  } else if (overflowRight && overflowTop) {
    // left and below
    lx = targetX - LABEL_OFFSET_X;
    ly = targetY + LABEL_OFFSET_Y + approxH / 2;
    anchor = "end";
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
  if (anchor === "start") {
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
