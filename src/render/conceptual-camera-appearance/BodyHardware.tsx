import { resolveConceptualFilmHolderGeometry } from "../conceptualCameraAnatomyGeometry";
import type { Vec3 } from "../../types/optics";
import type { BellowsEndpointFrame } from "../conceptualBellowsGeometry";
import { block, grip, machinedPlate, partPosition, pin, turned } from "./mechanicalGeometry";
import { Hardware } from "./Hardware";
import type { PresentationProps } from "./mechanicalMaterials";

const signs = [-1, 1] as const;

const lensBoardPlate = [machinedPlate([112, 104, 8], [0, 0, 0], 1.5)];
export const LensBoardSurface = ({
  activeColor,
  ...presentation
}: PresentationProps & { activeColor?: string }) => (
  <Hardware
    name="lens-board-plate"
    parts={lensBoardPlate}
    color={activeColor ?? "#555a61"}
    emissiveIntensity={0.36}
    metalness={0.23}
    {...presentation}
  />
);

const boardReceiver = [
  machinedPlate([156, 116, 6], [0, 0, -7], 1.25, [105, 96]),
  machinedPlate([109, 101, 1.4], [0, 0, 3.9], 0.33, [102, 94]),
  ...signs.map((sign) => machinedPlate([19, 12, 6], [0, sign * 53.5, 1], 0.8)),
];
const boardFasteners = signs.flatMap((xSign) =>
  signs.map((ySign) => pin(2.25, 1.4, [xSign * 49, ySign * 45, 4.2])),
);
const boardRelease = [
  machinedPlate([15, 9, 3.8], [0, 55.5, 4], 0.7),
  block([8, 1.6, 1.2], [0, 56.8, 6.15]),
];

export const LensBoardHardware = (presentation: PresentationProps) => (
  <group name="lens-board-retainers">
    <Hardware
      name="lens-board-seating-plate"
      parts={boardReceiver}
      color="#626871"
      {...presentation}
    />
    {!presentation.ghost && presentation.state !== "dimmed" ? (
      <Hardware
        name="lens-board-corner-fasteners"
        parts={boardFasteners}
        color="#727a80"
        roughness={0.43}
        {...presentation}
      />
    ) : null}
    <Hardware
      name="lens-board-release-tab"
      parts={boardRelease}
      color="#5c6269"
      {...presentation}
    />
  </group>
);

const lensMountCollar = [
  turned(
    [
      [24, -2],
      [28, -2],
      [30.8, 0],
      [30.8, 1],
      [29.4, 2.5],
      [23.5, 2.5],
    ],
    [0, 0, 2],
  ),
  turned(
    [
      [24, -1.8],
      [26, -1.8],
      [28.8, -0.4],
      [29.15, 0.7],
      [28.5, 1.9],
      [25.2, 1.9],
      [24.5, 0.6],
      [24, -1.8],
    ],
    [0, 0, 34],
  ),
  turned(
    [
      [24.5, -0.9],
      [26, -0.9],
      [26, 0.9],
      [24.5, 0.9],
    ],
    [0, 0, 31.7],
  ),
];
// The shutter ring sits behind the diaphragm and has a 32 mm outer grip.
// The front retaining ring and all controls clear the canonical lens window.
const shutterGrip = [grip(32.5, 7, [0, 0, 15], "z")];
const lensControls = [
  machinedPlate([11, 7, 5], [29, -9, 21], 1),
  pin(2.5, 5, [33, -9, 22]),
  pin(2.6, 6, [-6, 32, 16], "y"),
  pin(2.05, 5.8, [8, 32.2, 16], "y"),
];
const lensEngraving = Array.from({ length: 17 }, (_, index) => {
  const angle = -Math.PI * 0.47 + (index * Math.PI * 1.35) / 16;
  const radius = 29.3;
  return block(
    [index % 4 === 0 ? 1.9 : 1.2, 0.48, 0.18],
    [radius * Math.cos(angle), radius * Math.sin(angle), 24.15],
    angle,
  );
});

