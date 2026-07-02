export const imageDistanceMm = (focalLengthMm: number, focusDistanceMm: number): number => {
  // imageDistance = f * D / (D - f)
  if (focusDistanceMm === focalLengthMm) return Infinity;
  return (focalLengthMm * focusDistanceMm) / (focusDistanceMm - focalLengthMm);
};

export const focusPlaneWidthMm = (
  sensorWidthMm: number,
  focusDistanceMm: number,
  imageDistanceMmVal: number,
): number => {
  return (sensorWidthMm * focusDistanceMm) / imageDistanceMmVal;
};

export const focusPlaneHeightMm = (
  sensorHeightMm: number,
  focusDistanceMm: number,
  imageDistanceMmVal: number,
): number => {
  return (sensorHeightMm * focusDistanceMm) / imageDistanceMmVal;
};

export const projectPointToGroundGlass = (
  point: { x: number; y: number; z: number },
  imageDistanceMmVal: number,
): { xFilm: number; yFilm: number } | null => {
  // Only defined for points in front of the lens (z > 0)
  if (point.z <= 0) return null;
  const xFilm = -imageDistanceMmVal * point.x / point.z;
  const yFilm = -imageDistanceMmVal * point.y / point.z;
  return { xFilm, yFilm };
};

export const cocDiameterMm = (
  focalLengthMm: number,
  apertureFNumber: number,
  imageDistanceMmVal: number,
  objectDistanceMm: number,
): number => {
  // vObject = f * U / (U - f)
  if (objectDistanceMm === focalLengthMm) return Infinity;
  const vObject = (focalLengthMm * objectDistanceMm) / (objectDistanceMm - focalLengthMm);
  const apertureDiameterMm = focalLengthMm / apertureFNumber;
  return apertureDiameterMm * Math.abs(1 - imageDistanceMmVal / vObject);
};

export const verticalFovDegreesFromImageDistance = (
  sensorHeightMm: number,
  imageDistanceMmVal: number,
): number => {
  const verticalFovRadians = 2 * Math.atan(sensorHeightMm / (2 * imageDistanceMmVal));
  return (verticalFovRadians * 180) / Math.PI;
};
