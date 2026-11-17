import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { SceneVariationRouteSync } from "../../app/SceneVariationRouteSync";
import { useRegenerateSceneVariant } from "../../app/useRegenerateSceneVariant";
import { interiorCornerScene } from "../../scenes/definitions/interior-corner";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { useAppStore } from "../../state/appStore";
import type { SceneDefinition } from "../../types/scene";

const fixtureScene: Pick<SceneDefinition, "id" | "sceneVariation"> = {
  ...interiorCornerScene,
  sceneVariation: { enabled: true, schemaVersion: 2, supportedSchemaVersions: [1, 2] },
};

type HarnessProps = {
  createSeed: () => number;
  scene?: Pick<SceneDefinition, "id" | "sceneVariation">;
};

const Probe = () => {
  const location = useLocation();
  const identity = useAppStore((state) => state.sceneVariantIdentity);
  const status = useAppStore((state) => state.sceneVariantRouteStatus);
  return (
    <output data-testid="route-state">
      {JSON.stringify({ pathname: location.pathname, search: location.search, hash: location.hash, identity, status })}
    </output>
  );
};

const VariationRouteHarness = ({ createSeed, scene = fixtureScene }: HarnessProps) => {
  const { mode: routeMode } = useParams();
  const mode = routeMode === "guided" ? "guided" : "free";
  const location = useLocation();
  const navigate = useNavigate();
  const guidedLessonEntry = new URLSearchParams(location.search).get("lesson") === "1";
  const regenerate = useRegenerateSceneVariant({ mode, scene, createSeed });
  return (
    <>
      <SceneVariationRouteSync
        mode={mode}
        scene={scene}
        guidedLessonEntry={guidedLessonEntry}
        createSeed={createSeed}
      />
      <Probe />
      <button type="button" onClick={() => navigate(`/simulator/free/${scene.id}?keep=two`)}>new-entry</button>
      <button type="button" onClick={() => navigate(`/simulator/free/${scene.id}?lesson=1&seed=71&sv=1`)}>lesson-entry</button>
      <button type="button" onClick={() => navigate(-1)}>back</button>
      <button type="button" onClick={() => navigate(1)}>forward</button>
      <button type="button" onClick={() => regenerate()}>regenerate</button>
    </>
  );
};

const renderRoute = (
  initialEntries: string[],
  createSeed: () => number,
  strict = false,
  scene: Pick<SceneDefinition, "id" | "sceneVariation"> = fixtureScene,
) => {
  const tree = (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/simulator/:mode/:sceneId"
          element={<VariationRouteHarness createSeed={createSeed} scene={scene} />}
        />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const readRouteState = () => JSON.parse(screen.getByTestId("route-state").textContent ?? "{}") as {
  pathname: string;
  search: string;
  hash: string;
  identity: { sceneId: string; seed: number; schemaVersion: number } | null;
  status: string;
};

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
});

