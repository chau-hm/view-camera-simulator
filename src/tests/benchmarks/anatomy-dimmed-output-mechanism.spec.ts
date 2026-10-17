import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { arch, platform, release } from "node:os";
import { dirname } from "node:path";
import { REVISION } from "three";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import {
  LESSON_ZERO_STEPS,
  resolveLessonZeroCameraPresentation,
  type LessonZeroStepId,
} from "../../app/anatomyLesson";
import type { ConceptualCameraAnatomyPresentation } from "../../render/ConceptualViewCamera";
import {
  anatomyMaskBounds,
  combineAnatomyMasks,
  compareAnatomyImages,
  complementAnatomyMask,
  countAnatomyMaskPixels,
  deriveAnatomyDifferenceHeatmap,
  deriveAnatomyObservedDifferentialMask,
  type AnatomyPixelMask,
} from "../../render/anatomyRenderableContribution";
import {
  ANATOMY_OUTPUT_INTERVENTION_EVENT,
  ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT,
  type AnatomyOutputInterventionMode,
  type AnatomyOutputInterventionSelection,
} from "../../render/backend/anatomyMaterialOutputIntervention";
import { resolveAnatomyPresentationClassification } from "./anatomyPresentationClassification";
import { decodePlaywrightPng } from "./observerBackendBenchmark";

const nativeRequired = process.env.OBSERVER_NATIVE_WEBGPU_REQUIRED === "1";
const anatomyAuditMode = process.env.OBSERVER_ANATOMY_AUDIT_MODE ?? "standard";
const auditRequestEvent = "vcs:observer-verification:anatomy-material-audit";
const auditResultEvent = "vcs:observer-verification:anatomy-material-audit-result";
const visibilityEvent = "vcs:observer-verification:anatomy-object-visibility";
const visibilityResultEvent = "vcs:observer-verification:anatomy-object-visibility-result";
const cameraPoseEvent = "vcs:observer-verification:anatomy-view";
type PriorityState = Readonly<{
  id: string;
  step: LessonStep;
  heading: string;
  smallAperture?: boolean;
}>;
const priorityStates: readonly PriorityState[] = [
  { id: "highlighted-front-standard", step: "front-standard", heading: "Front Standard" },
  { id: "highlighted-lens-and-board", step: "lens-and-board", heading: "Lens and Lens Board" },
  { id: "aperture-small-opening", step: "aperture", heading: "Aperture", smallAperture: true },
  { id: "bellows-highlighted", step: "bellows", heading: "Bellows" },
] as const;

type LessonStep = LessonZeroStepId;
type AuditBackend = "webgl" | "native-webgpu" | "native-webgpu-standard";
type AuditProps = Readonly<Record<string, unknown>>;
type AuditAssignment = Readonly<{
  slot: number;
  adapted: boolean;
  source: AuditProps;
  output: AuditProps;
  sourceTransparency: Readonly<{
    transparent: boolean;
    opacity: number;
    alphaTest: number;
    hasAlphaMap: boolean;
  }>;
}>;
type AuditRenderable = Readonly<{
  objectId: string;
  name: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
  parentHierarchy?: readonly Readonly<{ id: string; name: string }>[];
  worldMatrix: readonly number[];
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
  geometry: AuditProps;
  materialAssignments: readonly AuditAssignment[];
}>;
type AuditSnapshot = Readonly<{
  schemaVersion: number;
  sceneId: string;
  generation: number;
  anatomyPresentation: ConceptualCameraAnatomyPresentation | null;
  renderer: AuditProps;
  browser: AuditProps;
  viewport: Readonly<{
    width: number;
    height: number;
    devicePixelRatio: number;
    canvasBackingWidth: number;
    canvasBackingHeight: number;
    cameraPosition: readonly number[];
    cameraQuaternion: readonly number[];
    orbitTarget: readonly number[] | null;
  }>;
  background: string | null;
  environment: AuditProps;
  lights: readonly AuditProps[];
  renderables: readonly AuditRenderable[];
  materials: readonly AuditProps[];
}>;
type Capture = Readonly<{
  state: string;
  mode: AnatomyOutputInterventionMode | "webgl-standard" | "webgpu-standard" | "C1" | "C2" | "C4";
  trial: number;
  filename: string;
  png: Buffer;
  image: ReturnType<typeof decodePlaywrightPng>;
  inventory: AuditSnapshot;
  observerAttributes: Record<string, string>;
}>;
type VisibilityResult = Readonly<{
  requestId: string;
  generation: number;
  ok: boolean;
  reason?: string;
  operation?: string;
  transactionId?: string;
  targetCount?: number;
  targets?: readonly Readonly<Record<string, unknown>>[];
  sourceResourceIdentityPreserved?: boolean;
  sourceResourceIdentityMatchesInitialExclusion?: boolean;
  restored?: readonly Readonly<{ id: string; visible: boolean }>[];
}>;
type InterventionResult = Readonly<{
  requestId: string;
  generation: number;
  ok: boolean;
  reason?: string;
  mode?: AnatomyOutputInterventionMode;
  targetGroup?: string | null;
  outputTransform?: string | null;
  renderableIds?: readonly string[];
  semanticParts?: readonly string[];
  selection?: string;
}>;

let requestSequence = 0;

const mountedPresentationForStep = (
  stepId: LessonStep,
  smallAperture = false,
): ConceptualCameraAnatomyPresentation => {
  const step = LESSON_ZERO_STEPS.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Missing Lesson 0 step ${stepId}`);
  const anatomy = resolveLessonZeroCameraPresentation(step, smallAperture).anatomy;
  if (!anatomy) throw new Error(`Lesson 0 step ${stepId} did not resolve an Anatomy presentation`);
  return anatomy;
};

const stabilizeFrame = async (page: Page): Promise<void> => {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
};

const readInventory = async (page: Page, requestId: string): Promise<AuditSnapshot> =>
  page.getByTestId("scene-canvas").evaluate((element, payload) => new Promise<AuditSnapshot>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      element.removeEventListener(payload.resultEvent, onResult);
      reject(new Error("Timed out waiting for the mounted Anatomy audit snapshot"));
    }, 10_000);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId: string; snapshot: AuditSnapshot }>).detail;
      if (detail?.requestId !== payload.requestId) return;
      window.clearTimeout(timeout);
      element.removeEventListener(payload.resultEvent, onResult);
      resolve(detail.snapshot);
    };
    element.addEventListener(payload.resultEvent, onResult);
    element.dispatchEvent(new CustomEvent(payload.requestEvent, { detail: { requestId: payload.requestId } }));
  }), { requestId, requestEvent: auditRequestEvent, resultEvent: auditResultEvent });

const readObserverAttributes = async (page: Page): Promise<Record<string, string>> =>
  page.getByTestId("scene-canvas").evaluate((element) => Object.fromEntries(
    Array.from(element.attributes)
      .filter((attribute) => attribute.name.startsWith("data-observer-"))
      .map((attribute) => [attribute.name, attribute.value]),
  ));

const requestIntervention = async (
  page: Page,
  request: Readonly<{
    generation: number;
    mode: AnatomyOutputInterventionMode;
    selection?: AnatomyOutputInterventionSelection;
  }>,
): Promise<InterventionResult> => {
  const requestId = `anatomy-output-${request.generation}-${++requestSequence}`;
  return page.getByTestId("scene-canvas").evaluate((element, payload) => new Promise<InterventionResult>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      element.removeEventListener(payload.resultEvent, onResult);
      reject(new Error("Timed out waiting for the generation-scoped Anatomy output intervention"));
    }, 5_000);
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<InterventionResult>).detail;
      if (detail?.requestId !== payload.requestId) return;
      window.clearTimeout(timeout);
      element.removeEventListener(payload.resultEvent, onResult);
      resolve(detail);
    };
    element.addEventListener(payload.resultEvent, onResult);
    element.dispatchEvent(new CustomEvent(payload.eventName, {
      detail: { ...payload.request, requestId: payload.requestId },
    }));
  }), {
    request,
    requestId,
    eventName: ANATOMY_OUTPUT_INTERVENTION_EVENT,
    resultEvent: ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT,
  });
};

const requestVisibility = async (
  page: Page,
  request: Readonly<{
    generation: number;
    operation: "exclude" | "restore";
    transactionId?: string;
    renderableIds?: readonly string[];
  }>,
): Promise<VisibilityResult> => {
  const requestId = `anatomy-visibility-${request.generation}-${++requestSequence}`;
  const result = await page.getByTestId("scene-canvas").evaluate((element, payload) =>
    new Promise<VisibilityResult>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        element.removeEventListener(payload.resultEvent, onResult);
        reject(new Error("Timed out waiting for the generation-scoped visibility result"));
      }, 5_000);
      const onResult = (event: Event) => {
        const detail = (event as CustomEvent<VisibilityResult>).detail;
        if (detail?.requestId !== payload.requestId) return;
        window.clearTimeout(timeout);
        element.removeEventListener(payload.resultEvent, onResult);
        resolve(detail);
      };
      element.addEventListener(payload.resultEvent, onResult);
      element.dispatchEvent(new CustomEvent(payload.eventName, {
        detail: {
          ...payload.request,
          requestId: payload.requestId,
          selector: payload.request.operation === "exclude"
            ? { kind: "renderable-ids", renderableIds: payload.request.renderableIds }
            : undefined,
        },
      }));
    }), {
      request,
      requestId,
      eventName: visibilityEvent,
      resultEvent: visibilityResultEvent,
    });
  expect(result.requestId).toBe(requestId);
  expect(result.generation).toBe(request.generation);
  return result;
};

const setCameraPose = async (
  page: Page,
  position: readonly number[],
  target: readonly number[],
): Promise<void> => {
  await page.getByTestId("scene-canvas").evaluate((element, payload) => {
    element.dispatchEvent(new CustomEvent(payload.eventName, {
      detail: { position: payload.position, target: payload.target },
    }));
  }, { eventName: cameraPoseEvent, position: [...position], target: [...target] });
  await stabilizeFrame(page);
};

const openAuditBackend = async (
  browser: Browser,
  backend: AuditBackend,
  testInfo: TestInfo,
): Promise<Readonly<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page; initial: AuditSnapshot }>> => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") pageErrors.push(message.text());
  });
  const params = new URLSearchParams({
    lesson: "1",
    observerMaterialAudit: "1",
    rttDiagnostics: "1",
    observerOutput: "standard",
  });
  if (backend !== "webgl") {
    params.set("observerRenderer", "webgpu");
    params.set("observerOutput", backend === "native-webgpu" ? "material-aware" : "standard");
  }
  await page.goto(`/simulator/free/view-camera-anatomy?${params.toString()}`);
  const observer = page.getByTestId("scene-canvas");
  await expect(observer).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 90_000 });
  await expect(observer).toHaveAttribute("data-observer-test-renderable-contribution-hook", "ready");
  if (backend !== "webgl") {
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgpu-renderer");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgpu");
    await expect(observer).toHaveAttribute("data-observer-adapter-availability", "available");
    await expect(observer).toHaveAttribute("data-observer-application-fallback", "none");
  }
  if (backend === "native-webgpu") {
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "material-aware");
    await expect(observer).toHaveAttribute("data-observer-output-policy-status", "active");
    await expect(observer).toHaveAttribute("data-observer-output-policy-readiness", "ready");
    await expect(observer).toHaveAttribute("data-observer-anatomy-output-intervention-hook", "ready");
  } else if (backend === "native-webgpu-standard") {
    await expect(observer).not.toHaveAttribute("data-observer-anatomy-output-intervention-hook");
  } else {
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer");
    await expect(observer).toHaveAttribute("data-observer-execution-backend", "webgl2");
    await expect(observer).toHaveAttribute("data-observer-output-policy-installed", "standard");
  }
  const initial = await readInventory(page, `${backend}-initial`);
  expect(initial.sceneId).toBe("view-camera-anatomy");
  expect(initial.viewport.devicePixelRatio).toBe(1);
  expect(initial.viewport.canvasBackingWidth).toBeGreaterThan(0);
  expect(initial.viewport.canvasBackingHeight).toBeGreaterThan(0);
  await testInfo.attach(`${backend}-initial-runtime.json`, {
    body: JSON.stringify({ attributes: await readObserverAttributes(page), inventory: initial, pageErrors }, null, 2),
    contentType: "application/json",
  });
  return { context, page, initial };
};

const capture = async (
  page: Page,
  state: string,
  mode: Capture["mode"],
  trial: number,
  testInfo: TestInfo,
): Promise<Capture> => {
  await stabilizeFrame(page);
  const inventory = await readInventory(page, `${mode}-${state}-${trial}`);
  const png = await page.getByTestId("scene-canvas").locator("canvas").screenshot({ animations: "disabled" });
  const filename = `${String(mode).toLowerCase()}-${state}-trial-${trial}.png`;
  const outputPath = testInfo.outputPath(`raw/${filename}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
  return {
    state,
    mode,
    trial,
    filename,
    png,
    image: decodePlaywrightPng(png),
    inventory,
    observerAttributes: await readObserverAttributes(page),
  };
};

