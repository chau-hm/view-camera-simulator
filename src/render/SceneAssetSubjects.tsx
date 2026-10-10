import { useLayoutEffect, useState } from "react";
import type * as THREE from "three";
import {
  ARCHITECTURE_RISE_ASSET_KEY,
  ARCHITECTURE_FOREGROUND_ASSET_KEY,
  INTERIOR_CORNER_ASSET_KEY,
  OBLIQUE_TABLETOP_ASSET_KEY,
  OBLIQUE_ARCHITECTURE_ASSET_KEY,
  SHELF_SWING_ASSET_KEY,
  TABLE_TILT_ASSET_KEY,
  FOCUS_FUNDAMENTALS_ASSET_KEY,
  VIEW_CAMERA_ANATOMY_ASSET_KEY,
  MIRROR_SHIFT_ASSET_KEY,
  MACRO_BELLOWS_EXTENSION_ASSET_KEY,
  MACRO_DEPTH_OF_FIELD_ASSET_KEY,
  MACRO_OBLIQUE_PLANE_ASSET_KEY,
  MACRO_COMPOUND_MOVEMENTS_ASSET_KEY,
  FRINGE_CLUB_RUNTIME_ASSET_KEY,
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "./assets/sceneAssetRegistry";
import type {
  SceneAssetKey,
  SceneAssetRequestMap,
} from "./assets/sceneAssetRegistry";
import { useRefreshTeachingShadowParticipation } from "./TeachingLighting";
import { ARCHITECTURE_RISE_PRESENTATION } from "../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../scenes/presentation/obliqueArchitecture";
import { TABLE_TILT_PRESENTATION } from "../scenes/presentation/tableTilt";
import { SHELF_SWING_PRESENTATION } from "../scenes/presentation/shelfSwing";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../scenes/presentation/obliqueTabletop";
import { FOCUS_FUNDAMENTALS_PRESENTATION } from "../scenes/presentation/focusFundamentals";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../scenes/presentation/viewCameraAnatomy";
import { MIRROR_SHIFT_PRESENTATION } from "../scenes/presentation/mirrorShift";
import { MACRO_BELLOWS_EXTENSION_PRESENTATION } from "../scenes/presentation/macroBellowsExtension";
import { MACRO_DEPTH_OF_FIELD_PRESENTATION } from "../scenes/presentation/macroDepthOfField";
import { MACRO_OBLIQUE_PLANE_PRESENTATION } from "../scenes/presentation/macroObliquePlane";
import { MACRO_COMPOUND_MOVEMENTS_PRESENTATION } from "../scenes/presentation/macroCompoundMovements";

type RegisteredAssetProps<K extends SceneAssetKey> = {
  assetKey: K;
  request: SceneAssetRequestMap[K];
};

const RegisteredSceneAsset = <K extends SceneAssetKey,>({
  assetKey,
  request,
}: RegisteredAssetProps<K>) => {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const refreshShadowParticipation = useRefreshTeachingShadowParticipation();

  useLayoutEffect(() => {
    const nextGroup = createRegisteredSceneAsset(assetKey, request);
    setGroup(nextGroup);
    return () => disposeRegisteredSceneAsset(assetKey, nextGroup);
  }, [assetKey, request]);

  useLayoutEffect(() => {
    if (
      !import.meta.env.DEV ||
      assetKey !== VIEW_CAMERA_ANATOMY_ASSET_KEY ||
      !group ||
      group.name !== "view-camera-anatomy-subject"
    ) {
      return;
    }

    const container = document.querySelector<HTMLElement>(
      '[data-testid="scene-canvas"]',
    );
    const originalVisibility = group.visible;
    const setVisibility = (event: Event) => {
      const visible = (event as CustomEvent<unknown>).detail;
      if (typeof visible === "boolean") {
        group.visible = visible;
        container?.setAttribute(
          "data-observer-test-anatomy-subject-visible",
          String(group.visible),
        );
      }
    };

    window.addEventListener(
      "vcs:observer-verification:anatomy-visibility",
      setVisibility,
    );
    container?.setAttribute("data-observer-test-anatomy-visibility-hook", "ready");
    container?.setAttribute(
      "data-observer-test-anatomy-subject-visible",
      String(originalVisibility),
    );

    return () => {
      group.visible = originalVisibility;
      window.removeEventListener(
        "vcs:observer-verification:anatomy-visibility",
        setVisibility,
      );
      container?.removeAttribute("data-observer-test-anatomy-visibility-hook");
      container?.removeAttribute("data-observer-test-anatomy-subject-visible");
    };
  }, [assetKey, group]);

  useLayoutEffect(() => {
    if (group) refreshShadowParticipation();
  }, [group, refreshShadowParticipation]);

  return group ? <primitive object={group} dispose={null} /> : null;
};

const architectureRiseRequest = Object.freeze({
  presentation: ARCHITECTURE_RISE_PRESENTATION,
});
const obliqueArchitectureRequest = Object.freeze({
  presentation: OBLIQUE_ARCHITECTURE_PRESENTATION,
});
const tableTiltRequest = Object.freeze({ presentation: TABLE_TILT_PRESENTATION });
const shelfSwingRequest = Object.freeze({ presentation: SHELF_SWING_PRESENTATION });
const architectureForegroundRequest = Object.freeze({
  presentation: ARCHITECTURE_FOREGROUND_PRESENTATION,
});
const interiorCornerRequest = Object.freeze({
  presentation: INTERIOR_CORNER_PRESENTATION,
});
const obliqueTabletopRequest = Object.freeze({
  presentation: OBLIQUE_TABLETOP_PRESENTATION,
});
const focusFundamentalsRequest = Object.freeze({
  presentation: FOCUS_FUNDAMENTALS_PRESENTATION,
});
const viewCameraAnatomyRequest = Object.freeze({
  presentation: VIEW_CAMERA_ANATOMY_PRESENTATION,
});
const macroBellowsExtensionRequest: SceneAssetRequestMap[
  typeof MACRO_BELLOWS_EXTENSION_ASSET_KEY
] = Object.freeze({ presentation: MACRO_BELLOWS_EXTENSION_PRESENTATION });
const macroDepthOfFieldRequest: SceneAssetRequestMap[
  typeof MACRO_DEPTH_OF_FIELD_ASSET_KEY
] = Object.freeze({ presentation: MACRO_DEPTH_OF_FIELD_PRESENTATION });
const macroObliquePlaneRequest: SceneAssetRequestMap[
  typeof MACRO_OBLIQUE_PLANE_ASSET_KEY
] = Object.freeze({ presentation: MACRO_OBLIQUE_PLANE_PRESENTATION });
const macroCompoundMovementsRequest: SceneAssetRequestMap[
  typeof MACRO_COMPOUND_MOVEMENTS_ASSET_KEY
] = Object.freeze({ presentation: MACRO_COMPOUND_MOVEMENTS_PRESENTATION });
const mirrorShiftViewportRequest: SceneAssetRequestMap[
  typeof MIRROR_SHIFT_ASSET_KEY
] = Object.freeze({
  presentation: MIRROR_SHIFT_PRESENTATION,
  representation: "viewport",
});

/** Interactive scene consumers share the exact registered factories used by RTT. */
export const ArchitectureRiseSubject = () => (
  <RegisteredSceneAsset
    assetKey={ARCHITECTURE_RISE_ASSET_KEY}
    request={architectureRiseRequest}
  />
);

export const ObliqueArchitectureSubject = () => (
  <RegisteredSceneAsset
    assetKey={OBLIQUE_ARCHITECTURE_ASSET_KEY}
    request={obliqueArchitectureRequest}
  />
);

export const TableTiltSubject = () => (
  <RegisteredSceneAsset assetKey={TABLE_TILT_ASSET_KEY} request={tableTiltRequest} />
);

export const ShelfSwingSubject = () => (
  <RegisteredSceneAsset assetKey={SHELF_SWING_ASSET_KEY} request={shelfSwingRequest} />
);

export const ArchitectureForegroundSubject = () => (
  <RegisteredSceneAsset
    assetKey={ARCHITECTURE_FOREGROUND_ASSET_KEY}
    request={architectureForegroundRequest}
  />
);

export const InteriorCornerSubject = () => (
  <RegisteredSceneAsset
    assetKey={INTERIOR_CORNER_ASSET_KEY}
    request={interiorCornerRequest}
  />
);

export const ObliqueTabletopSubject = () => (
  <RegisteredSceneAsset
    assetKey={OBLIQUE_TABLETOP_ASSET_KEY}
    request={obliqueTabletopRequest}
  />
);

export const FocusFundamentalsSubject = () => (
  <RegisteredSceneAsset
    assetKey={FOCUS_FUNDAMENTALS_ASSET_KEY}
    request={focusFundamentalsRequest}
  />
);

export const ViewCameraAnatomySubject = () => (
  <RegisteredSceneAsset
    assetKey={VIEW_CAMERA_ANATOMY_ASSET_KEY}
    request={viewCameraAnatomyRequest}
  />
);

export const MacroSpecimenSubject = () => (
  <RegisteredSceneAsset
    assetKey={MACRO_BELLOWS_EXTENSION_ASSET_KEY}
    request={macroBellowsExtensionRequest}
  />
);

export const MacroDepthOfFieldSubject = () => (
  <RegisteredSceneAsset
    assetKey={MACRO_DEPTH_OF_FIELD_ASSET_KEY}
    request={macroDepthOfFieldRequest}
  />
);

export const MacroObliquePlaneSubject = () => (
  <RegisteredSceneAsset
    assetKey={MACRO_OBLIQUE_PLANE_ASSET_KEY}
    request={macroObliquePlaneRequest}
  />
);

export const MacroCompoundMovementsSubject = () => (
  <RegisteredSceneAsset
    assetKey={MACRO_COMPOUND_MOVEMENTS_ASSET_KEY}
    request={macroCompoundMovementsRequest}
  />
);

export const MirrorShiftSubject = () => (
  <RegisteredSceneAsset
    assetKey={MIRROR_SHIFT_ASSET_KEY}
    request={mirrorShiftViewportRequest}
  />
);

/** Development fixture consumer; deliberately absent from sceneSubjectRegistry. */
export const FringeClubRuntimeSubject = ({
  request,
}: {
  request: SceneAssetRequestMap[typeof FRINGE_CLUB_RUNTIME_ASSET_KEY];
}) => (
  <RegisteredSceneAsset
    assetKey={FRINGE_CLUB_RUNTIME_ASSET_KEY}
    request={request}
  />
);
