import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { RendererCapabilities } from "../../render/backend/rendererCapabilities";
import { resolveGroundGlassVisualPipelineCapabilities } from "../../render/backend/visualPipelineCapabilities";

const renderer = (overrides: Record<string, unknown> = {}) => ({
  isWebGLRenderer: true,
  shadowMap: { enabled: true, type: THREE.PCFShadowMap },
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1,
  outputColorSpace: THREE.SRGBColorSpace,
  ...overrides,
});

const renderTargetCapability: RendererCapabilities = {
  backend: "webgl",
  colorRenderTargetRenderable: true,
};

describe("Ground Glass visual pipeline capability contract", () => {
  it("scopes renderer observations to the mounted Ground Glass surface", () => {
    const capabilities = resolveGroundGlassVisualPipelineCapabilities(
      renderer(),
      renderTargetCapability,
    );

    expect(capabilities).toMatchObject({
      renderer: {
        surface: "ground-glass",
        activeBackend: "webgl",
        colorRenderTarget: {
          status: "available",
          backend: "webgl",
          evidence: "ground-glass-framebuffer-probe",
        },
        shadowMaps: { status: "active", type: "pcf" },
        toneMapping: {
          active: true,
          mode: "aces-filmic",
          exposure: 1,
          outputColorSpace: THREE.SRGBColorSpace,
        },
      },
      groundGlassPipeline: {
        rtt: {
          status: "active",
          implementation: "webgl-render-target-bundle",
          backendCoupling: "webgl",
        },
        dof: {
          status: "available",
          activeOnProcessedPath: true,
          implementation: "custom-glsl-multipass",
          backendCoupling: "webgl",
        },
      },
    });

    // This report observes only Ground Glass. Other application surfaces and
    // presentation architecture are intentionally absent from its runtime data.
    expect(capabilities).not.toHaveProperty("webgpuApplicationBackend");
    expect(capabilities).not.toHaveProperty("globalPostProcessing");
    expect(capabilities).not.toHaveProperty("litPbrMaterials");
    expect(capabilities).not.toHaveProperty("environmentLighting");
  });

  it("reports the mounted renderer's disabled shadow state and actual map type", () => {
    expect(
      resolveGroundGlassVisualPipelineCapabilities(
        renderer({ shadowMap: { enabled: false, type: THREE.VSMShadowMap } }),
      )?.renderer.shadowMaps,
    ).toEqual({ status: "disabled", type: "vsm" });
  });

  it("keeps framebuffer target evidence fail-closed and surface-matched", () => {
    expect(
      resolveGroundGlassVisualPipelineCapabilities(renderer())?.renderer.colorRenderTarget,
    ).toEqual({
      status: "unverified",
      backend: "webgl",
      evidence: "not-probed",
    });
    expect(
      resolveGroundGlassVisualPipelineCapabilities(renderer(), {
        backend: "webgl",
        colorRenderTargetRenderable: false,
      })?.renderer.colorRenderTarget.status,
    ).toBe("unavailable");
    expect(
      resolveGroundGlassVisualPipelineCapabilities(
        renderer(),
        { backend: "webgpu", colorRenderTargetRenderable: true } as unknown as RendererCapabilities,
      )?.renderer.colorRenderTarget,
    ).toEqual({
      status: "unverified",
      backend: "webgl",
      evidence: "not-probed",
    });
  });

  it("rejects unknown renderers and a WebGPU marker without an active Ground Glass backend", () => {
    expect(
      resolveGroundGlassVisualPipelineCapabilities({ isWebGLRenderer: false }),
    ).toBeNull();
    expect(
      resolveGroundGlassVisualPipelineCapabilities({ isWebGPURenderer: true }),
    ).toBeNull();
    expect(
      resolveGroundGlassVisualPipelineCapabilities({
        isWebGLRenderer: false,
        isWebGPURenderer: true,
      }),
    ).toBeNull();
  });
});
