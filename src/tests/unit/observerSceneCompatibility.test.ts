import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { sceneRegistry } from "../../scenes/definitions";
import { resolveObserverRendererRuntime } from "../../render/backend/observerVisualPipelineCapabilities";
import {
  resolveObserverSceneCompatibility,
  type ObserverSceneCompatibility,
} from "../../render/backend/observerSceneCompatibility";

describe("Observer scene backend compatibility declarations", () => {
  it("records the Anatomy pilot as verified and separately pilot-eligible", () => {
    const anatomy = resolveObserverSceneCompatibility("view-camera-anatomy");
    expect(anatomy).toMatchObject({
      requirements: [
        "observer-scene-subject",
        "presentation-lighting",
        "shadow-maps",
      ],
      webgpu: {
        status: "verified",
        evidence: "pr-248-native-observer-e2e",
      },
      knownBackendConstraints: [],
      developmentWebGpuPilot: "eligible",
    });
    if (anatomy.webgpu.status !== "verified" || anatomy.requirements === null) {
      throw new Error("Anatomy compatibility evidence expected");
    }
    expect(anatomy.webgpu.verifiedRequirements).toEqual(anatomy.requirements);
  });

  it("records Architecture Rise's procedural environment as a known WebGL-specific constraint", () => {
    expect(resolveObserverSceneCompatibility("architecture-rise")).toEqual({
      requirements: [
        "observer-scene-subject",
        "presentation-lighting",
        "shadow-maps",
        "procedural-world-environment",
      ],
      webgpu: { status: "not-evaluated" },
      knownBackendConstraints: [
        "procedural-world-environment-uses-webgl-pmrem",
      ],
      developmentWebGpuPilot: "not-eligible",
    });
  });

  it("returns an explicit fail-closed declaration for an unreviewed scene", () => {
    expect(resolveObserverSceneCompatibility("future-scene")).toEqual({
      requirements: null,
      webgpu: { status: "not-evaluated" },
      knownBackendConstraints: [],
      developmentWebGpuPilot: "not-eligible",
    } satisfies ObserverSceneCompatibility);
  });

  it("does not let scene-registry membership grant pilot eligibility", () => {
    for (const sceneId of Object.keys(sceneRegistry)) {
      if (sceneId === "view-camera-anatomy") continue;
      expect(resolveObserverSceneCompatibility(sceneId).developmentWebGpuPilot)
        .toBe("not-eligible");
    }
  });

  it("keeps runtime renderer evidence independent from scene compatibility", () => {
    const runtime = resolveObserverRendererRuntime({
      isWebGPURenderer: true,
      coordinateSystem: THREE.WebGPUCoordinateSystem,
    });
    expect(runtime.rendererFamily).toBe("webgpu-renderer");
    const architectureRise = resolveObserverSceneCompatibility("architecture-rise");
    expect(architectureRise.webgpu.status).toBe("not-evaluated");
    expect(architectureRise.developmentWebGpuPilot).toBe("not-eligible");
  });
});
