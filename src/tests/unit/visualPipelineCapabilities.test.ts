import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { RendererCapabilities } from "../../render/backend/rendererCapabilities";
import { resolveVisualPipelineCapabilities } from "../../render/backend/visualPipelineCapabilities";

const renderer = (overrides: Record<string, unknown> = {}) => ({
  isWebGLRenderer: true,
  shadowMap: { enabled: true, type: THREE.PCFShadowMap },
  toneMapping: THREE.NoToneMapping,
  toneMappingExposure: 1,
  outputColorSpace: THREE.SRGBColorSpace,
  ...overrides,
});

const renderTargetCapability: RendererCapabilities = {
  backend: "webgl",
  colorRenderTargetRenderable: true,
};

describe("visual pipeline capability contract", () => {
  it("describes the mounted WebGL pipeline and preserves inactive future paths", () => {
    const capabilities = resolveVisualPipelineCapabilities(
      renderer(),
      renderTargetCapability,
    );

    expect(capabilities).toMatchObject({
      activeRendererBackend: "webgl",
      colorRenderTarget: {
        status: "available",
        backend: "webgl",
        evidence: "ground-glass-framebuffer-probe",
      },
      shadowMaps: { status: "active", backend: "webgl", type: "pcf" },
      litPbrMaterials: {
        status: "available",
        backend: "webgl",
        currentAssetsUseMeshStandardMaterial: true,
      },
      environmentLighting: { status: "available", backend: "webgl", active: false },
      toneMappingExposure: {
        status: "available",
        backend: "webgl",
        active: false,
        toneMapping: "none",
        exposure: 1,
        outputColorSpace: THREE.SRGBColorSpace,
      },
      globalPostProcessing: { status: "inactive" },
      groundGlassRtt: {
        status: "active",
        implementation: "webgl-render-target-bundle",
        backendCoupling: "webgl",
      },
      groundGlassDof: {
        status: "available",
        activeOnProcessedPath: true,
        implementation: "custom-glsl-multipass",
        backendCoupling: "webgl",
      },
      webgpuApplicationBackend: { status: "inactive" },
    });
  });

  it("does not claim a render target is available without matching probe evidence", () => {
    expect(resolveVisualPipelineCapabilities(renderer())?.colorRenderTarget).toEqual({
      status: "unverified",
      backend: "webgl",
      evidence: "not-probed",
    });
    expect(
      resolveVisualPipelineCapabilities(renderer(), {
        backend: "webgl",
        colorRenderTargetRenderable: false,
      }),
    ).toMatchObject({
      colorRenderTarget: { status: "unavailable" },
    });
    expect(
      resolveVisualPipelineCapabilities(
        renderer(),
        { backend: "webgpu", colorRenderTargetRenderable: true } as unknown as RendererCapabilities,
      ),
    ).toMatchObject({
      colorRenderTarget: { status: "unverified", evidence: "not-probed" },
    });
  });

  it("reports the active Three.js tone-mapping mode instead of a generic configured flag", () => {
    expect(
      resolveVisualPipelineCapabilities(
        renderer({ toneMapping: THREE.ACESFilmicToneMapping }),
      )?.toneMappingExposure,
    ).toMatchObject({
      active: true,
      toneMapping: "aces-filmic",
      exposure: 1,
      outputColorSpace: THREE.SRGBColorSpace,
    });
  });

  it("rejects unknown renderers and a WebGPU marker without an active WebGPU backend", () => {
    expect(
      resolveVisualPipelineCapabilities({ isWebGLRenderer: false }),
    ).toBeNull();
    expect(
      resolveVisualPipelineCapabilities({ isWebGPURenderer: true }),
    ).toBeNull();
    expect(
      resolveVisualPipelineCapabilities({
        isWebGLRenderer: false,
        isWebGPURenderer: true,
      }),
    ).toBeNull();
  });
});
