import { Children, isValidElement, type ReactNode } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { CameraBodyAssembly } from "../../render/CameraBodyAssembly";
import { renderConceptualViewCamera } from "../../render/ConceptualViewCamera";
import { WORLD_SCALE } from "../../render/rttUtils";
import { stillLifeStudioScene } from "../../scenes/definitions/still-life-studio";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

type RenderProps = {
  name?: string;
  position?: [number, number, number];
  quaternion?: Quaternion;
  scale?: [number, number, number];
  children?: ReactNode;
};

type NamedPart = { matrix: Matrix4; ancestors: string[] };

const collectWorldParts = (tree: ReactNode): Map<string, NamedPart> => {
  const parts = new Map<string, NamedPart>();
  const visit = (nodes: ReactNode, parent: Matrix4, ancestors: string[]) => {
    Children.forEach(nodes, (node) => {
      if (!isValidElement<RenderProps>(node)) return;
      if (typeof node.type === "function") {
        visit((node.type as (props: RenderProps) => ReactNode)(node.props), parent, ancestors);
        return;
      }
      const { name, position, quaternion, scale, children } = node.props;
      const transform = new Matrix4().compose(
        new Vector3(...(position ?? [0, 0, 0])),
        quaternion ?? new Quaternion(),
        new Vector3(...(scale ?? [1, 1, 1])),
      );
      const matrix = parent.clone().multiply(transform);
      if (name) parts.set(name, { matrix, ancestors });
      visit(children, matrix, name ? [...ancestors, name] : ancestors);
    });
  };
  visit(tree, new Matrix4(), []);
  return parts;
};

const pointOn = (part: NamedPart, x: number, y: number, z: number) =>
  new Vector3(x, y, z).multiplyScalar(WORLD_SCALE).applyMatrix4(part.matrix);

describe("articulated camera detail ownership", () => {
  const cases = [
    {
      name: "opposed standard movements",
      scene: stillLifeStudioScene,
      movement: {
        frontRiseMm: 40,
        frontShiftMm: 60,
        frontTiltDeg: -10,
        frontSwingDeg: 10,
        rearShiftMm: -60,
        rearTiltDeg: 10,
        rearSwingDeg: -10,
      },
    },
    {
      name: "pitch with front tilt",
      scene: understandingCameraMovementsScene,
      movement: { cameraBodyPitchDeg: -34, frontTiltDeg: 5 },
    },
  ];

  it.each(cases)("joins both standards to their carriage in $name", ({ scene, movement }) => {
    const opticsState = deriveOpticsState({
      ...DEFAULT_CAMERA_STATE,
      ...scene.cameraPreset,
      activeSceneId: scene.id,
      ...movement,
    }, scene);
    const tree = scene.cameraBodyPitchCapability?.enabled
      ? CameraBodyAssembly({ opticsState })
      : renderConceptualViewCamera({ opticsState });
    const parts = collectWorldParts(tree);

    for (const side of ["front", "rear"] as const) {
      const frame = parts.get(`${side}-standard-frame`)!;
      const mount = parts.get(`camera-support-${side}-mount`)!;
      const pivot = parts.get(`${side}-standard-pivot-hardware`)!;
      expect(pivot.ancestors).toContain(`${side}-standard-frame`);
      for (const [sign, hand] of [[-1, "left"], [1, "right"]] as const) {
        const name = `${side}-carriage-link-${hand}`;
        const sleeve = parts.get(`${name}-sleeve`)!;
        const slider = parts.get(`${name}-slider`)!;
        expect(sleeve.ancestors).toContain("camera-anatomy-camera-support");
        expect(slider.ancestors).toContain(name);

        const expectedCarriageHinge = pointOn(mount, sign * 23, 5, 0);
        const expectedStandardHinge = pointOn(frame, sign * 83, -53, side === "front" ? 9 : -12);
        expect(pointOn(sleeve, 0, -0.5, 0).distanceTo(expectedCarriageHinge)).toBeLessThan(1e-10);
        expect(pointOn(slider, 0, 0.5, 0).distanceTo(expectedStandardHinge)).toBeLessThan(1e-10);
      }
    }
  });

  it.each(["ground-glass", "film-holder"] as const)(
    "keeps rear %s hardware and lens details inside their semantic owners",
    (rearBackMode) => {
      const opticsState = deriveOpticsState({
        ...DEFAULT_CAMERA_STATE,
        ...stillLifeStudioScene.cameraPreset,
        activeSceneId: stillLifeStudioScene.id,
        rearSwingDeg: 10,
        rearRiseMm: 40,
      }, stillLifeStudioScene);
      const parts = collectWorldParts(renderConceptualViewCamera({ opticsState, rearBackMode }));
      const rearPart = rearBackMode === "ground-glass" ? "ground-glass-back" : "film-holder";
      expect(parts.get(`${rearPart}-hardware`)?.ancestors).toEqual(
        expect.arrayContaining(["rear-standard-frame", `camera-anatomy-${rearPart}`]),
      );
      expect(parts.get("lens-board-retainers")?.ancestors).toContain("camera-anatomy-lens-board");
      expect(parts.get("lens-control-hardware")?.ancestors).toContain("camera-anatomy-lens");
      expect(parts.get("camera-rail-runners")?.ancestors).toContain("camera-body-rail");
    },
  );
});
