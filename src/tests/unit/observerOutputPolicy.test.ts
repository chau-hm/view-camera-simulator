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
      requestedParameter: "material-aware",
      requested: "material-aware",
      selected: "material-aware",
      reason: "material-aware-selected",
    });
  });

  it("selects material-aware by default for the explicitly requested Architecture Rise development pilot", () => {
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: null,
      backendSelection: architectureRiseSelection,
      developmentBuild: true,
    })).toEqual({
      requestedParameter: null,
      requested: "material-aware",
      selected: "material-aware",
      reason: "development-pilot-default",
    });
  });

  it("keeps default WebGL and explicit standard requests on standard output", () => {
    const webglSelection = selectObserverBackend({
      webglAvailable: true,
      requestedRendererParam: null,
      sceneCompatibility: resolveObserverSceneCompatibility("architecture-rise"),
      developmentPilotEnabled: true,
    });
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: null,
      requestedOutputParam: null,
      backendSelection: webglSelection,
      developmentBuild: true,
    })).toEqual({
      requestedParameter: null,
      requested: "standard",
      selected: "standard",
      reason: "standard-default",
    });
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "standard",
      backendSelection: architectureRiseSelection,
      developmentBuild: true,
    })).toEqual({
      requestedParameter: "standard",
      requested: "standard",
      selected: "standard",
      reason: "standard-requested",
    });
  });

  it("fails closed for unknown output values and keeps the raw parameter diagnostic", () => {
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "future-policy",
      backendSelection: architectureRiseSelection,
      developmentBuild: true,
    })).toEqual({
      requestedParameter: "future-policy",
      requested: "standard",
      selected: "standard",
      reason: "unknown-output-request",
    });
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
    })).toMatchObject({ requestedParameter: "material-aware", selected: "standard", reason: "scene-not-eligible" });
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgl",
      requestedOutputParam: "material-aware",
      backendSelection: webglSelection,
      developmentBuild: true,
    })).toMatchObject({ requestedParameter: "material-aware", selected: "standard", reason: "webgpu-not-selected" });
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: "material-aware",
      backendSelection: architectureRiseSelection,
      developmentBuild: false,
    })).toMatchObject({ requestedParameter: "material-aware", selected: "standard", reason: "development-gate-disabled" });

    expect(resolveObserverOutputPolicy({
      sceneId: "view-camera-anatomy",
      requestedRendererParam: "webgpu",
      requestedOutputParam: null,
      backendSelection: anatomySelection,
      developmentBuild: true,
    })).toMatchObject({ requested: "standard", selected: "standard" });
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
      requestedParameter: "material-aware",
      requested: "material-aware",
      selected: "standard",
      reason: "webgpu-not-selected",
    });

    const defaultRequestFallback = resolveObserverRendererInitializationFailure(architectureRiseSelection);
    expect(resolveObserverOutputPolicy({
      sceneId: "architecture-rise",
      requestedRendererParam: "webgpu",
      requestedOutputParam: null,
      backendSelection: defaultRequestFallback,
      developmentBuild: true,
    })).toMatchObject({
      requestedParameter: null,
      requested: "material-aware",
      selected: "standard",
      reason: "webgpu-not-selected",
    });
  });
});
