export type AnatomyTransparencyClass = "T0" | "T1" | "T2" | "T3" | "T4";

export type AnatomyMaterialTransparencyInput = Readonly<{
  transparent: boolean;
  opacity: number;
  alphaTest: number;
  hasAlphaMap: boolean;
}>;

/**
 * Describes authored material flags without inferring that partial opacity
 * necessarily enters Three.js's transparent render list.
 */
export const classifyAnatomyMaterialTransparency = (
  material: AnatomyMaterialTransparencyInput,
): readonly Exclude<AnatomyTransparencyClass, "T4">[] => {
  const classes: Exclude<AnatomyTransparencyClass, "T4">[] = [];
  if (!material.transparent) classes.push("T0");
  if (material.transparent) classes.push("T1");
  if (material.opacity < 1) classes.push("T2");
  if (material.alphaTest > 0 || material.hasAlphaMap) classes.push("T3");
  return classes;
};

const transparencySemantics = (material: AnatomyMaterialTransparencyInput): string => JSON.stringify([
  material.transparent,
  material.opacity < 1,
  material.alphaTest > 0,
  material.hasAlphaMap,
]);

export const hasMixedAnatomyMaterialTransparencySlots = (
  slots: readonly AnatomyMaterialTransparencyInput[],
): boolean => new Set(slots.map(transparencySemantics)).size > 1;

export type AnatomyRenderableSelector =
  | Readonly<{ kind: "all-renderables" }>
  | Readonly<{ kind: "explicit-transparent" }>
  | Readonly<{ kind: "conceptual-camera" }>
  | Readonly<{ kind: "semantic-role"; role: string }>
  | Readonly<{ kind: "camera-part"; cameraPart: string }>
  | Readonly<{ kind: "camera-parts"; cameraParts: readonly string[] }>
  | Readonly<{ kind: "dimmed-camera-parts"; selectedCameraParts: readonly string[] }>
  | Readonly<{ kind: "renderable-ids"; renderableIds: readonly string[] }>;

export type AnatomyRenderableSelectionRecord<T> = Readonly<{
  id: string;
  name: string;
  role: string;
  cameraPart: string | null;
  visible: boolean;
  materialSlots: readonly AnatomyMaterialTransparencyInput[];
  value: T;
}>;

export type AnatomyRenderableSelectionResult<T> =
  | Readonly<{ ok: true; records: readonly AnatomyRenderableSelectionRecord<T>[] }>
  | Readonly<{ ok: false; reason: "invalid-selector" | "empty-selection" | "stale-renderable-id" | "duplicate-renderable-id" }>;

const isConceptualCamera = (role: string): boolean =>
  role === "conceptual-camera" || role.startsWith("conceptual-camera/");

