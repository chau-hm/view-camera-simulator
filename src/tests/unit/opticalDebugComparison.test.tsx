import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpticalDebugPanel } from "../../components/simulator/OpticalDebugPanel";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolveCameraMovementGroundGlassComparison } from "../../scenes/cameraMovementGroundGlassComparison";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { GroundGlassRttRuntimeInfo } from "../../render/groundGlassRttDimensions";

const runtimeInfo = (overrides: Partial<GroundGlassRttRuntimeInfo>) =>
  ({
    resourceGeneration: 1,
    profile: "high",
    logicalWidthPx: 188,
    logicalHeightPx: 150,
    internalWidthPx: 376,
    internalHeightPx: 300,
    resolutionScale: 2,
    effectiveDevicePixelRatio: 1,
    zoomRenderScale: 1,
    wasClamped: false,
    configuredCanvasDpr: 2,
    rendererPixelRatio: 2,
    canvasCssWidthPx: 188,
    canvasCssHeightPx: 150,
    drawingBufferWidthPx: 376,
    drawingBufferHeightPx: 300,
    colorTargetWidthPx: 376,
    colorTargetHeightPx: 300,
    depthTargetWidthPx: 376,
    depthTargetHeightPx: 300,
    blurTargetWidthPx: 376,
    blurTargetHeightPx: 300,
    finalTargetWidthPx: 376,
    finalTargetHeightPx: 300,
    horizontalShaderRenderWidthPx: 376,
    horizontalShaderRenderHeightPx: 300,
    verticalShaderRenderWidthPx: 376,
    verticalShaderRenderHeightPx: 300,
    ...overrides,
  }) as GroundGlassRttRuntimeInfo;

describe("channel-aware Optical Debug", () => {
  it("keeps Original and Current diagnostics independent", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
      activeSceneId: understandingCameraMovementsScene.id,
      viewpointAnchor: "high" as const,
    };
    const currentOptics = deriveOpticsState(camera, understandingCameraMovementsScene);
    const comparison = resolveCameraMovementGroundGlassComparison({
      camera,
      opticsState: currentOptics,
      targetRegion: "upper",
    });
    const original = runtimeInfo({
      channel: "camera-movement-original",
      ownerId: "original-owner",
      resourceGeneration: 7,
      latticeSubjectGeneration: 11,
      latticeGeometryId: "lattice-original",
      latticeGeometryKey: "geometry-original",
      latticeResourceKey: "resource-original",
      latticePresentationRegion: "upper",
      cameraPositionWorld: [0, 0, 1],
      cameraUpWorld: [0, 1, 0],
      cameraForwardWorld: [0, 0, 1],
    });
    const current = runtimeInfo({
      channel: "camera-movement-current",
      ownerId: "current-owner",
      resourceGeneration: 9,
      latticeSubjectGeneration: 13,
      latticeGeometryId: "lattice-current",
      latticeGeometryKey: "geometry-current",
      latticeResourceKey: "resource-current",
      latticePresentationRegion: "lower",
      cameraPositionWorld: [4, 5, 6],
      cameraUpWorld: [0, 0, 1],
      cameraForwardWorld: [1, 0, 0],
    });

    const view = render(
      <OpticalDebugPanel
        sceneId={understandingCameraMovementsScene.id}
        mode="free"
        opticsState={currentOptics}
        focalLengthMm={camera.focalLengthMm}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        comparison={comparison}
        rttRuntimeInfoByChannel={{
          "camera-movement-original": original,
          "camera-movement-current": current,
        }}
      />,
    );

    const layers = view.container.querySelectorAll(".optical-debug__layer");
    expect(layers).toHaveLength(2);
    expect(layers[0]).toHaveTextContent("camera-movement-original");
    expect(layers[0]).toHaveTextContent("original-owner");
    expect(layers[0]).toHaveTextContent("lattice-original");
    expect(layers[0]).toHaveTextContent("0.000, 0.000, 1.000");
    expect(layers[1]).toHaveTextContent("camera-movement-current");
    expect(layers[1]).toHaveTextContent("current-owner");
    expect(layers[1]).toHaveTextContent("lattice-current");
    expect(layers[1]).toHaveTextContent("4.000, 5.000, 6.000");
    expect(layers[0]).toHaveTextContent("Lattice presentation: upper");
    expect(layers[1]).toHaveTextContent("Lattice presentation: lower");

    view.rerender(
      <OpticalDebugPanel
        sceneId={understandingCameraMovementsScene.id}
        mode="free"
        opticsState={currentOptics}
        focalLengthMm={camera.focalLengthMm}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        comparison={comparison}
        rttRuntimeInfoByChannel={{ "camera-movement-original": null, "camera-movement-current": current }}
      />,
    );
    expect(view.container.querySelectorAll(".optical-debug__layer")).toHaveLength(2);
    expect(view.container.querySelectorAll(".optical-debug__layer")[0]).not.toHaveTextContent("original-owner");
    expect(view.container.querySelectorAll(".optical-debug__layer")[1]).toHaveTextContent("current-owner");
  });

  it("keeps single-channel debug output for legacy RTT scenes", () => {
    const camera = { ...DEFAULT_CAMERA_STATE, activeSceneId: architectureRiseScene.id };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);
    const view = render(
      <OpticalDebugPanel
        sceneId="architecture-rise"
        mode="free"
        opticsState={opticsState}
        focalLengthMm={camera.focalLengthMm}
        focusDistanceMm={camera.focusDistanceMm}
        aperture={camera.aperture}
        rttRuntimeInfo={runtimeInfo({ channel: "default", ownerId: "default-owner" })}
      />,
    );
    expect(view.container.querySelectorAll(".optical-debug__layer")).toHaveLength(0);
    expect(view.container).toHaveTextContent("Channel: default");
    expect(view.container).toHaveTextContent("default-owner");
  });
});
