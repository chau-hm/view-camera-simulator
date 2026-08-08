import type { SceneDefinition } from "../../types/scene";
import {
  focusFundamentalsObjectCenterMm,
  focusFundamentalsReferenceFocusDepthMm,
  focusFundamentalsSceneBoundsMm,
  focusTargetsDefs,
} from "../focusFundamentalsTargets";

export const focusFundamentalsTwoTargets: SceneDefinition = {
  id: "focus-fundamentals-two-targets",
  name: "Focus Fundamentals — Two Targets",
  description:
    "Focus two depths on the same object and compare front- and rear-standard focusing.",
  assets: [],
  cameraPreset: {
    focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
  },
  cameraPlacement: {
    // observer camera is offset to keep the open subject's front and back
    // structure readable alongside the physical camera standards.
    position: { x: 350, y: 180, z: -800 },
    target: focusFundamentalsObjectCenterMm,
  },
  bounds: focusFundamentalsSceneBoundsMm,
  focusTargets: focusTargetsDefs,
  compositionTargets: [],
  focusStandardCapability: {
    enabled: true,
    defaultStandard: "front",
    referenceFocusDepthMm: focusFundamentalsReferenceFocusDepthMm,
    minimumFocusDepthMm: focusFundamentalsSceneBoundsMm.min.z,
  },
};