const captureGroundGlass = async (page: Page): Promise<Buffer> =>
  page.getByTestId("ground-glass-rtt").locator("canvas").first().screenshot({ animations: "disabled" });

const expectedAnatomyPresentation = (step: LessonStep, smallAperture = false) =>
  mountedPresentationForStep(step, smallAperture);

const captureMaskForIds = async (
  page: Page,
  reference: Capture,
  ids: readonly string[],
  name: string,
): Promise<Readonly<{
  mask: AnatomyPixelMask;
  restoration: ReturnType<typeof compareAnatomyImages>;
  targetCount: number;
  resourceIdentityMatchesInitialExclusion: boolean;
}>> => {
  expect(ids.length, `${reference.state}/${name} must select mounted renderables`).toBeGreaterThan(0);
  const transactionId = `${reference.inventory.generation}-${reference.state}-${name}`;
  const exclusion = await requestVisibility(page, {
    generation: reference.inventory.generation,
    operation: "exclude",
    transactionId,
    renderableIds: ids,
  });
  expect(exclusion.ok, `${reference.state}/${name} visibility exclusion must be accepted`).toBe(true);
  expect(exclusion.targetCount).toBe(ids.length);
  let excludedPng: Buffer | null = null;
  let restore: VisibilityResult | null = null;
  try {
    await stabilizeFrame(page);
    excludedPng = await page.getByTestId("scene-canvas").locator("canvas").screenshot({ animations: "disabled" });
  } finally {
    restore = await requestVisibility(page, {
      generation: reference.inventory.generation,
      operation: "restore",
      transactionId,
    });
  }
  expect(restore?.ok, `${reference.state}/${name} must restore visibility`).toBe(true);
  expect(restore?.sourceResourceIdentityPreserved).toBe(true);
  expect(new Set((restore?.restored ?? []).map(({ id }) => id))).toEqual(new Set(ids));
  await stabilizeFrame(page);
  const restoredImage = decodePlaywrightPng(
    await page.getByTestId("scene-canvas").locator("canvas").screenshot({ animations: "disabled" }),
  );
  const restoration = compareAnatomyImages(reference.image, restoredImage);
  expect(restoration.meanAbsoluteRgbDifference,
    `${reference.state}/${name} visibility restoration stays within repeat-capture noise`).toBeLessThanOrEqual(0.5);
  if (!excludedPng) throw new Error(`${reference.state}/${name} exclusion screenshot is missing`);
  const mask = deriveAnatomyObservedDifferentialMask(reference.image, decodePlaywrightPng(excludedPng), 8);
  return {
    mask,
    restoration,
    targetCount: exclusion.targetCount ?? 0,
    resourceIdentityMatchesInitialExclusion: restore?.sourceResourceIdentityMatchesInitialExclusion === true,
  };
};

const assertMaterialAssignmentsUnchanged = (baseline: AuditSnapshot, compared: AuditSnapshot): void => {
  const assignments = (snapshot: AuditSnapshot) => snapshot.renderables.map((renderable) => ({
    objectId: renderable.objectId,
    materialAssignments: renderable.materialAssignments.map((assignment) => ({
      slot: assignment.slot,
      adapted: assignment.adapted,
      sourceId: assignment.source.id,
      outputId: assignment.output.id,
      source: authoredMaterialProperties(assignment.source),
      output: authoredMaterialProperties(assignment.output),
      sourceTransparency: assignment.sourceTransparency,
    })),
  })).sort((left, right) => left.objectId.localeCompare(right.objectId));
  expect(assignments(compared)).toEqual(assignments(baseline));
};

const authoredMaterialProperties = (properties: AuditProps): AuditProps => Object.fromEntries(
  Object.entries(properties).filter(([key]) => key !== "materialVersion" && key !== "outputGraphBuildCount"),
);

const captureVisibilityCondition = async (
  page: Page,
  reference: Capture,
  renderableIdsToHide: readonly string[],
  condition: "C1" | "C2" | "C4",
  backend: "webgl" | "native-standard" | "material-aware",
  testInfo: TestInfo,
): Promise<Readonly<{
  capture: Capture;
  restoration: ReturnType<typeof compareAnatomyImages>;
  restoredIds: readonly string[];
  resourceIdentityMatchesInitialExclusion: boolean;
}>> => {
  expect(renderableIdsToHide.length, `${reference.state}/${condition} must hide an explicit renderable set`)
    .toBeGreaterThan(0);
  const transactionId = `${reference.inventory.generation}-${reference.state}-${condition}-${backend}`;
  const excluded = await requestVisibility(page, {
    generation: reference.inventory.generation,
    operation: "exclude",
    transactionId,
    renderableIds: renderableIdsToHide,
  });
  expect(excluded.ok, `${reference.state}/${condition}/${backend} exclusion must be accepted`).toBe(true);
  expect(excluded.targetCount).toBe(renderableIdsToHide.length);
  let measured: Capture | null = null;
  let restored: VisibilityResult | null = null;
  try {
    measured = await capture(page, `${reference.state}-${condition}-${backend}`, condition, 1, testInfo);
  } finally {
    restored = await requestVisibility(page, {
      generation: reference.inventory.generation,
      operation: "restore",
      transactionId,
    });
  }
  expect(restored?.ok, `${reference.state}/${condition}/${backend} must restore visibility`).toBe(true);
  expect(restored?.sourceResourceIdentityPreserved).toBe(true);
  const restoredIds = (restored?.restored ?? []).map(({ id }) => id).sort();
  expect(restoredIds).toEqual([...renderableIdsToHide].sort());
  if (!measured) throw new Error(`${reference.state}/${condition}/${backend} capture is missing`);
  assertMaterialAssignmentsUnchanged(reference.inventory, measured.inventory);
  await stabilizeFrame(page);
  const restoredImage = decodePlaywrightPng(
    await page.getByTestId("scene-canvas").locator("canvas").screenshot({ animations: "disabled" }),
  );
  const restoration = compareAnatomyImages(reference.image, restoredImage);
  expect(restoration.meanAbsoluteRgbDifference,
    `${reference.state}/${condition}/${backend} visibility restoration must reproduce its matched baseline`)
    .toBeLessThanOrEqual(0.5);
  return {
    capture: measured,
    restoration,
    restoredIds,
    resourceIdentityMatchesInitialExclusion: restored?.sourceResourceIdentityMatchesInitialExclusion === true,
  };
};

const canonicalRenderableName = (renderable: AuditRenderable): string =>
  renderable.name === `${renderable.role}#${renderable.name.split("#").at(-1)}` &&
  /#\d+$/.test(renderable.name)
    ? `${renderable.role}#<generated>`
    : renderable.name;

const renderableSelectionKey = (renderable: AuditRenderable): string => JSON.stringify([
  canonicalRenderableName(renderable),
  renderable.role,
  renderable.cameraPart,
  renderable.parentHierarchy?.map(({ name }) => name) ?? [],
  renderable.geometry.contentFingerprint,
]);

const idsForRenderableSelectionKeys = (
  inventory: AuditSnapshot,
  keys: readonly string[],
): readonly string[] => keys.map((key) => {
  const matches = inventory.renderables.filter((renderable) => renderable.visible &&
    renderable.role.startsWith("conceptual-camera/") && renderableSelectionKey(renderable) === key);
  expect(matches, `Cross-backend selection ${key} must map to one mounted renderable`)
    .toHaveLength(1);
  return matches[0]!.objectId;
});

const presentationForCapture = (captureValue: Capture) => {
  const presentation = captureValue.inventory.anatomyPresentation;
  if (!presentation) throw new Error(`${captureValue.state} is missing the mounted Anatomy presentation`);
  return resolveAnatomyPresentationClassification(presentation, captureValue.inventory.renderables);
};

