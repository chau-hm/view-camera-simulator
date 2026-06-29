import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../../components/system/AppErrorBoundary";

const ThrowingComponent = () => {
  throw new Error("boom");
};

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders fallback content when child throws", () => {
    render(
      <AppErrorBoundary>
        <ThrowingComponent />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });
});
