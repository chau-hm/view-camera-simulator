import * as THREE from "three";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import {
  GroundGlassRTT,
} from "../../render/GroundGlassRTT";
import { synchronizeGroundGlassDofClipRange } from "../../render/createGroundGlassDofUniformState";
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
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry from "../../scenes/shelfSwingGeometry";
import cameraMovementsGeometry from "../../scenes/understandingCameraMovementsGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { GroundGlassRttRuntimeInfo } from "../../render/groundGlassRttDimensions";

const fiberTestState = vi.hoisted(() => ({
  frameCallback: null as ((state?: unknown, delta?: number) => void) | null,
  renderedScenes: [] as unknown[],
  currentTarget: null as unknown,
  gl: {
    getPixelRatio: () => 1,
    getRenderTarget: () => fiberTestState.currentTarget,
    setRenderTarget: (target: unknown) => {
      fiberTestState.currentTarget = target;
    },
    getContext: () => ({
      FRAMEBUFFER: 0x8d40,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      checkFramebufferStatus: () => 0x8cd5,
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
  fiberTestState.currentTarget = null;
  useAppStore.getState().setGroundGlassRttRuntimeInfo(null);
  useAppStore.getState().setGroundGlassRttRuntimeInfoForChannel("camera-movement-original", null);
  useAppStore.getState().setGroundGlassRttRuntimeInfoForChannel("camera-movement-current", null);
});

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
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: optics,
        focalLengthMm: camera.focalLengthMm,
        sceneId: architectureForegroundScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        previewMode: "upright",
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
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.nearGatherTargetWidthPx).toBe(
      useAppStore.getState().groundGlassRttRuntimeInfo?.gatherTargetWidthPx,
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

  it("publishes timings for the active processed Ground Glass passes", () => {
    window.history.replaceState({}, "", "/?dofProfiling=1");
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        sceneId: architectureForegroundScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
        previewMode: "upright",
      }),
    );

    act(() => fiberTestState.frameCallback?.({}, 1 / 60));

    const snapshot = useAppStore.getState().groundGlassRttRuntimeInfo?.profilingSnapshot;
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.profilingEnabled).toBe(true);
    expect(snapshot?.profilingBackend).toBe("cpu-fallback");
    expect(snapshot?.timingUnit).toBe("cpu-submit-ms");
    expect(snapshot?.frame.count).toBe(1);
    expect(snapshot?.groundGlassCpuSubmit?.count).toBe(1);
    expect(snapshot?.physicalDofCpuSubmit?.count).toBe(1);
    expect(snapshot?.passes.sceneRenderMs?.count).toBe(1);
    expect(snapshot?.passes.cocFootprintMs?.count).toBe(1);
    expect(snapshot?.passes.farGatherMs?.count).toBe(1);
    expect(snapshot?.passes.nearGatherMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.count).toBe(1);
    expect(snapshot?.gatherResolution).toEqual([
      useAppStore.getState().groundGlassRttRuntimeInfo?.gatherTargetWidthPx,
      useAppStore.getState().groundGlassRttRuntimeInfo?.gatherTargetHeightPx,
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
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        sceneId: architectureForegroundScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "low",
        previewMode: "raw",
        rawDebug: true,
      }),
    );

    act(() => fiberTestState.frameCallback?.({}, 1 / 60));

    const snapshot = useAppStore.getState().groundGlassRttRuntimeInfo?.profilingSnapshot;
    expect(snapshot?.rawDebug).toBe(true);
    expect(snapshot?.passes.sceneRenderMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.count).toBe(1);
    expect(snapshot?.passes.cocFootprintMs).toBeNull();
    expect(snapshot?.passes.farGatherMs).toBeNull();
    expect(snapshot?.passes.nearGatherMs).toBeNull();
    expect(snapshot?.physicalDofCpuSubmit).toBeNull();

    view.unmount();
  });

  it("routes raw debug directly from the full-resolution scene color target", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureForegroundScene.cameraPreset,
      activeSceneId: architectureForegroundScene.id,
    };
    render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(camera, architectureForegroundScene),
        focalLengthMm: camera.focalLengthMm,
        sceneId: architectureForegroundScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "low",
        previewMode: "raw",
        rawDebug: true,
        focusAssistEnabled: true,
      }),
    );

    act(() => fiberTestState.frameCallback?.());

    const compositeMaterial = renderedShaderMaterials().find((material) =>
      material.fragmentShader.includes("uniform sampler2D tGather"),
    );
    const runtimeInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    const sourceTexture = compositeMaterial?.uniforms.tGather.value as THREE.Texture;
    const sourceWidth = (sourceTexture.image as { width: number }).width;
    expect(sourceWidth).toBe(runtimeInfo?.colorTargetWidthPx);
    expect(sourceWidth).not.toBe(runtimeInfo?.gatherTargetWidthPx);
    expect(compositeMaterial?.uniforms.displayUpright.value).toBe(1.0);
    expect(compositeMaterial?.uniforms.showRing.value).toBe(0.0);
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
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const view = render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(GroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          sceneId: understandingCameraMovementsScene.id,
          widthPx: 500,
          heightPx: 400,
          renderQuality: "standard",
          channel: "camera-movement-original",
          presentationRegion: "middle",
        }),
        React.createElement(GroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          sceneId: understandingCameraMovementsScene.id,
          widthPx: 500,
          heightPx: 400,
          renderQuality: "standard",
          channel: "camera-movement-current",
          presentationRegion: "middle",
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
        React.createElement(GroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          sceneId: understandingCameraMovementsScene.id,
          widthPx: 750,
          heightPx: 600,
          renderQuality: "standard",
          channel: "camera-movement-original",
          presentationRegion: "middle",
        }),
        React.createElement(GroundGlassRTT, {
          opticsState: optics,
          focalLengthMm: camera.focalLengthMm,
          sceneId: understandingCameraMovementsScene.id,
          widthPx: 750,
          heightPx: 600,
          renderQuality: "standard",
          channel: "camera-movement-current",
          presentationRegion: "middle",
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
    const props = {
      focalLengthMm: baseCamera.focalLengthMm,
      sceneId: understandingCameraMovementsScene.id,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
    };
    const view = render(
      React.createElement(GroundGlassRTT, {
        ...props,
        opticsState: deriveOpticsState(
          baseCamera,
          understandingCameraMovementsScene,
        ),
      }),
    );
    const initialGeneration =
      useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration;
    const initialGeometryId =
      useAppStore.getState().groundGlassRttRuntimeInfo?.latticeGeometryId;
    const initialEdgeCount =
      useAppStore.getState().groundGlassRttRuntimeInfo?.latticeEdgeCount;

    view.rerender(
      React.createElement(GroundGlassRTT, {
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
      React.createElement(GroundGlassRTT, {
        ...props,
        opticsState: deriveOpticsState(
          placedCamera,
          understandingCameraMovementsScene,
        ),
      }),
    );

    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration).toBe(
      initialGeneration,
    );
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.latticeGeometryId).toBe(
      initialGeometryId,
    );
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.latticeEdgeCount).toBe(
      initialEdgeCount,
    );
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
    expect(getSceneSubjectRegistration("architecture-rise")?.disposeRttGroup).toBeUndefined();
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

  it("resizes zoom-dependent targets without replacing the subject or resource generation", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const opticsState = deriveOpticsState(camera, architectureRiseScene);
    const createSubject = vi.mocked(createRegisteredRttSubject);
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, "setSize");
    const runtimeUpdates: Array<ReturnType<typeof useAppStore.getState>["groundGlassRttRuntimeInfo"]> = [];
    const unsubscribe = useAppStore.subscribe((state) => {
      runtimeUpdates.push(state.groundGlassRttRuntimeInfo);
    });

    const props = {
      opticsState,
      focalLengthMm: camera.focalLengthMm,
      sceneId: architectureRiseScene.id,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
      zoomEnabled: false,
    };
    const view = render(React.createElement(GroundGlassRTT, props));
    const initialInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    expect(initialInfo?.resourceGeneration).toBe(1);
    expect(createSubject).toHaveBeenCalledTimes(1);

    runtimeUpdates.length = 0;
    setSize.mockClear();
    view.rerender(React.createElement(GroundGlassRTT, { ...props, zoomEnabled: true }));

    const zoomedInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(zoomedInfo?.resourceGeneration).toBe(initialInfo?.resourceGeneration);
    expect(zoomedInfo?.internalWidthPx).toBeGreaterThan(initialInfo?.internalWidthPx ?? 0);
    expect(zoomedInfo?.colorTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.depthTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.blurTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.cocTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.gatherTargetWidthPx).toBe(zoomedInfo?.internalWidthPx);
    expect(zoomedInfo?.dofTechnique).toBe("physical-coc-near-far-oriented-gather");
    expect(zoomedInfo?.sampleCount).toBe(32);
    expect(setSize).toHaveBeenCalledTimes(5);
    expect(runtimeUpdates).not.toContain(null);

    runtimeUpdates.length = 0;
    setSize.mockClear();
    view.rerender(React.createElement(GroundGlassRTT, props));

    const resetInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(resetInfo?.resourceGeneration).toBe(initialInfo?.resourceGeneration);
    expect(resetInfo?.internalWidthPx).toBe(initialInfo?.internalWidthPx);
    expect(setSize).toHaveBeenCalledTimes(5);
    expect(runtimeUpdates).not.toContain(null);

    unsubscribe();
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
    const props = {
      opticsState,
      focalLengthMm: camera.focalLengthMm,
      sceneId: architectureRiseScene.id,
      widthPx: 500,
      heightPx: 400,
      renderQuality: "standard" as const,
      zoomEnabled: false,
    };
    const view = render(React.createElement(GroundGlassRTT, props));
    const initialGeneration = useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration;

    setSize.mockClear();
    view.rerender(
      React.createElement(GroundGlassRTT, { ...props, widthPx: 750, heightPx: 600 }),
    );
    const resizedInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
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
      React.createElement(GroundGlassRTT, {
        ...props,
        widthPx: 750,
        heightPx: 600,
        renderQuality: "high",
      }),
    );
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration).toBe(
      initialGeneration,
    );
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
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(architectureCamera, architectureRiseScene),
        focalLengthMm: architectureCamera.focalLengthMm,
        sceneId: architectureRiseScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );
    const initialGeneration = useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration;

    view.rerender(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(shelfCamera, shelfSwingScene),
        focalLengthMm: shelfCamera.focalLengthMm,
        sceneId: shelfSwingScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );

    expect(createSubject).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration).toBe(
      (initialGeneration ?? 0) + 1,
    );
  });

  it("updates the owned RTT lattice target in place without reallocating it", () => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: understandingCameraMovementsScene.id,
    });
    const camera = useAppStore.getState().camera;
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(camera, understandingCameraMovementsScene),
        focalLengthMm: camera.focalLengthMm,
        sceneId: understandingCameraMovementsScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );
    const firstGeneration = useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration;
    const firstSubjectGeneration =
      useAppStore.getState().groundGlassRttRuntimeInfo?.latticeSubjectGeneration;
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
      act(() => useAppStore.getState().setCameraMovementLessonState(lessonState));

      expect(createSubject).toHaveBeenCalledTimes(1);
      expect(disposeFirstGeometry).not.toHaveBeenCalled();
      expect(useAppStore.getState().groundGlassRttRuntimeInfo?.resourceGeneration).toBe(
        firstGeneration,
      );
      expect(useAppStore.getState().groundGlassRttRuntimeInfo?.latticeSubjectGeneration).toBe(
        firstSubjectGeneration,
      );
      expect(useAppStore.getState().groundGlassRttRuntimeInfo?.latticeResourceKey).toBe(
        firstResourceKey,
      );
      expect(
        useAppStore.getState().groundGlassRttRuntimeInfo?.latticeEdgeCount,
      ).toBe(firstGroup.userData.canonicalEdgeCount);
      expect(
        useAppStore.getState().groundGlassRttRuntimeInfo?.latticeGeometryId,
      ).toBe(firstGroup.userData.canonicalGeometryId);
      expect(
        useAppStore.getState().groundGlassRttRuntimeInfo?.latticePresentationRegion,
      ).toBe(presentationRegion);
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
    const disposeRenderTarget = vi.spyOn(
      THREE.WebGLRenderTarget.prototype,
      "dispose",
    );
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(
          camera,
          understandingCameraMovementsScene,
        ),
        focalLengthMm: camera.focalLengthMm,
        sceneId: understandingCameraMovementsScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );
    const firstInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
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

    const replacementInfo =
      useAppStore.getState().groundGlassRttRuntimeInfo;
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
    const architectureCamera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
    };
    const createSubject = vi.mocked(createRegisteredRttSubject);
    createSubject.mockClear();
    const view = render(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(
          cameraMovementCamera,
          understandingCameraMovementsScene,
        ),
        focalLengthMm: cameraMovementCamera.focalLengthMm,
        sceneId: understandingCameraMovementsScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );
    const cameraMovementGroup =
      createSubject.mock.results[0]?.value as THREE.Group;
    const disposeGeometry = vi.spyOn(
      (cameraMovementGroup.children[0] as THREE.Mesh).geometry,
      "dispose",
    );

    view.rerender(
      React.createElement(GroundGlassRTT, {
        opticsState: deriveOpticsState(
          architectureCamera,
          architectureRiseScene,
        ),
        focalLengthMm: architectureCamera.focalLengthMm,
        sceneId: architectureRiseScene.id,
        widthPx: 500,
        heightPx: 400,
        renderQuality: "standard",
      }),
    );

    const currentInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
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
        focusAssistEnabled: false,
        gridEnabled: false,
        riseMm: camera.frontRiseMm,
        tiltDeg: camera.frontTiltDeg,
        swingDeg: camera.frontSwingDeg,
        focusDistanceMm: camera.focusDistanceMm,
        aperture: camera.aperture,
        renderQuality: "standard",
        sceneId: architectureRiseScene.id,
        previewMode: "raw",
      }),
    );

    expect(colorTargetFactory).not.toHaveBeenCalled();
    expect(depthTargetFactory).not.toHaveBeenCalled();
    expect(cameraFactory).not.toHaveBeenCalled();
  });
});
