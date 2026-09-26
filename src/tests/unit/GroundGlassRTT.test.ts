import * as THREE from "three";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { resolveGroundGlassRelativeIlluminance } from "../../core/optics/groundGlassIlluminance";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import {
  GroundGlassRTT as UnconnectedGroundGlassRTT,
  type GroundGlassRTTProps,
} from "../../render/GroundGlassRTT";
import { synchronizeGroundGlassDofClipRange } from "../../render/createGroundGlassDofUniformState";
import {
  decodeGroundGlassSignedCoC,
  encodeGroundGlassSignedCoC,
  quantizeGroundGlassSignedCoCByte,
  resolveGroundGlassCocStorageMaxMm,
} from "../../render/groundGlassCocTarget";
import {
  createGroundGlassCamera,
  createGroundGlassDepthTarget,
  createGroundGlassRenderTarget,
} from "../../render/groundGlassPipeline";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "../../render/sceneSubjectRegistry";
import { useAppStore } from "../../state/appStore";
import { selectEffectiveCameraMovementCalibration } from "../../state/selectors";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry from "../../scenes/shelfSwingGeometry";
import cameraMovementsGeometry from "../../scenes/understandingCameraMovementsGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
  GroundGlassRttRuntimeInfoChangeHandler,
} from "../../render/groundGlassRttDimensions";
import { resolveGroundGlassInspectionWindow } from "../../render/groundGlassInspectionWindow";

const fiberTestState = vi.hoisted(() => ({
  frameCallback: null as ((state?: unknown, delta?: number) => void) | null,
  renderedScenes: [] as unknown[],
  cocFramebufferStatuses: [] as number[],
  currentTarget: null as unknown,
  gl: {
    isWebGLRenderer: true,
    getPixelRatio: () => 1,
    getRenderTarget: () => fiberTestState.currentTarget,
    setRenderTarget: (target: unknown) => {
      fiberTestState.currentTarget = target;
    },
    getContext: () => ({
      FRAMEBUFFER: 0x8d40,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      checkFramebufferStatus: () =>
        fiberTestState.cocFramebufferStatuses.shift() ?? 0x8cd5,
    }),
    setClearColor: () => undefined,
    clear: () => undefined,
    render: (scene: unknown) => {
      fiberTestState.renderedScenes.push(scene);
    },
    domElement: {
      width: 500,
      height: 400,
      getBoundingClientRect: () => ({ width: 500, height: 400 }),
    },
  },
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: (props: { children?: unknown }) => props.children,
  useFrame: (callback: (state?: unknown, delta?: number) => void) => {
    fiberTestState.frameCallback = callback;
  },
  useThree: () => ({ gl: fiberTestState.gl }),
}));

vi.mock("../../render/groundGlassPipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../render/groundGlassPipeline")>();
  return {
    ...actual,
    createGroundGlassCamera: vi.fn(actual.createGroundGlassCamera),
    createGroundGlassDepthTarget: vi.fn(actual.createGroundGlassDepthTarget),
    createGroundGlassRenderTarget: vi.fn(actual.createGroundGlassRenderTarget),
  };
});

vi.mock("../../render/sceneSubjectRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../render/sceneSubjectRegistry")>();
  return {
    ...actual,
    createRegisteredRttSubject: vi.fn(actual.createRegisteredRttSubject),
  };
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
  cleanup();
  vi.restoreAllMocks();
  fiberTestState.frameCallback = null;
  fiberTestState.renderedScenes.length = 0;
  fiberTestState.cocFramebufferStatuses.length = 0;
  fiberTestState.currentTarget = null;
  useAppStore.getState().setGroundGlassRttRuntimeInfo(null);
  useAppStore.getState().setGroundGlassRttRuntimeInfoForChannel("camera-movement-original", null);
  useAppStore.getState().setGroundGlassRttRuntimeInfoForChannel("camera-movement-current", null);
});

const ConnectedGroundGlassRTT = (props: GroundGlassRTTProps) => {
  const onRuntimeInfoChange: GroundGlassRttRuntimeInfoChangeHandler = (
    channel,
    info,
    ownerId,
  ) => {
    if (channel === "default") {
      useAppStore.getState().setGroundGlassRttRuntimeInfo(info, ownerId);
    } else {
      useAppStore
        .getState()
        .setGroundGlassRttRuntimeInfoForChannel(channel, info, ownerId);
    }
  };

  return React.createElement(UnconnectedGroundGlassRTT, {
    ...props,
    onRuntimeInfoChange: props.onRuntimeInfoChange ?? onRuntimeInfoChange,
  });
};

const createRuntimeInfoCollector = () => {
  const updates: Array<Parameters<GroundGlassRttRuntimeInfoChangeHandler>> = [];
  const runtimeInfoByChannel = new Map<GroundGlassRttChannel, GroundGlassRttRuntimeInfo | null>();
  const onRuntimeInfoChange: GroundGlassRttRuntimeInfoChangeHandler = (channel, info, ownerId) => {
    updates.push([channel, info, ownerId]);
    runtimeInfoByChannel.set(channel, info);
  };
  return {
    onRuntimeInfoChange,
    updates,
    get: (channel: GroundGlassRttChannel = "default") => runtimeInfoByChannel.get(channel) ?? null,
  };
};

function renderedShaderMaterials() {
  return fiberTestState.renderedScenes.flatMap((scene) => {
    if (!(scene instanceof THREE.Scene)) return [];
    return scene.children.flatMap((child) => {
      const material = (child as THREE.Mesh).material;
      return material instanceof THREE.ShaderMaterial ? [material] : [];
    });
  });
}

