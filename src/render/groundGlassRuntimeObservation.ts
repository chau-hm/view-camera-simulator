import type {
  GroundGlassAcceptedRequestIdentity,
  GroundGlassRendererGenerationIdentity,
} from "./backend/groundGlassBackendContracts";
import type {
  GroundGlassRttChannel,
  GroundGlassRttRuntimeInfo,
} from "./groundGlassRttDimensions";

type GroundGlassRuntimeObservationIdentity = Readonly<{
  channelId: GroundGlassRttChannel;
  generation: GroundGlassRendererGenerationIdentity;
  ownerId: string;
}>;

/** Internal host envelope; lifecycle observations stay separate from request-attributed data. */
export type GroundGlassRuntimeInfoObservation =
  | (GroundGlassRuntimeObservationIdentity & Readonly<{
      scope: "generation";
      requestIdentity: null;
      info: GroundGlassRttRuntimeInfo | null;
    }>)
  | (GroundGlassRuntimeObservationIdentity & Readonly<{
      scope: "request";
      requestIdentity: GroundGlassAcceptedRequestIdentity;
      info: GroundGlassRttRuntimeInfo | null;
    }>);

export type GroundGlassRuntimeInfoObservationHandler = (
  observation: GroundGlassRuntimeInfoObservation,
) => void;
