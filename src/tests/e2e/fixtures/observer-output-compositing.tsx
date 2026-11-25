/* eslint-disable react-refresh/only-export-components */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { GLProps } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import {
  LineBasicNodeMaterial,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  WebGPURenderer,
  type Node,
} from "three/webgpu";
import { color, toneMapping, toneMappingExposure, vec4, workingToColorSpace } from "three/tsl";
import { resolveObserverRendererRuntime } from "../../../render/backend/observerVisualPipelineCapabilities";

type Backend = "webgl" | "webgpu";
type OutputMode = "standard" | "material-aware";
type BackgroundName = "light" | "gray" | "dark";
type OverlayName = "none" | "focus" | "near" | "far" | "overlap" | "behind";
type ViewName = "front" | "oblique" | "back-oblique";

type FixtureState = Readonly<{
  backend: Backend;
  outputMode: OutputMode;
  background: BackgroundName;
  overlay: OverlayName;
  view: ViewName;
}>;

const backgroundColors: Record<BackgroundName, string> = {
  light: "#f8fafc",
  gray: "#808080",
  dark: "#172331",
};

const overlayDefinitions = {
  focus: { label: "Focus plane", color: "#16a34a", opacity: 0.42 },
  near: { label: "Near DOF plane", color: "#60a5fa", opacity: 0.24 },
  far: { label: "Far DOF plane", color: "#a78bfa", opacity: 0.22 },
} as const;

const parseState = (): FixtureState => {
  const params = new URLSearchParams(window.location.search);
  const backend = params.get("backend") === "webgpu" ? "webgpu" : "webgl";
  const outputMode = params.get("output") === "material-aware" ? "material-aware" : "standard";
  return {
    backend,
    outputMode,
    background: "light",
    overlay: "none",
    view: "front",
  };
};

const webGpuRendererFactory: GLProps = async (defaults) => {
  const attempts = Number(document.body.dataset.factoryAttempts ?? 0) + 1;
  document.body.dataset.factoryAttempts = String(attempts);
  document.body.dataset.applicationFallback = "none";
  document.body.dataset.initializationFailure = "none";
  try {
    const renderer = new WebGPURenderer({
      canvas: defaults.canvas as HTMLCanvasElement,
      alpha: defaults.alpha,
      antialias: true,
      powerPreference: "high-performance",
    });
    await renderer.init();
    return renderer;
  } catch (error) {
    document.body.dataset.initializationFailure = "initialization";
    throw error;
  }
};

const toDisplayColor = (linearOutput: Node) => workingToColorSpace(linearOutput, THREE.SRGBColorSpace);

class MaterialAwareStandardNodeMaterial extends MeshStandardNodeMaterial {
  override setupOutput(
    builder: Parameters<MeshStandardNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<MeshStandardNodeMaterial["setupOutput"]>[1],
  ) {
    const typedOutput = outputNode as Node<"vec4">;
    const toneMapped = toneMapping(
      THREE.ACESFilmicToneMapping,
      toneMappingExposure,
      typedOutput,
    );
    const displayOutput = toDisplayColor(toneMapped);
    return super.setupOutput(builder, displayOutput);
  }
}

class MaterialAwareBasicNodeMaterial extends MeshBasicNodeMaterial {
  override setupOutput(
    builder: Parameters<MeshBasicNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<MeshBasicNodeMaterial["setupOutput"]>[1],
  ) {
    return super.setupOutput(builder, toDisplayColor(outputNode));
  }
}

class MaterialAwareLineNodeMaterial extends LineBasicNodeMaterial {
  override setupOutput(
    builder: Parameters<LineBasicNodeMaterial["setupOutput"]>[0],
    outputNode: Parameters<LineBasicNodeMaterial["setupOutput"]>[1],
  ) {
    return super.setupOutput(builder, toDisplayColor(outputNode));
  }
}

