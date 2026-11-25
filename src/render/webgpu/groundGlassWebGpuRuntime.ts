import type { GroundGlassMountedRuntimeEvidence } from "../backend/groundGlassBackendDiagnostics";
import type { GroundGlassRendererGenerationIdentity } from "../backend/groundGlassBackendContracts";

export type GroundGlassWebGpuBackendObservation = Readonly<{
  rendererIsWebGpu: boolean;
  backendIsWebGpu: boolean;
  backendIsWebGl: boolean;
}>;

/** Classifies the initialized Three backend; browser availability is deliberately not an input. */
export const classifyGroundGlassWebGpuRuntime = (
  generation: GroundGlassRendererGenerationIdentity,
  observation: GroundGlassWebGpuBackendObservation,
): GroundGlassMountedRuntimeEvidence => {
  if (!observation.rendererIsWebGpu) return { status: "unknown" };
  if (observation.backendIsWebGpu) {
    return {
      status: "mounted",
      generation,
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgpu",
      internalFallback: "none",
    };
  }
  if (observation.backendIsWebGl) {
    return {
      status: "mounted",
      generation,
      rendererFamily: "webgpu-renderer",
      actualExecutionApi: "webgl2",
      internalFallback: "webgl2-compatibility",
    };
  }
  return { status: "unknown" };
};
