import type { ContourReferences } from "./coveragePixelEvidence";

// Top-origin CSS pixels in a 450 × 360 Observer canvas. These landmarks are
// fixed from reviewed reference captures, with no runtime geometry or DOM
// diagnostic values supplying the expected locations.
const contour = (
  kind: ContourReferences["kind"],
  movements: ContourReferences["movements"],
  points: ContourReferences["points"],
): ContourReferences => ({ kind, movements, points, size: [450, 360] });

export const architectureRiseContours = {
  neutral: contour("parallel-circle", { riseMm: 0 }, [[150, 157], [170, 126], [200, 113], [242, 131], [255, 174], [240, 213]]),
  rise20: contour("parallel-circle", { riseMm: 20 }, [[150, 144], [170, 114], [200, 101], [242, 120], [255, 165], [240, 203]]),
  rise40: contour("parallel-circle", { riseMm: 40 }, [[150, 131], [172, 100], [200, 90], [242, 109], [255, 157], [240, 192]]),
  tilt: contour("nonparallel-conic", { riseMm: 40, tiltDeg: 5 }, [[150, 116], [168, 90], [200, 77], [240, 94], [255, 147], [250, 168]]),
};

export const obliqueArchitectureContours = {
  neutral: contour("parallel-circle", { riseMm: 0, swingDeg: 0 }, [[143, 181], [146, 202], [257, 150], [265, 177], [261, 220], [237, 250]]),
  rise40: contour("parallel-circle", { riseMm: 40, swingDeg: 0 }, [[147, 181], [251, 110], [266, 157], [260, 194]]),
  plus: contour("nonparallel-conic", { riseMm: 40, swingDeg: 5 }, [[153, 151], [175, 98], [226, 84], [258, 102], [278, 180], [277, 192]]),
  minus: contour("nonparallel-conic", { riseMm: 40, swingDeg: -5 }, [[132, 153], [154, 98], [188, 84], [236, 108], [254, 160], [249, 190]]),
};

export const macroContours = {
  oblique: contour("nonparallel-conic", { tiltDeg: 5 }, [[72, 132], [107, 64], [165, 43], [282, 140], [290, 211], [174, 304]]),
  tiltOnly: contour("nonparallel-conic", { tiltDeg: 4, swingDeg: 0 }, [[93, 153], [107, 105], [178, 66], [275, 137], [288, 200], [206, 293]]),
  compound: contour("nonparallel-conic", { tiltDeg: 4, swingDeg: 4 }, [[105, 153], [124, 102], [166, 70], [295, 139], [286, 261], [217, 295]]),
};
