import * as THREE from "three";
import type { AnatomyPixelImage, AnatomyPixelMask } from "../anatomyRenderableContribution";
import { linkObserverOutputSourceMaterial } from "./observerMaterialOutputIdentity";

export const ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_EVENT =
  "vcs:observer-verification:anatomy-bellows-compositing-intervention";
export const ANATOMY_BELLOWS_COMPOSITING_INTERVENTION_RESULT_EVENT =
  "vcs:observer-verification:anatomy-bellows-compositing-intervention-result";

export type AnatomyBellowsCompositingCondition = "C0" | "C1" | "C2" | "C3";
export type AnatomyBellowsOpacityCondition = "O1" | "O2";
export type AnatomyBellowsInterventionCondition =
  | Exclude<AnatomyBellowsCompositingCondition, "C0">
  | AnatomyBellowsOpacityCondition;
export type AnatomyBellowsCompositingOverrides = Readonly<{
  opacity?: number;
  forceSinglePass?: boolean;
  blending?: THREE.Material["blending"];
}>;

export type AnatomyBellowsCompositingSourceProperties = Readonly<{
  id: string;
  type: string;
  opacity: number;
  transparent: boolean;
  blending: THREE.Material["blending"];
  premultipliedAlpha: boolean;
  depthTest: boolean;
  depthWrite: boolean;
  side: THREE.Material["side"];
  forceSinglePass: boolean;
}>;

export type AnatomyBellowsCompositingCandidate = Readonly<{
  id: string;
  name: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
  source: AnatomyBellowsCompositingSourceProperties;
}>;

export type AnatomyBellowsCompositingTargetResolution =
  | Readonly<{ ok: true; target: AnatomyBellowsCompositingCandidate }>
  | Readonly<{
      ok: false;
      reason:
        | "missing-renderable-id"
        | "stale-renderable-id"
        | "wrong-semantic-renderable"
        | "selected-renderable-not-visible"
        | "source-material-mismatch"
        | "non-baseline-source-material";
    }>;

export const isAnatomyBellowsCompositingCondition = (
  value: unknown,
): value is AnatomyBellowsCompositingCondition => value === "C0" || value === "C1" || value === "C2" || value === "C3";

/** C0 is the untouched reference. The other entries change only the named material state. */
export const anatomyBellowsCompositingOverrides = (
  condition: Exclude<AnatomyBellowsCompositingCondition, "C0">,
): AnatomyBellowsCompositingOverrides => {
  switch (condition) {
    case "C1": return { forceSinglePass: true };
    case "C2": return { blending: THREE.NoBlending };
    case "C3": return { forceSinglePass: true, blending: THREE.NoBlending };
  }
};

export const isAnatomyBellowsInterventionCondition = (
  value: unknown,
): value is AnatomyBellowsInterventionCondition =>
  value === "C1" || value === "C2" || value === "C3" || value === "O1" || value === "O2";

export const anatomyBellowsInterventionOverrides = (
  condition: AnatomyBellowsInterventionCondition,
): AnatomyBellowsCompositingOverrides => {
  if (condition === "O1") return { opacity: 0.5 };
  if (condition === "O2") return { opacity: 1 };
  return anatomyBellowsCompositingOverrides(condition);
};

const isConceptualBellowsRole = (role: string): boolean => role === "conceptual-camera/bellows";

/** Validates the current mounted object and authored source before permitting a trial. */
export const resolveAnatomyBellowsCompositingTarget = (
  renderableId: unknown,
  sourceMaterialId: unknown,
  candidates: readonly AnatomyBellowsCompositingCandidate[],
): AnatomyBellowsCompositingTargetResolution => {
  if (typeof renderableId !== "string" || renderableId.length === 0) {
    return { ok: false, reason: "missing-renderable-id" };
  }
  const target = candidates.find((candidate) => candidate.id === renderableId);
  if (!target) return { ok: false, reason: "stale-renderable-id" };
  if (target.name !== "bellows-folded-surface" || !isConceptualBellowsRole(target.role) || target.cameraPart !== "bellows") {
    return { ok: false, reason: "wrong-semantic-renderable" };
  }
  if (!target.visible) return { ok: false, reason: "selected-renderable-not-visible" };
  if (typeof sourceMaterialId !== "string" || sourceMaterialId !== target.source.id) {
    return { ok: false, reason: "source-material-mismatch" };
  }
  const source = target.source;
  if (source.type !== "MeshStandardMaterial" || source.opacity !== 0.16 || source.transparent !== true ||
      source.blending !== THREE.NormalBlending || source.premultipliedAlpha !== false ||
      source.depthTest !== true || source.depthWrite !== false || source.side !== THREE.DoubleSide ||
      source.forceSinglePass !== false) {
    return { ok: false, reason: "non-baseline-source-material" };
  }
  return { ok: true, target };
};

