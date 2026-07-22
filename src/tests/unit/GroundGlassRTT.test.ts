import * as THREE from "three";
import React from "react";
import { cleanup, render } from "@testing-library/react";
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
import geometry from "../../scenes/shelfSwingGeometry";
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

describe("GroundGlassRTT registered Shelf Swing lifecycle", () => {
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
