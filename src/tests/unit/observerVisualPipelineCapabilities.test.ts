import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveObserverVisualPipelineCapabilities } from "../../render/backend/observerVisualPipelineCapabilities";

const mountedRenderer = (
  identity: Record<string, unknown> = { isWebGLRenderer: true },
  overrides: Record<string, unknown> = {},
) => ({
  ...identity,
  shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.25,
  outputColorSpace: THREE.SRGBColorSpace,
  ...overrides,
});

describe("Observer mounted renderer capability contract", () => {
  it("reports identity and display settings from the actual mounted WebGL renderer", () => {
    expect(resolveObserverVisualPipelineCapabilities(mountedRenderer())).toEqual({
      surface: "observer",
      status: "active",
      rendererFamily: "webgl-renderer",
      executionBackend: "webgl2",
      shadowMaps: { status: "active", type: "pcf-soft" },
      toneMapping: {
        active: true,
        mode: "aces-filmic",
        exposure: 1.25,
        outputColorSpace: THREE.SRGBColorSpace,
      },
    });
  });

  it("reports mounted WebGPURenderer plus actual WebGPU execution", () => {
    expect(
      resolveObserverVisualPipelineCapabilities(
        mountedRenderer({
          isWebGPURenderer: true,
          coordinateSystem: THREE.WebGPUCoordinateSystem,
        }),
      ),
    ).toMatchObject({
      status: "active",
      rendererFamily: "webgpu-renderer",
      executionBackend: "webgpu",
      shadowMaps: { status: "active", type: "pcf-soft" },
      toneMapping: { active: true, mode: "aces-filmic", exposure: 1.25 },
    });
  });

  it("reports WebGPURenderer internal WebGL2 fallback without claiming native WebGPU", () => {
    expect(
      resolveObserverVisualPipelineCapabilities(
        mountedRenderer({
          isWebGPURenderer: true,
          coordinateSystem: THREE.WebGLCoordinateSystem,
        }),
      ),
    ).toMatchObject({
      status: "active",
      rendererFamily: "webgpu-renderer",
      executionBackend: "webgl2-fallback",
    });
  });

  it("derives shadow and tone-mapping settings from the mounted renderer", () => {
    expect(
      resolveObserverVisualPipelineCapabilities(
        mountedRenderer(undefined, {
          shadowMap: { enabled: false, type: THREE.VSMShadowMap },
          toneMapping: THREE.NoToneMapping,
        }),
      ),
    ).toMatchObject({
      status: "active",
      rendererFamily: "webgl-renderer",
      executionBackend: "webgl2",
      shadowMaps: { status: "disabled", type: "vsm" },
      toneMapping: { active: false, mode: "none", exposure: 1.25 },
    });
  });

  it("fails closed for unsupported renderer identities", () => {
    expect(resolveObserverVisualPipelineCapabilities({})).toEqual({
      surface: "observer",
      status: "unsupported",
      rendererFamily: "unknown",
      executionBackend: "unknown",
    });
    expect(resolveObserverVisualPipelineCapabilities(null)).toEqual({
      surface: "observer",
      status: "unsupported",
      rendererFamily: "unknown",
      executionBackend: "unknown",
    });
  });

  it("does not infer render-target support or other unobserved pipeline features", () => {
    const capabilities = resolveObserverVisualPipelineCapabilities(mountedRenderer());
    expect(capabilities).not.toHaveProperty("colorRenderTarget");
    expect(capabilities).not.toHaveProperty("automaticFallback");
  });
});
