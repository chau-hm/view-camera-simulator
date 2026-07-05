// Thin-lens projection helper shared across render paths. Projects a world point through
// the lens center to the image (film) plane at distance imageDistanceMm. Returns
// uRaw/vRaw in [0,1] film coordinates (not clamped) and visible flag.
export function projectWorldPointToGroundGlass(
  targetWorld: { x: number; y: number; z: number },
  lensCenterWorld: { x: number; y: number; z: number },
  imageDistanceMm: number,
  sensorWidthMm: number,
  sensorHeightMm: number,
) {
  const relativeX = targetWorld.x - lensCenterWorld.x;
  const relativeY = targetWorld.y - lensCenterWorld.y;
  const relativeZ = targetWorld.z - lensCenterWorld.z;

  const EPS = 1e-6;
  if (relativeZ <= EPS) {
    return { visible: false, uRaw: 0, vRaw: 0 };
  }

  const xFilmMm = -imageDistanceMm * (relativeX / relativeZ);
  const yFilmMm = -imageDistanceMm * (relativeY / relativeZ);

  const uRaw = (xFilmMm + sensorWidthMm / 2) / sensorWidthMm;
  const vRaw = (sensorHeightMm / 2 - yFilmMm) / sensorHeightMm;

  const visible = uRaw >= 0 && uRaw <= 1 && vRaw >= 0 && vRaw <= 1;

  return { visible, uRaw, vRaw, xFilmMm, yFilmMm };
}
