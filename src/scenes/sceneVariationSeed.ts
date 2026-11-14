import { normalizeSceneSeed } from "./sceneVariation";

export type SceneSeedEntropySource = Pick<Crypto, "getRandomValues">;

/** Obtain one new seed from browser entropy. Pure generation never calls this. */
export const createSceneVariationSeed = (
  entropy: SceneSeedEntropySource | undefined = globalThis.crypto,
): number => {
  if (!entropy || typeof entropy.getRandomValues !== "function") {
    throw new Error("Scene variation requires crypto.getRandomValues() to create a new seed");
  }
  const values = new Uint32Array(1);
  entropy.getRandomValues(values);
  return normalizeSceneSeed(values[0]!);
};
