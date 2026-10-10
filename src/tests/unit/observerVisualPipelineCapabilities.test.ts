import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { resolveObserverVisualPipelineCapabilities } from "../../render/backend/observerVisualPipelineCapabilities";

const mountedWebGLRenderer = (overrides: Record<string, unknown> = {}) => ({
  isWebGLRenderer: true,
  shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.25,
  outputColorSpace: THREE.SRGBColorSpace,
  ...overrides,
});

describe("Observer mounted renderer capability contract", () => {
  it("reports identity and display settings from the mounted WebGL renderer", () => {
    expect(
      resolveObserverVisualPipelineCapabilities(mountedWebGLRenderer()),
    ).toEqual({
      surface: "observer",
      status: "active",
      activeBackend: "webgl",
      shadowMaps: { status: "active", type: "pcf-soft" },
      toneMapping: {
        active: true,
        mode: "aces-filmic",
        exposure: 1.25,
        outputColorSpace: THREE.SRGBColorSpace,
      },
    });
  });

  it("reports disabled shadows and no tone mapping from actual renderer settings", () => {
    expect(
      resolveObserverVisualPipelineCapabilities(
        mountedWebGLRenderer({
          shadowMap: { enabled: false, type: THREE.VSMShadowMap },
          toneMapping: THREE.NoToneMapping,
        }),
      ),
    ).toMatchObject({
      status: "active",
      activeBackend: "webgl",
      shadowMaps: { status: "disabled", type: "vsm" },
      toneMapping: { active: false, mode: "none", exposure: 1.25 },
    });
  });

  it("fails closed for unknown renderers and WebGPU markers", () => {
    expect(resolveObserverVisualPipelineCapabilities({})).toEqual({
      surface: "observer",
      status: "unsupported",
      activeBackend: null,
    });
    expect(
      resolveObserverVisualPipelineCapabilities({ isWebGPURenderer: true }),
    ).toEqual({
      surface: "observer",
      status: "unsupported",
      activeBackend: null,
    });
  });

  it("does not infer render-target support or other unobserved pipeline features", () => {
    const capabilities = resolveObserverVisualPipelineCapabilities(
      mountedWebGLRenderer(),
    );
    expect(capabilities).not.toHaveProperty("colorRenderTarget");
    expect(capabilities).not.toHaveProperty("webgpu");
    expect(capabilities).not.toHaveProperty("automaticFallback");
  });
});