export const LensHardware = (presentation: PresentationProps) => (
  <group name="lens-control-hardware">
    <Hardware
      name="lens-machined-rings"
      parts={lensMountCollar}
      color="#525860"
      roughness={0.48}
      {...presentation}
    />
    <Hardware name="lens-shutter-grip" parts={shutterGrip} color="#363940" {...presentation} />
    <Hardware
      name="lens-shutter-controls"
      parts={lensControls}
      color="#697178"
      roughness={0.45}
      {...presentation}
    />
    {!presentation.ghost && presentation.state === "normal" ? (
      <Hardware
        name="lens-aperture-scale"
        parts={lensEngraving}
        color="#a4a8ab"
        metalness={0.15}
        {...presentation}
      />
    ) : null}
  </group>
);

const groundGlassRim = [
  machinedPlate([156, 116, 5.8], [0, 0, -5.2], 1.3, [133, 106]),
  ...signs.flatMap((xSign) =>
    signs.map((ySign) => machinedPlate([16, 7, 5], [xSign * 55, ySign * 53.8, -6.8], 0.9)),
  ),
];
const groundGlassFasteners = signs.flatMap((xSign) =>
  signs.map((ySign) => pin(2.1, 1.1, [xSign * 73.6, ySign * 52.3, -8.2])),
);

export const GroundGlassHardware = (presentation: PresentationProps) => (
  <group name="ground-glass-back-hardware">
    <Hardware
      name="ground-glass-cassette"
      parts={groundGlassRim}
      color="#4e545d"
      {...presentation}
    />
    {!presentation.ghost && presentation.state !== "dimmed" ? (
      <Hardware
        name="ground-glass-cassette-fasteners"
        parts={groundGlassFasteners}
        color="#747b82"
        {...presentation}
      />
    ) : null}
  </group>
);

const filmHolderGrip = [
  machinedPlate([102, 11, 9], [0, 65, -13], 1.6),
  machinedPlate([133, 7, 2.8], [0, 53, -18.6], 0.65),
  ...[-27, 0, 27].map((x) => block([17, 2.3, 1.1], [x, 66.3, -17.8])),
];
const filmHolderRibs = [-40, 35].map((y) => machinedPlate([128, 5.2, 2.8], [0, y, -19.2], 0.7));

export const FilmHolderHardware = (presentation: PresentationProps) => (
  <group name="film-holder-hardware">
    <Hardware
      name="film-holder-dark-slide-grip"
      parts={filmHolderGrip}
      color="#62686e"
      {...presentation}
    />
    <Hardware
      name="film-holder-reinforcement-ribs"
      parts={filmHolderRibs}
      color="#4e545a"
      {...presentation}
    />
  </group>
);

const collar = (width: number, height: number, side: "front" | "rear") => {
  const sign = side === "front" ? 1 : -1;
  return [
    machinedPlate([width + 7, height + 7, 4.4], [0, 0, sign * 0.9], 0.75, [width - 5, height - 5]),
    machinedPlate([width + 13, height + 13, 3.8], [0, 0, sign * 3.8], 0.7, [width - 5, height - 5]),
  ];
};

const frontCollars = new Map<string, ReturnType<typeof collar>>();
const rearCollars = new Map<string, ReturnType<typeof collar>>();
const collarParts = (frame: BellowsEndpointFrame, side: "front" | "rear") => {
  // These widths are fixed by the shared bellows attachment geometry.
  const key = `${frame.widthMm}:${frame.heightMm}`;
  const partsBySize = side === "front" ? frontCollars : rearCollars;
  const existing = partsBySize.get(key);
  if (existing) return existing;
  const parts = collar(frame.widthMm, frame.heightMm, side);
  partsBySize.set(key, parts);
  return parts;
};

