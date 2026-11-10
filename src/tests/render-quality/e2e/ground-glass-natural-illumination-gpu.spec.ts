import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { calculateGroundGlassCoverageRenderGain, resolveGroundGlassCoverageRenderState } from "../../../render/groundGlassCoverage";
import { groundGlassCompositeFragmentShader, groundGlassVertexShader } from "../../../render/groundGlassDofShaderSources";
import { calculateGroundGlassNaturalIlluminationGain } from "../../../core/optics/groundGlassNaturalIllumination";
import { deriveOpticsState } from "../../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../../scenes/definitions/architecture-rise";
import { macroObliquePlaneScene } from "../../../scenes/definitions/macro-oblique-plane";
import { obliqueArchitectureScene } from "../../../scenes/definitions/oblique-architecture";
import type { CameraState } from "../../../types/camera";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../../utils/constants";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const width = 127;
const height = 127;
const filmWidthMm = CAMERA_CONSTANTS.filmWidthMm;
const filmHeightMm = CAMERA_CONSTANTS.filmHeightMm;
const radianceByte = 128;
const edgeFeatherMm = Math.max(filmWidthMm / width, filmHeightMm / height);

const derive = (
  scene: typeof architectureRiseScene | typeof obliqueArchitectureScene | typeof macroObliquePlaneScene,
  movement: Partial<CameraState>,
) => deriveOpticsState({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  ...movement,
}, scene);

const sceneStates = [
  { stateId: "oblique-rise40-swing0", scene: obliqueArchitectureScene, movement: { frontRiseMm: 40, frontSwingDeg: 0 } },
  { stateId: "oblique-rise40-swing-plus5", scene: obliqueArchitectureScene, movement: { frontRiseMm: 40, frontSwingDeg: 5 } },
  { stateId: "oblique-rise40-swing-minus5", scene: obliqueArchitectureScene, movement: { frontRiseMm: 40, frontSwingDeg: -5 } },
  { stateId: "macro-oblique-tilt-plus5", scene: macroObliquePlaneScene, movement: { frontTiltDeg: 5 } },
  { stateId: "architecture-rise-neutral", scene: architectureRiseScene, movement: {} },
].map((entry) => ({ ...entry, optics: derive(entry.scene, entry.movement) }));

const filmPointAtPixel = (x: number, y: number) => ({
  xMm: ((x + 0.5) / width - 0.5) * filmWidthMm,
  yMm: (0.5 - (y + 0.5) / height) * filmHeightMm,
});

const toPixel = (xMm: number, yMm: number) => ({
  x: Math.max(0, Math.min(width - 1, Math.round((xMm / filmWidthMm + 0.5) * width - 0.5))),
  y: Math.max(0, Math.min(height - 1, Math.round((0.5 - yMm / filmHeightMm) * height - 0.5))),
});

const conicDistanceMm = (coverage: Extract<typeof sceneStates[number]["optics"]["groundGlassCoverage"], { kind: "nonparallel-conic" }>, x: number, y: number) => {
  const q = coverage.quadratic;
  const value = q.a * x * x + q.b * x * y + q.c * y * y + q.d * x + q.e * y + q.f;
  const gx = 2 * q.a * x + q.b * y + q.d;
  const gy = q.b * x + 2 * q.c * y + q.e;
  return value / Math.max(Math.hypot(gx, gy), 1e-6);
};

