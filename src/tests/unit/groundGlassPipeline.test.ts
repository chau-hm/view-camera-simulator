import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import {
  calculateApertureBlurStrength,
  createGroundGlassDofPipeline,
  createHalfResolutionBlurPass,
  createGroundGlassRenderTarget,
  linearizeDepthSample,
  reconstructWorldPosition,
} from "../../render/groundGlassPipeline";
import { createDepthOfFieldPass } from "../../render/postprocessing/DepthOfFieldPass";
import { createFocusAssistPass } from "../../render/postprocessing/FocusAssistPass";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { RenderQualityProfile } from "../../types/ui";

describe("ground glass pipeline", () => {
  const standardQuality: RenderQualityProfile = "standard";
  const lowQuality: RenderQualityProfile = "low";

  it("keeps 4x5 panel render target dimensions", () => {
    const renderTarget = createGroundGlassRenderTarget(500, 400);
    expect(renderTarget.widthPx / renderTarget.heightPx).toBeCloseTo(1.25, 8);
  });

  it("applies off-axis rise shift into pipeline vertical offset", () => {
    const base = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const raised = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        frontRiseMm: 20,
      },
      architectureRiseScene,
    );

    const basePipeline = createGroundGlassDofPipeline(base, 500, 400, standardQuality);
    const raisedPipeline = createGroundGlassDofPipeline(raised, 500, 400, standardQuality);
    expect(raisedPipeline.verticalFrameOffsetPx).not.toBe(basePipeline.verticalFrameOffsetPx);
  });

  it("scales the pipeline down for low render quality", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const standardPipeline = createGroundGlassDofPipeline(opticsState, 500, 400, standardQuality);
    const lowPipeline = createGroundGlassDofPipeline(opticsState, 500, 400, lowQuality);

    expect(lowPipeline.colorTarget.widthPx).toBeLessThan(standardPipeline.colorTarget.widthPx);
    expect(lowPipeline.colorTarget.heightPx).toBeLessThan(standardPipeline.colorTarget.heightPx);
    expect(lowPipeline.blurPass.widthPx).toBeLessThan(standardPipeline.blurPass.widthPx);
    expect(lowPipeline.blurPass.heightPx).toBeLessThan(standardPipeline.blurPass.heightPx);
  });

  it("keeps flip state aligned with orientation assist", () => {
    const inverted = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        groundGlassAssistEnabled: false,
      },
      architectureRiseScene,
    );
    const assisted = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        groundGlassAssistEnabled: true,
      },
      architectureRiseScene,
    );

    expect(inverted.groundGlassProjection.invertHorizontal).toBe(true);
    expect(inverted.groundGlassProjection.invertVertical).toBe(true);
    expect(assisted.groundGlassProjection.invertHorizontal).toBe(false);
    expect(assisted.groundGlassProjection.invertVertical).toBe(false);
  });

  it("produces lower blur for f/32 than f/5.6 at same distance", () => {
    const distance = 12;
    expect(calculateApertureBlurStrength(distance, 5.6)).toBeGreaterThan(
      calculateApertureBlurStrength(distance, 32),
    );
  });

  it("creates half-resolution blur pass", () => {
    const pass = createHalfResolutionBlurPass(createGroundGlassRenderTarget(500, 400));
    expect(pass.widthPx).toBe(250);
    expect(pass.heightPx).toBe(200);
  });

  it("linearizes depth and reconstructs world position", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const linearDepthMm = linearizeDepthSample(0.65) * 1000;
    const worldPosition = reconstructWorldPosition(0.5, 0.5, linearDepthMm, opticsState);
    expect(Number.isFinite(worldPosition.x)).toBe(true);
    expect(Number.isFinite(worldPosition.y)).toBe(true);
    expect(Number.isFinite(worldPosition.z)).toBe(true);
  });

  it("generates focus-assist target patterns and dof pass output", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const assistPass = createFocusAssistPass({
      enabled: true,
      targets: opticsState.focusTargets,
    });
    const dofPass = createDepthOfFieldPass(
      {
        enabled: true,
        widthPx: 500,
        heightPx: 400,
        sampleDepth: 0.5,
        sampleUv: { u: 0.45, v: 0.6 },
        aperture: DEFAULT_CAMERA_STATE.aperture,
        renderQuality: standardQuality,
      },
      opticsState,
    );
    expect(assistPass.targets.length).toBe(opticsState.focusTargets.length);
    expect(dofPass.blurPass.widthPx).toBe(250);
    expect(dofPass.blurPass.heightPx).toBe(200);
  });

  it("reduces dof pass resolution in low quality mode", () => {
    const opticsState = deriveOpticsState(DEFAULT_CAMERA_STATE, architectureRiseScene);
    const dofPass = createDepthOfFieldPass(
      {
        enabled: true,
        widthPx: 500,
        heightPx: 400,
        sampleDepth: 0.5,
        sampleUv: { u: 0.45, v: 0.6 },
        aperture: DEFAULT_CAMERA_STATE.aperture,
        renderQuality: lowQuality,
      },
      opticsState,
    );

    expect(dofPass.blurPass.widthPx).toBeLessThan(250);
    expect(dofPass.blurPass.heightPx).toBeLessThan(200);
  });
});
