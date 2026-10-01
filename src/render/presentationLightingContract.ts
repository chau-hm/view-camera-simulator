import * as THREE from "three";

export type PresentationLightingProfile = Readonly<{
  id: string;
  fill: Readonly<{
    skyColor: string;
    groundColor: string;
    intensity: number;
  }>;
  key: Readonly<{
    color: string;
    intensity: number;
    castsShadow: boolean;
    shadowMapSize: number;
    shadowBias: number;
    shadowNormalBias: number;
    shadowCamera: Readonly<{
      left: number;
      right: number;
      top: number;
      bottom: number;
      near: number;
      far: number;
    }>;
  }>;
}>;

/** Renderer-wide policy shared by the Observer and Ground Glass Canvases. */
export const PRESENTATION_SHADOW_MAP_TYPE = THREE.PCFShadowMap;

/** The existing teaching-assist recipe shared by Observer and Ground Glass. */
export const TEACHING_PRESENTATION_LIGHTING_PROFILE = {
  id: "teaching-default",
  fill: {
    skyColor: "#ffffff",
    groundColor: "#64748b",
    intensity: 0.55,
  },
  key: {
    color: "#ffffff",
    intensity: 1.15,
    castsShadow: true,
    shadowMapSize: 1024,
    shadowBias: -0.0002,
    shadowNormalBias: 0.015,
    shadowCamera: {
      left: -8,
      right: 8,
      top: 8,
      bottom: -8,
      near: 0.1,
      far: 32,
    },
  },
} as const satisfies PresentationLightingProfile;

export type PresentationLightingPlacement = Readonly<{
  targetWorld: readonly [number, number, number];
  keyOffsetWorld: readonly [number, number, number];
}>;

/** Default presentation-assist placement; independent of the light recipe. */
export const DEFAULT_PRESENTATION_LIGHTING_PLACEMENT = {
  targetWorld: [0, 0, 0],
  keyOffsetWorld: [-2.5, 3.5, -2.5],
} as const satisfies PresentationLightingPlacement;

export type ResolvedPresentationLighting = Readonly<{
  profile: PresentationLightingProfile;
  placement: PresentationLightingPlacement;
}>;

export const DEFAULT_PRESENTATION_LIGHTING: ResolvedPresentationLighting = {
  profile: TEACHING_PRESENTATION_LIGHTING_PROFILE,
  placement: DEFAULT_PRESENTATION_LIGHTING_PLACEMENT,
};