const materialAssignmentsByRenderable = (inventory: AuditSnapshot) => new Map(
  inventory.renderables.map((renderable) => [
    renderable.objectId,
    renderable.materialAssignments,
  ]),
);

const assertStableSceneInputs = (baseline: AuditSnapshot, compared: AuditSnapshot): void => {
  expect(compared.generation).toBe(baseline.generation);
  expect(compared.viewport).toEqual(baseline.viewport);
  expect(compared.background).toBe(baseline.background);
  expect(compared.environment).toEqual(baseline.environment);
  expect(compared.lights).toEqual(baseline.lights);
  const sceneRecords = (snapshot: AuditSnapshot) => snapshot.renderables.map((renderable) => ({
    objectId: renderable.objectId,
    role: renderable.role,
    cameraPart: renderable.cameraPart,
    visible: renderable.visible,
    worldMatrix: renderable.worldMatrix,
    castShadow: renderable.castShadow,
    receiveShadow: renderable.receiveShadow,
    renderOrder: renderable.renderOrder,
    geometry: {
      type: renderable.geometry.type,
      vertexCount: renderable.geometry.vertexCount,
      indexCount: renderable.geometry.indexCount,
      contentFingerprint: renderable.geometry.contentFingerprint,
      cachedBoundingBox: renderable.geometry.cachedBoundingBox,
    },
  })).sort((left, right) => left.objectId.localeCompare(right.objectId));
  expect(sceneRecords(compared)).toEqual(sceneRecords(baseline));
};

const assertMatchedCrossBackendInputs = (reference: AuditSnapshot, compared: AuditSnapshot): void => {
  expect(compared.sceneId).toBe(reference.sceneId);
  expect(compared.environment).toEqual(reference.environment);
  expect(compared.lights).toEqual(reference.lights);
  expect({
    width: compared.viewport.width,
    height: compared.viewport.height,
    devicePixelRatio: compared.viewport.devicePixelRatio,
    canvasBackingWidth: compared.viewport.canvasBackingWidth,
    canvasBackingHeight: compared.viewport.canvasBackingHeight,
    cameraPosition: compared.viewport.cameraPosition,
    cameraQuaternion: compared.viewport.cameraQuaternion,
    orbitTarget: compared.viewport.orbitTarget,
  }).toEqual({
    width: reference.viewport.width,
    height: reference.viewport.height,
    devicePixelRatio: reference.viewport.devicePixelRatio,
    canvasBackingWidth: reference.viewport.canvasBackingWidth,
    canvasBackingHeight: reference.viewport.canvasBackingHeight,
    cameraPosition: reference.viewport.cameraPosition,
    cameraQuaternion: reference.viewport.cameraQuaternion,
    orbitTarget: reference.viewport.orbitTarget,
  });
  const materialInputs = (assignment: AuditAssignment) => {
    const source = assignment.source;
    const textureSlots = source.textureSlots && typeof source.textureSlots === "object"
      ? Object.fromEntries(Object.entries(source.textureSlots as Record<string, AuditProps>).map(([slot, texture]) => [
          slot,
          { type: texture.type, colorSpace: texture.colorSpace },
        ]))
      : {};
    return {
      family: source.family,
      color: source.color,
      emissive: source.emissive,
      emissiveIntensity: source.emissiveIntensity,
      toneMapped: source.toneMapped,
      opacity: source.opacity,
      transparent: source.transparent,
      blending: source.blending,
      premultipliedAlpha: source.premultipliedAlpha,
      depthTest: source.depthTest,
      depthWrite: source.depthWrite,
      side: source.side,
      alphaTest: source.alphaTest,
      roughness: source.roughness,
      metalness: source.metalness,
      textureSlots,
    };
  };
  const records = (snapshot: AuditSnapshot) => snapshot.renderables.map((renderable) => ({
    name: canonicalRenderableName(renderable),
    role: renderable.role,
    cameraPart: renderable.cameraPart,
    visible: renderable.visible,
    worldMatrix: renderable.worldMatrix,
    castShadow: renderable.castShadow,
    receiveShadow: renderable.receiveShadow,
    renderOrder: renderable.renderOrder,
    geometry: {
      type: renderable.geometry.type,
      vertexCount: renderable.geometry.vertexCount,
      indexCount: renderable.geometry.indexCount,
      contentFingerprint: renderable.geometry.contentFingerprint,
      cachedBoundingBox: renderable.geometry.cachedBoundingBox,
    },
    materialAssignments: renderable.materialAssignments.map((assignment) => ({
      slot: assignment.slot,
      source: materialInputs(assignment),
      sourceTransparency: assignment.sourceTransparency,
    })),
  })).sort((left, right) => `${left.role}/${left.cameraPart}/${left.name}`
    .localeCompare(`${right.role}/${right.cameraPart}/${right.name}`));
  expect(records(compared)).toEqual(records(reference));
};

const alphaAndRenderFlags = (assignment: AuditAssignment) => ({
  transparent: assignment.output.transparent,
  opacity: assignment.output.opacity,
  premultipliedAlpha: assignment.output.premultipliedAlpha,
  blending: assignment.output.blending,
  depthTest: assignment.output.depthTest,
  depthWrite: assignment.output.depthWrite,
  side: assignment.output.side,
});

const assertInterventionAssignments = (
  baseline: Capture,
  compared: Capture,
  targetIds: readonly string[],
  mode: AnatomyOutputInterventionMode,
  outputTransform: string,
  allowRecreatedBaselineOutputs = false,
): Readonly<{
  targetAssignmentCount: number;
  outputGraphBuiltAssignmentCount: number;
  targetSourceIds: readonly string[];
  variantOutputIds: readonly string[];
  baselineOutputIdentityChanges: number;
  crossGroupSharedSourceCount: number;
}> => {
  assertStableSceneInputs(baseline.inventory, compared.inventory);
  expect(compared.inventory.anatomyPresentation).toEqual(baseline.inventory.anatomyPresentation);
  const targetSet = new Set(targetIds);
  const baselineAssignments = materialAssignmentsByRenderable(baseline.inventory);
  const targetSourceIds = new Set<string>();
  const variantOutputIds = new Set<string>();
  let targetAssignmentCount = 0;
  let outputGraphBuiltAssignmentCount = 0;
  let baselineOutputIdentityChanges = 0;
  for (const renderable of compared.inventory.renderables) {
    const baselineSlots = baselineAssignments.get(renderable.objectId);
    expect(baselineSlots, `B0 inventory must contain ${renderable.name}`).toBeDefined();
    expect(renderable.materialAssignments).toHaveLength(baselineSlots!.length);
    for (let index = 0; index < renderable.materialAssignments.length; index += 1) {
      const assignment = renderable.materialAssignments[index]!;
      const baselineAssignment = baselineSlots![index]!;
      expect(authoredMaterialProperties(assignment.source)).toEqual(
        authoredMaterialProperties(baselineAssignment.source),
      );
      expect(alphaAndRenderFlags(assignment)).toEqual(alphaAndRenderFlags(baselineAssignment));
      if (targetSet.has(renderable.objectId)) {
        targetAssignmentCount += 1;
        targetSourceIds.add(String(assignment.source.id));
        variantOutputIds.add(String(assignment.output.id));
        expect(assignment.adapted).toBe(true);
        expect(assignment.output.outputInterventionId).toBe(mode);
        expect(assignment.output.outputTransform).toBe(outputTransform);
        if (Number(assignment.output.outputGraphBuildCount) > 0) outputGraphBuiltAssignmentCount += 1;
        expect(Number(assignment.output.materialVersion),
          `${mode} scoped NodeMaterial must have a distinct compiled-material version`).toBeGreaterThan(0);
        expect(assignment.output.id).not.toBe(baselineAssignment.output.id);
      } else {
        expect(assignment.output.outputInterventionId).toBe("B0");
        expect(assignment.output.outputTransform).toBe("material-aware");
        if (assignment.output.id !== baselineAssignment.output.id) {
          baselineOutputIdentityChanges += 1;
          if (!allowRecreatedBaselineOutputs) {
            expect(assignment.output.id,
              `Non-target output identity for ${renderable.name} must remain stable during ${mode}`)
              .toBe(baselineAssignment.output.id);
          }
        }
      }
    }
  }
  if (mode === "B0") expect(targetAssignmentCount).toBe(0);
  else expect(targetAssignmentCount).toBeGreaterThan(0);

  const targetOutputIdsBySource = new Map<string, Set<string>>();
  const nonTargetOutputIdsBySource = new Map<string, Set<string>>();
  for (const renderable of compared.inventory.renderables) {
    const target = targetSet.has(renderable.objectId);
    for (const assignment of renderable.materialAssignments) {
      const sourceId = String(assignment.source.id);
      const bucket = target ? targetOutputIdsBySource : nonTargetOutputIdsBySource;
      const outputs = bucket.get(sourceId) ?? new Set<string>();
      outputs.add(String(assignment.output.id));
      bucket.set(sourceId, outputs);
    }
  }
  let crossGroupSharedSourceCount = 0;
  targetOutputIdsBySource.forEach((targetOutputs, sourceId) => {
    const nonTargetOutputs = nonTargetOutputIdsBySource.get(sourceId);
    if (!nonTargetOutputs) return;
    crossGroupSharedSourceCount += 1;
    expect([...targetOutputs].some((id) => nonTargetOutputs.has(id)),
      `Scoped outputs for shared source ${sourceId} must not leak across presentation groups`).toBe(false);
  });
  return {
    targetAssignmentCount,
    outputGraphBuiltAssignmentCount,
    targetSourceIds: [...targetSourceIds].sort(),
    variantOutputIds: [...variantOutputIds].sort(),
    baselineOutputIdentityChanges,
    crossGroupSharedSourceCount,
  };
};

const sharedMaterialEvidence = (
  baseline: Capture,
  dimmedIds: readonly string[],
): Readonly<{ sharedSourceMaterialIds: readonly string[]; sharedOutputMaterialIds: readonly string[] }> => {
  const dimmed = new Set(dimmedIds);
  const outputsBySource = new Map<string, { dimmed: Set<string>; other: Set<string> }>();
  for (const renderable of baseline.inventory.renderables) {
    for (const assignment of renderable.materialAssignments) {
      const sourceId = String(assignment.source.id);
      const record = outputsBySource.get(sourceId) ?? { dimmed: new Set<string>(), other: new Set<string>() };
      record[dimmed.has(renderable.objectId) ? "dimmed" : "other"].add(String(assignment.output.id));
      outputsBySource.set(sourceId, record);
    }
  }
  const sharedSourceMaterialIds: string[] = [];
  const sharedOutputMaterialIds = new Set<string>();
  outputsBySource.forEach((record, sourceId) => {
    if (record.dimmed.size === 0 || record.other.size === 0) return;
    sharedSourceMaterialIds.push(sourceId);
    record.dimmed.forEach((outputId) => {
      if (record.other.has(outputId)) sharedOutputMaterialIds.add(outputId);
    });
  });
  return {
    sharedSourceMaterialIds: sharedSourceMaterialIds.sort(),
    sharedOutputMaterialIds: [...sharedOutputMaterialIds].sort(),
  };
};

