import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  computeOpticalSectionData,
  resolveCameraBodyRailWorldEndpoints,
} from "../../components/geometry/opticalSectionProjection";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { CameraBodyAssembly } from "../../render/CameraBodyAssembly";
import { resolveCameraRigRenderTransform } from "../../render/planeOrientation";
import { WORLD_SCALE } from "../../render/rttUtils";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import geometry from "../../scenes/understandingCameraMovementsGeometry";
import type { CameraState, GeometryView } from "../../types/camera";
import type { Vec3 } from "../../types/optics";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

type GroupProps = {
  name: string;
  position: [number, number, number];
  quaternion?: unknown;
  children: ReactNode;
};

type InspectableProps = {
  name?: string;
  children?: ReactNode;
  [key: string]: unknown;
};

const childrenOf = (element: ReactElement<InspectableProps>): ReactNode => {
  if (typeof element.type === "function") {
    return (element.type as (props: InspectableProps) => ReactNode)(element.props);
  }
  return element.props.children;
};

const hasNamedDescendant = (node: ReactNode, expectedName: string): boolean => {
  let found = false;
  Children.forEach(node, (child) => {
    if (found || typeof child !== "object" || child === null || !("props" in child)) {
      return;
    }
    const element = child as ReactElement<{
      name?: string;
      children?: ReactNode;
    }>;
    if (element.props.name === expectedName) {
      found = true;
      return;
    }
    found = hasNamedDescendant(childrenOf(element), expectedName);
  });
  return found;
};

const cameraFor = (pitchDeg: number): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  cameraBodyPitchDeg: pitchDeg,
  activeSceneId: understandingCameraMovementsScene.id,
});

const applyRenderHierarchy = (
  pointMm: Vec3,
  transform: ReturnType<typeof resolveCameraRigRenderTransform>,
): Vec3 => {
  const point = new Vector3(pointMm.x, pointMm.y, pointMm.z)
    .multiplyScalar(WORLD_SCALE)
    .add(new Vector3(...transform.localOffset))
    .applyQuaternion(transform.bodyPitch.quaternion)
    .add(new Vector3(...transform.bodyPitch.position))
    .applyQuaternion(transform.rigPlacement.quaternion)
    .add(new Vector3(...transform.rigPlacement.position))
    .multiplyScalar(1 / WORLD_SCALE);
  return { x: point.x, y: point.y, z: point.z };
};

const expectVecClose = (actual: Vec3, expected: Vec3): void => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
};

const projectionFor = (pitchDeg: number) => {
  const opticsState = deriveOpticsState(
    cameraFor(pitchDeg),
    understandingCameraMovementsScene,
  );
  return {
    opticsState,
    projection: computeOpticalSectionData({
      opticsState,
      scene: understandingCameraMovementsScene,
      svgWidth: 640,
      svgHeight: 360,
      depthWindow: { minMm: -500, maxMm: 6400 },
    }),
  };
};