const selectSamples = (state: typeof sceneStates[number]) => {
  const samples = [
    { id: "film-center", pixel: { x: 63, y: 63 } },
    { id: "top-left", pixel: { x: 0, y: 126 } },
    { id: "top-right", pixel: { x: 126, y: 126 } },
    { id: "bottom-left", pixel: { x: 0, y: 0 } },
    { id: "bottom-right", pixel: { x: 126, y: 0 } },
    { id: "positive-x-gradient", pixel: { x: 94, y: 63 } },
    { id: "negative-x-gradient", pixel: { x: 32, y: 63 } },
    { id: "positive-y-gradient", pixel: { x: 63, y: 94 } },
    { id: "negative-y-gradient", pixel: { x: 63, y: 32 } },
  ];

  const illumination = state.optics.groundGlassNaturalIllumination;
  let axisX = 0;
  let axisY = 0;
  if (illumination.kind === "parallel-cos4") {
    axisX = illumination.opticalAxisOffsetXMm;
    axisY = illumination.opticalAxisOffsetYMm;
    samples.push({ id: "optical-axis-intersection", pixel: toPixel(axisX, axisY) });
  } else if (illumination.kind === "nonparallel-geometric") {
    const axisParameter = -illumination.lensToFilmCenterLocalMm[2] / illumination.imageSideAxisLocal[2];
    axisX = axisParameter * illumination.imageSideAxisLocal[0] - illumination.lensToFilmCenterLocalMm[0];
    axisY = axisParameter * illumination.imageSideAxisLocal[1] - illumination.lensToFilmCenterLocalMm[1];
    samples.push({ id: "optical-axis-intersection", pixel: toPixel(axisX, axisY) });
  }
  if (state.movement.frontSwingDeg) {
    samples.push({ id: "positive-x-gradient", pixel: toPixel(axisX + 10, axisY) });
    samples.push({ id: "negative-x-gradient", pixel: toPixel(axisX - 10, axisY) });
  } else if (state.movement.frontTiltDeg) {
    samples.push({ id: "positive-y-gradient", pixel: toPixel(axisX, axisY + 10) });
    samples.push({ id: "negative-y-gradient", pixel: toPixel(axisX, axisY - 10) });
  }

  const coverage = state.optics.groundGlassCoverage;
  if (coverage.kind === "nonparallel-conic") {
    let nearest = { x: 63, y: 63, distance: Number.POSITIVE_INFINITY };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const filmPoint = filmPointAtPixel(x, y);
        const axial = coverage.axial.x * filmPoint.xMm + coverage.axial.y * filmPoint.yMm + coverage.axial.constant;
        if (axial <= 0) continue;
        const distance = Math.abs(conicDistanceMm(coverage, filmPoint.xMm, filmPoint.yMm));
        if (distance < nearest.distance) nearest = { x, y, distance };
      }
    }
    if (!Number.isFinite(nearest.distance)) throw new Error(`${state.stateId} has no conic boundary in the film window`);
    samples.push({ id: "finite-coverage-boundary", pixel: { x: nearest.x, y: nearest.y } });
  }
  return samples;
};

