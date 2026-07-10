/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

// Some react-router navigation internals construct a global Request in the test environment.
// Node's undici Request constructor performs strict type checking on AbortSignal which can
// throw during tests. Provide a minimal shim here for the duration of this test to avoid
// environment-specific failures while still exercising router state transitions.
let OriginalRequest: any;
beforeAll(() => {
  OriginalRequest = (global as any).Request;
  (global as any).Request = class Request {
    constructor(input: any, init?: any) {
      return {
        url: typeof input === "string" ? input : input?.url,
        method: init?.method ?? "GET",
        headers: init?.headers ?? {},
        signal: init?.signal ?? null,
        body: init?.body,
      } as any;
    }
  };
});
afterAll(() => {
  (global as any).Request = OriginalRequest;
});

describe("mode redirect", () => {
  it("redirects /mode to /scenes", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/mode"] });
    render(<RouterProvider router={memoryRouter} />);

    // wait for the router state to reflect the redirect (assert router state, not window.location)
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe("/scenes"));

    // ensure a Scenes H1 is present (may render through the redirect)
    const h1s = await screen.findAllByRole("heading", { level: 1 });
    expect(h1s.some((el) => el.textContent && el.textContent.includes("Scenes"))).toBe(true);
  });
});