const createCheckerTexture = (): THREE.CanvasTexture => {
  const image = document.createElement("canvas");
  image.width = 64;
  image.height = 64;
  const context = image.getContext("2d");
  if (!context) throw new Error("Could not create the experiment checker texture");
  context.fillStyle = "#e8dec9";
  context.fillRect(0, 0, 64, 64);
  context.fillStyle = "#687b84";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if ((x + y) % 2 === 0) context.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  context.strokeStyle = "#172331";
  context.lineWidth = 2;
  context.strokeRect(1, 1, 62, 62);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
};

const RendererAndSceneSettings = ({ state }: { state: FixtureState }) => {
  const { gl, scene } = useThree();
  const materialAware = state.backend === "webgpu" && state.outputMode === "material-aware";
  const backgroundNode = useMemo(() => {
    const authoredColor = color(new THREE.Color(backgroundColors[state.background]));
    return workingToColorSpace(vec4(authoredColor, 1), THREE.SRGBColorSpace);
  }, [state.background]);

  useLayoutEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousOutputColorSpace = gl.outputColorSpace;
    const previousToneMappingExposure = gl.toneMappingExposure;
    gl.toneMapping = materialAware ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
    gl.outputColorSpace = materialAware ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;

    return () => {
      gl.toneMapping = previousToneMapping;
      gl.outputColorSpace = previousOutputColorSpace;
      gl.toneMappingExposure = previousToneMappingExposure;
    };
  }, [gl, materialAware]);

  useLayoutEffect(() => {
    const previousBackground = scene.background;
    const previousBackgroundNode = scene.backgroundNode;
    if (materialAware) {
      scene.background = null;
      scene.backgroundNode = backgroundNode;
    } else {
      scene.backgroundNode = null;
      scene.background = new THREE.Color(backgroundColors[state.background]);
    }
    document.body.dataset.activeBackground = state.background;

    return () => {
      scene.background = previousBackground;
      scene.backgroundNode = previousBackgroundNode;
    };
  }, [backgroundNode, materialAware, scene, state.background]);

  useEffect(() => {
    document.body.dataset.activeOverlay = state.overlay;
    document.body.dataset.activeView = state.view;
    document.body.dataset.outputMode = state.outputMode;
  }, [state.outputMode, state.overlay, state.view]);

  return null;
};

const RuntimeReport = () => {
  const { gl } = useThree();
  const runtime = resolveObserverRendererRuntime(gl);
  const frameCount = React.useRef(0);

  useLayoutEffect(() => {
    document.body.dataset.rendererFamily = runtime.rendererFamily;
    document.body.dataset.executionBackend = runtime.executionBackend;
    document.body.dataset.browserWebGpuApiPresent = String("gpu" in navigator);
    document.body.dataset.rendererAlpha = String("alpha" in gl ? gl.alpha : "unknown");
    document.body.dataset.fixtureReady = "pending";
    return () => {
      delete document.body.dataset.fixtureReady;
    };
  }, [gl, runtime.executionBackend, runtime.rendererFamily]);

  useFrame(() => {
    frameCount.current += 1;
    document.body.dataset.renderFrames = String(frameCount.current);
    document.body.dataset.rendererToneMapping = String(gl.toneMapping);
    document.body.dataset.rendererOutputColorSpace = gl.outputColorSpace;
    if (frameCount.current >= 4) document.body.dataset.fixtureReady = "true";
  });

  return null;
};

const CameraView = ({ view }: { view: ViewName }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    if (view === "oblique") camera.position.set(3.7, 2.2, 7.6);
    else if (view === "back-oblique") camera.position.set(3.7, 2.2, -7.6);
    else camera.position.set(0, 0.25, 8);
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
  }, [camera, view]);
  return null;
};

