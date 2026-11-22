import { Quaternion, Vector3 } from "three";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import type { FocusStandardVisualState } from "../focusStandardPresentation";
import type { RenderGroupTransform } from "../planeOrientation";
import {
  block,
  grip,
  machinedPlate,
  partPosition,
  pin,
  toWorld,
  turned,
  type PointMm,
} from "./mechanicalGeometry";
import { Hardware } from "./Hardware";
import type { PresentationProps } from "./mechanicalMaterials";

type Side = "front" | "rear";
type Hand = "left" | "right";

const signs = [-1, 1] as const;
const hands = ["left", "right"] as const;
const handSign = (hand: Hand) => (hand === "left" ? -1 : 1);
const faceSign = (side: Side) => (side === "front" ? 1 : -1);
const width = CAMERA_CONSTANTS.frontStandardWidthMm;
const height = CAMERA_CONSTANTS.frontStandardHeightMm;
const bar = 14;
const uprightX = (width - bar) / 2;
const thickness = { front: 12, rear: 18 } as const;

const standardHingeMm = (side: Side, hand: Hand): PointMm => [
  handSign(hand) * uprightX,
  -height / 2 + 17,
  faceSign(side) * (thickness[side] / 2 + 3),
];

const carriageHingeMm = (hand: Hand): PointMm => [handSign(hand) * 23, 5, 0];

const structure = (side: Side) => {
  const faceZ = faceSign(side) * (thickness[side] / 2);
  return {
    casting: [
      machinedPlate([width, height, thickness[side]], [0, 0, 0], 2.1, [
        width - 2 * bar,
        height - 2 * bar,
      ]),
      ...(side === "rear" ? [machinedPlate([157, 116, 5.6], [0, 0, 4.8], 1, [130, 102])] : []),
    ],
    slides: [
      machinedPlate([width - 9, height - 9, 4.6], [0, 0, faceZ], 0.85, [
        width - 2 * bar + 4,
        height - 2 * bar + 4,
      ]),
      ...signs.map((sign) =>
        machinedPlate(
          [9, height - 39, 5.6],
          [sign * uprightX, -1, faceZ + faceSign(side) * 1.2],
          0.8,
        ),
      ),
    ],
    housings: [
      ...signs.flatMap((sign) =>
        signs.map((ySign) =>
          machinedPlate([17, 17, 4], [sign * uprightX, ySign * (height / 2 - 8.5), faceZ], 0.9),
        ),
      ),
      ...hands.map((hand) => pin(8, 6, standardHingeMm(side, hand))),
      ...signs.map((sign) => pin(6.2, 6, [sign * (width / 2 + 0.5), -12, 0], "x")),
    ],
    knobs: signs.map((sign) => grip(12, 9, [sign * (width / 2 + 6), -12, 0], "x")),
    caps: [
      ...hands.map((hand) => {
        const [x, y, z] = standardHingeMm(side, hand);
        return pin(5.7, 1.3, [x, y, z + faceSign(side) * 3.3]);
      }),
      ...signs.flatMap((sign) => [
        pin(10.8, 1.7, [sign * (width / 2 + 10.7), -12, 0], "x", 24),
        ...signs.map((ySign) =>
          pin(2.4, 1, [sign * uprightX, ySign * 61.5, faceZ + faceSign(side) * 2.2]),
        ),
      ]),
    ],
    scales: signs.flatMap((sign) =>
      Array.from({ length: 9 }, (_, index) => {
        const tickWidth = index % 4 === 0 ? 5.4 : 3;
        return block(
          [tickWidth, 0.48, 0.18],
          [sign * uprightX, 7 + 4 * index, faceZ + faceSign(side) * 4.06],
        );
      }),
    ),
  };
};

const standards = { front: structure("front"), rear: structure("rear") };

export const StandardHardware = ({
  side,
  visual,
  ghost,
  state,
}: PresentationProps & { side: Side; visual: FocusStandardVisualState }) => {
  const parts = standards[side];
  const presentation = { ghost, state };
  return (
    <>
      <Hardware
        name={`${side}-standard-casting`}
        parts={parts.casting}
        color="#3c4148"
        emissiveIntensity={0.36}
        {...presentation}
      />
      <Hardware
        name={`${side}-standard-slide-rails`}
        parts={parts.slides}
        color={visual.active ? visual.bodyColor : "#4a525a"}
        emissive={visual.active ? visual.emissiveColor : undefined}
        emissiveIntensity={visual.active ? visual.emissiveIntensity : undefined}
        {...presentation}
      />
      <group name={`${side}-standard-pivot-hardware`}>
        <Hardware
          name={`${side}-standard-hinge-bosses`}
          parts={parts.housings}
          color="#272a30"
          {...presentation}
        />
        <Hardware
          name={`${side}-standard-lock-grips`}
          parts={parts.knobs}
          color="#22252a"
          {...presentation}
        />
        {!ghost && state !== "dimmed" ? (
          <Hardware
            name={`${side}-standard-fasteners`}
            parts={parts.caps}
            color="#6a7177"
            roughness={0.43}
            {...presentation}
          />
        ) : null}
      </group>
      {!ghost && state === "normal" ? (
        <Hardware
          name={`${side}-standard-rise-scale`}
          parts={parts.scales}
          color="#9ca1a3"
          metalness={0.15}
          {...presentation}
        />
      ) : null}
    </>
  );
};

