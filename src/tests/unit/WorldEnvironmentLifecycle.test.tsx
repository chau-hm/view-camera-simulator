import * as THREE from "three";
import { act, cleanup, render } from "@testing-library/react";
import { useThree } from "@react-three/fiber";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as observerEnvironmentRig from "../../render/observerWorldEnvironmentRig";
import { WorldEnvironment } from "../../render/WorldEnvironment";
import {
  ObserverWorldEnvironmentStatusOwner,
  type ObserverWorldEnvironmentRealizationToken,
  type ObserverWorldEnvironmentStatus,
} from "../../render/observerWorldEnvironmentStatus";
import * as worldEnvironmentRig from "../../render/worldEnvironmentRig";
import type { WorldEnvironmentRig } from "../../render/worldEnvironmentRig";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";

vi.mock("@react-three/fiber", () => ({ useThree: vi.fn() }));

const baseEnvironment = resolveSceneWorldIllumination("architecture-rise").environment;
if (!baseEnvironment) throw new Error("Expected the Architecture Rise environment recipe");

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const makeRig = (): WorldEnvironmentRig => {
  const texture = new THREE.Texture();
  return {
    renderTarget: { texture, dispose: vi.fn() },
    environmentTexture: texture,
    previousEnvironment: null,
    previousEnvironmentIntensity: 1,
    appliedIntensity: 0.5,
    disposed: false,
  };
};

const createRigMock = () => vi.mocked(observerEnvironmentRig.createObserverWorldEnvironmentRig);
const disposeRigMock = () => vi.mocked(worldEnvironmentRig.disposeWorldEnvironmentRig);

