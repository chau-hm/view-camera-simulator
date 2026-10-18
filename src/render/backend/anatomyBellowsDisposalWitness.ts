import type * as THREE from "three";

export const ANATOMY_BELLOWS_DISPOSAL_WITNESS_WINDOW_KEY = "__vcsMInv9BellowsDisposalWitnesses";

export type AnatomyBellowsBorrowedDisposalWitness = {
  kind: "source-material" | "geometry" | "texture";
  identity: string;
  disposeEventCount: number;
  disposeEventsDuringInterventionCleanup: number;
};

/** Primitive-only evidence retained after the Anatomy probe unmounts. */
export type AnatomyBellowsDisposalWitnessRecord = {
  token: string;
  backend: "webgl2" | "webgpu";
  rendererGeneration: number;
  transactionId: string;
  renderableId: string;
  sourceMaterialId: string;
  baselineOutputMaterialId: string;
  activeOutputMaterialId: string;
  outputOwnerKind: "probe-diagnostic-clone" | "observer-controller";
  outputOwnerToken: string | null;
  outputTrackerToken: string | null;
  activeOutputOpacity: number;
  ownedOutputDisposeEventCount: number;
  nativeOverrideRegistrationReleaseCount: number;
  interventionCleanupStarted: boolean;
  interventionCleanupCompleted: boolean;
  borrowedResources: AnatomyBellowsBorrowedDisposalWitness[];
};

type DisposeObservable = {
  addEventListener: (type: "dispose", listener: (event: { type: string }) => void) => void;
  removeEventListener: (type: "dispose", listener: (event: { type: string }) => void) => void;
};

type DisposableResource = THREE.Material | THREE.BufferGeometry | THREE.Texture;

type DisposalSubscription = Readonly<{
  resource: WeakRef<DisposeObservable>;
  listener: (event: { type: string }) => void;
}>;

export type AnatomyBellowsDisposalWitnessHandle = Readonly<{
  markInterventionCleanupStarted: () => void;
  markInterventionCleanupCompleted: () => void;
  markNativeOverrideRegistrationReleased: () => void;
  clear: () => void;
}>;

/** Observe actual Three.js dispose events without retaining the resource objects. */
export const observeAnatomyBellowsDisposals = (
  record: AnatomyBellowsDisposalWitnessRecord,
  ownedOutput: THREE.Material,
  borrowed: readonly Readonly<{
    resource: DisposableResource;
    witness: AnatomyBellowsBorrowedDisposalWitness;
  }>[],
): AnatomyBellowsDisposalWitnessHandle => {
  const subscriptions: DisposalSubscription[] = [];
  let borrowedDisposeCountsAtCleanupStart: number[] | null = null;
  let cleared = false;

  const subscribe = (resource: DisposableResource, onDispose: () => void) => {
    const observable = resource as unknown as DisposeObservable;
    const weakResource = new WeakRef(observable);
    const listener = () => {
      onDispose();
    };
    observable.addEventListener("dispose", listener);
    subscriptions.push({ resource: weakResource, listener });
  };

  subscribe(ownedOutput, () => { record.ownedOutputDisposeEventCount += 1; });
  borrowed.forEach(({ resource, witness }) => {
    subscribe(resource, () => { witness.disposeEventCount += 1; });
  });

  return {
    markInterventionCleanupStarted: () => {
      if (borrowedDisposeCountsAtCleanupStart !== null) return;
      borrowedDisposeCountsAtCleanupStart = record.borrowedResources.map((resource) => resource.disposeEventCount);
      record.interventionCleanupStarted = true;
    },
    markInterventionCleanupCompleted: () => {
      if (borrowedDisposeCountsAtCleanupStart === null || record.interventionCleanupCompleted) return;
      record.borrowedResources.forEach((resource, index) => {
        resource.disposeEventsDuringInterventionCleanup = resource.disposeEventCount -
          (borrowedDisposeCountsAtCleanupStart?.[index] ?? resource.disposeEventCount);
      });
      record.interventionCleanupCompleted = true;
    },
    markNativeOverrideRegistrationReleased: () => {
      record.nativeOverrideRegistrationReleaseCount += 1;
    },
    clear: () => {
      if (cleared) return;
      cleared = true;
      subscriptions.forEach(({ resource, listener }) => {
        resource.deref()?.removeEventListener("dispose", listener);
      });
      subscriptions.length = 0;
    },
  };
};

export const qualifyAnatomyBellowsDisposalWitness = (
  record: AnatomyBellowsDisposalWitnessRecord,
): Readonly<{
  ownedOutputDisposedExactlyOnce: boolean;
  nativeRegistrationReleasedExactlyOnce: boolean;
  borrowedResourcesUndisposedByIntervention: boolean;
  qualified: boolean;
}> => {
  const ownedOutputDisposedExactlyOnce = record.ownedOutputDisposeEventCount === 1;
  const nativeRegistrationReleasedExactlyOnce = record.backend === "webgl2"
    ? record.nativeOverrideRegistrationReleaseCount === 0
    : record.nativeOverrideRegistrationReleaseCount === 1;
  const borrowedResourcesUndisposedByIntervention = record.interventionCleanupCompleted &&
    record.borrowedResources.every((resource) => resource.disposeEventsDuringInterventionCleanup === 0);
  return {
    ownedOutputDisposedExactlyOnce,
    nativeRegistrationReleasedExactlyOnce,
    borrowedResourcesUndisposedByIntervention,
    qualified: ownedOutputDisposedExactlyOnce && nativeRegistrationReleasedExactlyOnce &&
      borrowedResourcesUndisposedByIntervention,
  };
};
