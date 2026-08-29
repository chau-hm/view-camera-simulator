import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("FAQ page", () => {
  it("renders one page heading and seven disclosures in the approved order", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/faq"] });
    render(<RouterProvider router={memoryRouter} />);

    const heading = await screen.findByRole("heading", {
      name: "Frequently Asked Questions",
      level: 1,
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Frequently Asked Questions" })).toHaveLength(1);
    expect(screen.queryByText("VIEW CAMERA SIMULATOR")).not.toBeInTheDocument();
    expect(screen.queryByText("Answers to common questions about View Camera Simulator.")).not.toBeInTheDocument();

    const faq = screen.getByTestId("faq-section");
    const details = Array.from(faq.querySelectorAll("details"));
    const summaries = Array.from(faq.querySelectorAll("summary"));
    const questions = [
      "Who is View Camera Simulator for?",
      "Do I need to own a large-format camera?",
      "What can I learn with View Camera Simulator?",
      "Is the simulator based on a specific type of view camera, camera, or lens?",
      "Will every movement shown be available on my camera?",
      "How realistic is the simulator?",
      "Is it a replacement for learning with a real view camera?",
    ];

    expect(details).toHaveLength(7);
    expect(
      summaries.map((summary) => summary.querySelector(".faq-item__question-text")?.textContent),
    ).toEqual(questions);
    expect(Array.from(faq.querySelectorAll(".faq-item__number")).map((number) => number.textContent?.trim())).toEqual([
      "1.",
      "2.",
      "3.",
      "4.",
      "5.",
      "6.",
      "7.",
    ]);
    expect(faq.querySelectorAll(".faq-item__icon")).toHaveLength(7);
    expect(details.every((detail) => !detail.open)).toBe(true);

    const firstSummary = summaries[0];
    const firstDetails = details[0];
    firstSummary.focus();
    expect(document.activeElement).toBe(firstSummary);
    fireEvent.click(firstSummary);
    expect(firstDetails.open).toBe(true);
    fireEvent.click(firstSummary);
    expect(firstDetails.open).toBe(false);
  });

  it("renders the approved Traditional Chinese FAQ in the zh-HK locale", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/faq"] });
    render(<RouterProvider router={memoryRouter} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "zh-HK" },
    });

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-HK");
      expect(screen.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
      expect(screen.getByRole("heading", { name: "常見問題", level: 1 })).toBeInTheDocument();
    });

    const faq = screen.getByTestId("faq-section");
    const summaries = Array.from(faq.querySelectorAll("summary"));
    const questions = [
      "View Camera Simulator 適合哪些人使用？",
      "我需要擁有大片幅相機嗎？",
      "我可以透過 View Camera Simulator 學到甚麼？",
      "模擬器是否以某一款特定的大片幅相機或鏡頭為基礎？",
      "我的相機會提供模擬器展示的所有移軸功能嗎？",
      "模擬器有多真實？",
      "它可以取代使用實際大片幅相機的學習嗎？",
    ];

    expect(summaries.map((summary) => summary.querySelector(".faq-item__question-text")?.textContent)).toEqual(
      questions,
    );
    expect(screen.getByText("不需要。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "常見問題" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("heading", { name: "常見問題", level: 1 }).closest("[lang=\"en\"]")).toBeNull();
    expect(faq.closest("[lang=\"en\"]")).toBeNull();
    expect(document.documentElement).toHaveAttribute("lang", "zh-HK");
  });
});
