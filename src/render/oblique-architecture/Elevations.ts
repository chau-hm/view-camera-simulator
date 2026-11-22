import * as THREE from "three";
import type { ObliqueArchitecturePresentation } from "../../scenes/presentation/obliqueArchitecture";
import type { BuildingGeometry } from "./BuildingGeometry";
import type { MasonryMaterials } from "./MasonryMaterials";

type Layout = ObliqueArchitecturePresentation["geometry"];
type FaceId = "front" | "side" | "opposite" | "rear";
type Opening = { center: number; bottom: number; top: number; width: number; row: number; column: number; door?: boolean };
type Face = { id: FaceId; alongX: boolean; outward: number; plane: number; min: number; max: number; openings: Opening[] };

const prefix = "oblique-architecture-";
const thickness = 130;

export function addElevations(
  root: THREE.Group, layout: Layout, shapes: BuildingGeometry, materials: MasonryMaterials,
) {
  const { building: b, ground, windowRowCenters, sideWindowColumnCenters, frontWindowColumnCenters } = layout;
  const teachingPlane = layout.focusTargets[0].worldPosition.x;
  const west = b.leftX;
  const bodyTop = ground.y + b.height;
  const baseTop = windowRowCenters[0] - b.windowHeight / 2 - 48;
  const grid = (columns: number[], width: number, height = b.windowHeight) =>
    windowRowCenters.flatMap((y, row) => columns.map((center, column) => ({
      center, bottom: y - height / 2, top: y + height / 2, width, row, column,
    })));
  const rearColumns = [b.leftX + 470, layout.buildingCenter.x, b.rightX - 470];
  const rearOpenings: Opening[] = grid(rearColumns, 350, 520).filter(o => o.row > 0);
  rearOpenings.push({
    center: layout.buildingCenter.x, width: 985, bottom: ground.y + 65,
    top: ground.y + 1370, row: 0, column: 1, door: true,
  });
  const faces: Face[] = [
    { id: "front", alongX: true, outward: -1, plane: b.nearZ, min: west, max: b.rightX, openings: grid(frontWindowColumnCenters, b.frontWindowWidth) },
    { id: "rear", alongX: true, outward: 1, plane: b.farZ, min: west, max: b.rightX, openings: rearOpenings },
    { id: "side", alongX: false, outward: -1, plane: west, min: b.nearZ + thickness, max: b.farZ - thickness, openings: grid(sideWindowColumnCenters, b.sideWindowWidth) },
    { id: "opposite", alongX: false, outward: 1, plane: b.rightX, min: b.nearZ + thickness, max: b.farZ - thickness, openings: grid(sideWindowColumnCenters, 480, 570) },
  ];

  for (const face of faces) {
    // h runs along each elevation. Positive projections face the street.
    function block(name: string, mat: THREE.Material, h: number, y: number, projection: number, width: number, height: number, depth: number, parent = root) {
      const d = face.plane + face.outward * projection;
      shapes.box(prefix + name, mat, face.alongX ? [h, y, d] : [d, y, h],
        face.alongX ? [width, height, depth] : [depth, height, width], parent);
    }
    const levels = [...new Set([ground.y, baseTop, bodyTop, ...face.openings.flatMap(o => [o.bottom, o.top])])].sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      const low = levels[i - 1], high = levels[i];
      const atBase = high <= baseTop;
      const cuts = face.openings.filter(o => o.bottom < high && o.top > low).sort((a, b) => a.center - b.center);
      const masonryName = face.id === "side" ? "target-facade" : "building";
      const solid = (start: number, end: number) => {
        if (end <= start) return;
        block(atBase ? "foundation" : masonryName, atBase ? materials.ashlar : materials.brick,
          (start + end) / 2, (low + high) / 2, -thickness / 2, end - start, high - low, thickness);
      };
      let cursor = face.min;
      for (const o of cuts) {
        solid(cursor, o.center - o.width / 2);
        cursor = o.center + o.width / 2;
      }
      solid(cursor, face.max);
    }

    for (const o of face.openings) {
      const height = o.top - o.bottom, y = (o.top + o.bottom) / 2;
      const primary = face.id === "front" || face.id === "side";
      if (o.door) {
        block("loading-door", materials.sash, o.center, y, -59, o.width, height, 36);
        for (let i = 0; i < 8; i++) {
          block("door-boards", materials.roof, o.center - o.width / 2 + (i + 0.5) * o.width / 8, y, -39, 7, height - 20, 6);
        }
        for (const sign of [-1, 1]) {
          block("door-upper-lights", materials.glazing, o.center + sign * o.width / 4, o.top - 211, -34, o.width / 2 - 75, 256, 7);
          block("door-crossrails", materials.sash, o.center + sign * o.width / 4, y - 150, -30, o.width / 2 - 15, 62, 20);
        }
      } else {
        const onFocusRow = face.id === "side" && o.row === layout.focusTargetRow;
        const outer = onFocusRow ? west - teachingPlane : -65;
        const glassName = onFocusRow ? `side-window-${o.row + 1}-${o.column + 1}` : "window";
        const glassParent = onFocusRow ? new THREE.Group() : root;
        if (onFocusRow) {
          glassParent.name = prefix + glassName;
          root.add(glassParent);
        }
        block(glassName + "-glass", materials.glazing, o.center, y, outer - 4, o.width - 12, height - 12, 8, glassParent);
        // The second-storey storm glazing sits forward of its timber joinery.
        // Every calibrated ray meets the glass; no projecting centre bar crosses it.
        const sashProjection = onFocusRow ? outer - 8 : outer + 5;
        const jamb = 18;
        if (onFocusRow) {
          // The removable storm sash projects from the masonry. Its casing
          // joins the structural jamb at x=900 to the outer glass at x=882.
          for (const sign of [-1, 1]) {
            block("storm-casings", materials.sash, o.center + sign * o.width / 2, y,
              outer / 2 - 2, 18, height + 20, outer + 4);
            block("storm-casings", materials.sash, o.center, y + sign * height / 2,
              outer / 2 - 2, o.width - 18, 18, outer + 4);
          }
        }
        for (const sign of [-1, 1]) {
          block("window-joinery", materials.sash, o.center + sign * (o.width - jamb) / 2, y, sashProjection, jamb, height, 12);
          block("window-joinery", materials.sash, o.center, y + sign * (height - jamb) / 2, sashProjection, o.width - 2 * jamb, jamb, 12);
        }
        block("window-joinery", materials.sash, o.center, y + height * 0.21, outer + 4, o.width - 2 * jamb, 20, 12);
        block("window-joinery", materials.sash, o.center, y + height * 0.35, outer + 4, 14, height * 0.28, 12);
        if (!onFocusRow && o.width > 420) {
          block("window-joinery", materials.sash, o.center, y - height * 0.14, outer + 3, 16, height * 0.68, 10);
        }
      }
      const headWidth = o.width + (primary ? 42 : 26);
      block("lintels", materials.stone, o.center, o.top + 36, 5, headWidth, 72, primary ? 62 : 38);
      if (primary) block("keystones", materials.stone, o.center, o.top + 44, 36, Math.min(96, o.width / 4), 88, 12);
      block("sills", materials.stone, o.center, o.bottom - 24, 12, headWidth, 48, primary ? 80 : 50);
    }
  }
}
