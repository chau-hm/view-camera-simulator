export type AnatomyPresentationState = "normal" | "highlighted" | "dimmed";

export type PresentationProps = {
  ghost: boolean;
  state?: AnatomyPresentationState;
};

export const resolvePresentationColor = (
  baseColor: string,
  ghostColor: string,
  state: AnatomyPresentationState,
  ghost: boolean,
): string => {
  if (state === "highlighted") return "#f59e0b";
  return ghost ? ghostColor : baseColor;
};

export const frameMaterialProps = ({ ghost, state = "normal" }: PresentationProps) => ({
  transparent: ghost || state === "dimmed",
  opacity: ghost ? 0.35 : state === "dimmed" ? 0.25 : 1,
  depthWrite: !ghost && state !== "dimmed",
});
