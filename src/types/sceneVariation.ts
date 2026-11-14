export type SceneVariantIdentity = Readonly<{
  sceneId: string;
  seed: number;
  schemaVersion: number;
}>;

export type SceneVariationDomain = "materials" | "props" | "layout" | "lighting";

export type SceneRandomStream = Readonly<{
  /** Stable unsigned 32-bit draw. */
  nextUint32: () => number;
  /** Float in the half-open interval [0, 1). */
  nextFloat: () => number;
  /** Integer in the inclusive interval [min, max]. */
  nextInt: (min: number, max: number) => number;
  /** Number in the half-open interval [min, max); min must be less than max. */
  nextRange: (min: number, max: number) => number;
  /** Select an item uniformly from a non-empty list. */
  pick: <T>(items: readonly T[]) => T;
}>;

/**
 * Renderer-neutral deterministic input for a future registered subject.
 * Each consumer creates its own stream for a semantic object/domain key.
 */
export type SceneVariationDescriptor = Readonly<{
  identity: SceneVariantIdentity;
  createRandomStream: (
    domain: SceneVariationDomain,
    objectId: string,
  ) => SceneRandomStream;
}>;

/** Shared optional input shape for interactive and Ground Glass subject factories. */
export type SceneVariationSubjectInput = Readonly<{
  variationDescriptor?: SceneVariationDescriptor;
}>;
