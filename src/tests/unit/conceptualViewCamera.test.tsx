import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Quaternion } from "three";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  CONCEPTUAL_CAMERA_ANATOMY_PARTS,
  renderConceptualViewCamera,
  resolveConceptualBellowsSpan,
} from "../../render/ConceptualViewCamera";
import {
  resolveFrontStandardRenderTransform,
  resolveRearStandardRenderTransform,
} from "../../render/planeOrientation";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

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

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  ...overrides,
});

const expectQuaternionEqual = (actual: unknown, expected: Quaternion): void => {
  expect((actual as Quaternion).toArray()).toEqual(expected.toArray());
};

describe("Conceptual View Camera v2 static anatomy", () => {
  it("provides stable semantic part IDs for current and ghost variants", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const current = renderConceptualViewCamera({ opticsState, variant: "current" });
    const ghost = renderConceptualViewCamera({ opticsState, variant: "ghost" });

    for (const part of CONCEPTUAL_CAMERA_ANATOMY_PARTS) {
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

  it("uses a deterministic accordion fold span between canonical film and lens centres", () => {
    const opticsState = deriveOpticsState(
      cameraFor({ frontRiseMm: 12, rearRiseMm: 18, rearTiltDeg: 6 }),
      architectureRiseScene,
    );
    const tree = renderConceptualViewCamera({ opticsState });
    const bellows = findNamedElement(tree, "camera-anatomy-bellows");
    const expected = resolveConceptualBellowsSpan(
      opticsState.filmCenterWorld,
      opticsState.lensCenterWorld,
    );
    const folds = collectNamedElements(tree, (name) => name.startsWith("bellows-fold-"));

    expect(bellows).not.toBeNull();
    expect(bellows!.props.position).toEqual(expected.position);
    expectQuaternionEqual(bellows!.props.quaternion, expected.quaternion);
    expect(folds).toHaveLength(9);
    expect(new Set(folds.map((fold) => fold.props.name)).size).toBe(9);
  });

  it("can omit the static bellows without changing the standard anatomy", () => {
    const opticsState = deriveOpticsState(cameraFor(), architectureRiseScene);
    const tree = renderConceptualViewCamera({ opticsState, showBellows: false });

    expect(findNamedElement(tree, "camera-anatomy-bellows")).toBeNull();
    expect(findNamedElement(tree, "camera-anatomy-front-standard")).not.toBeNull();
    expect(findNamedElement(tree, "camera-anatomy-rear-standard")).not.toBeNull();
  });
});
