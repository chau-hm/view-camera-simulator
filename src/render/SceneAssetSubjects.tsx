import { useEffect, useMemo } from "react";
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
  createRegisteredSceneAsset,
  disposeRegisteredSceneAsset,
} from "./assets/sceneAssetRegistry";
import type {
  SceneAssetKey,
  SceneAssetRequestMap,
} from "./assets/sceneAssetRegistry";
import { ARCHITECTURE_RISE_PRESENTATION } from "../scenes/presentation/architectureRise";
import { OBLIQUE_ARCHITECTURE_PRESENTATION } from "../scenes/presentation/obliqueArchitecture";
import { TABLE_TILT_PRESENTATION } from "../scenes/presentation/tableTilt";
import { SHELF_SWING_PRESENTATION } from "../scenes/presentation/shelfSwing";
import { ARCHITECTURE_FOREGROUND_PRESENTATION } from "../scenes/presentation/architectureForeground";
import { INTERIOR_CORNER_PRESENTATION } from "../scenes/presentation/interiorCorner";
import { OBLIQUE_TABLETOP_PRESENTATION } from "../scenes/presentation/obliqueTabletop";
import { FOCUS_FUNDAMENTALS_PRESENTATION } from "../scenes/presentation/focusFundamentals";
import { VIEW_CAMERA_ANATOMY_PRESENTATION } from "../scenes/presentation/viewCameraAnatomy";

type RegisteredAssetProps<K extends SceneAssetKey> = {
  assetKey: K;
  request: SceneAssetRequestMap[K];
};

const RegisteredSceneAsset = <K extends SceneAssetKey,>({
  assetKey,
  request,
}: RegisteredAssetProps<K>) => {
  const group = useMemo(
    () => createRegisteredSceneAsset(assetKey, request),
    [assetKey, request],
  );

  useEffect(
    () => () => disposeRegisteredSceneAsset(assetKey, group),
    [assetKey, group],
  );

  return <primitive object={group} dispose={null} />;
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