export const resolveAnatomyRenderableSelection = <T>(
  records: readonly AnatomyRenderableSelectionRecord<T>[],
  selector: AnatomyRenderableSelector,
): AnatomyRenderableSelectionResult<T> => {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) return { ok: false, reason: "duplicate-renderable-id" };
    ids.add(record.id);
  }

  if (selector.kind === "renderable-ids") {
    if (selector.renderableIds.length === 0) return { ok: false, reason: "empty-selection" };
    const requestedIds = new Set(selector.renderableIds);
    if (requestedIds.size !== selector.renderableIds.length) {
      return { ok: false, reason: "duplicate-renderable-id" };
    }
    if ([...requestedIds].some((id) => !ids.has(id))) {
      return { ok: false, reason: "stale-renderable-id" };
    }
    const selected = records.filter((record) => requestedIds.has(record.id));
    if (selected.some((record) => !record.visible)) return { ok: false, reason: "empty-selection" };
    return { ok: true, records: selected };
  }

  if (selector.kind === "semantic-role" && selector.role.trim().length === 0) {
    return { ok: false, reason: "invalid-selector" };
  }
  if (selector.kind === "camera-part" && selector.cameraPart.trim().length === 0) {
    return { ok: false, reason: "invalid-selector" };
  }
  if (selector.kind === "camera-parts" && selector.cameraParts.length === 0) {
    return { ok: false, reason: "empty-selection" };
  }
  if (selector.kind === "camera-parts" && selector.cameraParts.some((part) => part.trim().length === 0)) {
    return { ok: false, reason: "invalid-selector" };
  }
  if (selector.kind === "dimmed-camera-parts" && selector.selectedCameraParts.length === 0) {
    return { ok: false, reason: "invalid-selector" };
  }
  if (selector.kind === "dimmed-camera-parts" && selector.selectedCameraParts.some((part) => part.trim().length === 0)) {
    return { ok: false, reason: "invalid-selector" };
  }

  const selected = records.filter((record) => {
    if (!record.visible) return false;
    switch (selector.kind) {
      case "all-renderables":
        return true;
      case "explicit-transparent":
        return record.materialSlots.some((material) => material.transparent);
      case "conceptual-camera":
        return isConceptualCamera(record.role);
      case "semantic-role":
        return record.role === selector.role || record.role.startsWith(`${selector.role}/`);
      case "camera-part":
        return isConceptualCamera(record.role) && record.cameraPart === selector.cameraPart;
      case "camera-parts":
        return isConceptualCamera(record.role) && record.cameraPart !== null &&
          selector.cameraParts.includes(record.cameraPart);
      case "dimmed-camera-parts":
        return isConceptualCamera(record.role) && record.cameraPart !== null &&
          !selector.selectedCameraParts.includes(record.cameraPart);
      default:
        return false;
    }
  });
  return selected.length > 0
    ? { ok: true, records: selected }
    : { ok: false, reason: "empty-selection" };
};

export type AnatomyVisibilityMutable = Readonly<{ id: string; value: { visible: boolean } }>;
export type AnatomyVisibilitySnapshot<T extends AnatomyVisibilityMutable = AnatomyVisibilityMutable> =
  Readonly<{ id: string; value: T["value"]; visible: boolean }>;

export const excludeAnatomyRenderables = <T extends AnatomyVisibilityMutable>(
  records: readonly T[],
): readonly AnatomyVisibilitySnapshot<T>[] => {
  if (records.length === 0) throw new Error("Cannot exclude an empty Anatomy renderable selection");
  const ids = new Set<string>();
  const snapshots = records.map((record) => {
    if (ids.has(record.id)) throw new Error("Cannot exclude duplicate Anatomy renderable identities");
    ids.add(record.id);
    return { id: record.id, value: record.value, visible: record.value.visible };
  });
  snapshots.forEach((snapshot) => { snapshot.value.visible = false; });
  return snapshots;
};

export const restoreAnatomyRenderables = (
  snapshots: readonly AnatomyVisibilitySnapshot[],
): void => {
  snapshots.forEach((snapshot) => { snapshot.value.visible = snapshot.visible; });
};

export type AnatomyNormalizedProjectedBounds = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type AnatomyTransparentOverlapCandidate = Readonly<{
  firstId: string;
  secondId: string;
  projectedIntersection: AnatomyNormalizedProjectedBounds;
  intersectionArea: number;
}>;

