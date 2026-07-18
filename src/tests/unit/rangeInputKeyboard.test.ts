import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { handleRangeInputKeyboard } from "../../utils/rangeInputKeyboard";

const keyboardEvent = (key: string, shiftKey = false) =>
  ({ key, shiftKey, preventDefault: vi.fn() }) as unknown as KeyboardEvent<HTMLInputElement>;

describe("handleRangeInputKeyboard", () => {
  it("keeps repeated fractional movement aligned to the declared step", () => {
    let value = 0;
    for (let index = 0; index < 42; index += 1) {
      handleRangeInputKeyboard(keyboardEvent("ArrowLeft"), {
        value,
        min: -15,
        max: 15,
        step: 0.1,
        onChangeValue: (next) => {
          value = next;
        },
      });
    }

    expect(value).toBe(-4.2);
    expect(value / 0.1).toBeCloseTo(-42, 10);
  });

  it("keeps Shift movement step-aligned and clamps at the range bounds", () => {
    const values: number[] = [];
    handleRangeInputKeyboard(keyboardEvent("ArrowRight", true), {
      value: 14.9,
      min: -15,
      max: 15,
      step: 0.1,
      onChangeValue: (next) => values.push(next),
    });
    handleRangeInputKeyboard(keyboardEvent("ArrowLeft", true), {
      value: -14.9,
      min: -15,
      max: 15,
      step: 0.1,
      onChangeValue: (next) => values.push(next),
    });

    expect(values).toEqual([15, -15]);
  });
});
