import geometry from "../scenes/understandingCameraMovementsGeometry";
import {
  renderConceptualViewCamera,
  type ConceptualViewCameraProps,
} from "./ConceptualViewCamera";

type CameraBodyAssemblyProps = Omit<ConceptualViewCameraProps, "coordinateSpace" | "variant"> & {
  ghost?: boolean;
};

/**
 * Compatibility entry point for the calibrated camera-body scene. The
 * geometry now lives in ConceptualViewCamera so current and ghost cameras use
 * the same semantic anatomy implementation.
 */
export const CameraBodyAssembly = ({
  opticsState,
  ghost = false,
  showBellows = true,
  activeStandard = null,
  rearBackMode = "ground-glass",
  aperture,
  focalLengthMm,
  presentation,
}: CameraBodyAssemblyProps) => {
  return renderConceptualViewCamera({
    opticsState,
    variant: ghost ? "ghost" : "current",
    coordinateSpace: "rig-local",
    showBellows,
    activeStandard,
    rearBackMode,
    aperture,
    focalLengthMm,
    presentation,
    rigRail: geometry.cameraBody.rail,
  });
};

export default CameraBodyAssembly;
