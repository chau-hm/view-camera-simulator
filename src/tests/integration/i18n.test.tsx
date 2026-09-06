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

  it("keeps the Fundamentals and visualization message shapes complete in both locales", () => {
    expect(Object.keys(traditionalChineseHomeMessages.fundamentals)).toEqual(
      Object.keys(englishHomeMessages.fundamentals),
    );
    expect(Object.keys(traditionalChineseHomeMessages.fundamentals.items)).toEqual(
      Object.keys(englishHomeMessages.fundamentals.items),
    );
    expect(Object.keys(traditionalChineseHomeMessages.visualize)).toEqual(
      Object.keys(englishHomeMessages.visualize),
    );
    expect(Object.keys(traditionalChineseHomeMessages.visualize.items)).toEqual(
      Object.keys(englishHomeMessages.visualize.items),
    );
  });

  it("keeps the Why It Matters message shape complete in both locales", () => {
    expect(Object.keys(traditionalChineseHomeMessages.why)).toEqual(Object.keys(englishHomeMessages.why));
    expect(Object.keys(traditionalChineseHomeMessages.why.title)).toEqual(
      Object.keys(englishHomeMessages.why.title),
    );
    expect(Object.keys(traditionalChineseHomeMessages.why.items)).toEqual(
      Object.keys(englishHomeMessages.why.items),
    );

    for (const itemKey of Object.keys(englishHomeMessages.why.items) as Array<keyof typeof englishHomeMessages.why.items>) {
      expect(Object.keys(traditionalChineseHomeMessages.why.items[itemKey])).toEqual(
        Object.keys(englishHomeMessages.why.items[itemKey]),
      );
    }
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
    expect(screen.getByRole("heading", { name: "學習基礎原理", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "三種視覺化方式", level: 2 })).toBeInTheDocument();
    const why = screen.getByTestId("landing-why-section");
    expect(within(why).getByText("為甚麼重要")).toBeInTheDocument();
    expect(within(why).getByRole("heading", { level: 2 })).toHaveTextContent("曝光前，掌控更多。");
    expect(within(why).getByRole("heading", { level: 2 })).toHaveTextContent("以更深入的方式觀看。");
    expect(screen.getByRole("heading", { name: "透視控制", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "焦平面", level: 3 })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "對焦屏", level: 3 })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "幾何視圖", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("看見．研究．理解")).toBeInTheDocument();

    const partECopy = [
      "掌握相機移軸",
      "學習基礎原理",
      "理解影響相機取景、移軸與對焦方式的核心原理。",
      "透視控制",
      "理解視點、構圖與相機移軸如何影響透視關係及匯聚線條。",
      "焦平面",
      "觀察清晰焦平面位於哪裏，以及對焦、傾斜與擺動如何改變它與主體的關係。",
      "從攝影者的視角查看對焦屏上的影像，理解取景、構圖與對焦結果。",
      "光學幾何",
      "理解鏡頭、主體、成像平面與影像形成之間的幾何關係。",
      "看見．研究．理解",
      "三種視覺化方式",
      "同一個相機狀態，可以從三種互補視圖理解；每一種都揭示不同的關係。",
      "3D 場景",
      "在 3D 空間中理解相機、主體與視點之間的相對位置。",
      "查看相機形成的影像，理解取景、構圖與對焦結果。",
      "幾何視圖",
      "顯示光路、鏡頭與成像平面、焦平面及透視幾何。",
      "為甚麼重要",
      "曝光前，你可以控制甚麼？",
      "相機位置、構圖、影像幾何與焦平面，是幾個可以分開思考的決定。大片幅相機讓這些關係在曝光前清楚呈現。",
      "為甚麼相機移軸重要？",
      "上移與橫移可以在整部相機的視點不變時重新構圖；傾斜與擺動改變焦平面的方向；移動整部相機則會改變視點、透視與視差。",
      "為甚麼仍然值得學大片幅相機？",
      "較慢的操作過程，讓每一個調整都成為有意識的決定。倒轉而左右相反的對焦屏影像，亦讓你更仔細觀察邊緣、平面、對焦與空間關係。",
    ];
    for (const copy of partECopy) expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "場景" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Camera Simulator 主頁" })).toBeInTheDocument();
    expect(screen.getByText("親手操作上移、橫移、傾斜、擺動與對焦，看見它們如何改變透視、構圖與焦平面。")).toBeInTheDocument();
    expect(screen.getByTestId("landing-hero-cta")).toHaveAttribute("href", "/scenes");
    expect(screen.getByText("瀏覽場景")).toBeInTheDocument();
    expect(within(why).getByRole("heading", { name: "曝光前，你可以控制甚麼？", level: 3 })).toBeInTheDocument();
    expect(within(why).getByRole("heading", { name: "為甚麼相機移軸重要？", level: 3 })).toBeInTheDocument();
    expect(within(why).getByRole("heading", { name: "為甚麼仍然值得學大片幅相機？", level: 3 })).toBeInTheDocument();
    expect(screen.queryByText(/前、後組移軸/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("大型相機");
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-HK");
    expect(router.state.location.pathname).toBe("/");

    fireEvent.change(selector, { target: { value: "en" } });
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en");
      expect(screen.getByRole("heading", { name: "Shape Perspective. Place Focus." })).toBeInTheDocument();
    });
    expect(screen.getByTestId("landing-why-section")).toHaveTextContent("More control before the shot.");
    expect(screen.getByTestId("landing-why-section")).toHaveTextContent("Why is large-format camera still worth learning?");
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
