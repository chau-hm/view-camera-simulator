import * as THREE from "three";
import { createFixtureHarness } from "./fixture-core.js";
import { createStockMaterial, describeMaterial } from "./materials.js";

const query = new URLSearchParams(location.search);
const backend = query.get("backend") ?? "webgl";
const family = query.get("family") ?? "standard";

const start = async () => {
  window.__threeRevision = THREE.REVISION;
  window.__fixtureErrors = [];
  window.__fixtureDrawCalls = [];
  window.addEventListener("error", (event) => window.__fixtureErrors.push(String(event.message)));
  window.addEventListener("unhandledrejection", (event) => window.__fixtureErrors.push(String(event.reason)));
  const harness = await createFixtureHarness({
    backend,
    output: "stock",
    family,
    createMaterial: createStockMaterial,
    describeMaterial,
    createBackgroundNode: () => null,
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