test("production composite shader matches the CPU geometric illumination field on WebGL2", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const sourceCommit = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const dirtySource = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  if (dirtySource) throw new Error(`RQ3B GPU fixture requires a clean source tree:\n${dirtySource}`);
  await page.goto("/src/tests/render-quality/fixtures/blank.html", { waitUntil: "domcontentloaded" });

  const fixtureStates = sceneStates.map((entry) => ({
    stateId: entry.stateId,
    natural: entry.optics.groundGlassNaturalIllumination,
    coverage: entry.optics.groundGlassCoverage,
    samples: selectSamples(entry),
  }));
  for (const entry of sceneStates) {
    expect(entry.optics.groundGlassNaturalIllumination.kind, entry.stateId).not.toBe("neutral");
  }

  const fixture = await page.evaluate(async ({ vertexShader, fragmentShader, states }) => {
    const threeModuleUrl = "/node_modules/three/build/three.module.js";
    const THREE = await import(/* @vite-ignore */ threeModuleUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    document.body.append(canvas);
    const context = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!context) throw new Error("WebGL2 context unavailable for the controlled composite fixture");
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false });
    renderer.setSize(127, 127, false);
    renderer.toneMapping = THREE.NoToneMapping;

    const input = new THREE.DataTexture(
      new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType,
    );
    input.minFilter = THREE.NearestFilter;
    input.magFilter = THREE.NearestFilter;
    input.generateMipmaps = false;
    input.colorSpace = THREE.NoColorSpace;
    input.needsUpdate = true;
    const target = new THREE.WebGLRenderTarget(127, 127, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    const uniforms = {
      tGather: { value: input }, tNearGather: { value: input }, useNearGather: { value: 0 },
      flipDisplayX: { value: 0 }, flipDisplayY: { value: 0 },
      groundGlassIlluminanceGain: { value: 1 },
      groundGlassNaturalIlluminationEnabled: { value: 0 },
      groundGlassNaturalIlluminationModel: { value: 0 },
      groundGlassNaturalIlluminationImageDistanceMm: { value: 0 },
      groundGlassNaturalIlluminationOffsetXMm: { value: 0 },
      groundGlassNaturalIlluminationOffsetYMm: { value: 0 },
      groundGlassNaturalIlluminationLensToFilmCenterLocalMm: { value: new THREE.Vector3() },
      groundGlassNaturalIlluminationImageSideAxisLocal: { value: new THREE.Vector3() },
      groundGlassNaturalIlluminationReferenceFilmIncidenceCosine: { value: 0 },
      groundGlassNaturalIlluminationFilmNormalTowardLensSign: { value: 0 },
      groundGlassCoverageEnabled: { value: 0 }, groundGlassCoverageMode: { value: 0 },
      groundGlassCoverageRadiusMm: { value: 0 }, groundGlassCoverageOffsetXMm: { value: 0 },
      groundGlassCoverageOffsetYMm: { value: 0 },
      groundGlassCoverageConicQuadratic: { value: new THREE.Vector3() },
      groundGlassCoverageConicLinear: { value: new THREE.Vector3() },
      groundGlassCoverageConicAxial: { value: new THREE.Vector3() },
      groundGlassCoverageEdgeFeatherMm: { value: 0 },
      groundGlassFilmWindowCenterXMm: { value: 0 }, groundGlassFilmWindowCenterYMm: { value: 0 },
      groundGlassFilmWindowWidthMm: { value: 127 }, groundGlassFilmWindowHeightMm: { value: 101.6 },
      renderWidth: { value: 127 }, renderHeight: { value: 127 },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    const pixels = new Uint8Array(127 * 127 * 4);
    const results = [];

    for (const state of states) {
      const natural = state.natural;
      if (natural.kind === "neutral") throw new Error(`${state.stateId} has no accepted illumination geometry`);
      uniforms.groundGlassNaturalIlluminationEnabled.value = 1;
      uniforms.groundGlassNaturalIlluminationModel.value = natural.kind === "parallel-cos4" ? 1 : 2;
      uniforms.groundGlassNaturalIlluminationImageDistanceMm.value = natural.kind === "parallel-cos4"
        ? natural.imageDistanceMm : natural.referenceImageDistanceMm;
      uniforms.groundGlassNaturalIlluminationOffsetXMm.value = natural.kind === "parallel-cos4"
        ? natural.opticalAxisOffsetXMm : 0;
      uniforms.groundGlassNaturalIlluminationOffsetYMm.value = natural.kind === "parallel-cos4"
        ? natural.opticalAxisOffsetYMm : 0;
      uniforms.groundGlassNaturalIlluminationLensToFilmCenterLocalMm.value.set(
        ...(natural.kind === "nonparallel-geometric" ? natural.lensToFilmCenterLocalMm : [0, 0, 0]),
      );
      uniforms.groundGlassNaturalIlluminationImageSideAxisLocal.value.set(
        ...(natural.kind === "nonparallel-geometric" ? natural.imageSideAxisLocal : [0, 0, 0]),
      );
      uniforms.groundGlassNaturalIlluminationReferenceFilmIncidenceCosine.value =
        natural.kind === "nonparallel-geometric" ? natural.referenceFilmIncidenceCosine : 0;
      uniforms.groundGlassNaturalIlluminationFilmNormalTowardLensSign.value =
        natural.kind === "nonparallel-geometric" ? natural.filmNormalTowardLensSign : 0;

      const coverage = state.coverage;
      uniforms.groundGlassCoverageEnabled.value = coverage.kind === "parallel-circle" || coverage.kind === "nonparallel-conic" ? 1 : 0;
      uniforms.groundGlassCoverageMode.value = coverage.kind === "parallel-circle" ? 1 : coverage.kind === "nonparallel-conic" ? 2 : 0;
      uniforms.groundGlassCoverageRadiusMm.value = coverage.kind === "parallel-circle" ? coverage.imageCircleRadiusMm : 0;
      uniforms.groundGlassCoverageOffsetXMm.value = coverage.kind === "parallel-circle" ? coverage.opticalAxisOffsetXMm : 0;
      uniforms.groundGlassCoverageOffsetYMm.value = coverage.kind === "parallel-circle" ? coverage.opticalAxisOffsetYMm : 0;
      uniforms.groundGlassCoverageConicQuadratic.value.set(
        ...(coverage.kind === "nonparallel-conic"
          ? [coverage.quadratic.a, coverage.quadratic.b, coverage.quadratic.c]
          : [0, 0, 0]),
      );
      uniforms.groundGlassCoverageConicLinear.value.set(
        ...(coverage.kind === "nonparallel-conic"
          ? [coverage.quadratic.d, coverage.quadratic.e, coverage.quadratic.f]
          : [0, 0, 0]),
      );
      uniforms.groundGlassCoverageConicAxial.value.set(
        ...(coverage.kind === "nonparallel-conic"
          ? [coverage.axial.x, coverage.axial.y, coverage.axial.constant]
          : [0, 0, 150]),
      );
      uniforms.groundGlassCoverageEdgeFeatherMm.value = Math.max(127 / 127, 101.6 / 127);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 127, 127, pixels);
      results.push({
        stateId: state.stateId,
        rendererFamily: "webgl-renderer",
        executionApi: context.getParameter(context.VERSION),
        samples: state.samples.map((sample) => ({
          id: sample.id,
          pixel: sample.pixel,
          rgba: Array.from(pixels.slice(4 * (sample.pixel.y * 127 + sample.pixel.x), 4 * (sample.pixel.y * 127 + sample.pixel.x) + 4)),
        })),
      });
    }
    const rendererIdentity = {
      isWebGL2: renderer.capabilities.isWebGL2,
      version: context.getParameter(context.VERSION),
      vendor: context.getParameter(context.VENDOR),
      renderer: context.getParameter(context.RENDERER),
    };
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    input.dispose();
    material.dispose();
    return { rendererIdentity, results };
  }, { vertexShader: groundGlassVertexShader, fragmentShader: groundGlassCompositeFragmentShader, states: fixtureStates });

  expect(fixture.rendererIdentity.isWebGL2).toBe(true);
  expect(fixture.results).toHaveLength(sceneStates.length);
  const reports = [];
  for (let stateIndex = 0; stateIndex < sceneStates.length; stateIndex += 1) {
    const entry = sceneStates[stateIndex];
    const measured = fixture.results[stateIndex];
    const coverageRenderState = resolveGroundGlassCoverageRenderState({
      state: entry.optics.groundGlassCoverage,
      rawDebug: false,
      filmWidthMm,
      filmHeightMm,
      inspectionWindow: { active: false, centerU: 0.5, centerV: 0.5, widthFraction: 1, heightFraction: 1 },
      renderWidthPx: width,
      renderHeightPx: height,
    });
    const expectedSamples = selectSamples(entry).map((sample) => {
      const filmPoint = filmPointAtPixel(sample.pixel.x, sample.pixel.y);
      const naturalGain = calculateGroundGlassNaturalIlluminationGain(
        entry.optics.groundGlassNaturalIllumination,
        filmPoint.xMm,
        filmPoint.yMm,
      );
      const coverageGain = calculateGroundGlassCoverageRenderGain(
        { ...coverageRenderState, edgeFeatherMm },
        filmPoint.xMm,
        filmPoint.yMm,
      );
      const expectedRed = Math.round(radianceByte * naturalGain * coverageGain);
      const actual = measured.samples.find((result) => result.id === sample.id);
      if (!actual) throw new Error(`${entry.stateId} omitted ${sample.id}`);
      const absoluteDifference = Math.abs(actual.rgba[0] - expectedRed);
      expect(absoluteDifference, `${entry.stateId}/${sample.id} CPU/GPU difference`).toBeLessThanOrEqual(2);
      return {
        sampleId: sample.id,
        filmPointMm: { x: filmPoint.xMm, y: filmPoint.yMm },
        cpuNaturalGain: naturalGain,
        cpuCoverageGain: coverageGain,
        cpuExpectedRed: expectedRed,
        gpuObservedRgba: actual.rgba,
        absoluteDifference,
      };
    });
    reports.push({
      stateId: entry.stateId,
      cameraMovements: entry.movement,
      naturalIllumination: entry.optics.groundGlassNaturalIllumination,
      coverageKind: entry.optics.groundGlassCoverage.kind,
      edgeFeatherMm: coverageRenderState.edgeFeatherMm,
      samples: expectedSamples,
    });
  }

  const browser = page.context().browser();
  const report = {
    schemaVersion: "rq3b-geometric-illumination-gpu-v1",
    sourceCommit,
    sourceTreeStatus: "clean",
    runtime: {
      rendererFamily: "webgl-renderer",
      executionApi: "webgl2",
      contextVersion: fixture.rendererIdentity.version,
      vendor: fixture.rendererIdentity.vendor,
      renderer: fixture.rendererIdentity.renderer,
      browser: { name: "Chromium (Playwright)", version: browser?.version() ?? "unknown" },
      operatingSystem: { platform: platform(), release: release(), architecture: arch() },
    },
    uniformRadianceByte: radianceByte,
    readback: "WebGLRenderTarget RGBA8 readRenderTargetPixels; test-only",
    tolerance: { absoluteOutputByteDifference: 2 },
    states: reports,
  };
  await writeFile(testInfo.outputPath("gpu-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
});