export const findAnatomyTransparentOverlapCandidates = <T>(
  records: readonly Readonly<{
    id: string;
    visible: boolean;
    materialSlots: readonly AnatomyMaterialTransparencyInput[];
    projectedBounds: AnatomyNormalizedProjectedBounds | null;
    value?: T;
  }>[],
): readonly AnatomyTransparentOverlapCandidate[] => {
  const transparent = records.filter((record) => record.visible &&
    record.materialSlots.some((material) => material.transparent) && record.projectedBounds !== null);
  const overlaps: AnatomyTransparentOverlapCandidate[] = [];
  for (let firstIndex = 0; firstIndex < transparent.length; firstIndex += 1) {
    const first = transparent[firstIndex];
    const firstBounds = first?.projectedBounds;
    if (!first || !firstBounds) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < transparent.length; secondIndex += 1) {
      const second = transparent[secondIndex];
      const secondBounds = second?.projectedBounds;
      if (!second || !secondBounds) continue;
      const intersection = {
        left: Math.max(firstBounds.left, secondBounds.left),
        top: Math.max(firstBounds.top, secondBounds.top),
        right: Math.min(firstBounds.right, secondBounds.right),
        bottom: Math.min(firstBounds.bottom, secondBounds.bottom),
      };
      if (intersection.right <= intersection.left || intersection.bottom <= intersection.top) continue;
      overlaps.push({
        firstId: first.id,
        secondId: second.id,
        projectedIntersection: intersection,
        intersectionArea: (intersection.right - intersection.left) * (intersection.bottom - intersection.top),
      });
    }
  }
  return overlaps.sort((first, second) => second.intersectionArea - first.intersectionArea ||
    `${first.firstId}/${first.secondId}`.localeCompare(`${second.firstId}/${second.secondId}`));
};

export const isAnatomyRendererGenerationCurrent = (
  requestedGeneration: number,
  activeGeneration: number,
): boolean => Number.isInteger(requestedGeneration) && requestedGeneration === activeGeneration;

export type AnatomyPixelImage = Readonly<{
  width: number;
  height: number;
  channels: number;
  pixels: ArrayLike<number>;
}>;

export type AnatomyPixelMask = Readonly<{
  width: number;
  height: number;
  pixels: Uint8Array;
}>;

export type AnatomyImageDifference = Readonly<{
  sampleCount: number;
  meanAbsoluteRgbDifference: number;
  perChannelMeanAbsoluteDifference: readonly [number, number, number];
  changedPixelCount: number;
  changedPixelFraction: number;
  meanSignedLuminanceDifference: number;
}>;

const validateImage = (image: AnatomyPixelImage): void => {
  if (!Number.isInteger(image.width) || image.width <= 0 ||
      !Number.isInteger(image.height) || image.height <= 0 || image.channels < 3 ||
      image.pixels.length !== image.width * image.height * image.channels) {
    throw new Error("Invalid or incomplete Anatomy framebuffer image");
  }
};

const validateCompatibleImages = (first: AnatomyPixelImage, second: AnatomyPixelImage): void => {
  validateImage(first);
  validateImage(second);
  if (first.width !== second.width || first.height !== second.height || first.channels !== second.channels) {
    throw new Error("Cannot compare Anatomy captures with incompatible dimensions or channels");
  }
};

const validateMask = (mask: AnatomyPixelMask, width: number, height: number): number => {
  if (mask.width !== width || mask.height !== height || mask.pixels.length !== width * height) {
    throw new Error("Anatomy pixel mask dimensions do not match the framebuffer");
  }
  const count = countAnatomyMaskPixels(mask);
  if (count === 0) throw new Error("Cannot calculate an Anatomy image metric over an empty mask");
  return count;
};

const rgbOffset = (image: AnatomyPixelImage, pixelIndex: number, channel: number): number =>
  pixelIndex * image.channels + channel;

export const deriveAnatomyObservedDifferentialMask = (
  reference: AnatomyPixelImage,
  compared: AnatomyPixelImage,
  perChannelThreshold = 8,
): AnatomyPixelMask => {
  validateCompatibleImages(reference, compared);
  if (!Number.isFinite(perChannelThreshold) || perChannelThreshold < 0) {
    throw new Error("Anatomy mask threshold must be a finite nonnegative number");
  }
  const pixels = new Uint8Array(reference.width * reference.height);
  for (let pixel = 0; pixel < pixels.length; pixel += 1) {
    const changed = [0, 1, 2].some((channel) =>
      Math.abs((reference.pixels[rgbOffset(reference, pixel, channel)] ?? 0) -
        (compared.pixels[rgbOffset(compared, pixel, channel)] ?? 0)) > perChannelThreshold,
    );
    pixels[pixel] = changed ? 1 : 0;
  }
  return { width: reference.width, height: reference.height, pixels };
};

