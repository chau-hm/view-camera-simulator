import type { Bounds3, Vec3 } from "../../types/optics";
import { focusFundamentalsTwoTargets } from "../definitions/focus-fundamentals-two-targets";
import {
  focusFundamentalsBackdropColor,
  focusFundamentalsBackdropHorizontalMarginMm,
  focusFundamentalsBackdropRearMarginMm,
  focusFundamentalsBackdropVerticalMarginMm,
  focusFundamentalsFloorYmm,
  focusFundamentalsFocusDetails,
  focusFundamentalsFrameGeometry,
  focusFundamentalsMarkerSizeMm,
  focusFundamentalsObjectCenterMm,
  focusFundamentalsObjectRotationYRad,
  getFocusFundamentalsDetailMarkerLocalPosition,
  getFocusFundamentalsDetailMarkerRotationY,
  type FocusFundamentalsFocusDetail,
} from "../focusFundamentalsTargets";
import {
  focusFundamentalsConnectedSubjectBoundsMm,
  focusFundamentalsParallaxBracketBarWidthMm,
  focusFundamentalsParallaxFeatureRotationYRad,
  focusFundamentalsParallaxFeatureShapes,
  focusFundamentalsParallaxFeatures,
  focusFundamentalsParallaxPointerColor,
  focusFundamentalsParallaxSupportWidthMm,
} from "../focusFundamentalsParallax";

export type FocusFundamentalsPresentationDetail = Readonly<
  FocusFundamentalsFocusDetail & {
    markerLocalPositionMm: Vec3;
    markerRotationYRad: number;
  }
>;

/** Canonical millimetre data consumed by the Focus Fundamentals visual asset. */
export type FocusFundamentalsPresentation = Readonly<{
  sceneId: typeof focusFundamentalsTwoTargets.id;
  geometry: Readonly<{
    objectCenterMm: Readonly<Vec3>;
    objectRotationYRad: number;
    frame: typeof focusFundamentalsFrameGeometry;
    focusDetails: readonly FocusFundamentalsPresentationDetail[];
    markerSizeMm: typeof focusFundamentalsMarkerSizeMm;
    floorYmm: number;
    connectedSubjectBoundsMm: Bounds3;
    backdrop: Readonly<{
      color: typeof focusFundamentalsBackdropColor;
      horizontalMarginMm: number;
      verticalMarginMm: number;
      rearMarginMm: number;
    }>;
    parallax: Readonly<{
      features: typeof focusFundamentalsParallaxFeatures;
      featureShapes: typeof focusFundamentalsParallaxFeatureShapes;
      featureRotationYRad: number;
      bracketBarWidthMm: number;
      supportWidthMm: number;
      pointerColor: typeof focusFundamentalsParallaxPointerColor;
    }>;
  }>;
}>;

export const FOCUS_FUNDAMENTALS_PRESENTATION: FocusFundamentalsPresentation =
  Object.freeze({
    sceneId: focusFundamentalsTwoTargets.id,
    geometry: {
      objectCenterMm: focusFundamentalsObjectCenterMm,
      objectRotationYRad: focusFundamentalsObjectRotationYRad,
      frame: focusFundamentalsFrameGeometry,
      focusDetails: focusFundamentalsFocusDetails.map((detail) => ({
        ...detail,
        markerLocalPositionMm: getFocusFundamentalsDetailMarkerLocalPosition(detail),
        markerRotationYRad: getFocusFundamentalsDetailMarkerRotationY(detail),
      })),
      markerSizeMm: focusFundamentalsMarkerSizeMm,
      floorYmm: focusFundamentalsFloorYmm,
      connectedSubjectBoundsMm: focusFundamentalsConnectedSubjectBoundsMm,
      backdrop: {
        color: focusFundamentalsBackdropColor,
        horizontalMarginMm: focusFundamentalsBackdropHorizontalMarginMm,
        verticalMarginMm: focusFundamentalsBackdropVerticalMarginMm,
        rearMarginMm: focusFundamentalsBackdropRearMarginMm,
      },
      parallax: {
        features: focusFundamentalsParallaxFeatures,
        featureShapes: focusFundamentalsParallaxFeatureShapes,
        featureRotationYRad: focusFundamentalsParallaxFeatureRotationYRad,
        bracketBarWidthMm: focusFundamentalsParallaxBracketBarWidthMm,
        supportWidthMm: focusFundamentalsParallaxSupportWidthMm,
        pointerColor: focusFundamentalsParallaxPointerColor,
      },
    },
  } as const);
