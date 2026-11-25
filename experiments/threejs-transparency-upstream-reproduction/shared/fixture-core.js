import * as THREE from "three";
import { createSceneFixture } from "./scenes.js";

const WIDTH = 320;
const HEIGHT = 320;
const BACKGROUNDS = {
  light: "#f8fafc",
  dark: "#172331",
  clear: "#f8fafc",
};
const allowedOpacities = new Set([0.16, 0.5, 1]);
const disposeEvents = [];
const ownedResources = new WeakMap();
const ownedResourceRecords = [];

const toneMappingName = (value) => Object.entries(THREE)
  .find(([name, candidate]) => name.endsWith("ToneMapping") && candidate === value)?.[0] ?? String(value);

const waitForPresentationFrames = () => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

const recordOwnedResource = (resource, kind) => {
  const record = { uuid: resource.uuid, kind, count: 0 };
  ownedResources.set(resource, record);
  ownedResourceRecords.push(record);
  resource.addEventListener("dispose", () => {
    record.count += 1;
    disposeEvents.push({ uuid: record.uuid, kind, count: record.count });
  });
  return record;
};

const summarizeRenderer = (renderer, requestedBackend, requestedOutput) => {
  const actualBackendName = renderer.backend?.constructor?.name ?? renderer.constructor.name;
  const context = renderer.getContext?.();
  const contextLooksLikeWebGPU = typeof context?.configure === "function"
    && typeof context?.getCurrentTexture === "function";
  const executionBackend = contextLooksLikeWebGPU
    ? "webgpu"
    : requestedBackend === "webgl" ? "webgl2" : "webgl2-fallback";
  const webglAttributes = context?.getContextAttributes?.() ?? null;
  const webgpuConfiguration = context?.getConfiguration?.() ?? null;
  return {
    requestedBackend,
    requestedOutput,
    rendererFamily: renderer.isWebGPURenderer ? "WebGPURenderer" : "WebGLRenderer",
    backendName: actualBackendName,
    nativeContextApi: contextLooksLikeWebGPU ? "GPUCanvasContext methods" : context?.constructor?.name ?? null,
    executionBackend,
    revision: THREE.REVISION,
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: toneMappingName(renderer.toneMapping),
    toneMappingExposure: renderer.toneMappingExposure,
    canvas: { width: renderer.domElement.width, height: renderer.domElement.height },
    requestedContextOptions: { alpha: true, premultipliedAlpha: true, antialias: false },
    context: {
      webglAttributes,
      webgpu: webgpuConfiguration
        ? {
            format: webgpuConfiguration.format ?? null,
            alphaMode: webgpuConfiguration.alphaMode ?? null,
            colorSpace: webgpuConfiguration.colorSpace ?? null,
            usage: webgpuConfiguration.usage ?? null,
          }
        : null,
      webgpuAlphaModeObservable: webgpuConfiguration?.alphaMode ?? null,
      htmlCanvasReadbackIsRawFramebuffer: false,
    },
  };
};