export const countAnatomyMaskPixels = (mask: AnatomyPixelMask): number =>
  mask.pixels.reduce((total, value) => total + (value > 0 ? 1 : 0), 0);

export const combineAnatomyMasks = (
  first: AnatomyPixelMask,
  second: AnatomyPixelMask,
  operation: "union" | "intersection" | "difference",
): AnatomyPixelMask => {
  if (first.width !== second.width || first.height !== second.height ||
      first.pixels.length !== first.width * first.height || second.pixels.length !== first.pixels.length) {
    throw new Error("Cannot combine incompatible Anatomy masks");
  }
  const pixels = new Uint8Array(first.pixels.length);
  for (let index = 0; index < pixels.length; index += 1) {
    const a = first.pixels[index] > 0;
    const b = second.pixels[index] > 0;
    pixels[index] = Number(operation === "union" ? a || b : operation === "intersection" ? a && b : a && !b);
  }
  return { width: first.width, height: first.height, pixels };
};

export const complementAnatomyMask = (mask: AnatomyPixelMask): AnatomyPixelMask => {
  if (mask.pixels.length !== mask.width * mask.height) throw new Error("Invalid Anatomy mask data");
  return {
    width: mask.width,
    height: mask.height,
    pixels: Uint8Array.from(mask.pixels, (value) => Number(value === 0)),
  };
};

export const anatomyMaskBounds = (mask: AnatomyPixelMask): Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> => {
  validateMask(mask, mask.width, mask.height);
  let left = mask.width;
  let top = mask.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (!mask.pixels[y * mask.width + x]) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left || bottom <= top) throw new Error("Cannot bound an empty Anatomy mask");
  return { left, top, right, bottom };
};

export const compareAnatomyImages = (
  first: AnatomyPixelImage,
  second: AnatomyPixelImage,
  mask?: AnatomyPixelMask,
  changedChannelThreshold = 8,
): AnatomyImageDifference => {
  validateCompatibleImages(first, second);
  if (!Number.isFinite(changedChannelThreshold) || changedChannelThreshold < 0) {
    throw new Error("Anatomy change threshold must be a finite nonnegative number");
  }
  const sampleCount = mask ? validateMask(mask, first.width, first.height) : first.width * first.height;
  const channelSums: [number, number, number] = [0, 0, 0];
  let changedPixelCount = 0;
  let signedLuminance = 0;
  for (let pixel = 0; pixel < first.width * first.height; pixel += 1) {
    if (mask && !mask.pixels[pixel]) continue;
    const differences: [number, number, number] = [0, 0, 0];
    for (let channel = 0; channel < 3; channel += 1) {
      const before = first.pixels[rgbOffset(first, pixel, channel)] ?? 0;
      const after = second.pixels[rgbOffset(second, pixel, channel)] ?? 0;
      differences[channel] = after - before;
      channelSums[channel] += Math.abs(differences[channel]);
    }
    if (differences.some((difference) => Math.abs(difference) > changedChannelThreshold)) changedPixelCount += 1;
    signedLuminance += 0.2126 * differences[0] + 0.7152 * differences[1] + 0.0722 * differences[2];
  }
  const perChannelMeanAbsoluteDifference = channelSums.map((sum) => sum / sampleCount) as [number, number, number];
  return {
    sampleCount,
    meanAbsoluteRgbDifference: perChannelMeanAbsoluteDifference.reduce((sum, value) => sum + value, 0) / 3,
    perChannelMeanAbsoluteDifference,
    changedPixelCount,
    changedPixelFraction: changedPixelCount / sampleCount,
    meanSignedLuminanceDifference: signedLuminance / sampleCount,
  };
};

