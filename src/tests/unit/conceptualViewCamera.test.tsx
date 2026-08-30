import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Quaternion } from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CONCEPTUAL_CAMERA_ANATOMY_PARTS,
  CONCEPTUAL_CAMERA_SUPPORT_RAIL,
  renderConceptualViewCamera,
  resolveConceptualAnatomyElementState,
  resolveConceptualAnatomyPartState,
  resolveConceptualSupportBeam,
} from "../../render/ConceptualViewCamera";
import {
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "../../render/planeOrientation";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { CONCEPTUAL_LENS_IRIS_BLADE_COUNT } from "../../render/conceptualCameraAnatomyGeometry";

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

const expectQuaternionEqual = (actual: unknown, expected: Quaternion): void => {
  expect((actual as Quaternion).toArray()).toEqual(expected.toArray());
};

const cameraSupportFor = (
  tree: ReactNode,
): {
  rail: ReactElement<InspectableProps>;
  frontMount: ReactElement<InspectableProps>;
  rearMount: ReactElement<InspectableProps>;
} => {
  const rail = findNamedElement(tree, "camera-support-rail");
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

  it("derives the visible iris opening from the canonical aperture input", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const wide = renderConceptualViewCamera({ opticsState, aperture: 5.6 });
    const narrow = renderConceptualViewCamera({ opticsState, aperture: 32 });
    const wideOpening = findNamedElement(wide, "lens-aperture-opening");
    const narrowOpening = findNamedElement(narrow, "lens-aperture-opening");
    const wideBlades = collectNamedElements(
      wide,
      (name) => name.startsWith("lens-aperture-blade-"),
    );
    const narrowBlades = collectNamedElements(
      narrow,
      (name) => name.startsWith("lens-aperture-blade-"),
    );

    expect(findNamedElement(wide, "lens-aperture-iris")).not.toBeNull();
    expect(wideOpening).not.toBeNull();
    expect(narrowOpening).not.toBeNull();
    expect(geometryArgs(wideOpening!, "shapeGeometry")).toHaveLength(1);
    expect(geometryArgs(narrowOpening!, "shapeGeometry")).toHaveLength(1);
    expect(wideBlades).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(narrowBlades).toHaveLength(CONCEPTUAL_LENS_IRIS_BLADE_COUNT);
    expect(
      wideBlades.every((blade) =>
        Children.toArray(blade.props.children).some(
          (child) =>
            typeof child === "object" &&
            child !== null &&
            "type" in child &&
            child.type === "shapeGeometry",
        ),
      ),
    ).toBe(true);
    expect(findNamedElement(wide, "camera-anatomy-lens")).not.toBeNull();
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

    expect(translatedSupport.props.position).toEqual(expected.position);
    expectQuaternionEqual(translatedSupport.props.quaternion, expected.quaternion);
    expect(translatedSupport.props.position![0] - neutralSupport.props.position![0]).toBeCloseTo(0.45, 12);
    expect(translatedSupport.props.position![1]).toBeCloseTo(neutralSupport.props.position![1], 12);
    expect(translatedSupport.props.position![2]).toBeCloseTo(neutralSupport.props.position![2], 12);
  });
});