export const createFixtureHarness = async ({ backend, output, family, createMaterial, describeMaterial, createBackgroundNode }) => {
  const canvas = document.querySelector("#fixture");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Fixture canvas is missing");
  let renderer;
  if (backend === "webgl") {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
  } else if (backend === "webgpu") {
    const { WebGPURenderer } = await import("three/webgpu");
    renderer = new WebGPURenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    await renderer.init();
  } else {
    throw new Error(`Unknown renderer backend: ${backend}`);
  }

  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.autoClear = true;
  // Keep renderer.info counters cumulative so each fixture can record an exact before/after delta.
  // This changes statistics reset policy only; it does not alter rendering state or output.
  renderer.info.autoReset = false;
  renderer.toneMappingExposure = 1;
  if (output === "material-aware") {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  } else {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  const initialRenderer = summarizeRenderer(renderer, backend, output);
  if (backend === "webgpu" && initialRenderer.executionBackend !== "webgpu") {
    throw new Error(`Native WebGPU required; observed ${initialRenderer.executionBackend} via ${initialRenderer.backendName}`);
  }

  const disposalObjects = new Set();
  let current = null;
  let currentRun = null;
  const disposeCurrent = () => {
    if (!current) return;
    current.scene.remove(...current.objects);
    for (const material of current.ownedMaterials) {
      if (!disposalObjects.has(material)) {
        disposalObjects.add(material);
        material.dispose();
      }
    }
    for (const geometry of current.ownedGeometry) {
      if (!disposalObjects.has(geometry)) {
        disposalObjects.add(geometry);
        geometry.dispose();
      }
    }
    current = null;
  };

  const runCondition = async (condition) => {
    const opacity = Number(condition.opacity);
    const background = condition.background;
    if (!allowedOpacities.has(opacity)) throw new Error(`Unqualified opacity value: ${condition.opacity}`);
    if (!(background in BACKGROUNDS) && background !== "transparent") throw new Error(`Unknown background: ${background}`);
    disposeCurrent();
    const colorHex = background === "transparent" ? null : BACKGROUNDS[background];
    document.body.dataset.background = background;
    const fixture = createSceneFixture({
      backend,
      output,
      fixture: condition.fixture,
      family,
      opacity,
      createMaterial,
      describeMaterial,
    });
    current = fixture;
    for (const material of fixture.ownedMaterials) recordOwnedResource(material, "material");
    for (const geometry of fixture.ownedGeometry) recordOwnedResource(geometry, "geometry");

    fixture.scene.background = null;
    fixture.scene.backgroundNode = null;
    if (background === "transparent") {
      renderer.setClearColor(0x000000, 0);
    } else if (background === "clear") {
      renderer.setClearColor(new THREE.Color(colorHex), 1);
    } else if (output === "material-aware") {
      renderer.setClearColor(0x000000, 1);
      fixture.scene.backgroundNode = createBackgroundNode(colorHex);
    } else {
      renderer.setClearColor(new THREE.Color(colorHex), 1);
      fixture.scene.background = new THREE.Color(colorHex);
    }

    window.__fixtureDrawCalls = [];
    const rendererInfoRenderCallsBefore = renderer.info.render.calls;
    const rendererDrawCounterName = typeof renderer.info.render.drawCalls === "number" ? "drawCalls" : "calls";
    const rendererDrawCounterBefore = renderer.info.render[rendererDrawCounterName];
    renderer.render(fixture.scene, fixture.camera);
    const rendererInfoRenderCallsAfter = renderer.info.render.calls;
    const rendererDrawCounterAfter = renderer.info.render[rendererDrawCounterName];
    await waitForPresentationFrames();

    const metadata = {
      ...initialRenderer,
      condition: {
        fixture: condition.fixture,
        family,
        opacity,
        transparent: fixture.objects.every((object) => object.material.transparent === true),
        requestedBackground: background,
        requestedClearAlpha: background === "transparent" ? 0 : 1,
        cssBackground: getComputedStyle(document.body).backgroundColor,
        imageRepresentation: "browser viewport PNG presentation screenshot with page compositor contribution; not raw framebuffer or fragment alpha",
        opaqueBackgroundSentinel: background === "transparent" ? null : "#00ff7f",
        canvasAlphaIndependentlyRead: false,
        pageCompositorCanAffectScreenshot: true,
      },
      fixtureEvidence: fixture.fixtureEvidence,
      draws: {
        rendererInfoRenderCalls: rendererInfoRenderCallsAfter - rendererInfoRenderCallsBefore,
        rendererDrawCounterName,
        rendererDrawCalls: rendererDrawCounterAfter - rendererDrawCounterBefore,
        rendererInfoRenderCallsBefore,
        rendererInfoRenderCallsAfter,
        rendererDrawCounterBefore,
        rendererDrawCounterAfter,
        onBeforeRenderOrder: [...window.__fixtureDrawCalls],
      },
      materialDescriptions: [...fixture.ownedMaterials].map(describeMaterial),
      ownedResourceIds: {
        materials: [...fixture.ownedMaterials].map((resource) => resource.uuid),
        geometry: [...fixture.ownedGeometry].map((resource) => resource.uuid),
      },
      disposalEventCountAtCapture: disposeEvents.length,
    };
    currentRun = { metadata };
    return currentRun;
  };

  const dispose = async () => {
    disposeCurrent();
    await renderer.dispose();
    return {
      rendererDisposed: true,
      disposalEvents: [...disposeEvents],
      ownedResourceRecords: ownedResourceRecords.map((record) => ({ ...record })),
      allOwnedDisposalsExactlyOnce: ownedResourceRecords.every((record) => record.count === 1),
    };
  };

  return { runCondition, dispose, initialRenderer, getCurrent: () => currentRun };
};
