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

  it("records Architecture Rise's full-scene native evidence and separate pilot approval", () => {
    const architectureRise = resolveObserverSceneCompatibility("architecture-rise");
    expect(architectureRise).toEqual({
      requirements: [
        "observer-scene-subject",
        "presentation-lighting",
        "shadow-maps",
        "procedural-world-environment",
      ],
      webgpu: {
        status: "verified",
        evidence: "pr-251-native-architecture-rise-e2e",
        verifiedRequirements: [
          "observer-scene-subject",
          "presentation-lighting",
          "shadow-maps",
          "procedural-world-environment",
        ],
      },
      knownBackendConstraints: [],
      developmentWebGpuPilot: "eligible",
    });
    if (architectureRise.webgpu.status !== "verified" || architectureRise.requirements === null) {
      throw new Error("Architecture Rise compatibility evidence expected");
    }
    expect(architectureRise.webgpu.verifiedRequirements).toEqual(architectureRise.requirements);
    const anatomy = resolveObserverSceneCompatibility("view-camera-anatomy");
    if (anatomy.webgpu.status !== "verified") throw new Error("Anatomy compatibility evidence expected");
    expect(architectureRise.webgpu.evidence).not.toBe(anatomy.webgpu.evidence);
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
      if (sceneId === "view-camera-anatomy" || sceneId === "architecture-rise") continue;
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
    expect(architectureRise.webgpu.status).toBe("verified");
    expect(architectureRise.developmentWebGpuPilot).toBe("eligible");
    const tableTilt = resolveObserverSceneCompatibility("table-tilt");
    expect(tableTilt.webgpu.status).toBe("not-evaluated");
    expect(tableTilt.developmentWebGpuPilot).toBe("not-eligible");
  });
});