describe("scene variation React Router lifecycle", () => {
  it("keeps implicit Shelf Swing Free Practice on current schema v1 once under StrictMode", async () => {
    const createSeed = vi.fn(() => 284719);
    renderRoute(
      ["/simulator/free/shelf-swing?keep=one"],
      createSeed,
      true,
      shelfSwingScene,
    );
    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        pathname: "/simulator/free/shelf-swing",
        search: "?keep=one&seed=284719&sv=1",
        identity: { sceneId: "shelf-swing", seed: 284719, schemaVersion: 1 },
        status: "resolved",
      });
    });
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("replays historical v1 and explicit v2 Shelf Swing URLs", async () => {
    const createSeed = vi.fn(() => 91);
    const view = renderRoute(
      ["/simulator/free/shelf-swing?seed=284719"],
      createSeed,
      false,
      shelfSwingScene,
    );
    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        search: "?seed=284719&sv=1",
        identity: { sceneId: "shelf-swing", seed: 284719, schemaVersion: 1 },
      });
    });
    expect(createSeed).not.toHaveBeenCalled();

    view.unmount();
    renderRoute(
      ["/simulator/free/shelf-swing?seed=284719&sv=1"],
      createSeed,
      false,
      shelfSwingScene,
    );
    await waitFor(() => expect(readRouteState().identity?.schemaVersion).toBe(1));

    cleanup();
    renderRoute(
      ["/simulator/free/shelf-swing?seed=284719&sv=2"],
      createSeed,
      false,
      shelfSwingScene,
    );
    await waitFor(() => expect(readRouteState()).toMatchObject({
      identity: { sceneId: "shelf-swing", seed: 284719, schemaVersion: 2 },
      status: "resolved",
    }));
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("regenerates and restores Shelf Swing variants through browser history", async () => {
    const createSeed = vi.fn(() => 55);
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "shelf-swing",
    });
    renderRoute(
      ["/simulator/free/shelf-swing?keep=two&seed=284719&sv=1#observer"],
      createSeed,
      false,
      shelfSwingScene,
    );
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(284719));

    fireEvent.click(screen.getByRole("button", { name: "regenerate" }));
    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        search: "?keep=two&seed=55&sv=1",
        hash: "#observer",
        identity: { sceneId: "shelf-swing", seed: 55, schemaVersion: 1 },
      });
    });
    expect(createSeed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(284719);
      expect(readRouteState().hash).toBe("#observer");
    });
    fireEvent.click(screen.getByRole("button", { name: "forward" }));
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(55));
  });

  it("keeps schema v2 on regeneration and restores its identity through browser history", async () => {
    const createSeed = vi.fn(() => 92);
    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "shelf-swing" });
    renderRoute(
      ["/simulator/free/shelf-swing?keep=two&seed=284719&sv=2#observer"],
      createSeed,
      false,
      shelfSwingScene,
    );
    await waitFor(() => expect(readRouteState().identity).toEqual({
      sceneId: "shelf-swing",
      seed: 284719,
      schemaVersion: 2,
    }));

    fireEvent.click(screen.getByRole("button", { name: "regenerate" }));
    await waitFor(() => expect(readRouteState()).toMatchObject({
      search: "?keep=two&seed=92&sv=2",
      hash: "#observer",
      identity: { sceneId: "shelf-swing", seed: 92, schemaVersion: 2 },
    }));
    expect(createSeed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => expect(readRouteState().identity).toEqual({
      sceneId: "shelf-swing",
      seed: 284719,
      schemaVersion: 2,
    }));
    fireEvent.click(screen.getByRole("button", { name: "forward" }));
    await waitFor(() => expect(readRouteState().identity).toEqual({
      sceneId: "shelf-swing",
      seed: 92,
      schemaVersion: 2,
    }));
  });

  it("normalizes one implicit seed under StrictMode and preserves other query parameters", async () => {
    const createSeed = vi.fn(() => 284719);
    renderRoute(["/simulator/free/interior-corner?keep=one&other=two"], createSeed, true);

    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        pathname: "/simulator/free/interior-corner",
        search: "?keep=one&other=two&seed=284719&sv=2",
        identity: { sceneId: "interior-corner", seed: 284719, schemaVersion: 2 },
        status: "resolved",
      });
    });
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("uses a direct legacy URL seed exactly and replace-normalizes schema v1 without entropy", async () => {
    const createSeed = vi.fn(() => 44);
    renderRoute(["/simulator/free/interior-corner?seed=0&keep=one"], createSeed);
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(0));
    expect(readRouteState().search).toBe("?keep=one&seed=0&sv=1");
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("replays an explicit v2 URL without entropy and keeps its schema", async () => {
    const createSeed = vi.fn(() => 44);
    renderRoute(["/simulator/free/interior-corner?seed=284719&sv=2&keep=one"], createSeed);
    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        search: "?keep=one&seed=284719&sv=2",
        identity: { seed: 284719, schemaVersion: 2 },
        status: "resolved",
      });
    });
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("restores explicit seeds through Back and Forward", async () => {
    const createSeed = vi.fn(() => 99);
    renderRoute([
      "/simulator/free/interior-corner?seed=11",
      "/simulator/free/interior-corner?seed=12",
    ], createSeed);
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(12));

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(11);
      expect(readRouteState().search).toBe("?seed=11&sv=1");
    });

    fireEvent.click(screen.getByRole("button", { name: "forward" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(12);
      expect(readRouteState().search).toBe("?seed=12&sv=1");
    });
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("starts a new implicit session on a fresh entry and Back restores the prior seed", async () => {
    const createSeed = vi.fn(() => 91);
    renderRoute(["/simulator/free/interior-corner?seed=7"], createSeed);
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(7));

    fireEvent.click(screen.getByRole("button", { name: "new-entry" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(91);
      expect(readRouteState().search).toBe("?keep=two&seed=91&sv=2");
    });
    expect(createSeed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(7);
      expect(readRouteState().search).toBe("?seed=7&sv=1");
    });
  });

  it("regenerates through a new URL entry and keeps camera state independent", async () => {
    useAppStore.getState().initializeSimulatorRoute({ mode: "free", sceneId: "interior-corner" });
    useAppStore.getState().setRise(17);
    const cameraBefore = useAppStore.getState().camera;
    const createSeed = vi.fn(() => 55);
    renderRoute(["/simulator/free/interior-corner?seed=4&keep=one"], createSeed);
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(4));

    fireEvent.click(screen.getByRole("button", { name: "regenerate" }));
    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        search: "?keep=one&seed=55&sv=1",
        identity: { sceneId: "interior-corner", seed: 55, schemaVersion: 1 },
      });
    });
    expect(useAppStore.getState().camera).toEqual(cameraBefore);
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("preserves canonical guided lesson Observe and clears a previous variant", async () => {
    const createSeed = vi.fn(() => 21);
    renderRoute(["/simulator/free/interior-corner?seed=19&sv=1"], createSeed);
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(19));

    fireEvent.click(screen.getByRole("button", { name: "lesson-entry" }));
    await waitFor(() => {
      expect(readRouteState().search).toBe("?lesson=1");
      expect(readRouteState().identity).toBeNull();
      expect(readRouteState().status).toBe("disabled");
    });
    expect(createSeed).not.toHaveBeenCalled();
  });

  it.each(["?seed=8&sv=3", "?seed=8&sv=1&sv=1", "?seed=8&sv="])(
    "fails closed on unsupported or malformed schema versions %s",
    async (search) => {
      const createSeed = vi.fn(() => 21);
      renderRoute([`/simulator/free/interior-corner${search}&keep=one`], createSeed);
      await waitFor(() => {
        expect(readRouteState().identity).toBeNull();
        expect(readRouteState().search).toContain("keep=one");
        expect(readRouteState().status).toBe(
          search.includes("sv=3") ? "unsupported-schema" : "invalid-schema",
        );
      });
      expect(createSeed).not.toHaveBeenCalled();
    },
  );
});
