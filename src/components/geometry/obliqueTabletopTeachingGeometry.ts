import type { GeometryView } from "../../types/camera";
import type { DerivedOpticsState, Plane } from "../../types/optics";
import type { SimulatorMessageKey } from "../../i18n/simulatorMessageKeys";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { deriveScheimpflugConstruction } from "../../core/optics/scheimpflugConstruction";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";

/**
 * The scene-specific teaching contract deliberately contains references to
 * the canonical subject plane and the live derived optical planes. It does
 * not fit a plane from focus samples or create separate Tilt/Swing planes.
 */
export type ObliqueTabletopTeachingGeometry = {
  subjectPlane: Pick<Plane, "point" | "normal">;
  filmPlane: DerivedOpticsState["filmPlane"];
  lensPlane: DerivedOpticsState["lensPlane"];
  focusPlane: DerivedOpticsState["focusPlane"];
  opticalAxis: DerivedOpticsState["opticalAxis"];
  scheimpflugConstruction: ReturnType<typeof deriveScheimpflugConstruction>;
};
export const deriveObliqueTabletopTeachingGeometry = (
  opticsState: DerivedOpticsState,
): ObliqueTabletopTeachingGeometry => ({
  subjectPlane: obliqueTabletopGeometry.subjectBoardPlane,
  filmPlane: opticsState.filmPlane,
  lensPlane: opticsState.lensPlane,
  focusPlane: opticsState.focusPlane,
  opticalAxis: opticsState.opticalAxis,
  scheimpflugConstruction: deriveScheimpflugConstruction({
    filmPlane: opticsState.filmPlane,
    lensPlane: opticsState.lensPlane,
    focusPlane: opticsState.focusPlane,
  }),
});

export type ObliqueTabletopTeachingState = "neutral" | "tilt" | "swing" | "compound";

const MOVEMENT_EPSILON_DEG = 1e-4;

export const getObliqueTabletopTeachingState = ({
  tiltDeg,
  swingDeg,
}: {
  tiltDeg: number;
  swingDeg: number;
}): ObliqueTabletopTeachingState => {
  const hasTilt = Math.abs(tiltDeg) > MOVEMENT_EPSILON_DEG;
  const hasSwing = Math.abs(swingDeg) > MOVEMENT_EPSILON_DEG;
  if (!hasTilt && !hasSwing) return "neutral";
  if (hasTilt && !hasSwing) return "tilt";
  if (!hasTilt && hasSwing) return "swing";
  return "compound";
};

export const getObliqueTabletopGeometryViewCopyKey = (
  geometryView: GeometryView,
): SimulatorMessageKey => {
  if (geometryView === "side") {
    return simulatorMessageKeys.geometry.obliqueTabletopSideView;
  }
  if (geometryView === "top") {
    return simulatorMessageKeys.geometry.obliqueTabletopTopView;
  }
  return simulatorMessageKeys.geometry.obliqueTabletopScheimpflugView;
};

export const getObliqueTabletopTeachingFeedbackKey = (
  state: ObliqueTabletopTeachingState,
): SimulatorMessageKey => {
  switch (state) {
    case "neutral":
      return simulatorMessageKeys.geometry.obliqueTabletopNeutralFeedback;
    case "tilt":
      return simulatorMessageKeys.geometry.obliqueTabletopTiltFeedback;
    case "swing":
      return simulatorMessageKeys.geometry.obliqueTabletopSwingFeedback;
    case "compound":
      return simulatorMessageKeys.geometry.obliqueTabletopCompoundFeedback;
  }
};