const materialEvidenceForRenderableIds = (
  inventory: AuditSnapshot,
  renderableIds: readonly string[],
) => {
  const selected = new Set(renderableIds);
  return inventory.renderables.filter((renderable) => selected.has(renderable.objectId)).map((renderable) => ({
    renderableId: renderable.objectId,
    name: renderable.name,
    role: renderable.role,
    cameraPart: renderable.cameraPart,
    renderOrder: renderable.renderOrder,
    materialAssignments: renderable.materialAssignments.map((assignment) => ({
      slot: assignment.slot,
      adapted: assignment.adapted,
      source: assignment.source,
      output: assignment.output,
      sourceTransparency: assignment.sourceTransparency,
    })),
  }));
};

const compareAlpha = (first: Capture, second: Capture) => {
  if (first.image.channels < 4 || second.image.channels < 4) {
    return { comparable: false, changedPixels: null, meanAbsoluteDifference: null };
  }
  let changedPixels = 0;
  let sum = 0;
  for (let pixel = 0; pixel < first.image.width * first.image.height; pixel += 1) {
    const firstAlpha = first.image.pixels[pixel * first.image.channels + 3] ?? 0;
    const secondAlpha = second.image.pixels[pixel * second.image.channels + 3] ?? 0;
    if (firstAlpha !== secondAlpha) changedPixels += 1;
    sum += Math.abs(firstAlpha - secondAlpha);
  }
  return {
    comparable: true,
    changedPixels,
    meanAbsoluteDifference: sum / (first.image.width * first.image.height),
  };
};

const comparePairwiseNonAdditivity = (
  baseline: Capture,
  firstOnly: Capture,
  secondOnly: Capture,
  both: Capture,
  mask: AnatomyPixelMask,
) => {
  let absoluteResidualSum = 0;
  let interactionChangedPixels = 0;
  const samples = countAnatomyMaskPixels(mask);
  for (let pixel = 0; pixel < mask.pixels.length; pixel += 1) {
    if (!mask.pixels[pixel]) continue;
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = pixel * baseline.image.channels + channel;
      const baselineValue = baseline.image.pixels[offset] ?? 0;
      const firstDelta = (firstOnly.image.pixels[offset] ?? 0) - baselineValue;
      const secondDelta = (secondOnly.image.pixels[offset] ?? 0) - baselineValue;
      const bothDelta = (both.image.pixels[offset] ?? 0) - baselineValue;
      const residual = bothDelta - firstDelta - secondDelta;
      absoluteResidualSum += Math.abs(residual);
      pixelChanged ||= Math.abs(residual) > 8;
    }
    if (pixelChanged) interactionChangedPixels += 1;
  }
  return {
    samplePixels: samples,
    meanAbsoluteRgbNonAdditivity: samples > 0 ? absoluteResidualSum / (samples * 3) : null,
    changedPixelCountAtPerChannelThreshold8: interactionChangedPixels,
    changedPixelFractionAtPerChannelThreshold8: samples > 0 ? interactionChangedPixels / samples : null,
    interpretation: "The residual compares simultaneous B1 output change against the sum of each part's separate B1 output change in the measured shared-response mask. It is evidence of non-additive framebuffer response under this setup, not a direct alpha-blending diagnosis.",
  };
};

const rectMask = (width: number, height: number, left: number, top: number, right: number, bottom: number): AnatomyPixelMask => {
  const pixels = new Uint8Array(width * height);
  for (let y = Math.max(0, top); y < Math.min(height, bottom); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(width, right); x += 1) pixels[y * width + x] = 1;
  }
  return { width, height, pixels };
};

const summarizeMask = (mask: AnatomyPixelMask) => {
  const changedPixels = countAnatomyMaskPixels(mask);
  return {
    width: mask.width,
    height: mask.height,
    changedPixels,
    changedPixelFraction: changedPixels / (mask.width * mask.height),
    bounds: changedPixels > 0 ? anatomyMaskBounds(mask) : null,
  };
};

const encodePng = async (
  page: Page,
  image: Readonly<{ width: number; height: number; channels: number; pixels: Uint8Array }>,
): Promise<Buffer> => {
  const encoded = await page.evaluate((payload) => {
    const canvas = document.createElement("canvas");
    canvas.width = payload.width;
    canvas.height = payload.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not create a canvas for PNG evidence");
    const imageData = context.createImageData(payload.width, payload.height);
    for (let pixel = 0; pixel < payload.width * payload.height; pixel += 1) {
      const source = pixel * payload.channels;
      const target = pixel * 4;
      imageData.data[target] = payload.pixels[source] ?? 0;
      imageData.data[target + 1] = payload.pixels[source + (payload.channels > 1 ? 1 : 0)] ?? 0;
      imageData.data[target + 2] = payload.pixels[source + (payload.channels > 2 ? 2 : 0)] ?? 0;
      imageData.data[target + 3] = payload.channels > 3 ? payload.pixels[source + 3] ?? 255 : 255;
    }
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1] ?? "";
  }, { ...image, pixels: Array.from(image.pixels) });
  if (!encoded) throw new Error("Canvas PNG evidence encoding returned empty data");
  return Buffer.from(encoded, "base64");
};

const writeEvidenceImage = async (
  page: Page,
  testInfo: TestInfo,
  filename: string,
  image: Readonly<{ width: number; height: number; channels: number; pixels: Uint8Array }>,
  attach: boolean,
): Promise<void> => {
  const png = await encodePng(page, image);
  const outputPath = testInfo.outputPath(filename);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
  if (attach) await testInfo.attach(filename, { path: outputPath, contentType: "image/png" });
};

