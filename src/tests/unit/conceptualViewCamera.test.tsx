import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Quaternion, Shape } from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CONCEPTUAL_CAMERA_ANATOMY_PARTS,
  CONCEPTUAL_CAMERA_SUPPORT_RAIL,
  renderConceptualViewCamera,
  resolveConceptualAnatomyElementState,
  resolveConceptualAnatomyPartState,
  resolveConceptualSupportBeam,
  resolveGenericConceptualSupportRail,
} from "../../render/ConceptualViewCamera";
import {
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "../../render/planeOrientation";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import {
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM,
  CONCEPTUAL_LENS_APERTURE_VISIBILITY_WINDOW_SEGMENT_COUNT,
  CONCEPTUAL_LENS_DIAPHRAGM_HOUSING_MASK_OFFSET_MM,
  CONCEPTUAL_LENS_DIAPHRAGM_HOUSING_OUTER_RADIUS_MM,
  CONCEPTUAL_LENS_IRIS_BLADE_COUNT,
  resolveConceptualImageCircleGeometry,
  resolveConceptualApertureBladePolygons,
  resolveConceptualApertureBlades,
  resolveConceptualApertureOpening,
  resolveConceptualGroundGlassGeometry,
} from "../../render/conceptualCameraAnatomyGeometry";
import { WORLD_SCALE } from "../../render/rttUtils";

type InspectableProps = {
  name?: string;
  position?: [number, number, number];
  quaternion?: Quaternion;
  children?: ReactNode;
  [key: string]: unknown;
};

const childrenOf = (element: ReactElement<InspectableProps>): ReactNode => {
  if (typeof element.type === "function") {
    return (element.type as (props: InspectableProps) => ReactNode)(element.props);
  }
  return element.props.children;
};

const findNamedElement = (
  node: ReactNode,
  expectedName: string,
): ReactElement<InspectableProps> | null => {
  let found: ReactElement<InspectableProps> | null = null;
  Children.forEach(node, (child) => {
    if (found || typeof child !== "object" || child === null || !("props" in child)) {
      return;
    }
    const element = child as ReactElement<InspectableProps>;
    if (element.props.name === expectedName) {
      found = element;
      return;
    }
    found = findNamedElement(childrenOf(element), expectedName);
  });
  return found;
};

const collectNamedElements = (
  node: ReactNode,
  predicate: (name: string) => boolean,
): ReactElement<InspectableProps>[] => {
  const result: ReactElement<InspectableProps>[] = [];
  Children.forEach(node, (child) => {
    if (typeof child !== "object" || child === null || !("props" in child)) {
      return;
    }
    const element = child as ReactElement<InspectableProps>;
    if (element.props.name && predicate(element.props.name)) {
      result.push(element);
    }
    result.push(...collectNamedElements(childrenOf(element), predicate));
  });
  return result;
};

const geometryArgs = (
  element: ReactElement<InspectableProps>,
  type: string,
): number[] => {
  const child = Children.toArray(element.props.children).find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "props" in candidate &&
      (candidate as ReactElement).type === type,
  );
  if (!child || typeof child !== "object" || !("props" in child)) {
    throw new Error(`Expected ${type} child`);
  }
  return (child as ReactElement<{ args: number[] }>).props.args;
};

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  ...overrides,
});

const anatomyCameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...viewCameraAnatomyScene.cameraPreset,
  activeSceneId: viewCameraAnatomyScene.id,
  ...overrides,
});

const focusComparisonCameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...focusFundamentalsTwoTargets.cameraPreset,
  activeSceneId: focusFundamentalsTwoTargets.id,
  ...overrides,
});

const expectQuaternionEqual = (actual: unknown, expected: Quaternion): void => {
  expect(((actual as Quaternion | undefined) ?? new Quaternion()).toArray()).toEqual(expected.toArray());
};

