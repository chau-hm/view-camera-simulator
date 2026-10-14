import { describe, expect, it } from "vitest";
import {
  resolveObserverRendererInitializationFailure,
  selectObserverBackend,
} from "../../render/backend/observerBackend";
import { resolveObserverSceneCompatibility } from "../../render/backend/observerSceneCompatibility";
import { resolveObserverOutputPolicy } from "../../render/backend/observerOutputPolicy";

const architectureRiseSelection = selectObserverBackend({
  webglAvailable: true,
  requestedRendererParam: "webgpu",
  sceneCompatibility: resolveObserverSceneCompatibility("architecture-rise"),
  developmentPilotEnabled: true,
});

describe("Observer output policy selection", () => {
  it("opts in only for the Architecture Rise development WebGPU pilot", () => {
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "material-aware",
      backendSelection: architectureRiseSelection,
      developmentBuild: true,
    })).toEqual({
      requested: "material-aware",
      selected: "material-aware",
      reason: "material-aware-selected",
    });
  });

  it("leaves the standard WebGPU route unchanged without the explicit output request", () => {
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: null,
      backendSelection: architectureRiseSelection,
      developmentBuild: true,
    })).toMatchObject({ selected: "standard", reason: "standard-requested" });
  });

  it("ignores the candidate request on Anatomy, WebGL, and production routes", () => {
    const anatomySelection = selectObserverBackend({
      webglAvailable: true,
      requestedRendererParam: "webgpu",
      sceneCompatibility: resolveObserverSceneCompatibility("view-camera-anatomy"),
      developmentPilotEnabled: true,
    });
    const webglSelection = selectObserverBackend({
      webglAvailable: true,
      requestedRendererParam: "webgl",
      sceneCompatibility: resolveObserverSceneCompatibility("architecture-rise"),
      developmentPilotEnabled: true,
    });

    expect(resolveObserverOutputPolicy({
      sceneId: "view-camera-anatomy",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "material-aware",
      backendSelection: anatomySelection,
      developmentBuild: true,
    })).toMatchObject({ selected: "standard", reason: "scene-not-eligible" });
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgl",
      requestedOutputParam: "material-aware",
      backendSelection: webglSelection,
      developmentBuild: true,
    })).toMatchObject({ selected: "standard", reason: "webgpu-not-selected" });
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "material-aware",
      backendSelection: architectureRiseSelection,
      developmentBuild: false,
    })).toMatchObject({ selected: "standard", reason: "development-gate-disabled" });
  });

  it("restores standard output selection after the current pilot falls back to WebGL", () => {
    if (architectureRiseSelection.status !== "selected") {
      throw new Error("expected a selected Architecture Rise backend");
    }
    const fallback = resolveObserverRendererInitializationFailure(architectureRiseSelection);
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "material-aware",
      backendSelection: fallback,
      developmentBuild: true,
    })).toMatchObject({
      requested: "material-aware",
      selected: "standard",
      reason: "webgpu-not-selected",
    });
  });
});
