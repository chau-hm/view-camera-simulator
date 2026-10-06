import type { Bounds3 } from "../../types/optics";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import {
  FRINGE_CLUB_RUNTIME_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "../../render/assets/sceneAssetRegistry";
import {
  type FringeClubAssetRequest,
  type FringeClubSourceOwnerLease,
} from "../../render/assets/FringeClubRuntimeAsset";
import {
  getGroundGlassSceneProfile,
  type GroundGlassSceneProfile,
} from "../../render/groundGlassSceneProfiles";

const MILLIMETRES_PER_METRE = 1000;
const RTT_INSTANCE_ID = "ground-glass-rtt";

export type FringeClubGroundGlassSubjectIdentity = Readonly<{
  sourceId: string;
  instanceId: string;
  rootId: string;
}>;

export type FringeClubGroundGlassProfileOptions = Readonly<{
  sourceOwner: FringeClubSourceOwnerLease;
  mountSubject: boolean;
  onSubjectIdentityChange?: (
    identity: FringeClubGroundGlassSubjectIdentity | null,
  ) => void;
}>;

const resolveFringePositionMeters = (
  sourceOwner: FringeClubSourceOwnerLease,
): readonly [number, number, number] => {
  const target = architectureRiseScene.focusTargets[0]?.worldPosition;
  if (!target) {
    throw new Error("Architecture Rise must provide the RTT fixture focus target");
  }

  const [centerX, centerY] = sourceOwner.boundsMeters.center;
  const [, , nearZ] = sourceOwner.boundsMeters.min;
  return Object.freeze([
    target.x / MILLIMETRES_PER_METRE - centerX,
    target.y / MILLIMETRES_PER_METRE - centerY,
    target.z / MILLIMETRES_PER_METRE - nearZ,
  ]);
};

const resolveAssetBoundsWorldMm = (
  sourceOwner: FringeClubSourceOwnerLease,
  positionMeters: readonly [number, number, number],
): Bounds3 => {
  const minimum = sourceOwner.boundsMeters.min.map(
    (value, axis) => (value + positionMeters[axis]) * MILLIMETRES_PER_METRE,
  );
  const maximum = sourceOwner.boundsMeters.max.map(
    (value, axis) => (value + positionMeters[axis]) * MILLIMETRES_PER_METRE,
  );
  return {
    min: { x: minimum[0], y: minimum[1], z: minimum[2] },
    max: { x: maximum[0], y: maximum[1], z: maximum[2] },
  };
};

const unionBounds = (left: Bounds3, right: Bounds3): Bounds3 => ({
  min: {
    x: Math.min(left.min.x, right.min.x),
    y: Math.min(left.min.y, right.min.y),
    z: Math.min(left.min.z, right.min.z),
  },
  max: {
    x: Math.max(left.max.x, right.max.x),
    y: Math.max(left.max.y, right.max.y),
    z: Math.max(left.max.z, right.max.z),
  },
});

/**
 * Development-only RTT profile. It swaps only the offscreen subject while
 * retaining the Architecture Rise RTT camera, lighting, pass graph, and
 * render-target lifecycle. The GLB stays a registered presentation asset.
 */
export const createFringeClubGroundGlassDevelopmentProfile = ({
  sourceOwner,
  mountSubject,
  onSubjectIdentityChange,
}: FringeClubGroundGlassProfileOptions): GroundGlassSceneProfile => {
  const baseProfile = getGroundGlassSceneProfile(architectureRiseScene);
  const positionMeters = resolveFringePositionMeters(sourceOwner);
  const request: FringeClubAssetRequest = Object.freeze({
    sourceOwner,
    instanceId: RTT_INSTANCE_ID,
    transform: Object.freeze({ positionMeters }),
  });
  const assetBounds = resolveAssetBoundsWorldMm(sourceOwner, positionMeters);

  return Object.freeze({
    ...baseProfile,
    mountSubject: (scene) => {
      if (!mountSubject) return null;

      const group = createRegisteredSceneAsset(
        FRINGE_CLUB_RUNTIME_ASSET_KEY,
        request,
      );
      scene.add(group);
      onSubjectIdentityChange?.(
        Object.freeze({
          sourceId: sourceOwner.sourceId,
          instanceId: RTT_INSTANCE_ID,
          rootId: group.uuid,
        }),
      );

      let disposed = false;
      return {
        group,
        dispose: () => {
          if (disposed) return;
          disposed = true;
          scene.remove(group);
          disposeRegisteredSceneAsset(FRINGE_CLUB_RUNTIME_ASSET_KEY, group);
          onSubjectIdentityChange?.(null);
        },
      };
    },
    resolveRenderBounds: (context) =>
      mountSubject
        ? unionBounds(baseProfile.resolveRenderBounds(context), assetBounds)
        : baseProfile.resolveRenderBounds(context),
  });
};
