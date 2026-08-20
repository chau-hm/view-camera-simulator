import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import {
  getPublicSceneEntryById,
  getPublicScenes,
  publicSceneCatalog,
  publicSceneIds,
} from "../../app/publicScenes";
import { routes } from "../../app/router";
import { i18n } from "../../i18n";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

describe("scenes page", () => {
  it("shows the enabled public scene cards in catalog order", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);

    // Focus Fundamentals card
    expect(
      await screen.findByRole("heading", { name: "Focus Fundamentals — Two Targets", level: 2 }),
    ).toBeInTheDocument();
    const openButtons = await screen.findAllByText(/Open Scene/);
    expect(openButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Understand how Front and Rear focusing differ/)).toBeInTheDocument();
    expect(screen.getByText("Front / Rear focusing")).toBeInTheDocument();
    expect(screen.getByText("Image alignment")).toBeInTheDocument();
    expect(screen.getByText("Fixed f/32")).toBeInTheDocument();
    const focusHeading = await screen.findByRole("heading", {
      name: "Focus Fundamentals — Two Targets",
      level: 2,
    });
    const focusCard = focusHeading.closest("article");
    expect(focusCard).not.toBeNull();
    expect(within(focusCard!).queryByRole("link", { name: "Start Guided Task" })).not.toBeInTheDocument();

    const understandingHeading = await screen.findByRole("heading", { name: "Understanding Camera Movements", level: 2 });
    const understandingCard = understandingHeading.closest("article");
    expect(understandingCard).not.toBeNull();
    expect(within(understandingCard!).getByText(/Understand how whole-camera movement and Front\/Rear standard movements affect viewpoint/)).toBeInTheDocument();

    // Architecture Rise card should be present with its description and topics
    const architectureHeading = await screen.findByRole("heading", { name: "Architecture Rise", level: 2 });
    expect(architectureHeading).toBeInTheDocument();
    const architectureCard = architectureHeading.closest("article");
    expect(architectureCard).not.toBeNull();
    const scopedArchitectureCard = within(architectureCard!);
    expect(scopedArchitectureCard.getByText(/Understand how Front Rise changes framing/)).toBeInTheDocument();
    expect(scopedArchitectureCard.getByText("Front Rise")).toBeInTheDocument();
    expect(scopedArchitectureCard.getByText("Framing")).toBeInTheDocument();
    expect(scopedArchitectureCard.getByText("Perspective control")).toBeInTheDocument();

    const architectureForegroundHeading = await screen.findByRole("heading", {
      name: "Architecture + Foreground",
      level: 2,
    });
    const architectureForegroundCard = architectureForegroundHeading.closest("article");
    expect(architectureForegroundCard).not.toBeNull();
    const scopedArchitectureForegroundCard = within(architectureForegroundCard!);
    expect(
      scopedArchitectureForegroundCard.getByText(
        "Frame a level architectural subject while observing how foreground depth creates a second focusing problem.",
      ),
    ).toBeInTheDocument();
    expect(scopedArchitectureForegroundCard.getByText("Level framing")).toBeInTheDocument();
    expect(scopedArchitectureForegroundCard.getByText("Foreground depth")).toBeInTheDocument();
    expect(scopedArchitectureForegroundCard.getByText("Sharpness across depth")).toBeInTheDocument();
    expect(architectureForegroundCard!.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/architecture-foreground.png",
    );
    expect(scopedArchitectureForegroundCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
      "href",
      "/simulator/free/architecture-foreground",
    );
    expect(scopedArchitectureForegroundCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
      "href",
      "/simulator/guided/architecture-foreground/architecture-foreground-rise-01",
    );

    // Oblique Architecture remains the final public scene and now exposes the compound task.
    const obliqueHeading = await screen.findByRole("heading", {
      name: "Oblique Architecture",
      level: 2,
    });
    const obliqueCard = obliqueHeading.closest("article");
    expect(obliqueCard).not.toBeNull();
    const scopedObliqueCard = within(obliqueCard!);
    expect(
      scopedObliqueCard.getByText(
        "Combine Front Rise and Front Swing to frame an oblique building while keeping verticals parallel and the receding façade sharp.",
      ),
    ).toBeInTheDocument();
    expect(scopedObliqueCard.getByText("Front Rise")).toBeInTheDocument();
    expect(scopedObliqueCard.getByText("Front Swing")).toBeInTheDocument();
    expect(scopedObliqueCard.getByText("Compound movements")).toBeInTheDocument();
    expect(obliqueCard!.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/oblique-architecture.png",
    );
    expect(scopedObliqueCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
      "href",
      "/simulator/free/oblique-architecture",
    );
    expect(scopedObliqueCard.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
      "href",
      "/simulator/free/oblique-architecture?lesson=1",
    );

    // Table Tilt remains in the existing lesson order and uses the standard enabled SceneCard link.
    const tableHeading = await screen.findByRole("heading", { name: "Table Tilt", level: 2 });
    const tableCard = tableHeading.closest("article");
    expect(tableCard).not.toBeNull();
    const scopedTableCard = within(tableCard!);
    expect(
      scopedTableCard.getByText(
        "Understand how Front Tilt changes the plane of sharp focus across subject depth.",
      ),
    ).toBeInTheDocument();
    expect(scopedTableCard.getByText("Front Tilt")).toBeInTheDocument();
    expect(scopedTableCard.getByText("Plane of sharp focus")).toBeInTheDocument();
    expect(scopedTableCard.getByText("Scheimpflug principle")).toBeInTheDocument();
    expect(tableCard!.querySelector("img")).toHaveAttribute("src", "/assets/table-tilt.png");
    expect(scopedTableCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
      "href",
      "/simulator/free/table-tilt",
    );
    expect(scopedTableCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
      "href",
      "/simulator/guided/table-tilt/tilt-01",
    );

    const shelfHeading = await screen.findByRole("heading", { name: "Shelf Swing", level: 2 });
    const shelfCard = shelfHeading.closest("article");
    expect(shelfCard).not.toBeNull();
    const scopedShelfCard = within(shelfCard!);
    expect(
      scopedShelfCard.getByText(
        "Understand how Front Swing changes the plane of sharp focus across subjects arranged diagonally in depth.",
      ),
    ).toBeInTheDocument();
    expect(scopedShelfCard.getByText("Front Swing")).toBeInTheDocument();
    expect(scopedShelfCard.getByText("Plane of sharp focus")).toBeInTheDocument();
    expect(scopedShelfCard.getByText("Scheimpflug principle")).toBeInTheDocument();
    expect(shelfCard!.querySelector("img")).toHaveAttribute("src", "/assets/shelf-swing.png");
    expect(scopedShelfCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
      "href",
      "/simulator/free/shelf-swing",
    );
    expect(scopedShelfCard.queryByText("In development")).toBeNull();
    expect(scopedShelfCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
      "href",
      "/simulator/guided/shelf-swing/swing-01",
    );

    expect(publicSceneIds).toEqual([
      "understanding-camera-movements",
      "focus-fundamentals-two-targets",
      "architecture-rise",
      "architecture-foreground",
      "table-tilt",
      "shelf-swing",
      "mirror-shift",
      "oblique-architecture",
    ]);
    expect(publicSceneIds.at(-1)).toBe("oblique-architecture");
    expect(publicSceneCatalog.map((entry) => entry.id)).toEqual(publicSceneIds);
    expect(getPublicSceneEntryById("focus-fundamentals-two-targets")?.availableModes).toEqual([
      "free",
    ]);
    expect(getPublicSceneEntryById("focus-fundamentals-two-targets")?.guidedTaskId).toBeUndefined();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "Understanding Camera Movements",
      "Focus Fundamentals — Two Targets",
      "Architecture Rise",
      "Architecture + Foreground",
      "Table Tilt",
      "Shelf Swing",
      "Mirror Shift",
      "Oblique Architecture",
    ]);
    expect(getPublicScenes().map((scene) => scene.id)).toContain("shelf-swing");
    expect(getPublicSceneEntryById("shelf-swing")?.availability).toBe("available");
    expect(getPublicSceneEntryById("shelf-swing")?.availableModes).toEqual([
      "free",
      "guided",
    ]);
    expect(getPublicSceneEntryById("shelf-swing")?.guidedTaskId).toBe("swing-01");
    expect(getPublicSceneEntryById("table-tilt")?.availability).toBe("available");
    expect(getPublicSceneEntryById("table-tilt")?.availableModes).toEqual([
      "free",
      "guided",
    ]);
    const mirrorHeading = await screen.findByRole("heading", { name: "Mirror Shift", level: 2 });
    const mirrorCard = mirrorHeading.closest("article");
    expect(mirrorCard).not.toBeNull();
    expect(
      within(mirrorCard!).getByText(
        "Understand how Front Shift can restore framing without restoring the original viewpoint or parallax.",
      ),
    ).toBeInTheDocument();
    expect(within(mirrorCard!).getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
      "href",
      "/simulator/guided/mirror-shift/mirror-shift-01",
    );
    expect(getPublicSceneEntryById("mirror-shift")?.availableModes).toEqual(["free", "guided"]);
    expect(getPublicSceneEntryById("mirror-shift")?.guidedTaskId).toBe("mirror-shift-01");
    expect(getPublicScenes().map((scene) => scene.id)).toContain("mirror-shift");
    expect(getPublicSceneEntryById("unknown-scene")).toBeUndefined();
    expect(
      screen.queryByText("The guided Shelf Swing lesson is still being prepared."),
    ).not.toBeInTheDocument();
  });

  it("renders canonical zh-HK titles and learning-purpose descriptions", async () => {
    await i18n.changeLanguage("zh-HK");
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);

    expect(screen.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
    expect(
      (await screen.findAllByRole("heading", { level: 2 })).map((heading) => heading.textContent),
    ).toEqual([
      "認識大片幅相機移軸",
      "前後組對焦比較",
      "建築構圖與上移",
      "建築物與前景",
      "桌面焦平面與傾斜",
      "斜向焦平面與擺動",
      "鏡面構圖與視點",
      "斜向建築攝影",
    ]);

    const cardFor = (title: string) => {
      const heading = screen.getByRole("heading", { name: title, level: 2 });
      const card = heading.closest("article");
      expect(card).not.toBeNull();
      return within(card!);
    };

    expect(cardFor("認識大片幅相機移軸").getByText(/理解整部相機移動與前、後組移軸/)).toBeInTheDocument();
    expect(
      cardFor("鏡面構圖與視點").getByText(
        "理解前組橫移如何恢復構圖，而不會恢復原本的視點與視差。",
      ),
    ).toBeInTheDocument();
    expect(cardFor("桌面焦平面與傾斜").getByText(/理解前組傾斜如何改變清晰焦平面/)).toBeInTheDocument();
    expect(cardFor("斜向焦平面與擺動").getByText(/理解前組擺動如何改變清晰焦平面/)).toBeInTheDocument();
    expect(
      cardFor("斜向建築攝影").getByText(
        "結合前組上移與前組擺動，在斜角拍攝建築物時保持垂直線平行，並讓延伸的立面由近至遠保持清晰。",
      ),
    ).toBeInTheDocument();
    expect(cardFor("斜向建築攝影").getByRole("link", { name: "引導課程" })).toHaveAttribute(
      "href",
      "/simulator/free/oblique-architecture?lesson=1",
    );
  });
});