const cameraSupportFor = (
  tree: ReactNode,
): {
  rail: ReactElement<InspectableProps>;
  frontMount: ReactElement<InspectableProps>;
  rearMount: ReactElement<InspectableProps>;
} => {
  const rail = findNamedElement(tree, "camera-body-rail");
  const frontMount = findNamedElement(tree, "camera-support-front-mount");
  const rearMount = findNamedElement(tree, "camera-support-rear-mount");
  expect(rail).not.toBeNull();
  expect(frontMount).not.toBeNull();
  expect(rearMount).not.toBeNull();
  return {
    rail: rail!,
    frontMount: frontMount!,
    rearMount: rearMount!,
  };
};

describe("Conceptual View Camera v2 static anatomy", () => {
  it("keeps front/rear focus parts and support under one canonical rig-local camera root", () => {
    const reference = deriveOpticsState(
      focusComparisonCameraFor({
        focusStandard: "front",
        focusDistanceMm: focusFundamentalsReferenceFocusDepthMm,
      }),
      focusFundamentalsTwoTargets,
    );
    const frontFocus = deriveOpticsState(
      focusComparisonCameraFor({
        focusStandard: "front",
        focusDistanceMm: focusFundamentalsNearFocusDepthMm,
      }),
      focusFundamentalsTwoTargets,
    );
    const rearFocus = deriveOpticsState(
      focusComparisonCameraFor({
        focusStandard: "rear",
        focusDistanceMm: focusFundamentalsNearFocusDepthMm,
      }),
      focusFundamentalsTwoTargets,
    );

    const inspectAssembly = (opticsState: ReturnType<typeof deriveOpticsState>) => {
      const tree = renderConceptualViewCamera({ opticsState });
      const root = findNamedElement(tree, "camera-rig-placement");
      const localGeometry = findNamedElement(tree, "camera-body-local-geometry");
      expect(root?.props.userData).toMatchObject({ cameraAssemblyRoot: true });
      expect(localGeometry).not.toBeNull();

      for (const part of CONCEPTUAL_CAMERA_ANATOMY_PARTS.filter(
        (candidate) => candidate !== "film-holder",
      )) {
        expect(
          findNamedElement(localGeometry!.props.children, `camera-anatomy-${part}`),
          `${part} must remain inside the shared local camera assembly`,
        ).not.toBeNull();
      }

      const canonicalLocal = opticsState.cameraBodyLocalGeometry;
      const frontFrame = findNamedElement(tree, "front-standard-frame");
      const rearFrame = findNamedElement(tree, "rear-standard-frame");
      const supportRail = findNamedElement(tree, "camera-body-rail");
      const frontMount = findNamedElement(tree, "camera-support-front-mount");
      const rearMount = findNamedElement(tree, "camera-support-rear-mount");
      const supportRailDatum = resolveGenericConceptualSupportRail(
        canonicalLocal.rearStandardFrameLocal.centerWorld,
      );
      expect(frontFrame?.props.position).toEqual(
        resolveFrontStandardRenderTransform(
          canonicalLocal.lensCenterLocal,
          canonicalLocal.lensNormalLocal,
        ).position,
      );
      expect(rearFrame?.props.position).toEqual(
        resolveRearStandardRenderTransform(
          canonicalLocal.rearStandardFrameLocal,
        ).position,
      );
      expect(supportRail?.props.position).toEqual([
        supportRailDatum.centerRigLocal.x * WORLD_SCALE,
        supportRailDatum.centerRigLocal.y * WORLD_SCALE,
        supportRailDatum.centerRigLocal.z * WORLD_SCALE,
      ]);
      return {
        frontFrame: frontFrame!,
        rearFrame: rearFrame!,
        supportRail: supportRail!,
        frontMount: frontMount!,
        rearMount: rearMount!,
      };
    };

    const referenceAssembly = inspectAssembly(reference);
    const frontAssembly = inspectAssembly(frontFocus);
    const rearAssembly = inspectAssembly(rearFocus);
    const filmHolderTree = renderConceptualViewCamera({
      opticsState: reference,
      rearBackMode: "film-holder",
    });
    const filmHolderGeometry = findNamedElement(
      findNamedElement(filmHolderTree, "camera-body-local-geometry")?.props.children,
      "camera-anatomy-film-holder",
    );
    expect(filmHolderGeometry).not.toBeNull();
    expect(findNamedElement(filmHolderGeometry?.props.children, "film-holder-film-surface")).not.toBeNull();

    expect(frontAssembly.frontFrame.props.position).not.toEqual(
      referenceAssembly.frontFrame.props.position,
    );
    expect(frontAssembly.rearFrame.props.position).toEqual(
      referenceAssembly.rearFrame.props.position,
    );
    expect(frontAssembly.supportRail.props.position).toEqual(
      referenceAssembly.supportRail.props.position,
    );
    expect(rearAssembly.frontFrame.props.position).toEqual(
      referenceAssembly.frontFrame.props.position,
    );
    expect(rearAssembly.rearFrame.props.position).not.toEqual(
      referenceAssembly.rearFrame.props.position,
    );
    expect(rearAssembly.supportRail.props.position).toEqual(
      referenceAssembly.supportRail.props.position,
    );
    expect(rearAssembly.frontMount.props.position).toEqual(
      referenceAssembly.frontMount.props.position,
    );
    expect(rearAssembly.rearMount.props.position).not.toEqual(
      referenceAssembly.rearMount.props.position,
    );
  });

  it("resolves semantic anatomy presentation without mutating shared materials", () => {
    const bellowsPresentation = { targets: [{ kind: "part", part: "bellows" }] } as const;
    expect(resolveConceptualAnatomyPartState("bellows", bellowsPresentation)).toBe("highlighted");
    expect(resolveConceptualAnatomyPartState("lens", bellowsPresentation)).toBe("dimmed");
    expect(resolveConceptualAnatomyPartState("camera-support", undefined)).toBe("normal");

    const aperturePresentation = {
      targets: [{ kind: "element", name: "lens-aperture-iris", parentPart: "lens" }],
    } as const;
    expect(resolveConceptualAnatomyPartState("lens", aperturePresentation)).toBe("highlighted");
    expect(resolveConceptualAnatomyElementState("lens-aperture-iris", "lens", aperturePresentation)).toBe("highlighted");
    expect(resolveConceptualAnatomyPartState("lens-board", aperturePresentation)).toBe("dimmed");

    const tree = renderConceptualViewCamera({
      opticsState: deriveOpticsState(cameraFor(), architectureRiseScene),
      presentation: { anatomy: bellowsPresentation },
    });
    const bellows = findNamedElement(tree, "bellows-folded-surface");
    const lens = findNamedElement(tree, "lens-front-barrel");
    expect(bellows?.props).toMatchObject({ name: "bellows-folded-surface" });
    expect(lens?.props).toMatchObject({ name: "lens-front-barrel" });
  });

  it("provides stable semantic part IDs for current and ghost variants", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const current = renderConceptualViewCamera({ opticsState, variant: "current" });
    const ghost = renderConceptualViewCamera({ opticsState, variant: "ghost" });

    for (const part of CONCEPTUAL_CAMERA_ANATOMY_PARTS.filter((part) => part !== "film-holder")) {
      const name = `camera-anatomy-${part}`;
      expect(findNamedElement(current, name), `current ${part}`).not.toBeNull();
      expect(findNamedElement(ghost, name), `ghost ${part}`).not.toBeNull();
    }
    expect(current.type).toBe(ghost.type);
    expect(findNamedElement(current, "camera-anatomy-bellows")).not.toBeNull();
  });

  it("places the front assembly and rear focusing back from canonical frames", () => {
    const opticsState = deriveOpticsState(
      cameraFor({
        frontRiseMm: 10,
        frontShiftMm: 9,
        frontTiltDeg: -3,
        frontSwingDeg: 4,
        rearRiseMm: 15,
        rearShiftMm: -12,
        rearTiltDeg: 4,
        rearSwingDeg: 5,
      }),
      architectureRiseScene,
    );
    const tree = renderConceptualViewCamera({ opticsState });
    const frontFrame = findNamedElement(tree, "front-standard-frame");
    const rearFrame = findNamedElement(tree, "rear-standard-frame");
    const groundGlass = findNamedElement(tree, "camera-anatomy-ground-glass-back");

    expect(frontFrame).not.toBeNull();
    expect(rearFrame).not.toBeNull();
    expect(groundGlass).not.toBeNull();

    const expectedFront = resolveFrontStandardRenderTransform(
      opticsState.lensCenterWorld,
      opticsState.lensNormalWorld,
    );
    const expectedRear = resolveRearStandardRenderTransform(
      opticsState.rearStandardFrame,
    );
    expect(frontFrame!.props.position).toEqual(expectedFront.position);
    expectQuaternionEqual(frontFrame!.props.quaternion, expectedFront.quaternion);
    expect(rearFrame!.props.position).toEqual(expectedRear.position);
    expectQuaternionEqual(rearFrame!.props.quaternion, expectedRear.quaternion);
    expect(groundGlass!.props.position).toEqual([0, 0, 0]);
  });

  it("renders the film-holder variant through the same rear-standard hierarchy", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const current = renderConceptualViewCamera({
      opticsState,
      rearBackMode: "film-holder",
    });
    const ghost = renderConceptualViewCamera({
      opticsState,
      variant: "ghost",
      rearBackMode: "film-holder",
    });

    expect(findNamedElement(current, "camera-anatomy-film-holder")).not.toBeNull();
    expect(findNamedElement(ghost, "camera-anatomy-film-holder")).not.toBeNull();
    expect(findNamedElement(current, "camera-anatomy-ground-glass-back")).toBeNull();
    expect(findNamedElement(current, "film-holder-body")).not.toBeNull();
    expect(findNamedElement(current, "film-holder-film-surface")).not.toBeNull();
    expect(findNamedElement(current, "rear-standard-frame")).not.toBeNull();
  });

  it("renders the Image Circle illustration only when the presentation requests it", () => {
    const opticsState = deriveOpticsState(anatomyCameraFor(), viewCameraAnatomyScene);
    const withoutImageCircle = renderConceptualViewCamera({ opticsState });
    const withImageCircle = renderConceptualViewCamera({
      opticsState,
      presentation: { imageCircle: { visible: true } },
    });
    const surface = resolveConceptualImageCircleGeometry(
      resolveConceptualGroundGlassGeometry().surface,
    );

    expect(findNamedElement(withoutImageCircle, "lesson-image-circle")).toBeNull();
    expect(findNamedElement(withImageCircle, "lesson-image-circle")).not.toBeNull();
    expect(findNamedElement(withImageCircle, "lesson-image-circle-surface")).not.toBeNull();
    expect(findNamedElement(withImageCircle, "lesson-image-circle-outline")).not.toBeNull();

    const circleSurface = findNamedElement(withImageCircle, "lesson-image-circle-surface");
    const circleGroup = findNamedElement(withImageCircle, "lesson-image-circle");
    const filmSurface = findNamedElement(withImageCircle, "ground-glass-screen");
    expect(geometryArgs(circleSurface!, "circleGeometry")[0]).toBeCloseTo(
      surface.radiusMm * WORLD_SCALE,
    );
    expect(filmSurface).not.toBeNull();
    expect(circleGroup!.props.position).toEqual(filmSurface!.props.position);
  });

  it("keeps the Ground Glass and film surface coincident under rear-standard movement", () => {
    const opticsState = deriveOpticsState(
      cameraFor({
        rearRiseMm: 18,
        rearShiftMm: -14,
        rearTiltDeg: 6,
        rearSwingDeg: -5,
      }),
      architectureRiseScene,
    );
    const groundGlassTree = renderConceptualViewCamera({ opticsState });
    const filmHolderTree = renderConceptualViewCamera({
      opticsState,
      rearBackMode: "film-holder",
    });
    const screen = findNamedElement(groundGlassTree, "ground-glass-screen");
    const film = findNamedElement(filmHolderTree, "film-holder-film-surface");
    const rearFrame = findNamedElement(filmHolderTree, "rear-standard-frame");

    expect(screen).not.toBeNull();
    expect(film).not.toBeNull();
    expect(rearFrame).not.toBeNull();
    expect(screen!.props.position).toEqual([0, 0, 0]);
    expect(film!.props.position).toEqual([0, 0, 0]);
    expect(geometryArgs(screen!, "planeGeometry")).toEqual(
      geometryArgs(film!, "planeGeometry"),
    );
    expectQuaternionEqual(
      rearFrame!.props.quaternion,
      resolveRearStandardRenderTransform(opticsState.rearStandardFrame).quaternion,
    );
    expect(findNamedElement(groundGlassTree, "film-holder-film-surface")).toBeNull();
    expect(findNamedElement(filmHolderTree, "ground-glass-screen")).toBeNull();
  });

  it("derives a rotating off-axis diaphragm from the canonical aperture input", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const wide = renderConceptualViewCamera({ opticsState, aperture: 5.6 });
    const narrow = renderConceptualViewCamera({ opticsState, aperture: 32 });
    const wideInterior = findNamedElement(wide, "lens-aperture-interior");
    const narrowInterior = findNamedElement(narrow, "lens-aperture-interior");
    const isBladeGroup = (name: string) => /^lens-aperture-blade-\d+$/.test(name);
    const wideBlades = collectNamedElements(wide, isBladeGroup);
    const narrowBlades = collectNamedElements(narrow, isBladeGroup);
    const wideBladeSurface = findNamedElement(wide, "lens-aperture-blade-0-surface");
    const wideBladeMaterial = Children.toArray(wideBladeSurface?.props.children).find(
      (child) =>
        typeof child === "object" &&
        child !== null &&
        "props" in child &&
        (child as ReactElement).type === "meshStandardMaterial",
    ) as ReactElement<InspectableProps> | undefined;

    expect(findNamedElement(wide, "lens-aperture-iris")).not.toBeNull();
    expect(wideInterior).not.toBeNull();
    expect(narrowInterior).not.toBeNull();
    expect(findNamedElement(wide, "lens-aperture-opening")).toBeNull();
    expect(geometryArgs(wideInterior!, "circleGeometry")).toEqual(
      geometryArgs(narrowInterior!, "circleGeometry"),
    );
    expect(wideBlades).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(narrowBlades).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(wideBlades[0].props.position).toEqual([0, 0, 0]);
    expect(wideBlades[0].props.position).toEqual(narrowBlades[0].props.position);
    expect(wideBlades.every((blade) => blade.props.position?.[0] === 0 && blade.props.position?.[1] === 0)).toBe(true);
    expect(wideBlades.every((blade) => blade.props.rotation === undefined)).toBe(true);
    expect(wideBladeSurface).not.toBeNull();
    expect(geometryArgs(wideBladeSurface!, "shapeGeometry")).toHaveLength(1);
    expect(wideBladeMaterial?.props.depthTest).toBe(true);
    expect(wideBladeMaterial?.props.depthWrite).toBe(true);
    expect(
      wideBlades.every((blade) =>
        blade.props.position &&
        Children.toArray(blade.props.children).some((child) =>
          typeof child === "object" &&
          child !== null &&
          "props" in child &&
          (child as ReactElement<{ name?: string }>).props.name?.endsWith("-surface"),
        ),
      ),
    ).toBe(true);
    for (const blade of wideBlades) {
      const surface = findNamedElement(wide, `${blade.props.name}-surface`);
      expect(surface).not.toBeNull();
      const shape = geometryArgs(surface!, "shapeGeometry")[0] as unknown as Shape;
      expect(shape.getPoints(1).every((point) =>
        Math.hypot(point.x, point.y) <= CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM * WORLD_SCALE + 1e-6,
      )).toBe(true);
    }
    expect(findNamedElement(wide, "camera-anatomy-lens")).not.toBeNull();

    const mask = findNamedElement(wide, "lens-aperture-housing-mask");
    const maskMaterial = Children.toArray(mask?.props.children).find(
      (child) =>
        typeof child === "object" &&
        child !== null &&
        "props" in child &&
        (child as ReactElement).type === "meshStandardMaterial",
    ) as ReactElement<InspectableProps> | undefined;
    const frontBarrel = findNamedElement(wide, "lens-front-barrel");

    expect(mask).not.toBeNull();
    expect(frontBarrel).not.toBeNull();
    const maskGeometry = geometryArgs(mask!, "ringGeometry");
    expect(maskGeometry).toEqual([
      CONCEPTUAL_LENS_APERTURE_OUTER_RADIUS_MM * WORLD_SCALE,
      CONCEPTUAL_LENS_DIAPHRAGM_HOUSING_OUTER_RADIUS_MM * WORLD_SCALE,
      CONCEPTUAL_LENS_APERTURE_VISIBILITY_WINDOW_SEGMENT_COUNT,
    ]);
    expect(maskGeometry[0]).toBeGreaterThan(
      resolveConceptualApertureOpening({ aperture: 32 }).openingRadiusMm * WORLD_SCALE,
    );
    expect(maskGeometry[1]).toBe(
      geometryArgs(frontBarrel!, "cylinderGeometry")[0],
    );
    const maximumMechanicalRadius = Math.max(
      ...resolveConceptualApertureBladePolygons(
        resolveConceptualApertureBlades({ aperture: 5.6 }),
      ).flatMap((polygon) => polygon.map((point) => Math.hypot(point.x, point.y))),
    );
    expect(maximumMechanicalRadius).toBeGreaterThan(
      CONCEPTUAL_LENS_DIAPHRAGM_HOUSING_OUTER_RADIUS_MM,
    );
    expect(mask!.props.position).toEqual([
      0,
      0,
      CONCEPTUAL_LENS_DIAPHRAGM_HOUSING_MASK_OFFSET_MM * WORLD_SCALE,
    ]);
    expect(mask!.props.position![2]).toBeGreaterThan(wideBlades[0].props.position![2]);
    expect(mask!.props.position![2]).toBeLessThan(
      findNamedElement(wide, "lens-front-glass")!.props.position![2],
    );
    expect(maskMaterial?.props.color).toBe("#111827");
    expect(maskMaterial?.props.depthTest).toBe(true);
    expect(maskMaterial?.props.depthWrite).toBe(true);
  });

  it("uses a transparent convex front element so the highlighted diaphragm remains readable", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const tree = renderConceptualViewCamera({
      opticsState,
      aperture: 5.6,
      presentation: {
        anatomy: {
          targets: [{ kind: "element", name: "lens-aperture-iris", parentPart: "lens" }],
        },
      },
    });
    const glass = findNamedElement(tree, "lens-front-glass");
    const iris = findNamedElement(tree, "lens-aperture-iris");

    expect(glass).not.toBeNull();
    expect(geometryArgs(glass!, "sphereGeometry")[0]).toBeGreaterThan(0);
    expect(glass!.props.scale).toEqual([1, 1, 0.22]);
    expect(glass!.props.renderOrder).toBe(0);
    expect(iris).not.toBeNull();
  });

  it("uses one shared hollow procedural bellows mesh between canonical standards", () => {
    const opticsState = deriveOpticsState(
      cameraFor({ frontRiseMm: 12, rearRiseMm: 18, rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    const tree = renderConceptualViewCamera({ opticsState });
    const bellows = findNamedElement(tree, "camera-anatomy-bellows");
    const surface = findNamedElement(tree, "bellows-folded-surface");

    expect(bellows).not.toBeNull();
    expect(surface).not.toBeNull();
    expect(surface!.props).toMatchObject({
      name: "bellows-folded-surface",
      frustumCulled: false,
    });
    expect(collectNamedElements(tree, (name) => name.startsWith("bellows-fold-"))).toHaveLength(0);
  });

  it("can omit the static bellows without changing the standard anatomy", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const tree = renderConceptualViewCamera({ opticsState, showBellows: false });

    expect(findNamedElement(tree, "camera-anatomy-bellows")).toBeNull();
    expect(findNamedElement(tree, "camera-anatomy-front-standard")).not.toBeNull();
    expect(findNamedElement(tree, "camera-anatomy-rear-standard")).not.toBeNull();
  });

  it.each([
    ["front rise", { frontRiseMm: 20 }, "front", "position"],
    ["rear rise", { rearRiseMm: 20 }, "rear", "position"],
    ["front shift", { frontShiftMm: 20 }, "front", "position"],
    ["rear shift", { rearShiftMm: 20 }, "rear", "position"],
    ["front tilt", { frontTiltDeg: 6 }, "front", "orientation"],
    ["rear tilt", { rearTiltDeg: 6 }, "rear", "orientation"],
    ["front swing", { frontSwingDeg: 6 }, "front", "orientation"],
    ["rear swing", { rearSwingDeg: 6 }, "rear", "orientation"],
  ] as const)(
    "%s leaves the generic support datum independent of standard movement",
    (_label, overrides, standard, expectedChange) => {
      const neutral = cameraSupportFor(
        renderConceptualViewCamera({
          opticsState: deriveOpticsState(cameraFor(), architectureRiseScene),
        }),
      );
      const movedOptics = deriveOpticsState(
        cameraFor(overrides),
        architectureRiseScene,
      );
      const moved = cameraSupportFor(renderConceptualViewCamera({ opticsState: movedOptics }));

      expect(moved.rail.props.position).toEqual(neutral.rail.props.position);
      expectQuaternionEqual(moved.rail.props.quaternion, neutral.rail.props.quaternion as Quaternion);
      expect(moved.frontMount.props.position).toEqual(neutral.frontMount.props.position);
      expect(moved.rearMount.props.position).toEqual(neutral.rearMount.props.position);

      const standardFrame = findNamedElement(
        renderConceptualViewCamera({ opticsState: movedOptics }),
        `${standard}-standard-frame`,
      );
      const neutralFrame = findNamedElement(
        renderConceptualViewCamera({
          opticsState: deriveOpticsState(cameraFor(), architectureRiseScene),
        }),
        `${standard}-standard-frame`,
      );
      expect(standardFrame).not.toBeNull();
      expect(neutralFrame).not.toBeNull();
      if (expectedChange === "orientation") {
        expect(standardFrame!.props.quaternion).not.toEqual(neutralFrame!.props.quaternion);
      } else {
        expect(standardFrame!.props.position).not.toEqual(neutralFrame!.props.position);
      }
    },
  );

  it("keeps the front support datum fixed and contains the canonical rear carriage while focusing", () => {
    const neutralOptics = deriveOpticsState(
      anatomyCameraFor({ focusStandard: "front", focusDistanceMm: 2000 }),
      viewCameraAnatomyScene,
    );
    const frontFocusOptics = deriveOpticsState(
      anatomyCameraFor({ focusStandard: "front", focusDistanceMm: 2200 }),
      viewCameraAnatomyScene,
    );
    const rearFocusOptics = deriveOpticsState(
      anatomyCameraFor({ focusStandard: "rear", focusDistanceMm: 2200 }),
      viewCameraAnatomyScene,
    );
    const neutralSupport = cameraSupportFor(
      renderConceptualViewCamera({ opticsState: neutralOptics }),
    );

    for (const movedOptics of [frontFocusOptics, rearFocusOptics]) {
      const movedSupport = cameraSupportFor(
        renderConceptualViewCamera({ opticsState: movedOptics }),
      );
      const rearCenter = movedOptics.cameraBodyLocalGeometry.rearStandardFrameLocal.centerWorld;
      const expectedRail = resolveGenericConceptualSupportRail(rearCenter);
      const expectedBeam = resolveConceptualSupportBeam(expectedRail, movedOptics.cameraRigTransform);
      expect(movedSupport.rail.props.position).toEqual(expectedBeam.position);
      expectQuaternionEqual(
        movedSupport.rail.props.quaternion,
        neutralSupport.rail.props.quaternion as Quaternion,
      );
      movedSupport.frontMount.props.position!.forEach((value, axis) => {
        expect(value).toBeCloseTo(neutralSupport.frontMount.props.position![axis], 12);
      });
      expect(movedSupport.rearMount.props.position![2]).toBeCloseTo(rearCenter.z * WORLD_SCALE, 12);
    }
  });

  it.each([180, 225, 300])("renders the rear mount at the supplied canonical %s mm extension", (distance) => {
    const optics = deriveOpticsState(anatomyCameraFor({}), viewCameraAnatomyScene);
    // Supply canonical frames directly: this tests render plumbing, not thin-lens math.
    const rear = { x: 0, y: 0, z: -distance };
    const supplied = {
      ...optics,
      rearStandardFrame: { ...optics.rearStandardFrame, centerWorld: rear },
      cameraBodyLocalGeometry: {
        ...optics.cameraBodyLocalGeometry,
        rearStandardFrameLocal: { ...optics.cameraBodyLocalGeometry.rearStandardFrameLocal, centerWorld: rear },
      },
    };
    const support = cameraSupportFor(renderConceptualViewCamera({ opticsState: supplied }));
    expect(support.rearMount.props.position![2]).toBeCloseTo(-distance * WORLD_SCALE, 12);
    expect(support.frontMount.props.position![2]).toBeCloseTo(0, 12);
    expect(support.frontMount.props.position![2] - support.rearMount.props.position![2]).toBeCloseTo(distance * WORLD_SCALE, 12);
  });

  it("applies whole-camera rig translation to the fixed support datum", () => {
    const neutralOptics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...mirrorShiftScene.cameraPreset,
        activeSceneId: mirrorShiftScene.id,
        mirrorShiftLessonState: { rigLateralMm: 0 },
      },
      mirrorShiftScene,
    );
    const translatedOptics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...mirrorShiftScene.cameraPreset,
        activeSceneId: mirrorShiftScene.id,
        mirrorShiftLessonState: { rigLateralMm: 450 },
      },
      mirrorShiftScene,
    );
    const neutralSupport = cameraSupportFor(
      renderConceptualViewCamera({ opticsState: neutralOptics }),
    ).rail;
    const translatedSupport = cameraSupportFor(
      renderConceptualViewCamera({ opticsState: translatedOptics }),
    ).rail;
    const expected = resolveConceptualSupportBeam(
      CONCEPTUAL_CAMERA_SUPPORT_RAIL,
      translatedOptics.cameraRigTransform,
    );

    const translatedRoot = findNamedElement(
      renderConceptualViewCamera({ opticsState: translatedOptics }),
      "camera-rig-placement",
    );
    expect(translatedRoot?.props.userData).toMatchObject({ cameraAssemblyRoot: true });
    expect(translatedRoot?.props.position).toEqual([0.45, 0, 0]);
    expectQuaternionEqual(translatedSupport.props.quaternion, new Quaternion());
    expect(translatedSupport.props.position![0] + translatedRoot!.props.position![0]).toBeCloseTo(expected.position[0], 12);
    expect(translatedSupport.props.position![1] + translatedRoot!.props.position![1]).toBeCloseTo(expected.position[1], 12);
    expect(translatedSupport.props.position![2] + translatedRoot!.props.position![2]).toBeCloseTo(expected.position[2], 12);
    expect(translatedSupport.props.position).toEqual(neutralSupport.props.position);
  });
});