describe("canonical camera-body render views", () => {
  it.each([-8, 8])(
    "builds one pivot hierarchy while keeping local standard geometry stable at %i°",
    (pitchDeg) => {
      const baseline = deriveOpticsState(
        cameraFor(0),
        understandingCameraMovementsScene,
      );
      const pitched = deriveOpticsState(
        cameraFor(pitchDeg),
        understandingCameraMovementsScene,
      );
      const transform = resolveCameraRigRenderTransform(
        pitched.cameraRigTransform,
      );

      expect(pitched.cameraBodyLocalGeometry).toEqual(
        baseline.cameraBodyLocalGeometry,
      );
      expectVecClose(
        applyRenderHierarchy(
          pitched.cameraBodyLocalGeometry.lensCenterLocal,
          transform,
        ),
        pitched.lensCenterWorld,
      );
      expectVecClose(
        applyRenderHierarchy(
          pitched.cameraBodyLocalGeometry.filmCenterLocal,
          transform,
        ),
        pitched.filmCenterWorld,
      );

      const tree = CameraBodyAssembly({
        opticsState: pitched,
      }) as ReactElement<GroupProps>;
      expect(tree.props.name).toBe("camera-rig-placement");
      expect(tree.props.position).toEqual(transform.rigPlacement.position);
      expect((tree.props.quaternion as Quaternion).toArray()).toEqual(
        transform.rigPlacement.quaternion.toArray(),
      );

      const pitchGroup = Children.only(tree.props.children) as ReactElement<GroupProps>;
      expect(pitchGroup.props.name).toBe("camera-body-pitch");
      expect(pitchGroup.props.position).toEqual(transform.bodyPitch.position);
      expect((pitchGroup.props.quaternion as Quaternion).toArray()).toEqual(
        transform.bodyPitch.quaternion.toArray(),
      );
      const localGroup = Children.only(pitchGroup.props.children) as ReactElement<GroupProps>;
      expect(localGroup.props.name).toBe("camera-body-local-geometry");
      expect(localGroup.props.position).toEqual(transform.localOffset);
      expect(hasNamedDescendant(localGroup.props.children, "camera-body-rail")).toBe(true);
      expect(
        hasNamedDescendant(localGroup.props.children, "camera-anatomy-camera-support"),
      ).toBe(true);
    },
  );

  it("uses the baseline local hierarchy and a separately identifiable ghost rail", () => {
    const baseline = deriveOpticsState(
      cameraFor(0),
      understandingCameraMovementsScene,
    );
    const tree = CameraBodyAssembly({
      opticsState: baseline,
      ghost: true,
    }) as ReactElement<GroupProps>;
    const pitchGroup = Children.only(tree.props.children) as ReactElement<GroupProps>;
    const localGroup = Children.only(pitchGroup.props.children) as ReactElement<GroupProps>;
    expect(tree.props.name).toBe("original-ghost-camera-rig-placement");
    expect(pitchGroup.props.name).toBe("original-ghost-camera-body-pitch");
    expect(
      hasNamedDescendant(localGroup.props.children, "original-ghost-camera-rail"),
    ).toBe(true);
    expect(
      hasNamedDescendant(localGroup.props.children, "camera-anatomy-camera-support"),
    ).toBe(true);
  });

  it("applies outer rig placement after body pitch and matches resolved world standards", () => {
    const camera: CameraState = {
      ...cameraFor(8),
      viewpointAnchor: "high",
      cameraRigPlacement: geometry.cameraRig.viewpointAnchors.high,
    };
    const opticsState = deriveOpticsState(
      camera,
      understandingCameraMovementsScene,
    );
    const transform = resolveCameraRigRenderTransform(
      opticsState.cameraRigTransform,
    );

    expectVecClose(
      applyRenderHierarchy(
        opticsState.cameraBodyLocalGeometry.lensCenterLocal,
        transform,
      ),
      opticsState.lensCenterWorld,
    );
    expectVecClose(
      applyRenderHierarchy(
        opticsState.cameraBodyLocalGeometry.filmCenterLocal,
        transform,
      ),
      opticsState.filmCenterWorld,
    );
    expectVecClose(
      applyRenderHierarchy(
        opticsState.cameraRigTransform.bodyPitchPivotRigLocal,
        transform,
      ),
      opticsState.cameraBodyPivotWorld,
    );
    expectVecClose(
      applyRenderHierarchy(geometry.cameraBody.rail.centerRigLocal, transform),
      opticsState.cameraBodyPivotWorld,
    );
  });

  it.each([-8, 8])(
    "projects the same canonical rail used by the 3D hierarchy at %i°",
    (pitchDeg) => {
      const { opticsState, projection } = projectionFor(pitchDeg);
      const transform = resolveCameraRigRenderTransform(
        opticsState.cameraRigTransform,
      );
      const railWorld = resolveCameraBodyRailWorldEndpoints(
        opticsState,
        understandingCameraMovementsScene,
      );
      expect(railWorld).not.toBeNull();
      expectVecClose(
        railWorld!.rear,
        applyRenderHierarchy(geometry.cameraBody.rail.rearEndpointRigLocal, transform),
      );
      expectVecClose(
        railWorld!.front,
        applyRenderHierarchy(geometry.cameraBody.rail.frontEndpointRigLocal, transform),
      );

      for (const viewId of ["side", "top", "scheimpflug"] as GeometryView[]) {
        const view = projection.views[viewId];
        const segment = view.physicalPlaneSegments.find(
          (candidate) => candidate.id === "camera-body-rail",
        );
        expect(segment, viewId).toBeDefined();
        expect(segment!.p1).toEqual(view.projectWorldPoint(railWorld!.rear));
        expect(segment!.p2).toEqual(view.projectWorldPoint(railWorld!.front));
        for (const value of [
          segment!.p1.x,
          segment!.p1.y,
          segment!.p2.x,
          segment!.p2.y,
        ]) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    },
  );

  it("changes the Side rail slope with pitch sign and leaves legacy scenes rail-free", () => {
    const negative = projectionFor(-8).projection.views.side.physicalPlaneSegments.find(
      (segment) => segment.id === "camera-body-rail",
    )!;
    const positive = projectionFor(8).projection.views.side.physicalPlaneSegments.find(
      (segment) => segment.id === "camera-body-rail",
    )!;
    const slope = (segment: typeof positive) =>
      (segment.p2.y - segment.p1.y) / (segment.p2.x - segment.p1.x);
    expect(slope(negative) * slope(positive)).toBeLessThan(0);

    const legacyOptics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...architectureRiseScene.cameraPreset,
        activeSceneId: architectureRiseScene.id,
      },
      architectureRiseScene,
    );
    const legacyProjection = computeOpticalSectionData({
      opticsState: legacyOptics,
      scene: architectureRiseScene,
      svgWidth: 640,
      svgHeight: 360,
      depthWindow: { minMm: -500, maxMm: 8000 },
    });
    for (const view of Object.values(legacyProjection.views)) {
      expect(
        view.physicalPlaneSegments.some(
          (segment) => segment.id === "camera-body-rail",
        ),
      ).toBe(false);
    }
  });
});
