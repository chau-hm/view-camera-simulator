import type { Vec3 } from "../../types/optics";
import { viewCameraAnatomyScene } from "../definitions/view-camera-anatomy";
import {
  lessonZeroGroundGlassSubjectCenterMm,
  lessonZeroGroundGlassSubjectGeometry,
  type LessonZeroGroundGlassSubjectGeometry,
} from "../lessonZeroGroundGlassSubject";

/** Canonical renderer-neutral teaching layout for the View Camera Anatomy asset. */
export type ViewCameraAnatomyPresentation = Readonly<{
  sceneId: typeof viewCameraAnatomyScene.id;
  geometry: LessonZeroGroundGlassSubjectGeometry;
  centerMm: Readonly<Vec3>;
}>;

export const VIEW_CAMERA_ANATOMY_PRESENTATION: ViewCameraAnatomyPresentation =
  Object.freeze({
    sceneId: viewCameraAnatomyScene.id,
    geometry: lessonZeroGroundGlassSubjectGeometry,
    centerMm: lessonZeroGroundGlassSubjectCenterMm,
  });