const LitSubject = ({ materialAware }: { materialAware: boolean }) => {
  const texture = useMemo(createCheckerTexture, []);
  const material = useMemo(() => {
    const options = {
      color: "#ffffff",
      map: texture,
      roughness: 0.74,
      metalness: 0.03,
      toneMapped: true,
    };
    return materialAware
      ? new MaterialAwareStandardNodeMaterial(options)
      : new THREE.MeshStandardMaterial(options);
  }, [materialAware, texture]);

  useEffect(() => () => {
    material.dispose();
    texture.dispose();
  }, [material, texture]);

  return (
    <mesh name="lit-checker-subject" position={[0, -0.02, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.8, 1.5, 1.05]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const ShadowReceiver = ({ materialAware }: { materialAware: boolean }) => {
  const material = useMemo(() => {
    const options = { color: "#d5dbe1", roughness: 0.9, toneMapped: true };
    return materialAware
      ? new MaterialAwareStandardNodeMaterial(options)
      : new THREE.MeshStandardMaterial(options);
  }, [materialAware]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh name="shadow-receiver" position={[0, -1.2, -0.05]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[12, 12]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

type PlanePlacement = Readonly<{ x: number; y: number; z: number }>;
const planePlacements: Record<keyof typeof overlayDefinitions, PlanePlacement> = {
  focus: { x: -0.42, y: 0.2, z: 0.9 },
  near: { x: 0.42, y: 0.1, z: 0.65 },
  far: { x: 0, y: -0.28, z: 0.25 },
};

const OverlayPlane = ({
  kind,
  placement,
  materialAware,
}: {
  kind: keyof typeof overlayDefinitions;
  placement: PlanePlacement;
  materialAware: boolean;
}) => {
  const definition = overlayDefinitions[kind];
  const fill = useMemo(() => {
    const options = {
      color: definition.color,
      transparent: true,
      opacity: definition.opacity,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    };
    return materialAware
      ? new MaterialAwareBasicNodeMaterial(options)
      : new THREE.MeshBasicMaterial(options);
  }, [definition, materialAware]);
  const outline = useMemo(() => {
    const options = {
      color: definition.color,
      transparent: true,
      opacity: Math.min(1, definition.opacity + 0.45),
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    };
    return materialAware
      ? new MaterialAwareLineNodeMaterial(options)
      : new THREE.LineBasicMaterial(options);
  }, [definition, materialAware]);
  const outlinePositions = useMemo(() => new Float32Array([
    -1.2, -0.92, 0.005, 1.2, -0.92, 0.005,
    1.2, -0.92, 0.005, 1.2, 0.92, 0.005,
    1.2, 0.92, 0.005, -1.2, 0.92, 0.005,
    -1.2, 0.92, 0.005, -1.2, -0.92, 0.005,
  ]), []);

  useEffect(() => () => {
    fill.dispose();
    outline.dispose();
  }, [fill, outline]);

  return (
    <group name={`${kind}-teaching-plane`} position={[placement.x, placement.y, placement.z]}>
      <mesh name={`${kind}-plane-fill`} renderOrder={2}>
        <planeGeometry args={[2.4, 1.84]} />
        <primitive object={fill} attach="material" />
      </mesh>
      <lineSegments name={`${kind}-plane-outline`} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outlinePositions, 3]} />
        </bufferGeometry>
        <primitive object={outline} attach="material" />
      </lineSegments>
    </group>
  );
};

const selectedPlanes = (overlay: OverlayName): readonly (keyof typeof overlayDefinitions)[] => {
  if (overlay === "overlap") return ["far", "near", "focus"];
  if (overlay === "behind") return ["focus"];
  if (overlay === "focus" || overlay === "near" || overlay === "far") return [overlay];
  return [];
};

const ExperimentScene = ({ state }: { state: FixtureState }) => {
  const materialAware = state.backend === "webgpu" && state.outputMode === "material-aware";
  const planes = selectedPlanes(state.overlay);
  const placementFor = (kind: keyof typeof overlayDefinitions): PlanePlacement => {
    const placement = state.overlay === "behind"
      ? { x: 0, y: 0.1, z: -0.85 }
      : state.overlay === kind
        ? { x: 0, y: 0.08, z: 0.9 }
        : planePlacements[kind];
    return state.view === "back-oblique" ? { ...placement, z: -placement.z } : placement;
  };

  return (
    <>
      <RuntimeReport />
      <RendererAndSceneSettings state={state} />
      <CameraView view={state.view} />
      <ambientLight intensity={0.62} />
      <directionalLight
        castShadow
        position={[3.5, 5, 5]}
        intensity={2.2}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <LitSubject materialAware={materialAware} />
      <ShadowReceiver materialAware={materialAware} />
      {planes.map((kind) => (
        <OverlayPlane
          key={kind}
          kind={kind}
          placement={placementFor(kind)}
          materialAware={materialAware}
        />
      ))}
    </>
  );
};

const App = () => {
  const [initial] = useState(parseState);
  const [state, setState] = useState(initial);
  const gl = useMemo(
    () => state.backend === "webgpu" ? webGpuRendererFactory : { antialias: true, alpha: true },
    [state.backend],
  );
  const [runtime, setRuntime] = useState<Readonly<{ family: string; backend: string }> | null>(null);

  const update = <K extends "background" | "overlay" | "view">(
    key: K,
    value: FixtureState[K],
  ) => setState((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div id="controls">
        <label>Background
          <select aria-label="Background" value={state.background} onChange={(event) => update("background", event.target.value as BackgroundName)}>
            <option value="light">Light #f8fafc</option>
            <option value="gray">Gray #808080</option>
            <option value="dark">Dark #172331</option>
          </select>
        </label>
        <label>Teaching overlay
          <select aria-label="Teaching overlay" value={state.overlay} onChange={(event) => update("overlay", event.target.value as OverlayName)}>
            <option value="none">None</option>
            <option value="focus">Focus plane</option>
            <option value="near">Near DOF plane</option>
            <option value="far">Far DOF plane</option>
            <option value="overlap">All overlapping planes</option>
            <option value="behind">Plane behind opaque subject</option>
          </select>
        </label>
        <label>Camera
          <select aria-label="Camera view" value={state.view} onChange={(event) => update("view", event.target.value as ViewName)}>
            <option value="front">Front</option>
            <option value="oblique">Oblique</option>
            <option value="back-oblique">Back oblique</option>
          </select>
        </label>
        <span data-testid="runtime" data-renderer-family={runtime?.family ?? "pending"} data-execution-backend={runtime?.backend ?? "pending"} />
      </div>
      <div id="stage">
        <Canvas
          shadows
          dpr={1}
          camera={{ position: [0, 0.25, 8], fov: 42, near: 0.1, far: 100 }}
          gl={gl}
          onCreated={({ gl: renderer }) => {
            if (state.backend === "webgl") document.body.dataset.factoryAttempts = "0";
            document.body.dataset.applicationFallback = "none";
            document.body.dataset.initializationFailure = "none";
            renderer.toneMapping = state.backend === "webgpu" && state.outputMode === "material-aware"
              ? THREE.NoToneMapping
              : THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1;
            renderer.outputColorSpace = state.backend === "webgpu" && state.outputMode === "material-aware"
              ? THREE.LinearSRGBColorSpace
              : THREE.SRGBColorSpace;
            const classification = resolveObserverRendererRuntime(renderer);
            setRuntime({ family: classification.rendererFamily, backend: classification.executionBackend });
          }}
        >
          <ExperimentScene state={state} />
        </Canvas>
      </div>
    </>
  );
};

window.addEventListener("error", (event) => {
  document.body.dataset.fixtureError = event.message;
});
window.addEventListener("unhandledrejection", (event) => {
  document.body.dataset.fixtureError = String(event.reason);
});

const root = document.getElementById("root");
if (!root) throw new Error("Output/compositing fixture root is missing");
createRoot(root).render(<App />);