export const BellowsCollar = ({
  frame,
  side,
  ...presentation
}: PresentationProps & { frame: BellowsEndpointFrame; side: "front" | "rear" }) => (
  <group
    name={`bellows-${side}-attachment-collar`}
    position={partPosition([frame.center.x, frame.center.y, frame.center.z])}
    quaternion={frame.quaternion}
  >
    <Hardware
      name={`bellows-${side}-attachment-flange`}
      parts={collarParts(frame, side)}
      color="#50545b"
      roughness={0.77}
      metalness={0.14}
      {...presentation}
    />
  </group>
);

const RAIL_GUTTER_HEIGHT_MM = 2;
const railTrim = (width: number, height: number) => ({
  runners: [
    ...signs.map((sign) =>
      block([5.5, RAIL_GUTTER_HEIGHT_MM, 1], [sign * (width / 2 - 5.6), height / 2 + 0.55, 0]),
    ),
    ...signs.flatMap((sign) =>
      signs.map((ySign) =>
        block([0.75, 1.5, 1], [sign * (width / 2 + 0.15), ySign * (height / 2 - 3.4), 0]),
      ),
    ),
  ],
  endPlate: [machinedPlate([width + 1.2, height + 2.8, 4], [0, 0, 0], 0.95)],
  endScrews: signs.flatMap((xSign) =>
    signs.flatMap((ySign) =>
      signs.map((zSign) =>
        pin(1.85, 0.95, [xSign * (width / 2 - 4), ySign * (height / 2 - 4.5), zSign * 2]),
      ),
    ),
  ),
  scale: signs.flatMap((sign) =>
    Array.from({ length: 23 }, (_, index) => {
      const major = index % 5 === 1;
      const tick = major ? 5.1 : 2.7;
      return block(
        [0.32, tick, 0.48],
        [sign * (width / 2 + 0.25), -height / 2 + 5.7 + tick / 2, (index - 11) * 5],
      );
    }),
  ),
});

const railAppearanceBySection = new Map<string, ReturnType<typeof railTrim>>();
const railAppearance = (width: number, height: number) => {
  const key = `${width}:${height}`;
  const existing = railAppearanceBySection.get(key);
  if (existing) return existing;
  const parts = railTrim(width, height);
  railAppearanceBySection.set(key, parts);
  return parts;
};

export const RailHardware = ({
  dimensionsMm,
  ...presentation
}: PresentationProps & { dimensionsMm: Vec3 }) => {
  const parts = railAppearance(dimensionsMm.x, dimensionsMm.y);
  return (
    <>
      <Hardware
        name="camera-rail-runners"
        parts={parts.runners}
        color="#5b626b"
        scale={[1, 1, dimensionsMm.z - 2]}
        {...presentation}
      />
      {signs.map((sign) => (
        <group key={sign} position={partPosition([0, 0, sign * (dimensionsMm.z / 2 - 2.3)])}>
          <Hardware
            name="camera-rail-end-plate"
            parts={parts.endPlate}
            color="#4b5057"
            {...presentation}
          />
          {!presentation.ghost && presentation.state !== "dimmed" ? (
            <Hardware
              name="camera-rail-end-fasteners"
              parts={parts.endScrews}
              color="#777f86"
              {...presentation}
            />
          ) : null}
        </group>
      ))}
      {!presentation.ghost && presentation.state === "normal" ? (
        <Hardware
          name="camera-rail-focus-scale"
          parts={parts.scale}
          color="#969da3"
          metalness={0.12}
          {...presentation}
        />
      ) : null}
    </>
  );
};

const { holder } = resolveConceptualFilmHolderGeometry();
const filmHolderBody = [
  machinedPlate([holder.widthMm, holder.heightMm, holder.depthMm], [0, 0, 0], 1.8),
];

export const FilmHolderBodySurface = (presentation: PresentationProps) => (
  <Hardware
    name="film-holder-body"
    parts={filmHolderBody}
    position={partPosition([holder.centerLocal.x, holder.centerLocal.y, holder.centerLocal.z])}
    color="#343940"
    roughness={0.81}
    metalness={0.12}
    {...presentation}
  />
);
