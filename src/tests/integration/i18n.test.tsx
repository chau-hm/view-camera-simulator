import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";
import { i18n } from "../../i18n";
import { LOCALE_STORAGE_KEY } from "../../i18n/localePreference";
import { homeMessages as englishHomeMessages } from "../../i18n/messages/en/home";
import { homeMessages as traditionalChineseHomeMessages } from "../../i18n/messages/zh-HK/home";

const resetLocale = async () => {
  cleanup();
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  await i18n.changeLanguage("en");
  document.documentElement.lang = "en";
};

beforeEach(resetLocale);
afterEach(resetLocale);

describe("internationalization foundation", () => {
  it("keeps the Hero message shape complete in English and Traditional Chinese", () => {
    expect(Object.keys(traditionalChineseHomeMessages.hero)).toEqual(Object.keys(englishHomeMessages.hero));
    expect(traditionalChineseHomeMessages.hero.titleLine1).toBe("掌控透視感");
    expect(traditionalChineseHomeMessages.hero.titleLine2).toBe("定位焦平面");
    expect(traditionalChineseHomeMessages.hero.startExploring).toBe("開始探索模擬器");
    expect(traditionalChineseHomeMessages.hero.exploreScenes).toBe("瀏覽場景");
  });

  it("renders the bundled English surface by default", () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveValue("en");
    expect(screen.getByRole("link", { name: "View Camera Simulator home" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shape Perspective. Place Focus.", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Explore how rise, shift, tilt, swing, and focus reshape perspective, composition, and the plane of focus.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("landing-hero-cta")).toHaveAttribute("href", "/scenes");
    expect(screen.queryByText(/See How It Works|Watch Video/)).not.toBeInTheDocument();
  });

  it("switches visible public copy immediately and persists without navigation", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    const selector = screen.getByRole("combobox", { name: "Language" });
    fireEvent.change(selector, { target: { value: "zh-HK" } });

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-HK");
      expect(screen.getByRole("heading", { name: "掌控透視感 定位焦平面" })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "場景" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Camera Simulator 主頁" })).toBeInTheDocument();
    expect(screen.getByText("親手操作上移、橫移、傾斜、擺動與對焦，看見它們如何改變透視、構圖與焦平面。")).toBeInTheDocument();
    expect(screen.getByTestId("landing-hero-cta")).toHaveAttribute("href", "/scenes");
    expect(screen.getByText("瀏覽場景")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "為甚麼相機移軸重要？", level: 2 })).toBeInTheDocument();
    expect(screen.queryByText(/前、後組移軸/)).not.toBeInTheDocument();
    expect(screen.getByText(/移動整部相機會改變視點/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("大型相機");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-HK");
    expect(router.state.location.pathname).toBe("/");

    fireEvent.change(selector, { target: { value: "en" } });
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
      expect(screen.getByRole("heading", { name: "Shape Perspective. Place Focus." })).toBeInTheDocument();
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

    const mirrorHeading = screen.getByRole("heading", { name: "鏡面構圖與視點", level: 2 });
    const mirrorCard = mirrorHeading.closest("article");
    expect(mirrorCard).not.toBeNull();
    expect(
      within(mirrorCard!).getByText(
        "理解前組橫移如何恢復構圖，而不會恢復原本的視點與視差。",
      ),
    ).toBeInTheDocument();
    expect(within(mirrorCard!).getByText("視點")).toBeInTheDocument();
    expect(within(mirrorCard!).getByText("構圖")).toBeInTheDocument();
    expect(within(mirrorCard!).getByText("前組橫移")).toBeInTheDocument();
    expect(within(mirrorCard!).getByRole("link", { name: "開啟場景" })).toHaveAttribute(
      "href",
      "/simulator/free/mirror-shift",
    );
    expect(screen.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
  });
});
