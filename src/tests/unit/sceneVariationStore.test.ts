import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { getSceneById } from "../../scenes/definitions";
import { useAppStore } from "../../state/appStore";
import type { ParsedSceneSeed } from "../../app/sceneVariationUrl";

const capability = { enabled: true as const, schemaVersion: 1 };
const missingSeed: ParsedSceneSeed = { kind: "missing" };

const resolveVariant = (options: {
  sceneId?: string;
  mode?: "free" | "guided";
  routeKey?: string;
  seed?: ParsedSceneSeed;
  createSeed?: () => number;
}) => useAppStore.getState().resolveSceneVariantRoute({
  mode: options.mode ?? "free",
  sceneId: options.sceneId ?? "interior-corner",
  capability,
  routeKey: options.routeKey ?? "location-a",
  seed: options.seed ?? missingSeed,
  createSeed: options.createSeed,
});

describe("scene variation store lifecycle", () => {
  afterEach(() => useAppStore.getState().resetCamera());

  it("establishes one implicit Free Mode seed and does not reroll route-effect repeats", () => {
    const createSeed = vi.fn(() => 284719);
    const first = resolveVariant({ createSeed });
    const repeat = resolveVariant({ createSeed });
    expect(first.identity).toMatchObject({
      sceneId: "interior-corner",
      seed: 284719,
      schemaVersion: 1,
    });
    expect(repeat.identity).toBe(first.identity);
    expect(createSeed).toHaveBeenCalledTimes(1);
  });

  it("keeps an explicit seed authoritative", () => {
    const createSeed = vi.fn(() => 284719);
    const result = resolveVariant({
      seed: { kind: "valid", seed: 0 },
      createSeed,
    });
    expect(result.identity).toEqual({
      sceneId: "interior-corner",
      seed: 0,
      schemaVersion: 1,
    });
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("updates only variant state when a seeded URL changes", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "interior-corner" });
    store.setRise(18);
    store.setTilt(2.5);
    store.setFocusDistance(1600);
    store.setAperture(16);
    const before = useAppStore.getState();
    const routeKey = before.lastInitializedRouteKey;

    resolveVariant({
      routeKey: "location-b",
      seed: { kind: "valid", seed: 99 },
    });

    const after = useAppStore.getState();
    expect(after.sceneVariantIdentity).toEqual({
      sceneId: "interior-corner",
      seed: 99,
      schemaVersion: 1,
    });
    expect(after.camera).toEqual(before.camera);
    expect(after.lastInitializedRouteKey).toBe(routeKey);
    expect("sceneVariantIdentity" in after.camera).toBe(false);
    const scene = getSceneById("interior-corner");
    if (!scene) throw new Error("Interior Corner scene missing");
    expect(deriveOpticsState(after.camera, scene)).toEqual(
      deriveOpticsState(before.camera, scene),
    );
  });

  it("does not request more randomness during camera control or optics updates", () => {
    const createSeed = vi.fn(() => 17);
    resolveVariant({ createSeed });
    const identity = useAppStore.getState().sceneVariantIdentity;
    const store = useAppStore.getState();
    store.setFocusDistance(1450);
    store.setAperture(8);
    store.setRise(12);
    store.setTilt(2);
    const scene = getSceneById("interior-corner");
    if (!scene) throw new Error("Interior Corner scene missing");
    deriveOpticsState(useAppStore.getState().camera, scene);

    expect(createSeed).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().sceneVariantIdentity).toBe(identity);
  });

  it("preserves identity across Reset Movements and task restart", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "interior-corner" });
    resolveVariant({ seed: { kind: "valid", seed: 123 } });
    store.setRise(24);
    store.resetMovements();
    expect(useAppStore.getState().sceneVariantIdentity?.seed).toBe(123);

    store.initializeSimulatorRoute({
      mode: "guided",
      sceneId: "interior-corner",
      taskId: "interior-corner-compose-01",
      lessonEntry: true,
    });
    resolveVariant({ mode: "guided", routeKey: "guided-entry" });
    const identityAfterGuidedEntry = useAppStore.getState().sceneVariantIdentity;
    store.restartTask();
    expect(useAppStore.getState().sceneVariantIdentity).toBe(identityAfterGuidedEntry);
  });

  it("clears variant state in Guided Mode without consuming entropy", () => {
    resolveVariant({ seed: { kind: "valid", seed: 30 } });
    const createSeed = vi.fn(() => 40);
    const result = resolveVariant({ mode: "guided", createSeed, routeKey: "guided" });
    expect(result).toEqual({ status: "disabled", identity: null });
    expect(useAppStore.getState().sceneVariantIdentity).toBeNull();
    expect(createSeed).not.toHaveBeenCalled();
  });

  it("does not carry an implicit seed to a different scene", () => {
    resolveVariant({ createSeed: () => 11 });
    const next = resolveVariant({
      sceneId: "architecture-rise",
      routeKey: "different-scene-entry",
      createSeed: () => 22,
    });
    expect(next.identity).toEqual({
      sceneId: "architecture-rise",
      seed: 22,
      schemaVersion: 1,
    });
  });

  it("leaves camera route initialization idempotent when only the seed changes", () => {
    const store = useAppStore.getState();
    store.initializeSimulatorRoute({ mode: "free", sceneId: "interior-corner" });
    store.setRise(16);
    const before = useAppStore.getState();
    resolveVariant({ seed: { kind: "valid", seed: 8 } });
    store.initializeSimulatorRoute({ mode: "free", sceneId: "interior-corner" });
    const after = useAppStore.getState();
    expect(after.camera.frontRiseMm).toBe(before.camera.frontRiseMm);
    expect(after.lastInitializedRouteKey).toBe(before.lastInitializedRouteKey);
    expect(after.sceneVariantIdentity?.seed).toBe(8);
  });

  it("rejects unsupported capability versions without activating or generating a seed", () => {
    const createSeed = vi.fn(() => 30);
    const result = useAppStore.getState().resolveSceneVariantRoute({
      mode: "free",
      sceneId: "interior-corner",
      capability: { enabled: true, schemaVersion: 2 },
      routeKey: "future-version",
      seed: { kind: "valid", seed: 19 },
      createSeed,
    });
    expect(result).toEqual({ status: "unsupported-schema", identity: null });
    expect(useAppStore.getState().sceneVariantIdentity).toBeNull();
    expect(createSeed).not.toHaveBeenCalled();
  });
});
