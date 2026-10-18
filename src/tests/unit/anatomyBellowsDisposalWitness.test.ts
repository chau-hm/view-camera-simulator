import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import {
  observeAnatomyBellowsDisposals,
  qualifyAnatomyBellowsDisposalWitness,
  type AnatomyBellowsDisposalWitnessHandle,
  type AnatomyBellowsDisposalWitnessRecord,
} from "../../render/backend/anatomyBellowsDisposalWitness";

const handles: AnatomyBellowsDisposalWitnessHandle[] = [];

afterEach(() => {
  handles.splice(0).forEach((handle) => handle.clear());
});

const makeWitnessScenario = (backend: "webgl2" | "webgpu") => {
  const source = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BufferGeometry();
  const texture = new THREE.Texture();
  const output = new THREE.MeshStandardMaterial({ opacity: 0.5, transparent: true });
  const record: AnatomyBellowsDisposalWitnessRecord = {
    token: `witness-${backend}`,
    backend,
    rendererGeneration: 7,
    transactionId: "transaction-1",
    renderableId: "bellows-1",
    sourceMaterialId: source.uuid,
    baselineOutputMaterialId: "baseline-output",
    activeOutputMaterialId: output.uuid,
    outputOwnerKind: backend === "webgl2" ? "probe-diagnostic-clone" : "observer-controller",
    outputOwnerToken: backend === "webgl2" ? "transaction-1" : "controller-owner-1",
    outputTrackerToken: backend === "webgl2" ? null : "tracker-1",
    activeOutputOpacity: 0.5,
    ownedOutputDisposeEventCount: 0,
    nativeOverrideRegistrationReleaseCount: 0,
    interventionCleanupStarted: false,
    interventionCleanupCompleted: false,
    borrowedResources: [
      { kind: "source-material", identity: source.uuid, disposeEventCount: 0, disposeEventsDuringInterventionCleanup: 0 },
      { kind: "geometry", identity: geometry.uuid, disposeEventCount: 0, disposeEventsDuringInterventionCleanup: 0 },
      { kind: "texture", identity: texture.uuid, disposeEventCount: 0, disposeEventsDuringInterventionCleanup: 0 },
    ],
  };
  const handle = observeAnatomyBellowsDisposals(record, output, [
    { resource: source, witness: record.borrowedResources[0]! },
    { resource: geometry, witness: record.borrowedResources[1]! },
    { resource: texture, witness: record.borrowedResources[2]! },
  ]);
  handles.push(handle);
  return { source, geometry, texture, output, record, handle };
};

describe("M-INV9 exact Anatomy Bellows disposal witness", () => {
  it("fails when retirement removes probe listeners but omits WebGL clone disposal", () => {
    const scenario = makeWitnessScenario("webgl2");
    // Model the missing cleanup call: the hook can disappear while the clone emits no dispose event.
    scenario.handle.markInterventionCleanupStarted();
    scenario.handle.markInterventionCleanupCompleted();
    scenario.handle.clear();
    expect(qualifyAnatomyBellowsDisposalWitness(scenario.record)).toMatchObject({
      ownedOutputDisposedExactlyOnce: false,
      borrowedResourcesUndisposedByIntervention: true,
      qualified: false,
    });
    scenario.output.dispose();
  });

  it("does not treat native override-registration release as output-material disposal", () => {
    const scenario = makeWitnessScenario("webgpu");
    scenario.handle.markInterventionCleanupStarted();
    scenario.handle.markNativeOverrideRegistrationReleased();
    scenario.handle.markInterventionCleanupCompleted();
    expect(qualifyAnatomyBellowsDisposalWitness(scenario.record)).toMatchObject({
      ownedOutputDisposedExactlyOnce: false,
      nativeRegistrationReleasedExactlyOnce: true,
      borrowedResourcesUndisposedByIntervention: true,
      qualified: false,
    });
    scenario.output.dispose();
  });

  it("does not let an unrelated material disposal satisfy the selected O1 witness", () => {
    const scenario = makeWitnessScenario("webgl2");
    scenario.handle.markInterventionCleanupStarted();
    scenario.handle.markInterventionCleanupCompleted();
    const unrelated = new THREE.MeshBasicMaterial();
    unrelated.dispose();
    expect(scenario.record.ownedOutputDisposeEventCount).toBe(0);
    expect(qualifyAnatomyBellowsDisposalWitness(scenario.record).qualified).toBe(false);
    unrelated.dispose();
    scenario.output.dispose();
  });

  it("rejects borrowed source, geometry, or texture disposal even when O1 is disposed", () => {
    const scenario = makeWitnessScenario("webgpu");
    scenario.handle.markInterventionCleanupStarted();
    scenario.handle.markNativeOverrideRegistrationReleased();
    scenario.output.dispose();
    scenario.source.dispose();
    scenario.geometry.dispose();
    scenario.texture.dispose();
    scenario.handle.markInterventionCleanupCompleted();
    expect(scenario.record.borrowedResources.map((resource) => resource.disposeEventCount)).toEqual([1, 1, 1]);
    expect(qualifyAnatomyBellowsDisposalWitness(scenario.record)).toMatchObject({
      ownedOutputDisposedExactlyOnce: true,
      nativeRegistrationReleasedExactlyOnce: true,
      borrowedResourcesUndisposedByIntervention: false,
      qualified: false,
    });
  });

  it("rejects duplicate disposal of the exact owned material", () => {
    const scenario = makeWitnessScenario("webgl2");
    scenario.handle.markInterventionCleanupStarted();
    scenario.handle.markInterventionCleanupCompleted();
    scenario.output.dispose();
    scenario.output.dispose();
    expect(scenario.record.ownedOutputDisposeEventCount).toBe(2);
    expect(qualifyAnatomyBellowsDisposalWitness(scenario.record)).toMatchObject({
      ownedOutputDisposedExactlyOnce: false,
      qualified: false,
    });
  });

  it("qualifies the exact native output disposal independently from registration release", () => {
    const scenario = makeWitnessScenario("webgpu");
    scenario.handle.markInterventionCleanupStarted();
    scenario.handle.markNativeOverrideRegistrationReleased();
    scenario.output.dispose();
    scenario.handle.markInterventionCleanupCompleted();
    expect(qualifyAnatomyBellowsDisposalWitness(scenario.record)).toMatchObject({
      ownedOutputDisposedExactlyOnce: true,
      nativeRegistrationReleasedExactlyOnce: true,
      borrowedResourcesUndisposedByIntervention: true,
      qualified: true,
    });
  });
});
