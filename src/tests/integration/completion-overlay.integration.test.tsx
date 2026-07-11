import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SimulatorWorkspace } from "../../components/layout/SimulatorWorkspace";

vi.mock("../../core/tasks/evaluateTask", async () => {
  const actual = await vi.importActual<typeof import("../../core/tasks/evaluateTask")>("../../core/tasks/evaluateTask");
  return {
    ...actual,
    evaluateTask: () => ({
      taskId: "rise-01",
      status: "passed" as const,
      score: 1,
      primaryFeedback: "Great work.",
      secondaryFeedback: [],
      criteria: [
        {
          criterionId: "mock",
          label: "Mock criterion",
          passed: true,
          score: 1,
          message: "Met",
        },
      ],
      finalCameraState: {
        frontRiseMm: 20,
        frontTiltDeg: 0,
        frontSwingDeg: 0,
        focusDistanceMm: 7200,
        aperture: 11,
      },
    }),
  };
});

describe("phase 12 completion overlay", () => {
  it("TST-INT-013 shows completion overlay when task passes", () => {
    render(
      <MemoryRouter initialEntries={["/simulator/guided/architecture-rise/rise-01"]}>
        <SimulatorWorkspace mode="guided" sceneId="architecture-rise" taskId="rise-01" simulateAssetFailure={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Task completed")).toBeInTheDocument();
  });
});
