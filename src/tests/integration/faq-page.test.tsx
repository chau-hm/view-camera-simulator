import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../app/router";

afterEach(cleanup);

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
    expect(screen.getByText("VIEW CAMERA SIMULATOR")).toBeInTheDocument();
    expect(screen.getByText("Answers to common questions about View Camera Simulator.")).toBeInTheDocument();

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
});