const navigateWithinSimulator = async (page: Page, path: string): Promise<void> => {
  await page.evaluate((nextPath) => {
    window.history.pushState(window.history.state, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, path);
};

test("Anatomy dimmed material output intervention isolates real-scene RGB response", async ({ browser }, testInfo) => {
  test.skip(anatomyAuditMode !== "material-aware", "Set OBSERVER_ANATOMY_AUDIT_MODE=material-aware for the controlled output intervention audit.");
  test.setTimeout(1_800_000);
  expect(nativeRequired, "Native output intervention evidence requires OBSERVER_NATIVE_WEBGPU_REQUIRED=1 and headed Chrome").toBe(true);

  const webgl = await openAuditBackend(browser, "webgl", testInfo);
  const standardWebgpu = await openAuditBackend(browser, "native-webgpu-standard", testInfo);
  const candidate = await openAuditBackend(browser, "native-webgpu", testInfo);
  const webglInitial = webgl.initial;
  const pose = {
    position: webglInitial.viewport.cameraPosition,
    target: webglInitial.viewport.orbitTarget ?? [0, 0, 0],
  };
  await setCameraPose(webgl.page, pose.position, pose.target);
  await setCameraPose(standardWebgpu.page, pose.position, pose.target);
  await setCameraPose(candidate.page, pose.position, pose.target);

  const webglCaptures: Record<string, Capture> = {};
  const standardWebgpuCaptures: Record<string, Capture> = {};
  const stateReports: Record<string, unknown> = {};
  const pairwiseReports: Record<string, Record<string, unknown>> = {};

  const webglPanel = webgl.page.locator(".anatomy-lesson-panel");
  const webglHeading = webglPanel.getByRole("heading", { level: 3 });
  const webglNext = webglPanel.getByRole("button", { name: "Next", exact: true });
  const standardPanel = standardWebgpu.page.locator(".anatomy-lesson-panel");
  const standardHeading = standardPanel.getByRole("heading", { level: 3 });
  const standardNext = standardPanel.getByRole("button", { name: "Next", exact: true });
  const candidatePanel = candidate.page.locator(".anatomy-lesson-panel");
  const candidateHeading = candidatePanel.getByRole("heading", { level: 3 });
  const candidateNext = candidatePanel.getByRole("button", { name: "Next", exact: true });

  try {
    for (const state of priorityStates) {
      await webglNext.click();
      await expect(webglHeading).toHaveText(state.heading);
      await standardNext.click();
      await expect(standardHeading).toHaveText(state.heading);
      await candidateNext.click();
      await expect(candidateHeading).toHaveText(state.heading);
      if (state.smallAperture) {
        await webglPanel.getByRole("button", { name: "Show a smaller opening", exact: true }).click();
        await standardPanel.getByRole("button", { name: "Show a smaller opening", exact: true }).click();
        await candidatePanel.getByRole("button", { name: "Show a smaller opening", exact: true }).click();
      }
      await setCameraPose(webgl.page, pose.position, pose.target);
      await setCameraPose(standardWebgpu.page, pose.position, pose.target);
      await setCameraPose(candidate.page, pose.position, pose.target);

      const webglCapture = await capture(webgl.page, state.id, "webgl-standard", 1, testInfo);
      expect(webglCapture.inventory.anatomyPresentation).toEqual(
        expectedAnatomyPresentation(state.step, state.smallAperture),
      );
      webglCaptures[state.id] = webglCapture;

      const standardWebgpuCapture = await capture(standardWebgpu.page, state.id, "webgpu-standard", 1, testInfo);
      expect(standardWebgpuCapture.inventory.anatomyPresentation).toEqual(
        expectedAnatomyPresentation(state.step, state.smallAperture),
      );
      expect(standardWebgpuCapture.inventory.background).toBe(webglCapture.inventory.background);
      assertMatchedCrossBackendInputs(webglCapture.inventory, standardWebgpuCapture.inventory);
      standardWebgpuCaptures[state.id] = standardWebgpuCapture;

      const b0Request = await requestIntervention(candidate.page, {
        generation: candidate.initial.generation,
        mode: "B0",
      });
      expect(b0Request.ok, `${state.id} B0 baseline request`).toBe(true);
      await expect(candidate.page.getByTestId("scene-canvas"))
        .toHaveAttribute("data-observer-anatomy-output-intervention-mode", "B0");
      const baseline = await capture(candidate.page, state.id, "B0", 1, testInfo);
      assertMatchedCrossBackendInputs(webglCapture.inventory, baseline.inventory);
      const baselineRepeat = await capture(candidate.page, state.id, "B0", 2, testInfo);
      expect(baseline.inventory.anatomyPresentation).toEqual(
        expectedAnatomyPresentation(state.step, state.smallAperture),
      );
      const classification = presentationForCapture(baseline);
      expect(classification.highlightedRenderableIds.length).toBeGreaterThan(0);
      expect(classification.dimmedRenderableIds.length).toBeGreaterThan(0);
      expect(candidate.initial.generation).toBe(baseline.inventory.generation);
      const baselineRepeatNoise = compareAnatomyImages(baseline.image, baselineRepeat.image);
      expect(baselineRepeatNoise.meanAbsoluteRgbDifference,
        `${state.id} B0 repeat captures must bound same-mode measurement noise`).toBeLessThanOrEqual(0.5);
      assertInterventionAssignments(baseline, baselineRepeat, [], "B0", "material-aware");
      let assignmentBaseline = baseline;

      const staleGeneration = await requestIntervention(candidate.page, {
        generation: baseline.inventory.generation - 1,
        mode: "B1",
      });
      expect(staleGeneration).toMatchObject({ ok: false, reason: "stale-renderer-generation" });
      const highlightedId = classification.highlightedRenderableIds[0];
      if (!highlightedId) throw new Error(`${state.id} highlighted group is empty`);
      const wrongGroupSelection = await requestIntervention(candidate.page, {
        generation: baseline.inventory.generation,
        mode: "B1",
        selection: { kind: "renderable-ids", renderableIds: [highlightedId] },
      });
      expect(wrongGroupSelection).toMatchObject({ ok: false, reason: "selection-outside-target-group" });
      await expect(candidate.page.getByTestId("scene-canvas"))
        .toHaveAttribute("data-observer-anatomy-output-intervention-mode", "B0");

      const dimmedContribution = await captureMaskForIds(
        candidate.page,
        baseline,
        classification.dimmedRenderableIds,
        "dimmed-presentation-group",
      );
      const highlightedContribution = await captureMaskForIds(
        candidate.page,
        baseline,
        classification.highlightedRenderableIds,
        "highlighted-presentation-group",
      );
      const bothGroups = combineAnatomyMasks(dimmedContribution.mask, highlightedContribution.mask, "union");
      const groupIntersection = combineAnatomyMasks(dimmedContribution.mask, highlightedContribution.mask, "intersection");
      const unaffectedCandidate = complementAnatomyMask(bothGroups);
      const dimmedOnly = combineAnatomyMasks(dimmedContribution.mask, highlightedContribution.mask, "difference");
      const highlightedOnly = combineAnatomyMasks(highlightedContribution.mask, dimmedContribution.mask, "difference");

      const dimmedPartMasks: Record<string, AnatomyPixelMask> = {};
      const dimmedPartIds: Record<string, string[]> = {};
      for (const part of classification.dimmedParts) {
        const ids = baseline.inventory.renderables
          .filter((renderable) => renderable.visible && renderable.role.startsWith("conceptual-camera/") &&
            renderable.cameraPart === part)
          .map((renderable) => renderable.objectId)
          .sort();
        if (ids.length === 0) continue;
        const contribution = await captureMaskForIds(candidate.page, baseline, ids, `dimmed-part-${part}`);
        dimmedPartMasks[part] = contribution.mask;
        dimmedPartIds[part] = ids;
      }
      const partPairs = Object.entries(dimmedPartMasks).flatMap(([firstPart, firstMask], firstIndex, entries) =>
        entries.slice(firstIndex + 1).map(([secondPart, secondMask]) => {
          const overlapMask = combineAnatomyMasks(firstMask, secondMask, "intersection");
          return {
            firstPart,
            secondPart,
            overlapMask,
            overlapPixels: countAnatomyMaskPixels(overlapMask),
            firstPixels: countAnatomyMaskPixels(firstMask),
            secondPixels: countAnatomyMaskPixels(secondMask),
          };
        }),
      ).filter((pair) => pair.firstPixels > 32 && pair.secondPixels > 32 && pair.overlapPixels >= 32)
        .sort((first, second) => second.overlapPixels - first.overlapPixels ||
          `${first.firstPart}/${first.secondPart}`.localeCompare(`${second.firstPart}/${second.secondPart}`));

      const firstDimmedId = classification.dimmedRenderableIds[0];
      if (!firstDimmedId) throw new Error(`${state.id} has no dimmed renderable for C1`);
      const firstDimmedRenderable = baseline.inventory.renderables.find(({ objectId }) => objectId === firstDimmedId);
      if (!firstDimmedRenderable) throw new Error(`${state.id} C1 renderable is missing from the mounted inventory`);
      const firstDimmedKey = renderableSelectionKey(firstDimmedRenderable);
      const twoPartCandidates = Object.entries(dimmedPartIds)
        .filter(([, ids]) => ids.length > 0)
        .slice(0, 2)
        .map(([, ids]) => ids[0]!);
      expect(new Set(twoPartCandidates).size, `${state.id} C2 must select two distinct semantic-part renderables`)
        .toBe(2);
      const twoPartKeys = twoPartCandidates.map((id) => {
        const renderable = baseline.inventory.renderables.find((candidateRenderable) => candidateRenderable.objectId === id);
        if (!renderable) throw new Error(`${state.id} C2 renderable ${id} is missing from the mounted inventory`);
        return renderableSelectionKey(renderable);
      });
      expect(new Set(twoPartKeys).size, `${state.id} C2 selection keys must be distinct`).toBe(2);
      const visibilityConditions: Record<string, unknown> = {};
      for (const condition of [
        { id: "C1", visibleKeys: [firstDimmedKey] },
        { id: "C2", visibleKeys: twoPartKeys },
        { id: "C4", visibleKeys: [] },
      ] as const) {
        const perBackend: Record<string, Readonly<{
          capture: Capture;
          restoration: ReturnType<typeof compareAnatomyImages>;
          restoredIds: readonly string[];
          resourceIdentityMatchesInitialExclusion: boolean;
        }>> = {};
        for (const [backend, page, backendBaseline] of [
          ["webgl", webgl.page, webglCapture],
          ["native-standard", standardWebgpu.page, standardWebgpuCapture],
          ["material-aware", candidate.page, baseline],
        ] as const) {
          const backendClassification = presentationForCapture(backendBaseline);
          const permittedDimmedIds = idsForRenderableSelectionKeys(backendBaseline.inventory, condition.visibleKeys);
          const hiddenIds = backendClassification.dimmedRenderableIds
            .filter((id) => !permittedDimmedIds.includes(id));
          const conditionCapture = await captureVisibilityCondition(
            page,
            backendBaseline,
            hiddenIds,
            condition.id,
            backend,
            testInfo,
          );
          perBackend[backend] = conditionCapture;
        }
        const webglCondition = perBackend.webgl!.capture;
        const nativeStandardCondition = perBackend["native-standard"]!.capture;
        const materialAwareCondition = perBackend["material-aware"]!.capture;
        visibilityConditions[condition.id] = {
          policy: condition.id === "C4"
            ? "Exclude every currently visible dimmed semantic camera renderable; keep highlighted, normal, registered-target, overlay, and other renderables at their baseline visibility."
            : `Keep ${condition.visibleKeys.length} explicitly identified dimmed renderable(s) visible; exclude the rest of the current dimmed group. Keep every non-dimmed renderable at baseline visibility.`,
          permittedDimmedSelectionKeys: condition.visibleKeys,
          perBackend: Object.fromEntries(Object.entries(perBackend).map(([backend, result]) => [backend, {
            capture: result!.capture.filename,
            excludedRenderableCount: result!.restoredIds.length,
            restoration: result!.restoration,
            resourceIdentityMatchesInitialExclusion: result!.resourceIdentityMatchesInitialExclusion,
          }])),
          crossBackend: {
            webglVsNativeStandardWholeFrame: compareAnatomyImages(webglCondition.image, nativeStandardCondition.image),
            webglVsMaterialAwareWholeFrame: compareAnatomyImages(webglCondition.image, materialAwareCondition.image),
            nativeStandardVsMaterialAwareWholeFrame: compareAnatomyImages(nativeStandardCondition.image, materialAwareCondition.image),
            webglVsMaterialAwareDimmedResponseRegion: compareAnatomyImages(
              webglCondition.image,
              materialAwareCondition.image,
              dimmedContribution.mask,
            ),
          },
        };
      }
      const sharedMaterialBaseline = sharedMaterialEvidence(baseline, classification.dimmedRenderableIds);
      visibilityConditions.C3 = {
        policy: "Full current dimmed group remains visible with every other renderable at baseline visibility.",
        perBackend: {
          webgl: { capture: webglCapture.filename },
          nativeStandard: { capture: standardWebgpuCapture.filename },
          materialAware: { capture: baseline.filename, repeatCapture: baselineRepeat.filename },
        },
        crossBackend: {
          webglVsNativeStandardWholeFrame: compareAnatomyImages(webglCapture.image, standardWebgpuCapture.image),
          webglVsMaterialAwareWholeFrame: compareAnatomyImages(webglCapture.image, baseline.image),
          nativeStandardVsMaterialAwareWholeFrame: compareAnatomyImages(standardWebgpuCapture.image, baseline.image),
        },
      };

      const modeReports: Record<string, unknown> = {};
      const modeCaptures: Partial<Record<AnatomyOutputInterventionMode, Capture>> = {};
      const modes: readonly AnatomyOutputInterventionMode[] = ["B1", "B2", "B3", "B4"];
      for (const mode of modes) {
        const selectedIds = mode === "B4"
          ? classification.highlightedRenderableIds
          : classification.dimmedRenderableIds;
        const selection: AnatomyOutputInterventionSelection = { kind: "presentation-group" };
        const intervention = await requestIntervention(candidate.page, {
          generation: baseline.inventory.generation,
          mode,
          selection,
        });
        expect(intervention.ok, `${state.id}/${mode} intervention must be accepted`).toBe(true);
        expect(intervention.mode).toBe(mode);
        expect(intervention.renderableIds).toEqual(selectedIds);
        await expect(candidate.page.getByTestId("scene-canvas"))
          .toHaveAttribute("data-observer-anatomy-output-intervention-mode", mode);
        await expect(candidate.page.getByTestId("scene-canvas"))
          .toHaveAttribute("data-observer-anatomy-output-intervention-target-count", String(selectedIds.length));
        const transform = mode === "B1" || mode === "B4"
          ? "bypass-rgb-transform"
          : mode === "B2" ? "bypass-tone-mapping" : "bypass-color-space";
        const firstTrial = await capture(candidate.page, state.id, mode, 1, testInfo);
        modeCaptures[mode] = firstTrial;
        const assignmentEvidence = assertInterventionAssignments(
          assignmentBaseline,
          firstTrial,
          selectedIds,
          mode,
          transform,
        );
        expect(assignmentEvidence.outputGraphBuiltAssignmentCount,
          `${state.id}/${mode} must activate at least one selected output graph on the mounted native renderer`)
          .toBeGreaterThan(0);

        const resetAfterFirst = await requestIntervention(candidate.page, {
          generation: baseline.inventory.generation,
          mode: "B0",
        });
        expect(resetAfterFirst.ok).toBe(true);
        const resetInventory = await capture(candidate.page, state.id, "B0", 10 + modes.indexOf(mode), testInfo);
        expect(compareAnatomyImages(baseline.image, resetInventory.image).meanAbsoluteRgbDifference)
          .toBeLessThanOrEqual(baselineRepeatNoise.meanAbsoluteRgbDifference + 0.5);
        assertInterventionAssignments(assignmentBaseline, resetInventory, [], "B0", "material-aware", true);
        assignmentBaseline = resetInventory;

        const repeatedIntervention = await requestIntervention(candidate.page, {
          generation: baseline.inventory.generation,
          mode,
          selection,
        });
        expect(repeatedIntervention.ok).toBe(true);
        const secondTrial = await capture(candidate.page, state.id, mode, 2, testInfo);
        const secondAssignmentEvidence = assertInterventionAssignments(
          assignmentBaseline,
          secondTrial,
          selectedIds,
          mode,
          transform,
        );
        expect(secondAssignmentEvidence.outputGraphBuiltAssignmentCount,
          `${state.id}/${mode} repeated capture must retain active output-graph evidence`)
          .toBeGreaterThan(0);
        const repeatNoise = compareAnatomyImages(firstTrial.image, secondTrial.image);
        const responseMask = deriveAnatomyObservedDifferentialMask(baseline.image, firstTrial.image, 8);
        const regionMasks: Readonly<Record<string, AnatomyPixelMask>> = {
          fullFrame: rectMask(baseline.image.width, baseline.image.height, 0, 0, baseline.image.width, baseline.image.height),
          dimmedResponse: dimmedContribution.mask,
          highlightedResponse: highlightedContribution.mask,
          dimmedOnlyResponse: dimmedOnly,
          highlightedOnlyResponse: highlightedOnly,
          unaffectedBackgroundCandidate: unaffectedCandidate,
          bothGroupsInfluenceCandidate: groupIntersection,
        };
        const modeVsWebgl = Object.fromEntries(Object.entries(regionMasks).map(([region, mask]) => [
          region,
          compareAnatomyImages(webglCapture.image, firstTrial.image, mask),
        ]));
        const modeVsB0 = Object.fromEntries(Object.entries(regionMasks).map(([region, mask]) => [
          region,
          compareAnatomyImages(baseline.image, firstTrial.image, mask),
        ]));
        const alphaDifference = compareAlpha(baseline, firstTrial);
        if (alphaDifference.comparable) expect(alphaDifference.changedPixels).toBe(0);
        const changedTopLeft = compareAnatomyImages(
          baseline.image,
          firstTrial.image,
          rectMask(baseline.image.width, baseline.image.height, 0, 0, 32, 32),
        );
        expect(changedTopLeft.meanAbsoluteRgbDifference,
          `${state.id}/${mode} output intervention must leave the fixed canvas-background patch unchanged`)
          .toBeLessThanOrEqual(baselineRepeatNoise.meanAbsoluteRgbDifference + 0.5);

        const resetAfterSecond = await requestIntervention(candidate.page, {
          generation: baseline.inventory.generation,
          mode: "B0",
        });
        expect(resetAfterSecond.ok).toBe(true);
        const restored = await capture(candidate.page, state.id, "B0", 20 + modes.indexOf(mode), testInfo);
        expect(compareAnatomyImages(baseline.image, restored.image).meanAbsoluteRgbDifference)
          .toBeLessThanOrEqual(baselineRepeatNoise.meanAbsoluteRgbDifference + 0.5);
        assertInterventionAssignments(assignmentBaseline, restored, [], "B0", "material-aware", true);
        assignmentBaseline = restored;

        modeReports[mode] = {
          targetGroup: mode === "B4" ? "highlighted" : "dimmed",
          targetRenderableIds: selectedIds,
          outputTransform: transform,
          assignments: assignmentEvidence,
          repeatAssignmentEvidence: secondAssignmentEvidence,
          repeatNoise,
          webglReference: modeVsWebgl,
          b0Reference: modeVsB0,
          actualOutputGraphResponse: {
            changedPixels: countAnatomyMaskPixels(responseMask),
            changedPixelFraction: countAnatomyMaskPixels(responseMask) /
              (responseMask.width * responseMask.height),
            alphaDifference,
            fixedTopLeftBackgroundPatch: changedTopLeft,
          },
          lifecycle: {
            requestedAndRestored: true,
            b0RestorationCaptures: [resetInventory.filename, restored.filename],
            restoredMode: restored.observerAttributes["data-observer-anatomy-output-intervention-mode"],
          },
          captures: [firstTrial.filename, secondTrial.filename],
        };

        if (state.id === "highlighted-front-standard") {
          const representativePath = testInfo.outputPath(`selected-captures/${state.id}-${mode}.png`);
          await mkdir(dirname(representativePath), { recursive: true });
          await writeFile(representativePath, firstTrial.png);
          await testInfo.attach(`${state.id}-${mode}.png`, { path: representativePath, contentType: "image/png" });
        }
      }

      if (partPairs.length > 0) {
        const pair = partPairs[0]!;
        const firstIds = dimmedPartIds[pair.firstPart] ?? [];
        const secondIds = dimmedPartIds[pair.secondPart] ?? [];
        const scenarios = [
          { id: "first-part-only", ids: firstIds },
          { id: "second-part-only", ids: secondIds },
          { id: "both-parts", ids: [...new Set([...firstIds, ...secondIds])].sort() },
        ];
        const pairModeMetrics: Record<string, unknown> = {
          neitherAltered: {
            mode: "B0",
            changedPixelsInOverlap: 0,
            meanAbsoluteRgbDifferenceInOverlap: 0,
            baselineRepeatNoise: compareAnatomyImages(baseline.image, baselineRepeat.image, pair.overlapMask),
          },
        };
        const pairCaptures: Record<string, Capture> = {};
        for (const scenario of scenarios) {
          const applyPairMode = async () => requestIntervention(candidate.page, {
            generation: baseline.inventory.generation,
            mode: "B1",
            selection: { kind: "renderable-ids", renderableIds: scenario.ids },
          });
          const firstApply = await applyPairMode();
          expect(firstApply.ok, `${state.id}/${scenario.id} pair intervention must be accepted`).toBe(true);
          const firstPartCapture = await capture(candidate.page, state.id, "B1", 30 + scenarios.indexOf(scenario) * 2, testInfo);
          pairCaptures[scenario.id] = firstPartCapture;
          const firstEvidence = assertInterventionAssignments(
            assignmentBaseline,
            firstPartCapture,
            scenario.ids,
            "B1",
            "bypass-rgb-transform",
            true,
          );
          const reset = await requestIntervention(candidate.page, {
            generation: baseline.inventory.generation,
            mode: "B0",
          });
          expect(reset.ok).toBe(true);
          const pairBaseline = await capture(candidate.page, state.id, "B0", 50 + scenarios.indexOf(scenario), testInfo);
          assertInterventionAssignments(assignmentBaseline, pairBaseline, [], "B0", "material-aware", true);
          assignmentBaseline = pairBaseline;
          const secondApply = await applyPairMode();
          expect(secondApply.ok).toBe(true);
          const secondPartCapture = await capture(candidate.page, state.id, "B1", 31 + scenarios.indexOf(scenario) * 2, testInfo);
          const secondEvidence = assertInterventionAssignments(
            assignmentBaseline,
            secondPartCapture,
            scenario.ids,
            "B1",
            "bypass-rgb-transform",
            true,
          );
          const repeatNoise = compareAnatomyImages(firstPartCapture.image, secondPartCapture.image);
          const overlapDifference = compareAnatomyImages(baseline.image, firstPartCapture.image, pair.overlapMask);
          pairModeMetrics[scenario.id] = {
            targetIds: scenario.ids,
            assignmentEvidence: firstEvidence,
            repeatedAssignmentEvidence: secondEvidence,
            repeatNoise,
            overlapDifference,
            fullFrameDifference: compareAnatomyImages(baseline.image, firstPartCapture.image),
            captures: [firstPartCapture.filename, secondPartCapture.filename],
          };
        }
        const pairReset = await requestIntervention(candidate.page, {
          generation: baseline.inventory.generation,
          mode: "B0",
        });
        expect(pairReset.ok).toBe(true);
        const pairRestored = await capture(candidate.page, state.id, "B0", 60, testInfo);
        expect(compareAnatomyImages(baseline.image, pairRestored.image).meanAbsoluteRgbDifference)
          .toBeLessThanOrEqual(baselineRepeatNoise.meanAbsoluteRgbDifference + 0.5);
        assertInterventionAssignments(assignmentBaseline, pairRestored, [], "B0", "material-aware", true);
        assignmentBaseline = pairRestored;
        pairModeMetrics.pairwiseNonAdditivity = comparePairwiseNonAdditivity(
          baseline,
          pairCaptures["first-part-only"]!,
          pairCaptures["second-part-only"]!,
          pairCaptures["both-parts"]!,
          pair.overlapMask,
        );
        pairwiseReports[state.id] = {
          state: state.id,
          firstPart: pair.firstPart,
          secondPart: pair.secondPart,
          firstPartRenderableIds: firstIds,
          secondPartRenderableIds: secondIds,
          overlapMask: summarizeMask(pair.overlapMask),
          overlapInterpretation: "Intersection of actual per-part visibility-exclusion response masks. This demonstrates that both tested part sets influence some measured output pixels; it is not an exact silhouette or an additive alpha decomposition.",
          shaderActivationEvidence: {
            outputGraphBuiltAssignmentCountForFullDimmedB1: (modeReports.B1 as {
              assignments: { outputGraphBuiltAssignmentCount: number };
            }).assignments.outputGraphBuiltAssignmentCount,
            scopedPairCopiesCarryB1Identity: true,
            reasonPerCopyGraphCountMayBeZero: "Three may reuse the already compiled B1 program for a scoped copy with the same material family and output-transform cache key; the experiment therefore checks B1 graph activation in the same state, the pair's actual output-copy identity/version, and repeated framebuffer captures.",
          },
          pairControls: pairModeMetrics,
          finalRestoration: compareAnatomyImages(baseline.image, pairRestored.image),
        };
      }

      const groupMasks = {
        dimmed: dimmedContribution.mask,
        highlighted: highlightedContribution.mask,
        unaffectedCandidate,
        bothGroupsInfluenceCandidate: groupIntersection,
      };
      if (state.id === "highlighted-front-standard") {
        const artifacts = [
          ["front-standard-dimmed-response-mask.png", dimmedContribution.mask],
          ["front-standard-highlighted-response-mask.png", highlightedContribution.mask],
          ["front-standard-unaffected-candidate-mask.png", unaffectedCandidate],
          ["front-standard-both-groups-influence-mask.png", groupIntersection],
        ] as const;
        for (const [filename, mask] of artifacts) {
          const pixels = new Uint8Array(mask.width * mask.height * 4);
          for (let index = 0; index < mask.pixels.length; index += 1) {
            const value = mask.pixels[index] ? 255 : 0;
            pixels[index * 4] = value;
            pixels[index * 4 + 1] = value;
            pixels[index * 4 + 2] = value;
            pixels[index * 4 + 3] = 255;
          }
          await writeEvidenceImage(candidate.page, testInfo, `masks/${filename}`, {
            width: mask.width,
            height: mask.height,
            channels: 4,
            pixels,
          }, true);
        }
        for (const mode of modes) {
          const modeCapture = modeCaptures[mode];
          if (!modeCapture) throw new Error(`${state.id}/${mode} representative capture is missing`);
          const heatmap = deriveAnatomyDifferenceHeatmap(baseline.image, modeCapture.image);
          const heatPixels = new Uint8Array(heatmap.pixels);
          await writeEvidenceImage(candidate.page, testInfo, `heatmaps/front-standard-${mode.toLowerCase()}-vs-b0.png`, {
            width: heatmap.width,
            height: heatmap.height,
            channels: heatmap.channels,
            pixels: heatPixels,
          }, true);
        }
      }

      const groundGlassBaseline = await captureGroundGlass(candidate.page);
      const groundGlassRepeat = await captureGroundGlass(candidate.page);
      expect(compareAnatomyImages(
        decodePlaywrightPng(groundGlassBaseline),
        decodePlaywrightPng(groundGlassRepeat),
      ).meanAbsoluteRgbDifference).toBeLessThanOrEqual(0.5);
      const webglVsB0 = compareAnatomyImages(webglCapture.image, baseline.image);
      const standardVsWebgl = compareAnatomyImages(webglCapture.image, standardWebgpuCapture.image);
      const standardVsB0 = compareAnatomyImages(standardWebgpuCapture.image, baseline.image);
      const baselineVsRepeat = baselineRepeatNoise;
      const reportMasks = {
        dimmedResponse: summarizeMask(groupMasks.dimmed),
        highlightedResponse: summarizeMask(groupMasks.highlighted),
        unaffectedBackgroundCandidate: summarizeMask(groupMasks.unaffectedCandidate),
        bothGroupsInfluenceCandidate: summarizeMask(groupMasks.bothGroupsInfluenceCandidate),
      };
      stateReports[state.id] = {
        mountedPresentation: classification,
        mountedDimmedMaterialAssignments: materialEvidenceForRenderableIds(
          baseline.inventory,
          classification.dimmedRenderableIds,
        ),
        mountedHighlightedMaterialAssignments: materialEvidenceForRenderableIds(
          baseline.inventory,
          classification.highlightedRenderableIds,
        ),
        sharedMaterialOwnershipBeforeIntervention: {
          sharedSourceMaterialIdsAcrossDimmedAndOtherRenderableGroups: sharedMaterialBaseline.sharedSourceMaterialIds,
          sharedOutputMaterialIdsAcrossDimmedAndOtherRenderableGroups: sharedMaterialBaseline.sharedOutputMaterialIds,
          sharedSourceCount: sharedMaterialBaseline.sharedSourceMaterialIds.length,
          sharedOutputCount: sharedMaterialBaseline.sharedOutputMaterialIds.length,
        },
        nativeBaseline: {
          captures: [baseline.filename, baselineRepeat.filename],
          repeatNoise: baselineVsRepeat,
          wholeFrameWebglDifference: webglVsB0,
          backgroundRepresentations: {
            webgl: webglCapture.inventory.background,
            nativeStandardWebgpu: standardWebgpuCapture.inventory.background,
            materialAwareB0: baseline.inventory.background,
            note: "The material-aware controller replaces scene.background with an explicit display-encoded backgroundNode; the fixed canvas patch separately checks observed output stability.",
          },
          nativeStandardWebgpu: {
            capture: standardWebgpuCapture.filename,
            wholeFrameWebglDifference: standardVsWebgl,
            wholeFrameDifferenceFromMaterialAwareB0: standardVsB0,
            dimmedResponseRegionVsWebgl: compareAnatomyImages(
              webglCapture.image,
              standardWebgpuCapture.image,
              dimmedContribution.mask,
            ),
            highlightedResponseRegionVsWebgl: compareAnatomyImages(
              webglCapture.image,
              standardWebgpuCapture.image,
              highlightedContribution.mask,
            ),
            unaffectedCandidateRegionVsWebgl: compareAnatomyImages(
              webglCapture.image,
              standardWebgpuCapture.image,
              unaffectedCandidate,
            ),
          },
          materialAwareB0: {
            wholeFrameWebglDifference: webglVsB0,
            dimmedResponseRegionVsWebgl: compareAnatomyImages(
              webglCapture.image,
              baseline.image,
              dimmedContribution.mask,
            ),
            highlightedResponseRegionVsWebgl: compareAnatomyImages(
              webglCapture.image,
              baseline.image,
              highlightedContribution.mask,
            ),
            unaffectedCandidateRegionVsWebgl: compareAnatomyImages(
              webglCapture.image,
              baseline.image,
              unaffectedCandidate,
            ),
          },
          masks: reportMasks,
          visibilityRestoration: {
            dimmed: dimmedContribution.restoration,
            highlighted: highlightedContribution.restoration,
            groupMaskInterpretation: "Observed visibility-response masks include occlusion, reveal, depth, blending and shadow effects; the unaffected complement is a background/unaffected candidate, not an exact semantic decomposition.",
          },
          dimmedPartCandidates: Object.entries(dimmedPartMasks).map(([part, mask]) => ({
            part,
            renderableIds: dimmedPartIds[part],
            responseMask: summarizeMask(mask),
          })),
          candidatePartIntersections: partPairs.map(({ firstPart, secondPart, overlapPixels, firstPixels, secondPixels, overlapMask }) => ({
            firstPart,
            secondPart,
            overlapPixels,
            firstPixels,
            secondPixels,
            mask: summarizeMask(overlapMask),
          })),
        visibilityConditions,
          fixedBackgroundPatch: compareAnatomyImages(
            baseline.image,
            baselineRepeat.image,
            rectMask(baseline.image.width, baseline.image.height, 0, 0, 32, 32),
          ),
          fixedBackgroundPatchVsWebgl: compareAnatomyImages(
            webglCapture.image,
            baseline.image,
            rectMask(baseline.image.width, baseline.image.height, 0, 0, 32, 32),
          ),
          groundGlass: {
            contentful: await candidate.page.getByTestId("ground-glass-rtt")
              .getAttribute("data-rtt-final-contentful"),
            repeatDifference: compareAnatomyImages(
              decodePlaywrightPng(groundGlassBaseline),
              decodePlaywrightPng(groundGlassRepeat),
            ),
          },
        },
        interventions: modeReports,
      };
    }

    const nativeAttributes = await readObserverAttributes(candidate.page);
    const qualification = {
      rendererFamily: nativeAttributes["data-observer-renderer-family"],
      executionBackend: nativeAttributes["data-observer-execution-backend"],
      adapterAvailability: nativeAttributes["data-observer-adapter-availability"],
      rendererAttempt: nativeAttributes["data-observer-renderer-attempt"],
      initializationAttempts: nativeAttributes["data-observer-webgpu-initialization-attempts"],
      initializationFailure: nativeAttributes["data-observer-renderer-failure-stage"] ?? null,
      applicationFallback: nativeAttributes["data-observer-application-fallback"],
      outputPolicy: nativeAttributes["data-observer-output-policy-installed"],
      outputPolicyStatus: nativeAttributes["data-observer-output-policy-status"],
      readiness: nativeAttributes["data-observer-output-policy-readiness"],
      hardwareAcceleration: "unconfirmed",
    };
    expect(qualification.rendererFamily).toBe("webgpu-renderer");
    expect(qualification.executionBackend).toBe("webgpu");
    expect(qualification.applicationFallback).toBe("none");
    const nativeStandardAttributes = await readObserverAttributes(standardWebgpu.page);
    expect(nativeStandardAttributes["data-observer-renderer-family"]).toBe("webgpu-renderer");
    expect(nativeStandardAttributes["data-observer-execution-backend"]).toBe("webgpu");
    expect(nativeStandardAttributes["data-observer-application-fallback"]).toBe("none");

    const mechanismContributionByMode = Object.fromEntries(["B1", "B2", "B3"].map((mode) => [
      mode,
      Object.fromEntries(priorityStates.map(({ id }) => {
        const state = stateReports[id] as {
          nativeBaseline: {
            materialAwareB0: { dimmedResponseRegionVsWebgl: ReturnType<typeof compareAnatomyImages> };
            repeatNoise: ReturnType<typeof compareAnatomyImages>;
          };
          interventions: Record<string, {
            webglReference: { dimmedResponse: ReturnType<typeof compareAnatomyImages> };
          }>;
        };
        const baselineMae = state.nativeBaseline.materialAwareB0.dimmedResponseRegionVsWebgl.meanAbsoluteRgbDifference;
        const interventionMae = state.interventions[mode]!.webglReference.dimmedResponse.meanAbsoluteRgbDifference;
        return [id, {
          baselineDimmedRegionMae: baselineMae,
          interventionDimmedRegionMae: interventionMae,
          maeReduction: baselineMae - interventionMae,
          repeatCaptureNoise: state.nativeBaseline.repeatNoise.meanAbsoluteRgbDifference,
        }];
      })),
    ]));
    const contributingModes = Object.entries(mechanismContributionByMode)
      .filter(([, measurements]) => Object.values(measurements as Record<string, { maeReduction: number; repeatCaptureNoise: number }>)
        .every(({ maeReduction, repeatCaptureNoise }) => maeReduction > repeatCaptureNoise + 0.5))
      .map(([mode]) => mode);
    const decision = contributingModes.length > 0 ? "D2" : "D3";

    const report: Record<string, unknown> = {
      schemaVersion: 1,
      audit: "view-camera-anatomy-dimmed-output-mechanism",
      decision,
      decisionBasis: {
        contributingModes,
        requiredConsistency: "A tested output intervention lowers dimmed-response-mask MAE against matched WebGL by more than repeat-capture noise plus 0.5 RGB levels in every priority state.",
        perStateDimmedRegionComparisons: mechanismContributionByMode,
        interpretation: decision === "D2"
          ? "At least one isolated output-stage intervention contributes consistently to the dimmed-region discrepancy, while the measured residual remains much larger than repeat noise. This does not establish a complete cause or authorize a correction/promotion."
          : "No tested output-stage intervention consistently lowers the dimmed-region discrepancy beyond repeat noise across all priority states.",
      },
      promotionBoundary: "Anatomy remains M2 — OPT-IN IMPLEMENTATION INCOMPLETE.",
      provenance: {
        measurementCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        workingTreeStatus: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
        baseCommit: "a4255e904ada29dad2c0ae640d582bb042e1ad7f",
        browserVersion: browser.version(),
        nodeVersion: process.version,
        operatingSystem: { platform: platform(), release: release(), architecture: arch() },
        threeRevision: REVISION,
        nativeQualification: qualification,
        viewport: [1440, 1000],
        devicePixelRatio: 1,
        cameraPosition: pose.position,
        orbitTarget: pose.target,
        priorityStates: priorityStates.map(({ id }) => id),
        repeatedCapturesPerModeAndState: 2,
      },
      interventionMatrix: {
        B0: "Unchanged material-aware output baseline.",
        B1: "Bypass custom per-material RGB tone-map and display-color conversion for dimmed targets only.",
        B2: "Bypass tone mapping for dimmed targets while retaining sRGB conversion.",
        B3: "Bypass sRGB conversion for dimmed targets while retaining authored tone-mapping behavior.",
        B4: "Bypass custom per-material RGB output transform for highlighted targets only.",
      },
      masks: {
        method: "Within-renderer B0 framebuffer differences from excluding current presentation-group renderable IDs, with an RGB per-channel threshold of 8.",
        limitation: "Masks are observed visibility responses, not exact silhouettes or additive color decomposition. The complement is an unaffected/background candidate.",
        bothGroupIntersectionMeaning: "A non-empty intersection means pixels changed when either group was excluded; it does not prove simultaneous visible-surface overlap.",
      },
      targetSelection: {
        source: "Mounted ConceptualCameraAnatomyPresentation resolved with the same resolveConceptualAnatomyPartState contract and joined to current visible renderable UUIDs.",
        frontStandardHighlightedCount: presentationForCapture(webglCaptures["highlighted-front-standard"]!).highlightedRenderableIds.length,
        frontStandardDimmedCount: presentationForCapture(webglCaptures["highlighted-front-standard"]!).dimmedRenderableIds.length,
        pairwiseExperimentsByPriorityState: pairwiseReports,
        pairwiseUntestedStates: priorityStates.filter(({ id }) => !pairwiseReports[id]).map(({ id }) => ({
          state: id,
          reason: "No pair of distinct dimmed semantic-part exclusion-response masks shared at least 32 observed pixels in both component masks and their intersection.",
        })),
      },
      states: stateReports,
      controls: {
        rejectedStaleGeneration: true,
        rejectedHighlightedIdsAsDimmedSelection: true,
        sourcePropertiesEqualAcrossModes: true,
        sourceAndOutputMaterialIdentitySeparated: true,
        highlightedAssignmentsPreservedForB1B2B3: true,
        nonTargetAssignmentsPreserved: true,
        alphaAndTransparencyPropertiesPreserved: true,
        outputGraphBuildCountAndMaterialVersionRecorded: true,
        visibilityRestorationAndResourceIdentityVerified: true,
        groundGlassRemainedContentful: true,
      },
      runtime: {
        webgl: await readObserverAttributes(webgl.page),
        nativeStandardWebgpu: nativeStandardAttributes,
        nativeMaterialAware: nativeAttributes,
      },
      remainingUnknowns: [
        "The screenshot is a browser-composited canvas capture; unchanged screenshot alpha does not qualify renderer-context premultiplication.",
        "A pixel-mask intersection records common measured response, not exact transparent surface overlap or additive layer contribution.",
        "Hardware acceleration is unconfirmed; native WebGPU execution is qualified by the mounted renderer family/backend and no-fallback evidence.",
      ],
      recommendation: decision === "D2"
        ? "Keep Anatomy M2. A later, separately reviewed proposal may test a narrow color-space/output-stage correction, but first measure the remaining dimmed error with a GPU blend-intermediate capture for the qualifying single-part and two-part visibility conditions. Do not start PR N from this evidence alone."
        : "Keep Anatomy M2 and investigate blend ordering, depth, lighting, or another renderer-stage mechanism before proposing an output-core change.",
    };

    const previousGeneration = Number(nativeAttributes["data-observer-renderer-generation"]);
    await candidate.page.evaluate(() => {
      (window as Window & { __anatomyInterventionSpaToken?: string }).__anatomyInterventionSpaToken = "same-document";
      const lifecycle = window as Window & { __outputPolicyLifecycleEvidence?: unknown[] };
      lifecycle.__outputPolicyLifecycleEvidence = [];
      window.addEventListener("vcs:observer-output-policy-lifecycle", (event) => {
        lifecycle.__outputPolicyLifecycleEvidence?.push((event as CustomEvent<unknown>).detail);
      }, { once: true });
    });
    await navigateWithinSimulator(candidate.page, "/simulator/free/view-camera-anatomy?rttDiagnostics=1");
    const observer = candidate.page.getByTestId("scene-canvas");
    await expect.poll(async () => Number(await observer.getAttribute("data-observer-renderer-generation")))
      .toBeGreaterThan(previousGeneration);
    await expect(observer).toHaveAttribute("data-observer-renderer-family", "webgl-renderer", { timeout: 90_000 });
    await expect(observer).not.toHaveAttribute("data-observer-anatomy-output-intervention-hook");
    await expect(observer).not.toHaveAttribute("data-observer-anatomy-output-intervention-mode");
    const sameDocument = await candidate.page.evaluate(() =>
      (window as Window & { __anatomyInterventionSpaToken?: string }).__anatomyInterventionSpaToken,
    );
    expect(sameDocument).toBe("same-document");

    const lifecycleEvidence = await candidate.page.evaluate(() => new Promise<unknown>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        resolve((window as Window & { __outputPolicyLifecycleEvidence?: unknown[] })
          .__outputPolicyLifecycleEvidence?.[0] ?? null);
      }));
    }));
    expect(lifecycleEvidence, "SPA route teardown must report material-aware generation cleanup").not.toBeNull();
    expect(lifecycleEvidence).toMatchObject({
      rendererGeneration: candidate.initial.generation,
      managedMaterialCount: 0,
      attachmentCount: 0,
    });
    expect(Number((lifecycleEvidence as Record<string, unknown>).disposedNodeMaterials),
      "The experimental generation must dispose its owned NodeMaterial outputs at SPA teardown").toBeGreaterThan(0);

    const noResponse = await observer.evaluate((element, resultEventName) => new Promise<boolean>((resolve) => {
      let responded = false;
      const onResult = () => { responded = true; };
      element.addEventListener(resultEventName, onResult);
      element.dispatchEvent(new CustomEvent("vcs:observer-verification:anatomy-output-intervention", {
        detail: {
          requestId: "normal-anatomy-route-must-not-intervene",
          generation: Number(element.getAttribute("data-observer-renderer-generation")),
          mode: "B1",
        },
      }));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        element.removeEventListener(resultEventName, onResult);
        resolve(responded);
      }));
    }), ANATOMY_OUTPUT_INTERVENTION_RESULT_EVENT);
    expect(noResponse, "The ordinary SPA Anatomy route must not retain the experimental intervention listener").toBe(false);

    report.spaTeardown = {
      sameDocumentTokenPreserved: sameDocument === "same-document",
      previousRendererGeneration: previousGeneration,
      nextRendererGeneration: Number(await observer.getAttribute("data-observer-renderer-generation")),
      interventionHookRemoved: await observer.getAttribute("data-observer-anatomy-output-intervention-hook") === null,
      interventionModeRemoved: await observer.getAttribute("data-observer-anatomy-output-intervention-mode") === null,
      normalRouteIgnoredInterventionEvent: !noResponse,
      materialAwareLifecycleEvent: lifecycleEvidence,
      ownedNodeMaterialsDisposed: Number((lifecycleEvidence as Record<string, unknown>).disposedNodeMaterials),
      remainingManagedMaterials: (lifecycleEvidence as Record<string, unknown>).managedMaterialCount,
      remainingAttachments: (lifecycleEvidence as Record<string, unknown>).attachmentCount,
    };
    expect(report).toMatchObject({
      schemaVersion: 1,
      audit: "view-camera-anatomy-dimmed-output-mechanism",
      promotionBoundary: "Anatomy remains M2 — OPT-IN IMPLEMENTATION INCOMPLETE.",
      spaTeardown: {
        sameDocumentTokenPreserved: true,
        interventionHookRemoved: true,
        interventionModeRemoved: true,
        normalRouteIgnoredInterventionEvent: true,
        remainingManagedMaterials: 0,
        remainingAttachments: 0,
      },
    });
    expect(Object.keys(stateReports).sort()).toEqual(priorityStates.map(({ id }) => id).sort());
    const reportPath = testInfo.outputPath("report.json");
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach("anatomy-dimmed-output-mechanism-report.json", {
      path: reportPath,
      contentType: "application/json",
    });
  } finally {
    await webgl.context.close();
    await standardWebgpu.context.close();
    await candidate.context.close();
  }
});
