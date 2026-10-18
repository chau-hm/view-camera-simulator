import * as THREE from "three";
import { createFixtureHarness } from "./fixture-core.js";
import { createAdapterMaterial, createDisplaySpaceBackgroundNode } from "./adapter-materials.js";
import { describeMaterial } from "./materials.js";

const query = new URLSearchParams(location.search);
const backend = query.get("backend") ?? "webgpu";
const family = query.get("family") ?? "standard";

const start = async () => {
  if (backend !== "webgpu") throw new Error("The project-specific adapter fixture requires WebGPURenderer");
  window.__threeRevision = THREE.REVISION;
  window.__fixtureErrors = [];
  window.__fixtureDrawCalls = [];
  window.addEventListener("error", (event) => window.__fixtureErrors.push(String(event.message)));
  window.addEventListener("unhandledrejection", (event) => window.__fixtureErrors.push(String(event.reason)));
  const harness = await createFixtureHarness({
    backend,
    output: "material-aware",
    family,
    createMaterial: createAdapterMaterial,
    describeMaterial,
    createBackgroundNode: createDisplaySpaceBackgroundNode,
  });
  window.__runCondition = harness.runCondition;
  window.__disposeFixture = harness.dispose;
  window.__initialRenderer = harness.initialRenderer;
  document.documentElement.dataset.fixtureState = "ready";
};

start().catch((error) => {
  window.__fixtureErrors = [error instanceof Error ? `${error.name}: ${error.message}` : String(error)];
  document.documentElement.dataset.fixtureState = "error";
});
