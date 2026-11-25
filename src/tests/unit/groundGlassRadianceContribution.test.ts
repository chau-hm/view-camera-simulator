import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  resolveGroundGlassRadianceContributions,
  type GroundGlassRadianceContribution,
} from "../../render/groundGlassRadianceContribution";
import type { GroundGlassPhysicalRenderState } from "../../render/groundGlassPhysicalRenderState";
import type { GroundGlassDofRenderState } from "../../render/groundGlassDofRenderState";
import type { SceneDefinition } from "../../types/scene";
import { resolveGroundGlassPassOrder } from "../../render/groundGlassPassGraph";

type HasContributionTextures<T> = Extract<
  keyof T,
  "radiance" | "apparentWorldPosition" | "gatherVisibilityDepth"
> extends never ? true : false;

const makeTexture = (width = 2, height = 2): THREE.DataTexture => {
  const data = new Uint8Array(width * height * 4);
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

const makeWorldPositionTexture = (width = 2, height = 2): THREE.DataTexture => {
  const data = new Float32Array(width * height * 4);
  for (let offset = 3; offset < data.length; offset += 4) data[offset] = 1;
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.needsUpdate = true;
  return texture;
};

const contribution = (
  id: string,
  width = 2,
  height = 2,
  depthWidth = width,
): GroundGlassRadianceContribution => ({
  id,
  radianceSemantics: "preweighted-linear-radiance",
  radiance: makeTexture(width, height),
  apparentWorldPosition: makeWorldPositionTexture(width, height),
  ...(depthWidth === -1
    ? {}
    : { gatherVisibilityDepth: makeTexture(depthWidth, height) }),
});

describe("renderer-local Ground Glass radiance contribution contract", () => {
  it("uses a valid direct contribution unchanged when there is no optional source", () => {
    const direct = contribution("direct-pane");
    const resolved = resolveGroundGlassRadianceContributions(direct);

    expect(resolved.contributions).toEqual([direct]);
    expect(resolved.contributions[0]).toBe(direct);
    expect(resolved.omittedOptionalIds).toEqual([]);
  });

  it("retains a valid optional contribution with independent apparent positions", () => {
    const direct = contribution("direct-pane");
    const secondary = {
      ...contribution("virtual-image", 2, 2, -1),
      gatherVisibilityDepth: makeTexture(1, 1),
    };

    const resolved = resolveGroundGlassRadianceContributions(direct, [secondary]);

    expect(resolved.contributions).toEqual([direct, secondary]);
    expect(resolved.contributions[0].apparentWorldPosition).not.toBe(
      resolved.contributions[1].apparentWorldPosition,
    );
    expect(resolved.contributions[1].gatherVisibilityDepth?.image).toMatchObject({
      width: 1,
      height: 1,
    });
  });

  it("omits invalid or duplicate optional input and leaves direct-only rendering available", () => {
    const direct = contribution("direct-pane");
    const mismatched = contribution("mismatched", 4, 4, 2);
    const bytePositions = {
      ...contribution("byte-position"),
      apparentWorldPosition: makeTexture(),
    };
    const duplicate = contribution("direct-pane");

    const resolved = resolveGroundGlassRadianceContributions(direct, [
      mismatched,
      bytePositions,
      duplicate,
    ]);

    expect(resolved.contributions).toEqual([direct]);
    expect(resolved.omittedOptionalIds).toEqual([
      "mismatched",
      "byte-position",
      "direct-pane",
    ]);
  });

  it("fails closed when the required direct contribution is invalid", () => {
    const invalidDirect = contribution("direct-pane", 2, 2, 4);

    expect(() => resolveGroundGlassRadianceContributions(invalidDirect)).toThrow(
      "Ground Glass direct radiance contribution is invalid",
    );
  });

  it("keeps contribution textures out of canonical scene and DOF state contracts", () => {
    const sceneContractIsTextureFree: HasContributionTextures<SceneDefinition> = true;
    const dofContractIsTextureFree: HasContributionTextures<GroundGlassDofRenderState> = true;
    const physicalStateContractIsTextureFree: HasContributionTextures<GroundGlassPhysicalRenderState> = true;

    expect(sceneContractIsTextureFree).toBe(true);
    expect(dofContractIsTextureFree).toBe(true);
    expect(physicalStateContractIsTextureFree).toBe(true);
  });

  it("preserves the existing Raw RTT direct-scene diagnostic path", () => {
    expect(resolveGroundGlassPassOrder(true)).toEqual(["sceneRender", "composite"]);
    expect(resolveGroundGlassPassOrder(false)).toEqual([
      "sceneRender",
      "cocFootprint",
      "farGather",
      "nearGather",
      "composite",
    ]);
  });
});
