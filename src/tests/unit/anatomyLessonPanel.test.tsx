import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "../../i18n";
import { AnatomyLessonPanel } from "../../components/simulator/AnatomyLessonPanel";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});

const renderPanel = (stepIndex = 0, canAdvance = true) => {
  const onStepIndexChange = vi.fn();
  const onShowSmallApertureChange = vi.fn();
  const onReset = vi.fn();
  render(
    <MemoryRouter>
      <AnatomyLessonPanel
        stepIndex={stepIndex}
        onStepIndexChange={onStepIndexChange}
        showSmallAperture={false}
        onShowSmallApertureChange={onShowSmallApertureChange}
        onReset={onReset}
        canAdvance={canAdvance}
      />
    </MemoryRouter>,
  );
  return { onStepIndexChange, onShowSmallApertureChange, onReset };
};

describe("AnatomyLessonPanel", () => {
  it("starts at the complete-camera step and advances with Next", () => {
    const { onStepIndexChange } = renderPanel();

    expect(screen.getByRole("heading", { name: "The complete camera" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 19")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onStepIndexChange).toHaveBeenCalledWith(1);
  });

  it("shows aperture presentation controls only on the aperture step", () => {
    const { onShowSmallApertureChange } = renderPanel(3);

    expect(screen.getByRole("heading", { name: "Aperture" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show a smaller opening" }));
    expect(onShowSmallApertureChange).toHaveBeenCalledWith(true);
  });

  it("visually marks an incomplete step's Next action as disabled", () => {
    renderPanel(11, false);

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    expect(next).toHaveClass("btn--disabled");
  });

  it("uses the enabled primary styling once a step can advance", () => {
    renderPanel(11, true);

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeEnabled();
    expect(next).not.toHaveClass("btn--disabled");
    expect(next).toHaveClass("btn--primary");
  });

  it("supports Previous, reset, completion and a Scenes exit", () => {
    const { onStepIndexChange, onReset } = renderPanel(18);

    expect(screen.getByText("Lesson complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart lesson" }));

    expect(onStepIndexChange).toHaveBeenCalledWith(17);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Back to Scenes" })).toHaveAttribute("href", "/scenes");
  });
});
