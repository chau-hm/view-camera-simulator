import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "../../components/layout/AppShell";

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a global error display area", () => {
    render(
      <AppShell title="Shell test">
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getByTestId("global-error-area")).toBeInTheDocument();
  });

  it("shows provided global error message", () => {
    render(
      <AppShell title="Shell test" globalErrorMessage="Global failure">
        <div>content</div>
      </AppShell>,
    );

    const errorArea = screen.getByTestId("global-error-area");
    expect(errorArea).toHaveTextContent("Global failure");
    expect(errorArea).toHaveAttribute("role", "alert");
  });
});
