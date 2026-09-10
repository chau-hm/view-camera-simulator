import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FocusDistributionPanel } from "../../components/simulator/FocusDistributionPanel";
import { i18n } from "../../i18n";

const allTargets = [
  { id: "near-left", sharpnessPercent: 81.6, status: "sharp" },
  { id: "near-centre", sharpnessPercent: 25.2, status: "soft" },
  { id: "near-right", sharpnessPercent: -4, status: "soft" },
  { id: "middle", sharpnessPercent: 100.4, status: "sharp" },
  { id: "far-left", sharpnessPercent: 11.4, status: "soft" },
  { id: "far-centre", sharpnessPercent: 44.5, status: "acceptable" },
  { id: "far-right", sharpnessPercent: 83.2, status: "sharp" },
];

const renderPanel = (focusTargets = allTargets, previewMode: "raw" | "upright" = "upright") =>
  render(
    <FocusDistributionPanel
      sceneId="oblique-tabletop"
      focusTargets={focusTargets}
      previewMode={previewMode}
      metric="focus"
      closestTargetId="middle"
    />,
  );

describe("FocusDistributionPanel", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("presents the seven targets in a compact upright spatial table", () => {
    renderPanel();

    const panel = screen.getByTestId("focus-distribution-panel");
    const rows = within(panel).getAllByRole("row");
    expect(within(rows[0]).getByRole("cell", { name: /Near left/ })).toHaveTextContent("82%");
    expect(within(rows[0]).getByRole("cell", { name: /Near right/ })).toHaveTextContent("0%");
    expect(within(rows[1]).getByRole("cell", { name: /Middle/ })).toHaveTextContent("100%");
    expect(within(rows[2]).getByRole("cell", { name: /Far right/ })).toHaveTextContent("83%");
    expect(within(rows[1]).getByRole("cell", { name: /Sharp/ })).toHaveAccessibleName(/Closest point/);
    expect(screen.getByRole("heading", { name: "Focus distribution" })).toBeInTheDocument();
    expect(screen.getByTestId("focus-distribution-orientation")).toHaveTextContent("Upright");
  });

  it("moves populated cells with the raw Ground Glass orientation", () => {
    renderPanel(allTargets, "raw");

    const panel = screen.getByTestId("focus-distribution-panel");
    const rows = within(panel).getAllByRole("row");
    expect(within(rows[0]).getByRole("cell", { name: /Far right/ })).toHaveTextContent("83%");
    expect(within(rows[2]).getByRole("cell", { name: /Near left/ })).toHaveTextContent("82%");
    expect(within(rows[1]).getByRole("cell", { name: /Middle/ })).toHaveTextContent("100%");
    expect(screen.getByTestId("focus-distribution-orientation")).toHaveTextContent("Raw");
  });

  it("keeps percentage bounds and semantic status available without relying on color", () => {
    renderPanel();

    expect(screen.getByRole("cell", { name: /Near right/ })).toHaveAccessibleName(/0%.*Soft/);
    expect(screen.getByRole("cell", { name: /Middle/ })).toHaveAccessibleName(/100%.*Sharp/);
    expect(screen.getByRole("cell", { name: /Far centre/ })).toHaveAccessibleName(/45%.*Acceptable/);
    expect(screen.getByRole("cell", { name: /Near left/ })).toHaveTextContent("✓");
  });

  it("renders only supplied positions when focus data is partial", () => {
    renderPanel([
      { id: "near-left", sharpnessPercent: 35, status: "soft" },
      { id: "middle", sharpnessPercent: 75, status: "acceptable" },
    ]);

    expect(screen.getByRole("cell", { name: /Near left/ })).toHaveTextContent("35%");
    expect(screen.getByRole("cell", { name: /Middle/ })).toHaveTextContent("75%");
    expect(screen.queryByText("Near right")).not.toBeInTheDocument();
    expect(screen.queryByText("Far right")).not.toBeInTheDocument();
  });

  it("localizes the learner-facing panel and position labels", async () => {
    renderPanel();
    await i18n.changeLanguage("zh-HK");

    expect(screen.getByRole("heading", { name: "對焦分佈" })).toBeInTheDocument();
    expect(screen.getByTestId("focus-distribution-orientation")).toHaveTextContent("正像");
    expect(screen.getByRole("cell", { name: /近左/ })).toHaveTextContent("82%");
  });
});
