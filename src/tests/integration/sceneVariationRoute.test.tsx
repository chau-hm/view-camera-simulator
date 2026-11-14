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
import { useAppStore } from "../../state/appStore";
import type { SceneDefinition } from "../../types/scene";

const fixtureScene: Pick<SceneDefinition, "id" | "sceneVariation"> = {
  ...interiorCornerScene,
  sceneVariation: { enabled: true, schemaVersion: 1 },
};

type HarnessProps = { createSeed: () => number };

const Probe = () => {
  const location = useLocation();
  const identity = useAppStore((state) => state.sceneVariantIdentity);
  return (
    <output data-testid="route-state">
      {JSON.stringify({ pathname: location.pathname, search: location.search, identity })}
    </output>
  );
};

const VariationRouteHarness = ({ createSeed }: HarnessProps) => {
  const { mode: routeMode } = useParams();
  const mode = routeMode === "guided" ? "guided" : "free";
  const navigate = useNavigate();
  const regenerate = useRegenerateSceneVariant({ mode, scene: fixtureScene, createSeed });
  return (
    <>
      <SceneVariationRouteSync mode={mode} scene={fixtureScene} createSeed={createSeed} />
      <Probe />
      <button type="button" onClick={() => navigate("/simulator/free/interior-corner?keep=two")}>new-entry</button>
      <button type="button" onClick={() => navigate(-1)}>back</button>
      <button type="button" onClick={() => navigate(1)}>forward</button>
      <button type="button" onClick={() => regenerate()}>regenerate</button>
    </>
  );
};

const renderRoute = (initialEntries: string[], createSeed: () => number, strict = false) => {
  const tree = (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="/simulator/:mode/:sceneId"
          element={<VariationRouteHarness createSeed={createSeed} />}
        />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const readRouteState = () => JSON.parse(screen.getByTestId("route-state").textContent ?? "{}") as {
  pathname: string;
  search: string;
  identity: { sceneId: string; seed: number; schemaVersion: number } | null;
};

afterEach(() => {
  cleanup();
  useAppStore.getState().resetCamera();
});

describe("scene variation React Router lifecycle", () => {
  it("normalizes one implicit seed under StrictMode and preserves other query parameters", async () => {
    const createSeed = vi.fn(() => 284719);
    renderRoute(["/simulator/free/interior-corner?keep=one&other=two"], createSeed, true);

    await waitFor(() => {
      expect(readRouteState()).toMatchObject({
        pathname: "/simulator/free/interior-corner",
        search: "?keep=one&other=two&seed=284719",
        identity: { sceneId: "interior-corner", seed: 284719, schemaVersion: 1 },
      });
    });
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("uses a direct URL seed exactly without requesting entropy", async () => {
    const createSeed = vi.fn(() => 44);
    renderRoute(["/simulator/free/interior-corner?seed=0&keep=one"], createSeed);
    await waitFor(() => expect(readRouteState().identity?.seed).toBe(0));
    expect(readRouteState().search).toBe("?seed=0&keep=one");
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
      expect(readRouteState().search).toBe("?seed=11");
    });

    fireEvent.click(screen.getByRole("button", { name: "forward" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(12);
      expect(readRouteState().search).toBe("?seed=12");
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
      expect(readRouteState().search).toBe("?keep=two&seed=91");
    });
    expect(createSeed).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() => {
      expect(readRouteState().identity?.seed).toBe(7);
      expect(readRouteState().search).toBe("?seed=7");
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
        search: "?seed=55&keep=one",
        identity: { sceneId: "interior-corner", seed: 55, schemaVersion: 1 },
      });
    });
    expect(useAppStore.getState().camera).toEqual(cameraBefore);
    expect(createSeed).toHaveBeenCalledTimes(1);
  });
});
