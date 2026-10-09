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
  type FringeClubVector3,
} from "../../render/assets/FringeClubRuntimeAsset";
import {
  getGroundGlassSceneProfile,
  type GroundGlassSceneProfile,
} from "../../render/groundGlassSceneProfiles";

const MILLIMETRES_PER_METRE = 1000;
const RTT_INSTANCE_ID = "ground-glass-rtt";

export type FringeClubGroundGlassSubjectIdentity = Readonly<{
  candidateId: FringeClubSourceOwnerLease["candidateId"];
  probeId: string;
  motionId: string;
  sourceId: string;
  instanceId: string;
  rootId: string;
}>;

export type FringeClubGroundGlassProfileOptions = Readonly<{
  sourceOwner: FringeClubSourceOwnerLease;
  alignmentTargetMeters?: FringeClubVector3;
  probeId?: string;
  probeMotionId?: string;
  mountSubject: boolean;
  onSubjectIdentityChange?: (
    identity: FringeClubGroundGlassSubjectIdentity | null,
  ) => void;
}>;

const resolveFringePositionMeters = (
  sourceOwner: FringeClubSourceOwnerLease,
  alignmentTargetMeters?: FringeClubVector3,
): readonly [number, number, number] => {
  const target = architectureRiseScene.focusTargets[0]?.worldPosition;
  if (!target) {
    throw new Error("Architecture Rise must provide the RTT fixture focus target");
  }

  const localTarget = alignmentTargetMeters ?? [
    sourceOwner.boundsMeters.center[0],
    sourceOwner.boundsMeters.center[1],
    sourceOwner.boundsMeters.min[2],
  ];
  return Object.freeze([
    target.x / MILLIMETRES_PER_METRE - localTarget[0],
    target.y / MILLIMETRES_PER_METRE - localTarget[1],
    target.z / MILLIMETRES_PER_METRE - localTarget[2],
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
  alignmentTargetMeters,
  probeId = "default",
  probeMotionId = "center",
  mountSubject,
  onSubjectIdentityChange,
}: FringeClubGroundGlassProfileOptions): GroundGlassSceneProfile => {
  const baseProfile = getGroundGlassSceneProfile(architectureRiseScene);
  const positionMeters = resolveFringePositionMeters(sourceOwner, alignmentTargetMeters);
  const request: FringeClubAssetRequest = Object.freeze({
    sourceOwner,
    instanceId: RTT_INSTANCE_ID,
    transform: Object.freeze({ positionMeters }),
  });
  const assetBounds = resolveAssetBoundsWorldMm(sourceOwner, positionMeters);

  return Object.freeze({
    ...baseProfile,
    renderSanityIdentity:
      sourceOwner.candidateId +
      "|probe:" +
      probeId +
      (probeMotionId === "center" ? "" : "|motion:" + probeMotionId),
    mountSubject: (scene) => {
      if (!mountSubject) return null;

      const group = createRegisteredSceneAsset(
        FRINGE_CLUB_RUNTIME_ASSET_KEY,
        request,
      );
      scene.add(group);
      onSubjectIdentityChange?.(
        Object.freeze({
          candidateId: sourceOwner.candidateId,
          probeId,
          motionId: probeMotionId,
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
