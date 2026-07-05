// small helpers reused by RTT module
export const WORLD_SCALE = 0.001;
export const toWorld = (mm: number) => mm * WORLD_SCALE;
export const vecToWorld = (v: { x: number; y: number; z: number }): [number, number, number] => [
  toWorld(v.x),
  toWorld(v.y),
  toWorld(v.z),
];