describe("Observer world environment realization lifecycle", () => {
  const scene = new THREE.Scene();
  const renderer = {};

  beforeEach(() => {
    vi.mocked(useThree).mockReturnValue({ gl: renderer, scene } as never);
    vi.spyOn(observerEnvironmentRig, "createObserverWorldEnvironmentRig");
    vi.spyOn(worldEnvironmentRig, "disposeWorldEnvironmentRig")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const createStatusHarness = (initialGeneration: number) => {
    const owner = new ObserverWorldEnvironmentStatusOwner();
    let currentGeneration = initialGeneration;
    const reports: Array<{
      generation: number;
      realization: ObserverWorldEnvironmentRealizationToken | null;
      status: ObserverWorldEnvironmentStatus;
    }> = [];
    const createRealizationToken = (generation: number) => owner.createRealizationToken(generation);
    const onStatusChange = (
      generation: number,
      realization: ObserverWorldEnvironmentRealizationToken,
      status: ObserverWorldEnvironmentStatus,
    ) => {
      if (owner.accepts(currentGeneration, generation, realization, status)) {
        reports.push({ generation, realization, status });
      }
    };
    return {
      owner,
      reports,
      createRealizationToken,
      onStatusChange,
      setCurrentGeneration: (generation: number) => { currentGeneration = generation; },
    };
  };

  const renderEnvironment = (
    environment: typeof baseEnvironment,
    generation: number,
    createRealizationToken: (generation: number) => ObserverWorldEnvironmentRealizationToken,
    onStatusChange: (
      generation: number,
      realization: ObserverWorldEnvironmentRealizationToken,
      status: ObserverWorldEnvironmentStatus,
    ) => void,
  ) => render(
    <WorldEnvironment
      environment={environment}
      mountGeneration={generation}
      createRealizationToken={createRealizationToken}
      onStatusChange={onStatusChange}
    />,
  );

  it("disposes a late successful realization after removal without reporting it active", async () => {
    const pending = deferred<WorldEnvironmentRig | null>();
    const rig = makeRig();
    createRigMock().mockReturnValue(pending.promise);
    const harness = createStatusHarness(4);
    const view = renderEnvironment(
      baseEnvironment,
      4,
      harness.createRealizationToken,
      harness.onStatusChange,
    );

    expect(harness.reports.map(({ status }) => status)).toEqual(["pending"]);
    const realization = harness.reports[0].realization;
    expect(realization).not.toBeNull();
    act(() => view.unmount());

    await act(async () => {
      pending.resolve(rig);
      await pending.promise;
    });

    expect(harness.reports.map(({ status }) => status)).toEqual(["pending"]);
    expect(disposeRigMock()).toHaveBeenCalledWith(scene, rig);
  });

  it("rejects same-generation reports from a replaced realization while B remains active", async () => {
    const pendingA = deferred<WorldEnvironmentRig | null>();
    const pendingB = deferred<WorldEnvironmentRig | null>();
    const rigA = makeRig();
    const rigB = makeRig();
    createRigMock()
      .mockReturnValueOnce(pendingA.promise)
      .mockReturnValueOnce(pendingB.promise);
    const harness = createStatusHarness(7);
    const environmentA = { ...baseEnvironment, id: "architecture-rise-environment-a" };
    const environmentB = { ...baseEnvironment, id: "architecture-rise-environment-b" };
    const view = renderEnvironment(
      environmentA,
      7,
      harness.createRealizationToken,
      harness.onStatusChange,
    );
    const realizationA = harness.reports[0].realization;
    if (!realizationA) throw new Error("Expected realization A token");

    view.rerender(
      <WorldEnvironment
        environment={environmentB}
        mountGeneration={7}
        createRealizationToken={harness.createRealizationToken}
        onStatusChange={harness.onStatusChange}
      />,
    );
    const realizationB = harness.reports[1].realization;
    if (!realizationB) throw new Error("Expected realization B token");
    expect(realizationB.attempt).toBeGreaterThan(realizationA.attempt);

    await act(async () => {
      pendingA.resolve(rigA);
      await pendingA.promise;
    });
    harness.onStatusChange(7, realizationA, "active");
    harness.onStatusChange(7, realizationA, "pending");

    await act(async () => {
      pendingB.resolve(rigB);
      await pendingB.promise;
    });

    expect(harness.reports.map(({ status, realization }) => [status, realization])).toEqual([
      ["pending", realizationA],
      ["pending", realizationB],
      ["active", realizationB],
    ]);
    expect(disposeRigMock()).toHaveBeenCalledWith(scene, rigA);
    act(() => view.unmount());
  });

  it("preserves a current failure when the failed component is cleaned up", async () => {
    const pending = deferred<WorldEnvironmentRig | null>();
    const failure = new Error("environment realization failed");
    createRigMock().mockReturnValue(pending.promise);
    const harness = createStatusHarness(2);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = renderEnvironment(
      baseEnvironment,
      2,
      harness.createRealizationToken,
      harness.onStatusChange,
    );

    await act(async () => {
      pending.reject(failure);
      await pending.promise.catch(() => undefined);
    });
    expect(harness.reports.map(({ status }) => status)).toEqual(["pending", "failed"]);

    act(() => view.unmount());
    expect(harness.reports.map(({ status }) => status)).toEqual(["pending", "failed"]);
    expect(disposeRigMock()).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Observer world environment initialization failed",
      failure,
    );
  });

  it("rejects completion from the prior renderer generation after a new generation starts", async () => {
    const pendingA = deferred<WorldEnvironmentRig | null>();
    const pendingB = deferred<WorldEnvironmentRig | null>();
    const rigA = makeRig();
    const rigB = makeRig();
    createRigMock()
      .mockReturnValueOnce(pendingA.promise)
      .mockReturnValueOnce(pendingB.promise);
    const harness = createStatusHarness(10);
    const view = renderEnvironment(
      baseEnvironment,
      10,
      harness.createRealizationToken,
      harness.onStatusChange,
    );
    const realizationA = harness.reports[0].realization;

    harness.setCurrentGeneration(11);
    view.rerender(
      <WorldEnvironment
        environment={baseEnvironment}
        mountGeneration={11}
        createRealizationToken={harness.createRealizationToken}
        onStatusChange={harness.onStatusChange}
      />,
    );
    const realizationB = harness.reports[1].realization;
    if (!realizationA || !realizationB) throw new Error("Expected both realization tokens");

    await act(async () => {
      pendingA.resolve(rigA);
      await pendingA.promise;
    });
    harness.onStatusChange(10, realizationA, "active");
    await act(async () => {
      pendingB.resolve(rigB);
      await pendingB.promise;
    });

    expect(harness.reports.map(({ generation, status }) => [generation, status])).toEqual([
      [10, "pending"],
      [11, "pending"],
      [11, "active"],
    ]);
    expect(disposeRigMock()).toHaveBeenCalledWith(scene, rigA);
    act(() => view.unmount());
  });

  it("does not recreate PMREM when the host rerenders with unchanged realization inputs", () => {
    const rig = makeRig();
    createRigMock().mockReturnValue(rig);
    const harness = createStatusHarness(5);
    const view = renderEnvironment(
      baseEnvironment,
      5,
      harness.createRealizationToken,
      harness.onStatusChange,
    );
    view.rerender(
      <WorldEnvironment
        environment={baseEnvironment}
        mountGeneration={5}
        createRealizationToken={harness.createRealizationToken}
        onStatusChange={harness.onStatusChange}
      />,
    );

    expect(createRigMock()).toHaveBeenCalledTimes(1);
    expect(harness.reports.map(({ status }) => status)).toEqual(["pending", "active"]);
    act(() => view.unmount());
  });
});

describe("Observer world environment status ownership", () => {
  it("rejects callbacks from removed and replaced attempts, including stale pending reports", () => {
    const owner = new ObserverWorldEnvironmentStatusOwner();
    const realizationA = owner.createRealizationToken(3);
    expect(owner.accepts(3, 3, realizationA, "pending")).toBe(true);
    expect(owner.accepts(3, 3, realizationA, "active")).toBe(true);
    expect(owner.accepts(3, 3, null, "not-configured")).toBe(true);

    const realizationB = owner.createRealizationToken(3);
    expect(owner.accepts(3, 3, realizationB, "pending")).toBe(true);
    expect(owner.accepts(3, 3, realizationA, "active")).toBe(false);
    expect(owner.accepts(3, 3, realizationA, "failed")).toBe(false);
    expect(owner.accepts(3, 3, realizationA, "pending")).toBe(false);
    expect(owner.accepts(3, 3, realizationB, "active")).toBe(true);
    expect(owner.accepts(4, 3, realizationB, "failed")).toBe(false);
  });
});