export const compareAnatomyDifferentialResponses = (
  referenceFull: AnatomyPixelImage,
  referenceExcluded: AnatomyPixelImage,
  candidateFull: AnatomyPixelImage,
  candidateExcluded: AnatomyPixelImage,
  mask?: AnatomyPixelMask,
): Readonly<{
  sampleCount: number;
  meanAbsoluteRgbDifference: number;
  perChannelMeanAbsoluteDifference: readonly [number, number, number];
  meanSignedLuminanceDifference: number;
}> => {
  validateCompatibleImages(referenceFull, referenceExcluded);
  validateCompatibleImages(candidateFull, candidateExcluded);
  validateCompatibleImages(referenceFull, candidateFull);
  const sampleCount = mask ? validateMask(mask, referenceFull.width, referenceFull.height) : referenceFull.width * referenceFull.height;
  const sums: [number, number, number] = [0, 0, 0];
  let signedLuminance = 0;
  for (let pixel = 0; pixel < referenceFull.width * referenceFull.height; pixel += 1) {
    if (mask && !mask.pixels[pixel]) continue;
    const response: [number, number, number] = [0, 0, 0];
    for (let channel = 0; channel < 3; channel += 1) {
      const referenceDelta = (referenceFull.pixels[rgbOffset(referenceFull, pixel, channel)] ?? 0) -
        (referenceExcluded.pixels[rgbOffset(referenceExcluded, pixel, channel)] ?? 0);
      const candidateDelta = (candidateFull.pixels[rgbOffset(candidateFull, pixel, channel)] ?? 0) -
        (candidateExcluded.pixels[rgbOffset(candidateExcluded, pixel, channel)] ?? 0);
      response[channel] = referenceDelta - candidateDelta;
      sums[channel] += Math.abs(response[channel]);
    }
    signedLuminance += 0.2126 * response[0] + 0.7152 * response[1] + 0.0722 * response[2];
  }
  const perChannelMeanAbsoluteDifference = sums.map((sum) => sum / sampleCount) as [number, number, number];
  return {
    sampleCount,
    meanAbsoluteRgbDifference: perChannelMeanAbsoluteDifference.reduce((sum, value) => sum + value, 0) / 3,
    perChannelMeanAbsoluteDifference,
    meanSignedLuminanceDifference: signedLuminance / sampleCount,
  };
};

export const deriveAnatomyDifferentialResponseMask = (
  referenceFull: AnatomyPixelImage,
  referenceExcluded: AnatomyPixelImage,
  candidateFull: AnatomyPixelImage,
  candidateExcluded: AnatomyPixelImage,
  perChannelThreshold = 8,
): AnatomyPixelMask => {
  validateCompatibleImages(referenceFull, referenceExcluded);
  validateCompatibleImages(candidateFull, candidateExcluded);
  validateCompatibleImages(referenceFull, candidateFull);
  if (!Number.isFinite(perChannelThreshold) || perChannelThreshold < 0) {
    throw new Error("Anatomy differential response threshold must be a finite nonnegative number");
  }
  const pixels = new Uint8Array(referenceFull.width * referenceFull.height);
  for (let pixel = 0; pixel < pixels.length; pixel += 1) {
    const changed = [0, 1, 2].some((channel) => {
      const referenceResponse = (referenceFull.pixels[rgbOffset(referenceFull, pixel, channel)] ?? 0) -
        (referenceExcluded.pixels[rgbOffset(referenceExcluded, pixel, channel)] ?? 0);
      const candidateResponse = (candidateFull.pixels[rgbOffset(candidateFull, pixel, channel)] ?? 0) -
        (candidateExcluded.pixels[rgbOffset(candidateExcluded, pixel, channel)] ?? 0);
      return Math.abs(referenceResponse - candidateResponse) > perChannelThreshold;
    });
    pixels[pixel] = changed ? 1 : 0;
  }
  return { width: referenceFull.width, height: referenceFull.height, pixels };
};