const carriageCasting = [
  machinedPlate([53, 22, 37], [0, 0, 0], 2),
  machinedPlate([49, 7, 30], [0, 9.5, 0], 1.2),
  turned(
    [
      [0, -3],
      [19, -3],
      [22, -1],
      [22, 1],
      [19, 3],
      [0, 3],
    ],
    [0, 10, 0],
    "y",
    28,
  ),
  ...hands.map((hand) => pin(7, 8, carriageHingeMm(hand))),
  ...signs.map((sign) => pin(7, 6, [sign * 27, 0, 0], "x")),
];
const carriageKnobs = signs.map((sign) => grip(11.5, 10, [sign * 33, 0, 0], "x"));
const carriageCaps = [
  ...signs.map((sign) => pin(10.2, 1.5, [sign * 38.4, 0, 0], "x", 24)),
  ...hands.map((hand) => {
    const [x, y] = carriageHingeMm(hand);
    return pin(4.3, 8.6, [x, y, 0]);
  }),
];
const sleeve = [block([9.5, 1, 7], [0, 0, 0])];
const slide = [block([6, 1, 4.5], [0, 0, 0])];
const up = new Vector3(0, 1, 0);

const CarriageLink = ({
  side,
  hand,
  standard,
  mountPosition,
  ghost,
  state,
}: PresentationProps & {
  side: Side;
  hand: Hand;
  standard: RenderGroupTransform;
  mountPosition: [number, number, number];
}) => {
  // These are mechanical endpoints on two already-resolved render frames.
  // Nothing here interprets rise, swing, focus, or any other control input.
  const lower = new Vector3(...partPosition(carriageHingeMm(hand))).add(
    new Vector3(...mountPosition),
  );
  const upper = new Vector3(...partPosition(standardHingeMm(side, hand)))
    .applyQuaternion(standard.quaternion)
    .add(new Vector3(...standard.position));
  const direction = upper.sub(lower);
  const distanceMm = direction.length() / toWorld(1);
  if (distanceMm < 0.01) return null;
  const rotation = new Quaternion().setFromUnitVectors(up, direction.normalize());
  const sleeveMm = Math.min(40, distanceMm * 0.67);
  const extensionStartMm = sleeveMm - Math.min(4, sleeveMm * 0.3);
  return (
    <group name={`${side}-carriage-link-${hand}`} position={lower.toArray()} quaternion={rotation}>
      <Hardware
        name={`${side}-carriage-link-${hand}-sleeve`}
        parts={sleeve}
        color="#393e45"
        position={partPosition([0, sleeveMm / 2, 0])}
        scale={[1, sleeveMm, 1]}
        ghost={ghost}
        state={state}
      />
      <Hardware
        name={`${side}-carriage-link-${hand}-slider`}
        parts={slide}
        color="#586069"
        position={partPosition([0, (distanceMm + extensionStartMm) / 2, 0])}
        scale={[1, distanceMm - extensionStartMm, 1]}
        ghost={ghost}
        state={state}
      />
    </group>
  );
};

export const FocusingCarriage = ({
  side,
  standard,
  mountPosition,
  ghost,
  state,
}: PresentationProps & {
  side: Side;
  standard: RenderGroupTransform;
  mountPosition: [number, number, number];
}) => {
  const presentation = { ghost, state };
  return (
    <>
      <group
        name={`camera-support-${side}-mount`}
        position={mountPosition}
        renderOrder={ghost ? 10 : 0}
      >
        <Hardware
          name={`${side}-carriage-casting`}
          parts={carriageCasting}
          color="#33383f"
          {...presentation}
        />
        <Hardware
          name={`${side}-carriage-focusing-grip`}
          parts={carriageKnobs}
          color="#23262b"
          {...presentation}
        />
        {!ghost && state !== "dimmed" ? (
          <Hardware
            name={`${side}-carriage-fasteners`}
            parts={carriageCaps}
            color="#656d75"
            roughness={0.46}
            {...presentation}
          />
        ) : null}
      </group>
      {hands.map((hand) => (
        <CarriageLink
          key={hand}
          side={side}
          hand={hand}
          standard={standard}
          mountPosition={mountPosition}
          {...presentation}
        />
      ))}
    </>
  );
};