describe("GroundGlassRTT ownership and lifecycle", () => {
  it("passes Architecture Rise physical CoC inputs without a display blur gain", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      focusDistanceMm: 13000,
      aperture: 5.6 as const,
      frontRiseMm: 22,
      frontTiltDeg: 0.4,
      frontSwingDeg: -1.1,
    };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    const diagnostics = createRuntimeInfoCollector();
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: optics,
        focalLengthMm: camera.focalLengthMm,
        scene: architectureRiseScene,
        widthPx: 500,
        heightPx: 400,
        aperture: camera.aperture,
        renderQuality: "standard",
        previewMode: "upright",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    act(() => fiberTestState.frameCallback?.());

    const materials = renderedShaderMaterials();
    const cocMaterial = materials.find((material) =>
      material.fragmentShader.includes("calculateCoCDiameterMmAtFragment"),
    );
    const gatherMaterial = materials.find((material) =>
      material.fragmentShader.includes("goldenAngle"),
    );
    expect(cocMaterial?.uniforms.fNumber.value).toBe(5.6);
    expect(cocMaterial?.uniforms.circleOfConfusionMm.value).toBe(0.1);
    expect(cocMaterial?.uniforms).not.toHaveProperty("displayBlurScale");
    expect(gatherMaterial?.uniforms).not.toHaveProperty("displayBlurScale");
    expect(gatherMaterial?.uniforms.fNumber.value).toBe(5.6);
    expect(gatherMaterial?.uniforms.circleOfConfusionMm.value).toBe(0.1);
    expect(diagnostics.get()?.groundGlassPhysicalBoundaryRadiusPx).toBeCloseTo(
      ACCEPTABLE_COC_DIAMETER_MM * 500 / CAMERA_CONSTANTS.filmWidthMm / 2,
      12,
    );

    view.unmount();
  });

  it("wires physical encoded-byte CoC and footprint ranges to both RTT shaders", () => {
    // Force the production fallback policy: half-float attachment fails and
    // the RGBA8 target succeeds.
    fiberTestState.cocFramebufferStatuses.push(0x8cd6, 0x8cd5);
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      focusDistanceMm: 13000,
      aperture: 5.6 as const,
      frontRiseMm: 22,
      frontTiltDeg: 0.4,
      frontSwingDeg: -1.1,
    };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    const diagnostics = createRuntimeInfoCollector();
    const initialProps = {
      opticsState: optics,
      focalLengthMm: camera.focalLengthMm,
      scene: architectureRiseScene,
      widthPx: 500,
      heightPx: 400,
      aperture: camera.aperture,
      renderQuality: "standard" as const,
      previewMode: "upright" as const,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, initialProps),
    );

    act(() => fiberTestState.frameCallback?.());

    const findCocAndGatherMaterials = () => {
      const materials = renderedShaderMaterials();
      const cocMaterial = materials.find((material) =>
        material.fragmentShader.includes("calculateCoCDiameterMmAtFragment"),
      );
      const gatherMaterial = materials.find((material) =>
        material.fragmentShader.includes("goldenAngle"),
      );
      expect(cocMaterial).toBeDefined();
      expect(gatherMaterial).toBeDefined();
      return { cocMaterial: cocMaterial!, gatherMaterial: gatherMaterial! };
    };
    const expectByteStorageRanges = (displayWidthPx: number) => {
      const { cocMaterial, gatherMaterial } = findCocAndGatherMaterials();
      expect(cocMaterial.uniforms.cocStorageEncoded.value).toBe(1);
      expect(gatherMaterial.uniforms.cocStorageEncoded.value).toBe(1);
      expect(cocMaterial.uniforms).not.toHaveProperty("displayBlurScale");
      expect(gatherMaterial.uniforms).not.toHaveProperty("displayBlurScale");

      const expectedCocStorageMaxMm = resolveGroundGlassCocStorageMaxMm({
        maximumCoCRadiusPx: Number(cocMaterial.uniforms.maximumCoCRadiusPx.value),
        filmWidthMm: Number(cocMaterial.uniforms.sampledFilmWidthMm.value),
        renderWidthPx: Number(cocMaterial.uniforms.renderWidth.value),
      });
      const expectedFootprintStorageMaxMm = expectedCocStorageMaxMm * 0.5;

      expect(cocMaterial.uniforms.cocStorageMaxMm.value).toBeCloseTo(
        expectedCocStorageMaxMm,
        12,
      );
      expect(gatherMaterial.uniforms.cocStorageMaxMm.value).toBeCloseTo(
        expectedCocStorageMaxMm,
        12,
      );
      expect(cocMaterial.uniforms.footprintStorageMaxMm.value).toBeCloseTo(
        expectedFootprintStorageMaxMm,
        12,
      );
      expect(gatherMaterial.uniforms.footprintStorageMaxMm.value).toBeCloseTo(
        expectedFootprintStorageMaxMm,
        12,
      );
      expect(cocMaterial.uniforms.cocStorageMaxMm.value).toBe(
        gatherMaterial.uniforms.cocStorageMaxMm.value,
      );
      expect(cocMaterial.uniforms.footprintStorageMaxMm.value).toBe(
        gatherMaterial.uniforms.footprintStorageMaxMm.value,
      );
      expect(diagnostics.get()?.cocStorageFormat).toBe("encoded-byte");
      expect(diagnostics.get()?.groundGlassPhysicalBoundaryRadiusPx).toBeCloseTo(
        ACCEPTABLE_COC_DIAMETER_MM * displayWidthPx / CAMERA_CONSTANTS.filmWidthMm / 2,
        12,
      );
      for (const physicalMm of [0.169, -0.169]) {
        const encoded = encodeGroundGlassSignedCoC(
          physicalMm,
          "encoded-byte",
          expectedCocStorageMaxMm,
        );
        const byte = quantizeGroundGlassSignedCoCByte(encoded);
        const decoded = decodeGroundGlassSignedCoC(
          encoded,
          "encoded-byte",
          expectedCocStorageMaxMm,
        );
        expect(byte).not.toBe(128);
        expect(Math.sign(decoded)).toBe(Math.sign(physicalMm));
      }
      return Number(cocMaterial.uniforms.renderWidth.value);
    };

    const initialWidthPx = expectByteStorageRanges(initialProps.widthPx);
    expect(initialWidthPx).toBeGreaterThan(0);
    expect(fiberTestState.cocFramebufferStatuses).toHaveLength(0);

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...initialProps,
        widthPx: 640,
      }),
    );
    const resizedWidthPx = expectByteStorageRanges(640);
    expect(resizedWidthPx).toBeGreaterThan(initialWidthPx);

    act(() => fiberTestState.frameCallback?.());
    expectByteStorageRanges(640);
    view.unmount();
  });

  it("synchronizes the active clip range into both CoC and aperture gather materials", () => {
    const cocMaterial = new THREE.ShaderMaterial({
      uniforms: {
        near: { value: 0.01 },
        far: { value: 12.0 },
      },
    });
    const gatherMaterial = new THREE.ShaderMaterial({
      uniforms: {
        near: { value: 0.01 },
        far: { value: 12.0 },
      },
    });

    synchronizeGroundGlassDofClipRange([cocMaterial, gatherMaterial], 0.25, 37.5);

    expect(cocMaterial.uniforms.near.value).toBe(0.25);
    expect(cocMaterial.uniforms.far.value).toBe(37.5);
    expect(gatherMaterial.uniforms.near.value).toBe(0.25);
    expect(gatherMaterial.uniforms.far.value).toBe(37.5);
    expect(gatherMaterial.uniforms.far.value).not.toBe(12.0);

    cocMaterial.dispose();
    gatherMaterial.dispose();
  });

  it("synchronizes the live camera clip range through the active frame path", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const optics = deriveOpticsState(camera, architectureForegroundScene);
    const diagnostics = createRuntimeInfoCollector();
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: optics,
        focalLengthMm: camera.focalLengthMm,
        scene: architectureForegroundScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        previewMode: "upright",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    expect(fiberTestState.frameCallback).not.toBeNull();
    act(() => fiberTestState.frameCallback?.());

    const materials = renderedShaderMaterials();
    const cocMaterial = materials.find((material) =>
      material.fragmentShader.includes("calculateCoCDiameterMmAtFragment"),
    );
    const gatherMaterial = materials.find((material) =>
      material.fragmentShader.includes("goldenAngle"),
    );
    expect(cocMaterial).toBeDefined();
    expect(gatherMaterial).toBeDefined();
    expect(gatherMaterial?.uniforms.near.value).toBe(cocMaterial?.uniforms.near.value);
    expect(gatherMaterial?.uniforms.far.value).toBe(cocMaterial?.uniforms.far.value);
    expect(cocMaterial?.uniforms.far.value).not.toBe(12.0);
    expect(cocMaterial?.uniforms.filmPlanePoint.value.x).toBeCloseTo(
      optics.filmPlane.point.x * 0.001,
      6,
    );
    expect(gatherMaterial?.uniforms.filmPlaneNormal.value.length()).toBeCloseTo(1, 6);
    expect(gatherMaterial?.uniforms.filmPlaneBasisX.value.length()).toBeCloseTo(1, 6);
    expect(gatherMaterial?.uniforms.filmPlaneBasisY.value.length()).toBeCloseTo(1, 6);
    expect(gatherMaterial?.uniforms.footprintStorageMaxMm.value).toBeGreaterThan(0);
    expect(cocMaterial?.uniforms).not.toHaveProperty("displayBlurScale");
    expect(gatherMaterial?.uniforms).not.toHaveProperty("displayBlurScale");
    expect(diagnostics.get()?.groundGlassPhysicalBoundaryRadiusPx).toBeCloseTo(
      ACCEPTABLE_COC_DIAMETER_MM * 500 / CAMERA_CONSTANTS.filmWidthMm / 2,
      12,
    );
    expect(diagnostics.get()?.nearGatherTargetWidthPx).toBe(
      diagnostics.get()?.gatherTargetWidthPx,
    );
    expect(
      fiberTestState.renderedScenes.filter((scene) =>
        scene instanceof THREE.Scene &&
        scene.children.some((child) =>
          (child as THREE.Mesh).material instanceof THREE.ShaderMaterial &&
          ((child as THREE.Mesh).material as THREE.ShaderMaterial).fragmentShader.includes("goldenAngle"),
        ),
      ),
    ).toHaveLength(2);

    view.unmount();
  });

  it("updates aperture illuminance live without recreating RTT resources", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const optics = deriveOpticsState(camera, architectureForegroundScene);
    const diagnostics = createRuntimeInfoCollector();
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, "setSize");
    const props = {
      opticsState: optics,
      focalLengthMm: camera.focalLengthMm,
      scene: architectureForegroundScene,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        aperture: 11,
        previewMode: "raw",
      }),
    );

    act(() => fiberTestState.frameCallback?.());

    const compositeMaterial = renderedShaderMaterials().find((material) =>
      material.fragmentShader.includes("uniform float groundGlassIlluminanceGain"),
    );
    expect(compositeMaterial).toBeDefined();
    const initialGain = resolveGroundGlassRelativeIlluminance({
      apertureFNumber: 11,
      focalLengthMm: camera.focalLengthMm,
      imageDistanceMm: optics.diagnostics.imageDistanceMm,
    });
    expect(compositeMaterial?.uniforms.groundGlassIlluminanceGain.value).toBeCloseTo(initialGain, 12);
    expect(diagnostics.get()?.groundGlassIlluminanceGain).toBeCloseTo(initialGain, 12);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationEnabled.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationImageDistanceMm.value).toBeCloseTo(
      optics.groundGlassNaturalIllumination.kind === "parallel-cos4"
        ? optics.groundGlassNaturalIllumination.imageDistanceMm
        : 0,
      12,
    );
    expect(diagnostics.get()?.groundGlassNaturalIlluminationEnabled).toBe(true);
    expect(diagnostics.get()?.groundGlassNaturalIlluminationKind).toBe("parallel-cos4");
    expect(compositeMaterial?.uniforms.groundGlassCoverageEnabled.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassCoverageMode.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassCoverageRadiusMm.value).toBeCloseTo(
      optics.groundGlassCoverage.kind === "parallel-circle"
        ? optics.groundGlassCoverage.imageCircleRadiusMm
        : 0,
      12,
    );
    expect(diagnostics.get()?.groundGlassCoverageEnabled).toBe(true);
    expect(diagnostics.get()?.groundGlassCoverageKind).toBe("parallel-circle");
    expect(compositeMaterial?.uniforms.flipDisplayX.value).toBe(1);
    expect(compositeMaterial?.uniforms.flipDisplayY.value).toBe(1);
    const initialGeneration = diagnostics.get()?.resourceGeneration;
    const initialSource = compositeMaterial?.uniforms.tGather.value;

    setSize.mockClear();
    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        aperture: 5.6,
        previewMode: "raw",
      }),
    );
    act(() => fiberTestState.frameCallback?.());

    expect(compositeMaterial?.uniforms.groundGlassIlluminanceGain.value).toBeCloseTo(
      resolveGroundGlassRelativeIlluminance({
        apertureFNumber: 5.6,
        focalLengthMm: camera.focalLengthMm,
        imageDistanceMm: optics.diagnostics.imageDistanceMm,
      }),
      12,
    );
    expect(compositeMaterial?.uniforms.flipDisplayX.value).toBe(1);
    expect(compositeMaterial?.uniforms.flipDisplayY.value).toBe(1);
    expect(diagnostics.get()?.resourceGeneration).toBe(initialGeneration);
    expect(compositeMaterial?.uniforms.tGather.value).toBe(initialSource);
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(setSize).not.toHaveBeenCalled();

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        aperture: 22,
        previewMode: "upright",
      }),
    );
    act(() => fiberTestState.frameCallback?.());

    expect(compositeMaterial?.uniforms.groundGlassIlluminanceGain.value).toBeCloseTo(
      resolveGroundGlassRelativeIlluminance({
        apertureFNumber: 22,
        focalLengthMm: camera.focalLengthMm,
        imageDistanceMm: optics.diagnostics.imageDistanceMm,
      }),
      12,
    );
    expect(compositeMaterial?.uniforms.flipDisplayX.value).toBe(0);
    expect(compositeMaterial?.uniforms.flipDisplayY.value).toBe(0);
    expect(diagnostics.get()?.resourceGeneration).toBe(initialGeneration);
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(setSize).not.toHaveBeenCalled();

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        aperture: 5.6,
        previewMode: "raw",
        rawDebug: true,
      }),
    );
    act(() => fiberTestState.frameCallback?.());

    expect(compositeMaterial?.uniforms.groundGlassIlluminanceGain.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationEnabled.value).toBe(0);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationImageDistanceMm.value).toBe(0);
    expect(diagnostics.get()?.groundGlassIlluminanceGain).toBe(1);
    expect(diagnostics.get()?.groundGlassNaturalIlluminationEnabled).toBe(false);
    expect(compositeMaterial?.uniforms.groundGlassCoverageEnabled.value).toBe(0);
    expect(diagnostics.get()?.groundGlassCoverageEnabled).toBe(false);
    expect(diagnostics.get()?.groundGlassCoverageKind).toBe("parallel-circle");
    expect(diagnostics.get()?.resourceGeneration).toBe(initialGeneration);
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(setSize).not.toHaveBeenCalled();

    view.unmount();
  });

  it("applies canonical macro extension loss at the initial and 1:1 states", () => {
    const initialCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...macroBellowsExtensionScene.cameraPreset,
      activeSceneId: macroBellowsExtensionScene.id,
      focusMode: "finite" as const,
    };
    const initialOptics = deriveOpticsState(initialCamera, macroBellowsExtensionScene);
    const diagnostics = createRuntimeInfoCollector();
    const props = {
      opticsState: initialOptics,
      focalLengthMm: initialCamera.focalLengthMm,
      scene: macroBellowsExtensionScene,
      widthPx: 500,
      heightPx: 400,
      aperture: 11,
      previewMode: "upright" as const,
      renderQuality: "standard" as const,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(React.createElement(UnconnectedGroundGlassRTT, props));

    act(() => fiberTestState.frameCallback?.());

    const compositeMaterial = renderedShaderMaterials().find((material) =>
      material.fragmentShader.includes("uniform float groundGlassIlluminanceGain"),
    );
    expect(compositeMaterial).toBeDefined();
    expect(compositeMaterial?.uniforms.groundGlassIlluminanceGain.value).toBeCloseTo(1 / 1.44, 12);
    expect(diagnostics.get()?.groundGlassIlluminanceGain).toBeCloseTo(1 / 1.44, 12);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationEnabled.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassCoverageEnabled.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationImageDistanceMm.value).toBeCloseTo(180, 12);
    expect(compositeMaterial?.uniforms.groundGlassCoverageRadiusMm.value).toBeCloseTo(
      180 * Math.tan((36 * Math.PI) / 180),
      12,
    );

    const oneToOneCamera = {
      ...initialCamera,
      focusDistanceMm: 300,
    };
    const oneToOneOptics = deriveOpticsState(oneToOneCamera, macroBellowsExtensionScene);
    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        opticsState: oneToOneOptics,
      }),
    );
    act(() => fiberTestState.frameCallback?.());

    expect(oneToOneOptics.diagnostics.imageDistanceMm).toBeCloseTo(300, 12);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationImageDistanceMm.value).toBeCloseTo(300, 12);
    expect(compositeMaterial?.uniforms.groundGlassCoverageRadiusMm.value).toBeCloseTo(
      300 * Math.tan((36 * Math.PI) / 180),
      12,
    );
    expect(compositeMaterial?.uniforms.groundGlassIlluminanceGain.value).toBeCloseTo(0.25, 12);
    expect(diagnostics.get()?.groundGlassIlluminanceGain).toBeCloseTo(0.25, 12);

    view.unmount();
  });

  it("sends canonical non-parallel conic coefficients to the composite and preserves Raw Debug bypass", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      frontSwingDeg: 5,
    };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    expect(optics.groundGlassCoverage.kind).toBe("nonparallel-conic");
    if (optics.groundGlassCoverage.kind !== "nonparallel-conic") return;

    const diagnostics = createRuntimeInfoCollector();
    const props = {
      opticsState: optics,
      focalLengthMm: camera.focalLengthMm,
      scene: architectureRiseScene,
      widthPx: 500,
      heightPx: 400,
      aperture: 11 as const,
      previewMode: "raw" as const,
      renderQuality: "standard" as const,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(React.createElement(UnconnectedGroundGlassRTT, props));
    act(() => fiberTestState.frameCallback?.());

    const compositeMaterial = renderedShaderMaterials().find((material) =>
      material.fragmentShader.includes("uniform float groundGlassCoverageMode"),
    );
    expect(compositeMaterial).toBeDefined();
    expect(compositeMaterial?.uniforms.groundGlassCoverageEnabled.value).toBe(1);
    expect(compositeMaterial?.uniforms.groundGlassCoverageMode.value).toBe(2);
    const q = compositeMaterial?.uniforms.groundGlassCoverageConicQuadratic.value as THREE.Vector3;
    const linear = compositeMaterial?.uniforms.groundGlassCoverageConicLinear.value as THREE.Vector3;
    const axial = compositeMaterial?.uniforms.groundGlassCoverageConicAxial.value as THREE.Vector3;
    expect([q.x, q.y, q.z]).toEqual([
      optics.groundGlassCoverage.quadratic.a,
      optics.groundGlassCoverage.quadratic.b,
      optics.groundGlassCoverage.quadratic.c,
    ]);
    expect([linear.x, linear.y, linear.z]).toEqual([
      optics.groundGlassCoverage.quadratic.d,
      optics.groundGlassCoverage.quadratic.e,
      optics.groundGlassCoverage.quadratic.f,
    ]);
    expect([axial.x, axial.y, axial.z]).toEqual([
      optics.groundGlassCoverage.axial.x,
      optics.groundGlassCoverage.axial.y,
      optics.groundGlassCoverage.axial.constant,
    ]);
    expect(diagnostics.get()?.groundGlassCoverageEnabled).toBe(true);
    expect(diagnostics.get()?.groundGlassCoverageKind).toBe("nonparallel-conic");
    expect(diagnostics.get()?.groundGlassCoverageConicQuadratic?.split(",")).toHaveLength(6);
    expect(diagnostics.get()?.groundGlassCoverageConicAxial?.split(",")).toHaveLength(3);
    expect(compositeMaterial?.uniforms.groundGlassNaturalIlluminationEnabled.value).toBe(0);
    expect(diagnostics.get()?.groundGlassNaturalIlluminationKind).toBe("neutral");

    const canonicalDiagnostic = diagnostics.get()?.groundGlassCoverageConicQuadratic;
    view.rerender(React.createElement(UnconnectedGroundGlassRTT, { ...props, rawDebug: true }));
    act(() => fiberTestState.frameCallback?.());
    expect(compositeMaterial?.uniforms.groundGlassCoverageEnabled.value).toBe(0);
    expect(compositeMaterial?.uniforms.groundGlassCoverageMode.value).toBe(0);
    expect(diagnostics.get()?.groundGlassCoverageEnabled).toBe(false);
    expect(diagnostics.get()?.groundGlassCoverageKind).toBe("nonparallel-conic");
    expect(diagnostics.get()?.groundGlassCoverageConicQuadratic).toBe(canonicalDiagnostic);

    view.unmount();
  });

  it("publishes runtime diagnostics through the injected owner-aware callback", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const updates: Array<
      Parameters<GroundGlassRttRuntimeInfoChangeHandler>
    > = [];
    const onRuntimeInfoChange: GroundGlassRttRuntimeInfoChangeHandler = (
      channel,
      info,
      ownerId,
    ) => {
      updates.push([channel, info, ownerId]);
    };
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        scene: architectureForegroundScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        onRuntimeInfoChange,
      }),
    );

    const initialUpdate = updates.find(([, info]) => info !== null);
    expect(initialUpdate?.[0]).toBe("default");
    expect(initialUpdate?.[1]?.resourceGeneration).toBe(1);
    expect(initialUpdate?.[1]?.ownerId).toBe(initialUpdate?.[2]);

    view.unmount();

    const finalUpdate = updates[updates.length - 1];
    expect(finalUpdate?.[0]).toBe("default");
    expect(finalUpdate?.[1]).toBeNull();
    expect(finalUpdate?.[2]).toBe(initialUpdate?.[2]);
  });

  it("publishes timings for the active processed Ground Glass passes", () => {
    window.history.replaceState({}, "", "/?dofProfiling=1");
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const diagnostics = createRuntimeInfoCollector();
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        scene: architectureForegroundScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        previewMode: "upright",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    act(() => fiberTestState.frameCallback?.({}, 1 / 60));

    const runtimeInfo = diagnostics.get();
    const snapshot = runtimeInfo?.profilingSnapshot;
    expect(runtimeInfo?.profilingEnabled).toBe(true);
    expect(snapshot?.profilingBackend).toBe("cpu-fallback");
    expect(snapshot?.timingUnit).toBe("cpu-submit-ms");
    expect(snapshot?.profilingDiagnostics.gpuQueryState).toBe("unavailable");
    expect(snapshot?.profilingDiagnostics.framesAttempted).toBe(1);
    expect(snapshot?.profilingDiagnostics.framesAccepted).toBe(1);
    expect(snapshot?.frame.count).toBe(1);
    expect(snapshot?.groundGlassCpuSubmit?.count).toBe(1);
    expect(snapshot?.physicalDofCpuSubmit?.count).toBe(1);
    expect(snapshot?.passes.sceneRenderMs?.count).toBe(1);
    expect(snapshot?.passes.cocFootprintMs?.count).toBe(1);
    expect(snapshot?.passes.farGatherMs?.count).toBe(1);
    expect(snapshot?.passes.nearGatherMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.count).toBe(1);
    expect(snapshot?.gatherResolution).toEqual([
      runtimeInfo?.gatherTargetWidthPx,
      runtimeInfo?.gatherTargetHeightPx,
    ]);

    view.unmount();
  });

  it("does not profile skipped CoC and gather passes in Raw RTT mode", () => {
    window.history.replaceState({}, "", "/?dofProfiling=1");
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const diagnostics = createRuntimeInfoCollector();
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        scene: architectureForegroundScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "low",
        previewMode: "raw",
        rawDebug: true,
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    act(() => fiberTestState.frameCallback?.({}, 1 / 60));

    const snapshot = diagnostics.get()?.profilingSnapshot;
    expect(snapshot?.rawDebug).toBe(true);
    expect(snapshot?.passes.sceneRenderMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.count).toBe(1);
    expect(snapshot?.passes.cocFootprintMs).toBeNull();
    expect(snapshot?.passes.farGatherMs).toBeNull();
    expect(snapshot?.passes.nearGatherMs).toBeNull();
    expect(snapshot?.physicalDofCpuSubmit).toBeNull();
    expect(snapshot?.profilingDiagnostics.framesAttempted).toBe(1);
    expect(snapshot?.profilingDiagnostics.framesAccepted).toBe(1);

    view.unmount();
  });

  it("routes raw debug directly from the full-resolution scene color target", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const diagnostics = createRuntimeInfoCollector();
    render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        scene: architectureForegroundScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "low",
        previewMode: "raw",
        rawDebug: true,
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    act(() => fiberTestState.frameCallback?.());

    const compositeMaterial = renderedShaderMaterials().find((material) =>
      material.fragmentShader.includes("uniform sampler2D tGather"),
    );
    const runtimeInfo = diagnostics.get();
    const sourceTexture = compositeMaterial?.uniforms.tGather.value as THREE.Texture;
    const sourceWidth = (sourceTexture.image as { width: number }).width;
    expect(sourceWidth).toBe(runtimeInfo?.colorTargetWidthPx);
    expect(sourceWidth).not.toBe(runtimeInfo?.gatherTargetWidthPx);
    expect(compositeMaterial?.uniforms.flipDisplayX.value).toBe(1.0);
    expect(compositeMaterial?.uniforms.flipDisplayY.value).toBe(1.0);
    expect(compositeMaterial?.fragmentShader).not.toContain("showRing");
    expect(
      renderedShaderMaterials().some((material) =>
        material.fragmentShader.includes("calculateCoCDiameterMmAtFragment"),
      ),
    ).toBe(false);
    expect(
      renderedShaderMaterials().some((material) =>
        material.fragmentShader.includes("goldenAngle"),
      ),
    ).toBe(false);
  });

  it("ignores stale owner cleanup for default, Original, and Current channels", () => {
    const runtimeInfo = (resourceGeneration: number) =>
      ({ resourceGeneration } as GroundGlassRttRuntimeInfo);

    useAppStore.getState().setGroundGlassRttRuntimeInfo(runtimeInfo(1), "default-old");
    useAppStore.getState().setGroundGlassRttRuntimeInfo(runtimeInfo(2), "default-new");
    useAppStore.getState().setGroundGlassRttRuntimeInfo(null, "default-old");
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration).toBe(2);
    useAppStore.getState().setGroundGlassRttRuntimeInfo(null, "default-new");
    expect(useAppStore.getState().groundGlassRttRuntimeInfo).toBeNull();

    for (const channel of [
      "camera-movement-original",
      "camera-movement-current",
    ] as const) {
      useAppStore
        .getState()
        .setGroundGlassRttRuntimeInfoForChannel(channel, runtimeInfo(3), `${channel}-old`);
      useAppStore
        .getState()
        .setGroundGlassRttRuntimeInfoForChannel(channel, runtimeInfo(4), `${channel}-new`);
      useAppStore
        .getState()
        .setGroundGlassRttRuntimeInfoForChannel(channel, null, `${channel}-old`);
      expect(
        useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.[channel]?.resourceGeneration,
      ).toBe(4);
      useAppStore
        .getState()
        .setGroundGlassRttRuntimeInfoForChannel(channel, null, `${channel}-new`);
      expect(useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.[channel]).toBeNull();
    }
  });

  it("maps default-channel diagnostics through the connected adapter", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const view = render(
      React.createElement(ConnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureRiseScene),
        focalLengthMm: camera.focalLengthMm,
        scene: architectureRiseScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );

    const runtimeInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    expect(runtimeInfo?.channel).toBe("default");
    expect(runtimeInfo?.ownerId).toMatch(/^ground-glass-rtt-owner-/);

    view.unmount();

    expect(useAppStore.getState().groundGlassRttRuntimeInfo).toBeNull();
  });

  it("owns independent Original and Current RTT channels through resize and teardown", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
      activeSceneId: understandingCameraMovementsScene.id,
    };
    const optics = deriveOpticsState(camera, understandingCameraMovementsScene);
    const effectiveCameraMovementCalibration = selectEffectiveCameraMovementCalibration(
      useAppStore.getState(),
    );
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const view = render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ConnectedGroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          scene: understandingCameraMovementsScene,
          widthPx: 500,
          heightPx: 400,
          renderQuality: "standard",
          channel: "camera-movement-original",
          presentationRegion: "middle",
          effectiveCameraMovementCalibration,
        }),
        React.createElement(ConnectedGroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          scene: understandingCameraMovementsScene,
          widthPx: 500,
          heightPx: 400,
          renderQuality: "standard",
          channel: "camera-movement-current",
          presentationRegion: "middle",
          effectiveCameraMovementCalibration,
        }),
      ),
    );

    expect(createSubject).toHaveBeenCalledTimes(2);
    const originalInfo = useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-original"];
    const currentInfo = useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-current"];
    expect(originalInfo?.channel).toBe("camera-movement-original");
    expect(currentInfo?.channel).toBe("camera-movement-current");
    expect(originalInfo?.ownerId).toMatch(/^ground-glass-rtt-owner-/);
    expect(currentInfo?.ownerId).toMatch(/^ground-glass-rtt-owner-/);
    expect(originalInfo?.ownerId).not.toBe(currentInfo?.ownerId);
    expect(originalInfo?.resourceGeneration).toBeGreaterThan(0);
    expect(currentInfo?.resourceGeneration).toBeGreaterThan(0);
    expect(createSubject.mock.results[0]?.value).not.toBe(createSubject.mock.results[1]?.value);
    const ownedGeometrySpies = createSubject.mock.results.map((result) => {
      const group = result.value as THREE.Group;
      const geometry = (group.children[0] as THREE.Mesh).geometry;
      return vi.spyOn(geometry, "dispose");
    });
    expect(view.container.querySelectorAll('[data-rtt-resource-channel="camera-movement-original"]').length).toBe(1);
    expect(view.container.querySelectorAll('[data-rtt-resource-channel="camera-movement-current"]').length).toBe(1);

    view.rerender(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(ConnectedGroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          scene: understandingCameraMovementsScene,
          widthPx: 750,
          heightPx: 600,
          renderQuality: "standard",
          channel: "camera-movement-original",
          presentationRegion: "middle",
          effectiveCameraMovementCalibration,
        }),
        React.createElement(ConnectedGroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          scene: understandingCameraMovementsScene,
          widthPx: 750,
          heightPx: 600,
          renderQuality: "standard",
          channel: "camera-movement-current",
          presentationRegion: "middle",
          effectiveCameraMovementCalibration,
        }),
      ),
    );

    expect(useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-original"]?.resourceGeneration).toBe(
      originalInfo?.resourceGeneration,
    );
    expect(useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-current"]?.resourceGeneration).toBe(
      currentInfo?.resourceGeneration,
    );
    expect(useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-original"]?.internalWidthPx).toBeGreaterThan(
      originalInfo?.internalWidthPx ?? 0,
    );
    ownedGeometrySpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    view.unmount();
    ownedGeometrySpies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-original"]).toBeNull();
    expect(useAppStore.getState().groundGlassRttRuntimeInfoByChannel?.["camera-movement-current"]).toBeNull();
  });

  it("keeps the owned lattice and RTT generation stable across canonical optics changes", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    const baseCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...understandingCameraMovementsScene.cameraPreset,
      cameraBodyPitchDeg: 0,
      activeSceneId: understandingCameraMovementsScene.id,
    };
    const createSubject = vi.mocked(createRegisteredRttSubject);
    const diagnostics = createRuntimeInfoCollector();
    const props = {
      focalLengthMm: baseCamera.focalLengthMm,
      scene: understandingCameraMovementsScene,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
      effectiveCameraMovementCalibration: selectEffectiveCameraMovementCalibration(
        useAppStore.getState(),
      ),
      presentationRegion: "middle" as const,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        opticsState: deriveOpticsState(
          baseCamera,
          understandingCameraMovementsScene,
        ),
      }),
    );
    const initialGeneration = diagnostics.get()?.resourceGeneration;
    const initialGeometryId = diagnostics.get()?.latticeGeometryId;
    const initialEdgeCount = diagnostics.get()?.latticeEdgeCount;

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        opticsState: deriveOpticsState(
          { ...baseCamera, cameraBodyPitchDeg: 8 },
          understandingCameraMovementsScene,
        ),
      }),
    );

    const placedCamera = {
      ...baseCamera,
      cameraBodyPitchDeg: -8,
      viewpointAnchor: "high" as const,
      cameraRigPlacement: cameraMovementsGeometry.cameraRig.viewpointAnchors.high,
    };
    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        opticsState: deriveOpticsState(
          placedCamera,
          understandingCameraMovementsScene,
        ),
      }),
    );

    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(diagnostics.get()?.resourceGeneration).toBe(initialGeneration);
    expect(diagnostics.get()?.latticeGeometryId).toBe(initialGeometryId);
    expect(diagnostics.get()?.latticeEdgeCount).toBe(initialEdgeCount);
  });

  it("creates the canonical charts without the generic fallback subject", () => {
    const group = createRegisteredRttSubject("shelf-swing")!;
    try {
      expect(group.name).toBe("shelf-swing-subject");
      expect(group.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);
      geometry.subjects.forEach((subject) => {
        expect(group.getObjectByName(subject.focusChart.semanticName)).toBeInstanceOf(THREE.Group);
      });
      expect(group.children.some((child) => child.name === "ground-glass-fallback-floor")).toBe(false);
    } finally {
      disposeRegisteredRttSubject("shelf-swing", group);
    }
  });

  it("disposes a Shelf Swing group exactly once during teardown", () => {
    const group = createRegisteredRttSubject("shelf-swing")!;
    const geometryResource = (group.getObjectByName("shelf-swing-floor") as THREE.Mesh).geometry;
    const dispose = vi.spyOn(geometryResource, "dispose");

    disposeRegisteredRttSubject("shelf-swing", group);

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("recreates independent groups and retains Table Tilt explicit disposal", () => {
    const first = createRegisteredRttSubject("shelf-swing")!;
    const second = createRegisteredRttSubject("shelf-swing")!;
    expect(second).not.toBe(first);
    expect(second.parent).toBeNull();
    disposeRegisteredRttSubject("shelf-swing", first);
    disposeRegisteredRttSubject("shelf-swing", second);

    expect(getSceneSubjectRegistration("table-tilt")?.disposeRttGroup).toBeDefined();
    expect(getSceneSubjectRegistration("architecture-rise")?.disposeRttGroup).toBeDefined();
  });

  it("removes and disposes a Shelf group before creating a fresh replacement", () => {
    const scene = new THREE.Scene();
    const first = createRegisteredRttSubject("shelf-swing")!;
    const firstFloor = first.getObjectByName("shelf-swing-floor") as THREE.Mesh;
    const disposeFirstFloor = vi.spyOn(firstFloor.geometry, "dispose");
    scene.add(first);

    scene.remove(first);
    disposeRegisteredRttSubject("shelf-swing", first);
    const replacement = createRegisteredRttSubject("shelf-swing")!;
    scene.add(replacement);

    expect(first.parent).toBeNull();
    expect(disposeFirstFloor).toHaveBeenCalledTimes(1);
    expect(replacement).not.toBe(first);
    expect(replacement.parent).toBe(scene);
    expect(replacement.getObjectByName("shelf-swing-floor")).toBeInstanceOf(THREE.Mesh);

    scene.remove(replacement);
    disposeRegisteredRttSubject("shelf-swing", replacement);
  });

  it("keeps RTT resources stable while a focus loupe crop changes sampled film density", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);
    const createSubject = vi.mocked(createRegisteredRttSubject);
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, "setSize");
    const diagnostics = createRuntimeInfoCollector();

    const props = {
      opticsState,
      focalLengthMm: camera.focalLengthMm,
      scene: architectureRiseScene,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
      zoomEnabled: false,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(React.createElement(UnconnectedGroundGlassRTT, props));
    const initialInfo = diagnostics.get();
    expect(initialInfo?.resourceGeneration).toBe(1);
    expect(createSubject).toHaveBeenCalledTimes(1);

    diagnostics.updates.length = 0;
    setSize.mockClear();
    const cropWindow = resolveGroundGlassInspectionWindow({
      active: true,
      normalizedPan: { x: 0, y: 0 },
      magnification: 4,
    });
    view.rerender(React.createElement(UnconnectedGroundGlassRTT, {
      ...props,
      inspectionWindow: cropWindow,
      zoomEnabled: true,
    }));
    act(() => fiberTestState.frameCallback?.());

    const zoomedInfo = diagnostics.get();
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(zoomedInfo?.resourceGeneration).toBe(initialInfo?.resourceGeneration);
    expect(zoomedInfo?.internalWidthPx).toBe(initialInfo?.internalWidthPx);
    expect(zoomedInfo?.internalHeightPx).toBe(initialInfo?.internalHeightPx);
    expect(zoomedInfo?.colorTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.depthTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.blurTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.cocTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.gatherTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.dofTechnique).toBe("physical-coc-near-far-oriented-gather");
    expect(zoomedInfo?.sampleCount).toBe(32);
    expect(zoomedInfo?.inspectionWindowActive).toBe(true);
    expect(zoomedInfo?.inspectionCenterU).toBeCloseTo(0.5, 12);
    expect(zoomedInfo?.inspectionCenterV).toBeCloseTo(0.5, 12);
    expect(zoomedInfo?.sampledFilmWidthMm).toBeCloseTo(31.75, 12);
    expect(zoomedInfo?.sampledFilmHeightMm).toBeCloseTo(25.4, 12);
    expect(setSize).not.toHaveBeenCalled();
    expect(diagnostics.updates.some(([, info]) => info === null)).toBe(false);

    diagnostics.updates.length = 0;
    setSize.mockClear();
    view.rerender(React.createElement(UnconnectedGroundGlassRTT, props));
    act(() => fiberTestState.frameCallback?.());

    const resetInfo = diagnostics.get();
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(resetInfo?.resourceGeneration).toBe(initialInfo?.resourceGeneration);
    expect(resetInfo?.internalWidthPx).toBe(initialInfo?.internalWidthPx);
    expect(resetInfo?.inspectionWindowActive).toBe(false);
    expect(resetInfo?.sampledFilmWidthMm).toBeCloseTo(127, 12);
    expect(resetInfo?.sampledFilmHeightMm).toBeCloseTo(101.6, 12);
    expect(setSize).not.toHaveBeenCalled();
    expect(diagnostics.updates.some(([, info]) => info === null)).toBe(false);
  });

  it("resizes responsive and quality-derived targets without reallocating the RTT graph", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);
    const createSubject = vi.mocked(createRegisteredRttSubject);
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, "setSize");
    const diagnostics = createRuntimeInfoCollector();
    const props = {
      opticsState,
      focalLengthMm: camera.focalLengthMm,
      scene: architectureRiseScene,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
      zoomEnabled: false,
      onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
    };
    const view = render(React.createElement(UnconnectedGroundGlassRTT, props));
    const initialGeneration = diagnostics.get()?.resourceGeneration;

    setSize.mockClear();
    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, { ...props, widthPx: 750, heightPx: 600 }),
    );
    const resizedInfo = diagnostics.get();
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(resizedInfo?.resourceGeneration).toBe(initialGeneration);
    expect(resizedInfo?.logicalWidthPx).toBe(750);
    expect(resizedInfo?.logicalHeightPx).toBe(600);
    expect(resizedInfo?.colorTargetWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.depthTargetWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.blurTargetWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.finalTargetWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.horizontalShaderRenderWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.verticalShaderRenderWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.cocTargetWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.gatherTargetWidthPx).toBe(resizedInfo?.internalWidthPx);
    expect(resizedInfo?.dofTechnique).toBe("physical-coc-near-far-oriented-gather");
    expect(setSize).toHaveBeenCalledTimes(5);

    setSize.mockClear();
    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        ...props,
        widthPx: 750,
        heightPx: 600,
        renderQuality: "high",
      }),
    );
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(diagnostics.get()?.resourceGeneration).toBe(initialGeneration);
    expect(setSize).toHaveBeenCalledTimes(5);
  });

  it("creates a fresh subject and resource generation when the RTT scene changes", () => {
    const architectureCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const shelfCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...shelfSwingScene.cameraPreset,
      activeSceneId: shelfSwingScene.id,
    };
    const createSubject = vi.mocked(createRegisteredRttSubject);
    const diagnostics = createRuntimeInfoCollector();
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(architectureCamera, architectureRiseScene),
        focalLengthMm: architectureCamera.focalLengthMm,
        scene: architectureRiseScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );
    const initialGeneration = diagnostics.get()?.resourceGeneration;

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(shelfCamera, shelfSwingScene),
        focalLengthMm: shelfCamera.focalLengthMm,
        scene: shelfSwingScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    expect(createSubject).toHaveBeenCalledTimes(2);
    expect(diagnostics.get()?.resourceGeneration).toBe((initialGeneration ?? 0) + 1);
  });

  it("updates the owned RTT lattice target in place without reallocating it", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    const camera = useAppStore.getState().camera;
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const diagnostics = createRuntimeInfoCollector();
    const effectiveCameraMovementCalibration = selectEffectiveCameraMovementCalibration(
      useAppStore.getState(),
    );
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(camera, understandingCameraMovementsScene),
        focalLengthMm: camera.focalLengthMm,
        scene: understandingCameraMovementsScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        effectiveCameraMovementCalibration,
        presentationRegion: "middle",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );
    const firstGeneration = diagnostics.get()?.resourceGeneration;
    const firstSubjectGeneration = diagnostics.get()?.latticeSubjectGeneration;
    const firstGroup = createSubject.mock.results[0]?.value as THREE.Group;
    const firstResourceKey = firstGroup.userData.resourceKey;
    const firstGeometry = (firstGroup.children[0] as THREE.Mesh).geometry;
    const disposeFirstGeometry = vi.spyOn(firstGeometry!, "dispose");

    const presentationTransitions = [
      {
        presentationRegion: "whole",
        lessonState: {
          study: "viewpoint",
          viewpointT: 0,
          activeStandard: "front",
          tiltDeg: 0,
          framingT: 0,
        },
      },
      {
        presentationRegion: "upper",
        lessonState: {
          study: "vertical-framing",
          viewpointT: 0,
          activeStandard: "front",
          tiltDeg: 0,
          framingT: 1,
        },
      },
      {
        presentationRegion: "whole",
        lessonState: {
          study: "viewpoint",
          viewpointT: 0,
          activeStandard: "rear",
          tiltDeg: 0,
          framingT: 0,
        },
      },
      {
        presentationRegion: "lower",
        lessonState: {
          study: "vertical-framing",
          viewpointT: 0,
          activeStandard: "rear",
          tiltDeg: 0,
          framingT: -1,
        },
      },
      {
        presentationRegion: "whole",
        lessonState: {
          study: "viewpoint",
          viewpointT: 0,
          activeStandard: "front",
          tiltDeg: 0,
          framingT: 0,
        },
      },
    ] as const;

    presentationTransitions.forEach(({ presentationRegion, lessonState }) => {
      act(() => {
        useAppStore.getState().setCameraMovementLessonState(lessonState);
        view.rerender(
          React.createElement(UnconnectedGroundGlassRTT, {
            opticsState: deriveOpticsState(camera, understandingCameraMovementsScene),
            focalLengthMm: camera.focalLengthMm,
            scene: understandingCameraMovementsScene,
            widthPx: 500,
            heightPx: 400,
            renderQuality: "standard",
            effectiveCameraMovementCalibration,
            presentationRegion,
            onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
          }),
        );
      });

      expect(createSubject).toHaveBeenCalledTimes(1);
      expect(disposeFirstGeometry).not.toHaveBeenCalled();
      expect(diagnostics.get()?.resourceGeneration).toBe(firstGeneration);
      expect(diagnostics.get()?.latticeSubjectGeneration).toBe(firstSubjectGeneration);
      expect(diagnostics.get()?.latticeResourceKey).toBe(firstResourceKey);
      expect(diagnostics.get()?.latticeEdgeCount).toBe(firstGroup.userData.canonicalEdgeCount);
      expect(diagnostics.get()?.latticeGeometryId).toBe(firstGroup.userData.canonicalGeometryId);
      expect(diagnostics.get()?.latticePresentationRegion).toBe(presentationRegion);
    });
    view.unmount();
    expect(disposeFirstGeometry).toHaveBeenCalledTimes(1);
  });

  it("replaces presentation resources without reallocating the RTT graph", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
      calibrationEnabled: true,
    });
    const camera = useAppStore.getState().camera;
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const diagnostics = createRuntimeInfoCollector();
    const initialCalibration = selectEffectiveCameraMovementCalibration(
      useAppStore.getState(),
    );
    const disposeRenderTarget = vi.spyOn(
      THREE.WebGLRenderTarget.prototype,
      "dispose",
    );
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(
          camera,
          understandingCameraMovementsScene,
        ),
        focalLengthMm: camera.focalLengthMm,
        scene: understandingCameraMovementsScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        effectiveCameraMovementCalibration: initialCalibration,
        presentationRegion: "middle",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );
    const firstInfo = diagnostics.get();
    const firstGroup = createSubject.mock.results[0]?.value as THREE.Group;
    const disposeFirstGeometry = vi.spyOn(
      (firstGroup.children[0] as THREE.Mesh).geometry,
      "dispose",
    );

    act(() => {
      expect(
        useAppStore.getState().updateCameraMovementCalibration({
          presentation: {
            inactiveColour: "#334455",
            internalEdgeOpacity: 0.7,
          },
        }),
      ).toBe(true);
    });

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(
          useAppStore.getState().camera,
          understandingCameraMovementsScene,
        ),
        focalLengthMm: useAppStore.getState().camera.focalLengthMm,
        scene: understandingCameraMovementsScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        effectiveCameraMovementCalibration: selectEffectiveCameraMovementCalibration(
          useAppStore.getState(),
        ),
        presentationRegion: "middle",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    const replacementInfo = diagnostics.get();
    expect(createSubject).toHaveBeenCalledTimes(2);
    expect(disposeFirstGeometry).toHaveBeenCalledTimes(1);
    expect(replacementInfo?.resourceGeneration).toBe(
      firstInfo?.resourceGeneration,
    );
    expect(replacementInfo?.latticeSubjectGeneration).toBeGreaterThan(
      firstInfo?.latticeSubjectGeneration ?? 0,
    );
    expect(replacementInfo?.latticeGeometryId).toBe(
      firstInfo?.latticeGeometryId,
    );
    expect(replacementInfo?.latticePresentationKey).not.toBe(
      firstInfo?.latticePresentationKey,
    );
    expect(disposeRenderTarget).not.toHaveBeenCalled();

    view.unmount();
  });

  it("cleans the camera-movement subject during a client-side scene transition", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    const cameraMovementCamera = useAppStore.getState().camera;
    const effectiveCameraMovementCalibration = selectEffectiveCameraMovementCalibration(
      useAppStore.getState(),
    );
    const architectureCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const diagnostics = createRuntimeInfoCollector();
    const view = render(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(
          cameraMovementCamera,
          understandingCameraMovementsScene,
        ),
        focalLengthMm: cameraMovementCamera.focalLengthMm,
        scene: understandingCameraMovementsScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        effectiveCameraMovementCalibration,
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );
    const cameraMovementGroup =
      createSubject.mock.results[0]?.value as THREE.Group;
    const disposeGeometry = vi.spyOn(
      (cameraMovementGroup.children[0] as THREE.Mesh).geometry,
      "dispose",
    );

    view.rerender(
      React.createElement(UnconnectedGroundGlassRTT, {
        opticsState: deriveOpticsState(
          architectureCamera,
          architectureRiseScene,
        ),
        focalLengthMm: architectureCamera.focalLengthMm,
        scene: architectureRiseScene,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        onRuntimeInfoChange: diagnostics.onRuntimeInfoChange,
      }),
    );

    const currentInfo = diagnostics.get();
    expect(cameraMovementGroup.parent).toBeNull();
    expect(cameraMovementGroup.userData.resourcesDisposed).toBe(true);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(createSubject).toHaveBeenCalledTimes(2);
    expect(currentInfo?.latticeGeometryId).toBeUndefined();
    expect(currentInfo?.latticeSubjectGeneration).toBeUndefined();

    view.unmount();
  });

  it("does not construct placeholder pipeline targets or cameras for an RTT renderer", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);
    const colorTargetFactory = vi.mocked(createGroundGlassRenderTarget);
    const depthTargetFactory = vi.mocked(createGroundGlassDepthTarget);
    const cameraFactory = vi.mocked(createGroundGlassCamera);

    render(
      React.createElement(GroundGlassRenderer, {
        opticsState,
        assistEnabled: false,
        gridEnabled: false,
        riseMm: camera.frontRiseMm,
        tiltDeg: camera.frontTiltDeg,
        swingDeg: camera.frontSwingDeg,
        focusDistanceMm: camera.focusDistanceMm,
        aperture: camera.aperture,
        renderQuality: "standard",
        scene: architectureRiseScene,
        focalLengthMm: camera.focalLengthMm,
        previewMode: "raw",
      }),
    );

    expect(colorTargetFactory).not.toHaveBeenCalled();
    expect(depthTargetFactory).not.toHaveBeenCalled();
    expect(cameraFactory).not.toHaveBeenCalled();
  });
});