/** Clone only the selected WebGL source material; the authored material and textures remain borrowed. */
export const createAnatomyBellowsCompositingMaterialClone = (
  source: THREE.Material,
  condition: Exclude<AnatomyBellowsCompositingCondition, "C0">,
): THREE.Material => {
  if (source.type !== "MeshStandardMaterial" || !("forceSinglePass" in source)) {
    throw new Error("unsupported-bellows-source-material-family");
  }
  const clone = source.clone();
  const overrides = anatomyBellowsCompositingOverrides(condition);
  if (overrides.forceSinglePass !== undefined) {
    (clone as THREE.Material & { forceSinglePass: boolean }).forceSinglePass = overrides.forceSinglePass;
  }
  if (overrides.blending !== undefined) clone.blending = overrides.blending;
  clone.needsUpdate = true;
  linkObserverOutputSourceMaterial(clone, source);
  return clone;
};

/** Clone the selected WebGL source material and change only its opacity. */
export const createAnatomyBellowsOpacityMaterialClone = (
  source: THREE.Material,
  condition: AnatomyBellowsOpacityCondition,
): THREE.Material => {
  if (source.type !== "MeshStandardMaterial" || !("forceSinglePass" in source)) {
    throw new Error("unsupported-bellows-source-material-family");
  }
  const clone = source.clone();
  clone.opacity = anatomyBellowsInterventionOverrides(condition).opacity!;
  linkObserverOutputSourceMaterial(clone, source);
  return clone;
};

export type AnatomyBellowsCompositingOverrideRegistration = Readonly<{
  generation: number;
  condition: AnatomyBellowsInterventionCondition;
  identity: object;
  overrides: AnatomyBellowsCompositingOverrides;
}>;

const activeOverrides = new WeakMap<THREE.Object3D, AnatomyBellowsCompositingOverrideRegistration>();

/** Register a per-renderable, per-generation native output-material variant. */
export const registerAnatomyBellowsCompositingOverride = (
  renderable: THREE.Object3D,
  generation: number,
  condition: AnatomyBellowsInterventionCondition,
): Readonly<{ registration: AnatomyBellowsCompositingOverrideRegistration; release: () => void }> => {
  const registration = {
    generation,
    condition,
    identity: {},
    overrides: anatomyBellowsInterventionOverrides(condition),
  } as const;
  activeOverrides.set(renderable, registration);
  return {
    registration,
    release: () => {
      if (activeOverrides.get(renderable) === registration) activeOverrides.delete(renderable);
    },
  };
};

export const readAnatomyBellowsCompositingOverride = (
  renderable: THREE.Object3D,
  generation: number,
): AnatomyBellowsCompositingOverrideRegistration | null => {
  const registration = activeOverrides.get(renderable);
  return registration?.generation === generation ? registration : null;
};

export type SignedRgbMetric = Readonly<{
  sampleCount: number;
  meanAbsoluteRgbDifference: number;
  perChannelMeanAbsoluteDifference: readonly [number, number, number];
  perChannelMeanSignedDifference: readonly [number, number, number];
  changedPixelCount: number;
  thresholdPerChannel: number;
}>;

const assertCompatible = (
  images: readonly AnatomyPixelImage[],
  mask: AnatomyPixelMask,
): number => {
  const first = images[0];
  if (!first || !Number.isInteger(first.width) || !Number.isInteger(first.height) ||
      first.width < 1 || first.height < 1 || first.channels < 3 ||
      first.pixels.length !== first.width * first.height * first.channels) {
    throw new Error("invalid-anatomy-image");
  }
  if (images.some((image) => image.width !== first.width || image.height !== first.height ||
      image.channels !== first.channels || image.pixels.length !== first.pixels.length)) {
    throw new Error("incompatible-anatomy-images");
  }
  if (mask.width !== first.width || mask.height !== first.height || mask.pixels.length !== first.width * first.height) {
    throw new Error("incompatible-anatomy-mask");
  }
  const sampleCount = mask.pixels.reduce((sum, value) => sum + Number(value > 0), 0);
  if (sampleCount === 0) throw new Error("empty-anatomy-mask");
  return sampleCount;
};

