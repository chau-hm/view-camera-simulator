import * as THREE from "three";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { GroundGlassRenderer } from "../../render/GroundGlassRenderer";
import { GroundGlassRTT } from "../../render/GroundGlassRTT";
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
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry from "../../scenes/shelfSwingGeometry";
import cameraMovementsGeometry from "../../scenes/understandingCameraMovementsGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const fiberTestState = vi.hoisted(() => ({
  gl: {
    getPixelRatio: () => 1,
    domElement: {
      width: 500,
      height: 400,
      getBoundingClientRect: () => ({ width: 500, height: 400 }),
    },
  },
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: (props: { children?: unknown }) => props.children,
  useFrame: () => undefined,
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
  cleanup();
  vi.restoreAllMocks();
  useAppStore.getState().setGroundGlassRttRuntimeInfo(null);
});

describe("GroundGlassRTT ownership and lifecycle", () => {
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
    expect(setSize).toHaveBeenCalledTimes(3);
    expect(runtimeUpdates).not.toContain(null);

    runtimeUpdates.length = 0;
    setSize.mockClear();
    view.rerender(React.createElement(GroundGlassRTT, props));

    const resetInfo = useAppStore.getState().groundGlassRttRuntimeInfo;
    expect(createSubject).toHaveBeenCalledTimes(1);
    expect(resetInfo?.resourceGeneration).toBe(initialInfo?.resourceGeneration);
    expect(resetInfo?.internalWidthPx).toBe(initialInfo?.internalWidthPx);
    expect(setSize).toHaveBeenCalledTimes(3);
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
    expect(setSize).toHaveBeenCalledTimes(3);

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
    expect(setSize).toHaveBeenCalledTimes(3);
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
    useAppStore.setState((state) => ({
      scene: { ...state.scene, targetRegion: "upper" },
    }));
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

    (["middle", "lower", "middle"] as const).forEach((targetRegion) => {
      act(() =>
        useAppStore.setState((state) => ({
          scene: { ...state.scene, targetRegion },
        })),
      );

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
        useAppStore.getState().groundGlassRttRuntimeInfo?.latticeTargetRegion,
      ).toBe(targetRegion);
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
