/* eslint-disable react-refresh/only-export-components */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { GLProps } from "@react-three/fiber";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import {
  resolveObserverRendererRuntime,
  resolveObserverVisualPipelineCapabilities,
} from "../../../render/backend/observerVisualPipelineCapabilities";
import type { ObserverWorldEnvironmentStatus } from "../../../render/observerWorldEnvironmentRig";
import { WorldEnvironment } from "../../../render/WorldEnvironment";
import { resolveSceneWorldIllumination } from "../../../scenes/illumination/sceneWorldIllumination";

const body = document.body;
const environment = resolveSceneWorldIllumination("architecture-rise").environment;
if (!environment) throw new Error("Architecture Rise environment recipe is required");

const reportFailure = (message: string): void => {
  body.dataset.fixtureError = message;
};

window.addEventListener("error", (event) => reportFailure(event.message));
window.addEventListener("unhandledrejection", (event) => reportFailure(String(event.reason)));

const webGpuRendererFactory: GLProps = async (defaults) => {
  body.dataset.rendererInitialization = "pending";
  try {
    const { WebGPURenderer } = await import("three/webgpu");
    const renderer = new WebGPURenderer({
      canvas: defaults.canvas as HTMLCanvasElement,
      alpha: defaults.alpha,
      antialias: true,
      powerPreference: defaults.powerPreference === "low-power"
        ? "low-power"
        : "high-performance",
    });
    await renderer.init();
    body.dataset.rendererInitialization = "active";
    return renderer;
  } catch (error) {
    body.dataset.rendererInitialization = "failed";
    reportFailure(error instanceof Error ? error.message : String(error));
    throw error;
  }
};

const ObserverEnvironmentEvidence = ({ enabled }: { enabled: boolean }) => {
  const { gl, scene } = useThree();
  const frameCount = React.useRef(0);
  const runtime = resolveObserverRendererRuntime(gl);
  const visualPipeline = resolveObserverVisualPipelineCapabilities(gl);
  const shadowMapStatus = visualPipeline.status === "active"
    ? visualPipeline.shadowMaps.status
    : "unsupported";
  const shadowMapType = visualPipeline.status === "active"
    ? visualPipeline.shadowMaps.type
    : "unsupported";
  const toneMapping = visualPipeline.status === "active"
    ? visualPipeline.toneMapping.mode
    : "unsupported";
  const toneMappingExposure = visualPipeline.status === "active"
    ? visualPipeline.toneMapping.exposure
    : null;
  const outputColorSpace = visualPipeline.status === "active"
    ? visualPipeline.toneMapping.outputColorSpace
    : null;
  const reportEnvironmentStatus = useCallback((
    generation: number,
    status: ObserverWorldEnvironmentStatus,
  ) => {
    if (generation === 1) body.dataset.environmentStatus = status;
  }, []);

  useEffect(() => {
    body.dataset.rendererFamily = runtime.rendererFamily;
    body.dataset.executionBackend = runtime.executionBackend;
    body.dataset.hardwareAcceleration = "unconfirmed";
    body.dataset.browserWebGpuApiPresent = String("gpu" in navigator);
    body.dataset.visibleBackground = scene.background instanceof THREE.Color
      ? `#${scene.background.getHexString()}`
      : "non-color";
    body.dataset.shadowMapStatus = shadowMapStatus;
    body.dataset.shadowMapType = shadowMapType;
    body.dataset.toneMapping = toneMapping;
    body.dataset.toneMappingExposure = String(toneMappingExposure ?? "unreported");
    body.dataset.outputColorSpace = outputColorSpace ?? "unreported";
  }, [
    gl,
    runtime.executionBackend,
    runtime.rendererFamily,
    scene,
    shadowMapStatus,
    shadowMapType,
    toneMapping,
    toneMappingExposure,
    outputColorSpace,
  ]);

  useFrame(() => {
    frameCount.current += 1;
    body.dataset.renderFrames = String(frameCount.current);
    body.dataset.sceneEnvironmentAssigned = String(scene.environment !== null);
    body.dataset.sceneEnvironmentTextureId = scene.environment?.uuid ?? "none";
    body.dataset.sceneEnvironmentTargetTexture = String(
      scene.environment?.isRenderTargetTexture === true,
    );
    if (runtime.rendererFamily !== "unknown" && frameCount.current >= 2) {
      body.dataset.fixtureReady = "true";
    }
  });

  return (
    <>
      <color attach="background" args={["#f8fafc"]} />
      {enabled ? (
        <WorldEnvironment
          environment={environment}
          mountGeneration={1}
          onStatusChange={reportEnvironmentStatus}
        />
      ) : null}
      <mesh name="environment-reflection-probe">
        <sphereGeometry args={[1, 64, 48]} />
        <meshStandardMaterial color="#b8b8b8" metalness={0.85} roughness={0.24} />
      </mesh>
    </>
  );
};

const App = () => {
  const [environmentEnabled, setEnvironmentEnabled] = useState(true);
  const requestedRenderer = new URLSearchParams(window.location.search).get("renderer");
  const usesWebGpuRenderer = requestedRenderer === "webgpu";

  const toggleEnvironment = () => {
    const nextEnabled = !environmentEnabled;
    setEnvironmentEnabled(nextEnabled);
    body.dataset.environmentStatus = nextEnabled ? "pending" : "not-configured";
  };

  return (
    <>
      <button
        id="toggle-environment"
        type="button"
        aria-pressed={environmentEnabled}
        onClick={toggleEnvironment}
      >
        {environmentEnabled ? "Disable environment" : "Enable environment"}
      </button>
      <Canvas
        dpr={1}
        camera={{ position: [0, 0, 4], fov: 40, near: 0.1, far: 100 }}
        gl={usesWebGpuRenderer ? webGpuRendererFactory : { antialias: true }}
      >
        <ObserverEnvironmentEvidence enabled={environmentEnabled} />
      </Canvas>
    </>
  );
};

createRoot(document.getElementById("observer")!).render(<App />);
