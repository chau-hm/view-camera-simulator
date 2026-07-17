import type { KeyboardEvent } from "react";
import { roundToStep } from "./roundToStep";

export const handleRangeInputKeyboard = (
  event: KeyboardEvent<HTMLInputElement>,
  options: {
    value: number;
    min: number;
    max: number;
    step: number;
    onChangeValue: (nextValue: number) => void;
  },
) => {
  const { value, min, max, step, onChangeValue } = options;
  const coarseStep = step * 10;
  const clampToStep = (next: number) =>
    Math.min(max, Math.max(min, roundToStep(next, step)));

  if (event.key === "Home") {
    event.preventDefault();
    onChangeValue(min);
    return;
  }

  if (event.key === "End") {
    event.preventDefault();
    onChangeValue(max);
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    onChangeValue(clampToStep(value - (event.shiftKey ? coarseStep : step)));
    return;
  }

  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    onChangeValue(clampToStep(value + (event.shiftKey ? coarseStep : step)));
  }
};