const summarizeSignedValues = (
  valuesAt: (pixel: number, channel: number) => number,
  width: number,
  height: number,
  mask: AnatomyPixelMask,
  sampleCount: number,
  thresholdPerChannel: number,
): SignedRgbMetric => {
  const absolute: [number, number, number] = [0, 0, 0];
  const signed: [number, number, number] = [0, 0, 0];
  let changedPixelCount = 0;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (!mask.pixels[pixel]) continue;
    let changed = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const value = valuesAt(pixel, channel);
      absolute[channel] += Math.abs(value);
      signed[channel] += value;
      changed ||= Math.abs(value) > thresholdPerChannel;
    }
    if (changed) changedPixelCount += 1;
  }
  const perChannelMeanAbsoluteDifference = absolute.map((value) => value / sampleCount) as [number, number, number];
  return {
    sampleCount,
    meanAbsoluteRgbDifference: perChannelMeanAbsoluteDifference.reduce((sum, value) => sum + value, 0) / 3,
    perChannelMeanAbsoluteDifference,
    perChannelMeanSignedDifference: signed.map((value) => value / sampleCount) as [number, number, number],
    changedPixelCount,
    thresholdPerChannel,
  };
};

export const summarizeSignedAnatomyImageResponse = (
  reference: AnatomyPixelImage,
  response: AnatomyPixelImage,
  mask: AnatomyPixelMask,
  thresholdPerChannel = 8,
): SignedRgbMetric => {
  const sampleCount = assertCompatible([reference, response], mask);
  return summarizeSignedValues(
    (pixel, channel) => response.pixels[(pixel * response.channels) + channel]! -
      reference.pixels[(pixel * reference.channels) + channel]!,
    reference.width,
    reference.height,
    mask,
    sampleCount,
    thresholdPerChannel,
  );
};

/** Difference of intervention responses: (candidate intervention - candidate C0) - (reference intervention - reference C0). */
export const summarizeAnatomyDifferenceOfResponses = (
  referenceC0: AnatomyPixelImage,
  referenceIntervention: AnatomyPixelImage,
  candidateC0: AnatomyPixelImage,
  candidateIntervention: AnatomyPixelImage,
  mask: AnatomyPixelMask,
  thresholdPerChannel = 8,
): SignedRgbMetric => {
  const sampleCount = assertCompatible([referenceC0, referenceIntervention, candidateC0, candidateIntervention], mask);
  return summarizeSignedValues(
    (pixel, channel) => {
      const referenceOffset = pixel * referenceC0.channels + channel;
      const candidateOffset = pixel * candidateC0.channels + channel;
      return (candidateIntervention.pixels[pixel * candidateIntervention.channels + channel]! -
        candidateC0.pixels[candidateOffset]!) -
        (referenceIntervention.pixels[pixel * referenceIntervention.channels + channel]! -
          referenceC0.pixels[referenceOffset]!);
    },
    referenceC0.width,
    referenceC0.height,
    mask,
    sampleCount,
    thresholdPerChannel,
  );
};

/** Within-renderer 2x2 factorial image interaction: (C3-C2) - (C1-C0). */
export const summarizeAnatomyFactorialInteraction = (
  c0: AnatomyPixelImage,
  c1: AnatomyPixelImage,
  c2: AnatomyPixelImage,
  c3: AnatomyPixelImage,
  mask: AnatomyPixelMask,
  thresholdPerChannel = 8,
): SignedRgbMetric => {
  const sampleCount = assertCompatible([c0, c1, c2, c3], mask);
  return summarizeSignedValues(
    (pixel, channel) => {
      const offset = pixel * c0.channels + channel;
      return (c3.pixels[offset]! - c2.pixels[offset]!) - (c1.pixels[offset]! - c0.pixels[offset]!);
    },
    c0.width,
    c0.height,
    mask,
    sampleCount,
    thresholdPerChannel,
  );
};
