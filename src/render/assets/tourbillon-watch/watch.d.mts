import type * as THREE from "three";

export type TourbillonWatchAssembly = Readonly<{
  root: THREE.Group;
  head: THREE.Group;
  strap: THREE.Group | null;
  cage: THREE.Group;
  setCageAngle: (radians: number) => void;
  dispose: () => void;
}>;

export const WATCH_DIMENSIONS_MM: Readonly<{
  caseDiameter: 42;
  caseThickness: 12;
  apertureDiameter: number;
  apertureCenter: readonly [number, number];
  dialDatumZ: number;
}>;
export const CAGE_REVOLUTION_SECONDS: 60;
export function createTourbillonWatch(options?: { includeStrap?: boolean }): TourbillonWatchAssembly;
