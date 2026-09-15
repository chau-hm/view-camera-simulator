import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  createMemoryRouter,
  useLocation,
} from "react-router-dom";
import {
  publicSceneCatalog,
  publicSceneGroups,
  type PublicSceneGroupId,
} from "../../app/publicScenes";
import { routes } from "../../app/router";
import { ScenesPage } from "../../app/pages";
import { SceneCard } from "../../components/marketing/SceneCard";
import {
  isScenePublished,
  scenePublication,
  type ScenePublicationConfig,
} from "../../config/scenePublication";
import { i18n } from "../../i18n";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage("en");
});

const expectedPublishedGroups = (
  publication: ScenePublicationConfig = scenePublication,
) =>
  publicSceneGroups.flatMap((group) => {
    const entries = publicSceneCatalog.filter(
      (entry) =>
        entry.groupId === group.id &&
        isScenePublished(entry.id, publication),
    );
    return entries.length > 0 ? [{ group, entries }] : [];
  });

const macroSceneIds = [
  "macro-bellows-extension",
  "macro-depth-of-field",
  "macro-oblique-plane",
  "macro-compound-movements",
] as const;

describe("scenes page", () => {
  it("shows published public scene cards in grouped catalog order", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);
    const expectedGroups = expectedPublishedGroups();
    const publishedEntries = expectedGroups.flatMap(({ entries }) => entries);
    const publishedSceneIds = new Set(publishedEntries.map(({ id }) => id));
    const publishedTitles = publishedEntries.map(({ titleKey }) => i18n.t(titleKey));
    const sectionFor = (groupId: PublicSceneGroupId) => {
      const group = expectedGroups.find(({ group }) => group.id === groupId);
      if (!group) {
        throw new Error(`Expected published group ${groupId} is missing from the test fixture`);
      }
      const heading = screen.getByRole("heading", {
        name: i18n.t(group.group.titleKey),
        level: 2,
      });
      const section = heading.closest("section");
      expect(section).not.toBeNull();
      return within(section!);
    };

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const visibleCards = screen.queryAllByRole("article");
    expect(visibleCards).toHaveLength(publishedEntries.length);
    expect(screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(
      expectedGroups.map(({ group }) => i18n.t(group.titleKey)),
    );
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(publishedEntries.length);
    expect(screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      publishedTitles,
    );
    expectedGroups.forEach(({ group }) => {
      expect(sectionFor(group.id).getByText(i18n.t(group.descriptionKey))).toBeInTheDocument();
    });

    const representativeMemberships: ReadonlyArray<readonly [PublicSceneGroupId, string]> = [
      ["foundations", "understanding-camera-movements"],
      ["core-movements", "table-tilt"],
      ["combined-movements", "oblique-tabletop"],
    ];
    representativeMemberships.forEach(([groupId, sceneId]) => {
      const expectedEntry = publishedEntries.find((entry) => entry.id === sceneId);
      if (!expectedEntry) return;

      expect(
        sectionFor(groupId).getByRole("heading", {
          name: i18n.t(expectedEntry.titleKey),
          level: 3,
        }),
      ).toBeInTheDocument();
    });
    visibleCards.forEach((card) => {
      expect(card.querySelector("article > a")).toBeNull();
    });

    if (publishedSceneIds.has("view-camera-anatomy")) {
      const anatomyHeading = await screen.findByRole("heading", {
        name: "Lesson 0 — Meet the View Camera",
        level: 3,
      });
      const anatomyCard = anatomyHeading.closest("article");
      expect(anatomyCard).not.toBeNull();
      const scopedAnatomyCard = within(anatomyCard!);
      expect(
        scopedAnatomyCard.getByText(
          "Identify the major physical parts of a conceptual view camera before exploring its movements.",
        ),
      ).toBeInTheDocument();
      expect(scopedAnatomyCard.getByText("Camera anatomy")).toBeInTheDocument();
      expect(scopedAnatomyCard.getByText("Focusing screen")).toBeInTheDocument();
      expect(scopedAnatomyCard.getByText("Shared image plane")).toBeInTheDocument();
      expect(anatomyCard!.querySelector("img")).toHaveAttribute(
        "src",
        "/assets/scene-view-camera-anatomy.webp",
      );
      expect(scopedAnatomyCard.getByRole("link", { name: "Start Lesson" })).toHaveAttribute(
        "href",
        "/simulator/free/view-camera-anatomy?lesson=1",
      );
    }

    if (publishedSceneIds.has("focus-fundamentals-two-targets")) {
      const focusHeading = await screen.findByRole("heading", {
        name: "Focus Fundamentals — Two Targets",
        level: 3,
      });
      const focusCard = focusHeading.closest("article");
      expect(focusCard).not.toBeNull();
      expect(within(focusCard!).queryByRole("link", { name: "Start Guided Task" })).not.toBeInTheDocument();
      expect(screen.getByText(/Understand how Front and Rear focusing differ/)).toBeInTheDocument();
      expect(screen.getByText("Front / Rear focusing")).toBeInTheDocument();
      expect(screen.getByText("Image alignment")).toBeInTheDocument();
      expect(screen.getByText("Fixed f/11")).toBeInTheDocument();
    }

    if (publishedSceneIds.has("understanding-camera-movements")) {
      const understandingHeading = await screen.findByRole("heading", {
        name: "Understanding Camera Movements",
        level: 3,
      });
      const understandingCard = understandingHeading.closest("article");
      expect(understandingCard).not.toBeNull();
      expect(
        within(understandingCard!).getByText(
          /Understand how whole-camera movement and Front\/Rear standard movements affect viewpoint/,
        ),
      ).toBeInTheDocument();
    }

    if (publishedSceneIds.has("architecture-rise")) {
      const architectureHeading = await screen.findByRole("heading", {
        name: "Architecture Rise",
        level: 3,
      });
      expect(architectureHeading).toBeInTheDocument();
      const architectureCard = architectureHeading.closest("article");
      expect(architectureCard).not.toBeNull();
      const scopedArchitectureCard = within(architectureCard!);
      expect(scopedArchitectureCard.getByText(/Understand how Front Rise changes framing/)).toBeInTheDocument();
      expect(scopedArchitectureCard.getByText("Front Rise")).toBeInTheDocument();
      expect(scopedArchitectureCard.getByText("Framing")).toBeInTheDocument();
      expect(scopedArchitectureCard.getByText("Perspective control")).toBeInTheDocument();
    }

    if (publishedSceneIds.has("architecture-foreground")) {
      const architectureForegroundHeading = await screen.findByRole("heading", {
        name: "Architecture + Foreground",
        level: 3,
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
        "/assets/architecture-foreground.webp",
      );
      expect(scopedArchitectureForegroundCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
        "href",
        "/simulator/free/architecture-foreground",
      );
      expect(scopedArchitectureForegroundCard.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
        "href",
        "/simulator/free/architecture-foreground?lesson=1",
      );
    }

    if (publishedSceneIds.has("interior-corner")) {
      const interiorCornerHeading = await screen.findByRole("heading", {
        name: "Interior Corner — Rise + Swing",
        level: 3,
      });
      const interiorCornerCard = interiorCornerHeading.closest("article");
      expect(interiorCornerCard).not.toBeNull();
      const scopedInteriorCornerCard = within(interiorCornerCard!);
      expect(
        scopedInteriorCornerCard.getByText(
          "Explore a neutral interior corner where upper architectural detail presses against the frame and one receding wall creates a future Front Swing and Focus problem.",
        ),
      ).toBeInTheDocument();
      expect(scopedInteriorCornerCard.getByText("Front Rise")).toBeInTheDocument();
      expect(scopedInteriorCornerCard.getByText("Front Swing")).toBeInTheDocument();
      expect(scopedInteriorCornerCard.getByText("Architectural depth")).toBeInTheDocument();
      expect(interiorCornerCard!.querySelector("img")).toHaveAttribute(
        "src",
        "/assets/interior-corner.webp",
      );
      expect(scopedInteriorCornerCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
        "href",
        "/simulator/free/interior-corner",
      );
      expect(scopedInteriorCornerCard.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
        "href",
        "/simulator/free/interior-corner?lesson=1",
      );
    }

    if (publishedSceneIds.has("oblique-architecture")) {
      // Oblique Architecture remains directly available immediately before the final scene.
      const obliqueHeading = await screen.findByRole("heading", {
        name: "Oblique Architecture",
        level: 3,
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
        "/assets/oblique-architecture.webp",
      );
      expect(scopedObliqueCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
        "href",
        "/simulator/free/oblique-architecture",
      );
      expect(scopedObliqueCard.getByRole("link", { name: "Guided Lesson" })).toHaveAttribute(
        "href",
        "/simulator/free/oblique-architecture?lesson=1",
      );
    }

    if (publishedSceneIds.has("table-tilt")) {
      // Table Tilt uses the standard enabled SceneCard link.
      const tableHeading = await screen.findByRole("heading", { name: "Table Tilt", level: 3 });
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
      expect(tableCard!.querySelector("img")).toHaveAttribute("src", "/assets/table-tilt.webp");
      expect(scopedTableCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
        "href",
        "/simulator/free/table-tilt",
      );
      expect(scopedTableCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
        "href",
        "/simulator/guided/table-tilt/tilt-01",
      );
    }

    if (publishedSceneIds.has("shelf-swing")) {
      const shelfHeading = await screen.findByRole("heading", { name: "Shelf Swing", level: 3 });
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
      expect(shelfCard!.querySelector("img")).toHaveAttribute("src", "/assets/shelf-swing.webp");
      expect(scopedShelfCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
        "href",
        "/simulator/free/shelf-swing",
      );
      expect(scopedShelfCard.queryByText("In development")).toBeNull();
      expect(scopedShelfCard.getByRole("link", { name: "Start Guided Task" })).toHaveAttribute(
        "href",
        "/simulator/guided/shelf-swing/swing-01",
      );
    }

    if (publishedSceneIds.has("oblique-tabletop")) {
      const tabletopHeading = await screen.findByRole("heading", { name: "Oblique Tabletop", level: 3 });
      const tabletopCard = tabletopHeading.closest("article");
      expect(tabletopCard).not.toBeNull();
      const scopedTabletopCard = within(tabletopCard!);
      expect(
        scopedTabletopCard.getByText(
          "Photograph an inclined plan board resting on a normal table. Because the board recedes near-to-far and laterally, Tilt alone cannot align the whole subject plane; Swing is also required.",
        ),
      ).toBeInTheDocument();
      expect(scopedTabletopCard.getByText("Oblique plane")).toBeInTheDocument();
      expect(scopedTabletopCard.getByText("Depth variation")).toBeInTheDocument();
      expect(scopedTabletopCard.getByText("Focus distance")).toBeInTheDocument();
      expect(tabletopCard!.querySelector("img")).toHaveAttribute("src", "/assets/oblique-tabletop.webp");
      expect(scopedTabletopCard.getByRole("link", { name: "Open Scene" })).toHaveAttribute(
        "href",
        "/simulator/free/oblique-tabletop",
      );
      expect(scopedTabletopCard.queryByRole("link", { name: "Start Guided Task" })).toBeNull();
    }

    if (publishedEntries.length > 0) {
      const lastPublishedTitle = publishedTitles.at(-1);
      expect(lastPublishedTitle).toBeDefined();
      expect(
        within(visibleCards.at(-1)!).getByRole("heading", {
          name: lastPublishedTitle,
          level: 3,
        }),
      ).toBeInTheDocument();
    }
    if (publishedSceneIds.has("mirror-shift")) {
      const mirrorHeading = await screen.findByRole("heading", { name: "Mirror Shift", level: 3 });
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
    }
    expect(
      screen.queryByText("The guided Shelf Swing lesson is still being prepared."),
    ).not.toBeInTheDocument();
  });

  it("uses lazy-loaded WebP thumbnails for every public scene", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);
    const publishedEntries = expectedPublishedGroups().flatMap(({ entries }) => entries);

    const cards = screen.queryAllByRole("article");
    expect(cards).toHaveLength(publishedEntries.length);

    cards.forEach((card, index) => {
      const image = card.querySelector("img");
      expect(image).not.toBeNull();
      expect(image).toHaveAttribute(
        "src",
        `/assets/${publishedEntries[index].thumbnailAsset.replace(/^assets\//, "")}`,
      );
      expect(image).toHaveAttribute("width", "360");
      expect(image).toHaveAttribute("height", "240");
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
    });
  });

  it("activates only Bellows Extension while preserving Macro card order and copy", async () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);

    const groupHeading = await screen.findByRole("heading", {
      name: "Macro Photography",
      level: 2,
    });
    const section = within(groupHeading.closest("section")!);
    const macroEntries = macroSceneIds.map((sceneId) =>
      publicSceneCatalog.find((entry) => entry.id === sceneId)!,
    );

    expect(section.getAllByRole("article")).toHaveLength(macroSceneIds.length);
    expect(section.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(
      macroEntries.map(({ titleKey }) => i18n.t(titleKey)),
    );

    macroEntries.forEach((entry) => {
      const card = section.getByRole("heading", {
        name: i18n.t(entry.titleKey),
        level: 3,
      }).closest("article");
      expect(card).not.toBeNull();
      const scopedCard = within(card!);

      expect(scopedCard.getByText(i18n.t(entry.descriptionKey))).toBeInTheDocument();
      entry.topicKeys.forEach((topicKey) => {
        expect(scopedCard.getByText(i18n.t(topicKey))).toBeInTheDocument();
      });
      if (entry.id === "macro-bellows-extension") {
        expect(scopedCard.getByRole("link")).toHaveAttribute("href", "/simulator/free/macro-bellows-extension");
      } else {
        expect(scopedCard.getByRole("status")).toHaveTextContent("In development");
        expect(scopedCard.queryByRole("link")).not.toBeInTheDocument();
      }
      expect(card!.querySelector("img")).toHaveAttribute(
        "src",
        `/assets/${entry.thumbnailAsset.replace(/^assets\//, "")}`,
      );
    });
  });

  it("keeps in-development scenes non-actionable", () => {
    render(
      <MemoryRouter>
        <SceneCard
          sceneId="architecture-rise"
          title="Architecture Rise"
          description="A scene in progress."
          topics={["Front Rise"]}
          availability="in-development"
          thumbnailAsset="assets/architecture-rise.webp"
          guidedTaskId="rise-01"
        />
      </MemoryRouter>,
    );

    const card = screen.getByRole("article");
    expect(within(card).getByRole("status")).toHaveAttribute(
      "data-scene-availability",
      "in-development",
    );
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders canonical zh-HK titles and learning-purpose descriptions", async () => {
    await i18n.changeLanguage("zh-HK");
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ["/scenes"] });
    render(<RouterProvider router={memoryRouter} />);
    const publishedGroups = expectedPublishedGroups();
    const publishedEntries = publishedGroups.flatMap(({ entries }) => entries);
    const publishedSceneIds = new Set(publishedEntries.map(({ id }) => id));
    const publishedTitles = publishedEntries.map(({ titleKey }) => i18n.t(titleKey));

    expect(screen.getByRole("combobox", { name: "語言" })).toHaveValue("zh-HK");
    expect(screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(
      publishedGroups.map(({ group }) => i18n.t(group.titleKey)),
    );
    expect(
      screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(publishedTitles);

    const cardFor = (title: string) => {
      const heading = screen.getByRole("heading", { name: title, level: 3 });
      const card = heading.closest("article");
      expect(card).not.toBeNull();
      return within(card!);
    };

    const macroEntries = macroSceneIds.map((sceneId) =>
      publicSceneCatalog.find((entry) => entry.id === sceneId)!,
    );
    macroEntries.forEach((entry) => {
      const card = cardFor(i18n.t(entry.titleKey));
      expect(card.getByText(i18n.t(entry.descriptionKey))).toBeInTheDocument();
      entry.topicKeys.forEach((topicKey) => {
        expect(card.getByText(i18n.t(topicKey))).toBeInTheDocument();
      });
      if (entry.id === "macro-bellows-extension") {
        expect(card.getByRole("link")).toHaveAttribute("href", "/simulator/free/macro-bellows-extension");
      } else {
        expect(card.getByRole("status")).toHaveTextContent("開發中");
        expect(card.queryByRole("link")).not.toBeInTheDocument();
      }
    });

    if (publishedSceneIds.has("view-camera-anatomy")) {
      expect(cardFor("第 0 課 — 認識大片幅相機").getByRole("link", { name: "開始課程" })).toHaveAttribute(
        "href",
        "/simulator/free/view-camera-anatomy?lesson=1",
      );
    }
    if (publishedSceneIds.has("understanding-camera-movements")) {
      expect(cardFor("認識大片幅相機移軸").getByText(/理解整部相機移動與前、後組移軸/)).toBeInTheDocument();
    }
    if (publishedSceneIds.has("mirror-shift")) {
      expect(
        cardFor("鏡面構圖與視點").getByText(
          "理解前組橫移如何恢復構圖，而不會恢復原本的視點與視差。",
        ),
      ).toBeInTheDocument();
    }
    if (publishedSceneIds.has("table-tilt")) {
      expect(cardFor("桌面焦平面與傾斜").getByText(/理解前組傾斜如何改變清晰焦平面/)).toBeInTheDocument();
    }
    if (publishedSceneIds.has("shelf-swing")) {
      expect(cardFor("斜向焦平面與擺動").getByText(/理解前組擺動如何改變清晰焦平面/)).toBeInTheDocument();
    }
    if (publishedSceneIds.has("oblique-architecture")) {
      expect(
        cardFor("斜向建築攝影").getByText(
          "結合前組上移與前組擺動，在斜角拍攝建築物時保持垂直線平行，並讓延伸的立面由近至遠保持清晰。",
        ),
      ).toBeInTheDocument();
      expect(cardFor("斜向建築攝影").getByRole("link", { name: "引導課程" })).toHaveAttribute(
        "href",
        "/simulator/free/oblique-architecture?lesson=1",
      );
    }
    if (publishedSceneIds.has("interior-corner")) {
      expect(
        cardFor("室內轉角 — 上移與擺動").getByText(/探索一個中性室內轉角/),
      ).toBeInTheDocument();
      expect(cardFor("室內轉角 — 上移與擺動").getByText("前組上移")).toBeInTheDocument();
      expect(cardFor("室內轉角 — 上移與擺動").getByText("前組擺動")).toBeInTheDocument();
      expect(cardFor("室內轉角 — 上移與擺動").getByText("建築深度")).toBeInTheDocument();
      expect(cardFor("室內轉角 — 上移與擺動").getByRole("link", { name: "開啟場景" })).toHaveAttribute(
        "href",
        "/simulator/free/interior-corner",
      );
      expect(cardFor("室內轉角 — 上移與擺動").getByRole("link", { name: "引導課程" })).toHaveAttribute(
        "href",
        "/simulator/free/interior-corner?lesson=1",
      );
    }
  });

  it("navigates from the Architecture + Foreground card into Free Practice", async () => {
    if (!expectedPublishedGroups().some(({ entries }) =>
      entries.some(({ id }) => id === "architecture-foreground")
    )) {
      return;
    }

    const LocationProbe = () => <div data-testid="navigation-location">{useLocation().pathname}</div>;
    render(
      <MemoryRouter initialEntries={["/scenes"]}>
        <Routes>
          <Route path="/scenes" element={<ScenesPage />} />
          <Route path="/simulator/free/:sceneId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "Architecture + Foreground", level: 3 });
    const card = heading.closest("article");
    expect(card).not.toBeNull();
    fireEvent.click(within(card!).getByRole("link", { name: "Open Scene" }));

    await waitFor(() =>
      expect(screen.getByTestId("navigation-location")).toHaveTextContent(
        "/simulator/free/architecture-foreground",
      ),
    );
  });

  it("navigates from the Architecture + Foreground card into its Guided Lesson", async () => {
    if (!expectedPublishedGroups().some(({ entries }) =>
      entries.some(({ id }) => id === "architecture-foreground")
    )) {
      return;
    }

    const LocationProbe = () => {
      const location = useLocation();
      return <div data-testid="navigation-location">{location.pathname}{location.search}</div>;
    };
    render(
      <MemoryRouter initialEntries={["/scenes"]}>
        <Routes>
          <Route path="/scenes" element={<ScenesPage />} />
          <Route path="/simulator/free/:sceneId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "Architecture + Foreground", level: 3 });
    const card = heading.closest("article");
    expect(card).not.toBeNull();
    fireEvent.click(within(card!).getByRole("link", { name: "Guided Lesson" }));

    await waitFor(() =>
      expect(screen.getByTestId("navigation-location")).toHaveTextContent(
        "/simulator/free/architecture-foreground?lesson=1",
      ),
    );
  });
});
