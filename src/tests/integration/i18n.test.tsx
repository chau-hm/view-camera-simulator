import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";
import { i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";

const resetLocale = async () => {
  cleanup();
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
};

beforeEach(resetLocale);
afterEach(resetLocale);

describe("internationalization foundation", () => {
  it("renders the bundled English surface by default", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en");
    expect(screen.getByRole("link", { name: "View Camera Simulator home" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "See how a view camera changes the image before the shutter is pressed.",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("switches visible public copy immediately and persists without navigation", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    const selector = screen.getByRole("combobox", { name: "Language" });
    fireEvent.change(selector, { target: { value: "zh-HK" } });

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-HK");
      expect(screen.getByRole("heading", { name: "在按下快門前，了解大型相機如何改變影像。" })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "場景" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Camera Simulator 主頁" })).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-HK");
    expect(router.state.location.pathname).toBe("/");

    fireEvent.change(selector, { target: { value: "en" } });
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
      expect(screen.getByRole("heading", { name: "See how a view camera changes the image before the shutter is pressed." })).toBeInTheDocument();
    });
  });

  it("keeps the selected locale when entering Scenes and translates Mirror Shift at the presentation boundary", async () => {
    const homeRouter = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={homeRouter} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "zh-HK" },
    });

    cleanup();
    const scenesRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={scenesRouter} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "場景", level: 1 })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
    });

    const mirrorHeading = screen.getByRole("heading", { name: "鏡面橫移", level: 2 });
    const mirrorCard = mirrorHeading.closest("article");
    expect(mirrorCard).not.toBeNull();
    expect(
      within(mirrorCard!).getByText(
        "將整部相機向側面移動以避開相機倒影，然後使用相反方向的前組橫移恢復鏡面構圖，同時保留已改變的視點。",
      ),
    ).toBeInTheDocument();
    expect(within(mirrorCard!).getByText("視點")).toBeInTheDocument();
    expect(within(mirrorCard!).getByText("構圖")).toBeInTheDocument();
    expect(within(mirrorCard!).getByText("前組橫移")).toBeInTheDocument();
    expect(within(mirrorCard!).getByRole("link", { name: "開啟場景" })).toHaveAttribute(
      "href",
      "/simulator/free/mirror-shift",
    );
  });
});
