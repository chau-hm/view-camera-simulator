import * as THREE from "three";
import type { ArchitectureForegroundPresentation } from "../../scenes/presentation/architectureForeground";
import { createBuildingGeometry } from "./BuildingGeometry";
import type { BuildingMaterials } from "./BuildingMaterials";

type Layout = ArchitectureForegroundPresentation["geometry"];
type Opening = { center: number; y: number; width: number; height: number; groundStorey: boolean };
type Elevation = {
  id: "front" | "rear" | "right" | "left";
  runsAlongX: boolean;
  plane: number;
  outward: -1 | 1;
  low: number;
  high: number;
  openings: Opening[];
};

const wallDepthMm = 140;

export function addElevations(root: THREE.Group, layout: Layout, materials: BuildingMaterials) {
  const { building, facade, ground, windowRowCenters } = layout;
  const { x, z } = building.center;
  const left = x - building.width / 2;
  const right = x + building.width / 2;
  const front = facade.frontFacadeZ;
  const rear = facade.backFacadeZ;
  const frontOpenings = layout.getWindows().map(window => ({
    center: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
    groundStorey: window.y === windowRowCenters[0],
  }));
  const returns = windowRowCenters.map((y, row) => ({
    center: z, y, width: 400, height: building.windowHeight, groundStorey: row === 0,
  }));
  const elevations: Elevation[] = [
    { id: "front", runsAlongX: true, plane: front, outward: -1, low: left, high: right, openings: frontOpenings },
    { id: "rear", runsAlongX: true, plane: rear, outward: 1, low: left, high: right, openings: frontOpenings },
    { id: "left", runsAlongX: false, plane: left, outward: -1, low: front + wallDepthMm, high: rear - wallDepthMm, openings: returns },
    { id: "right", runsAlongX: false, plane: right, outward: 1, low: front + wallDepthMm, high: rear - wallDepthMm, openings: returns },
  ];
  const baseTop = windowRowCenters[0] + building.windowHeight / 2 + 86;
  const windowBottom = (opening: Opening) => opening.y - opening.height / 2;
  const windowTop = (opening: Opening) => opening.y + opening.height / 2;
  const scoredFaceZ = layout.focusTargetById("building-middle").worldPosition.z;

  for (const face of elevations) {
    const front = face.id === "front";
    // The front plaster finish and flush mullion faces align with the existing
    // surface datum, just outboard of the load-bearing wall.
    const finish = front ? face.plane - scoredFaceZ : 0;
    const shapes = createBuildingGeometry(root);
    function block(
      role: string, material: THREE.Material, u: number, y: number, projection: number,
      width: number, height: number, depth: number,
    ) {
      const d = face.plane + face.outward * projection;
      shapes.box(role, material, face.runsAlongX ? [u, y, d] : [d, y, u],
        face.runsAlongX ? [width, height, depth] : [depth, height, width]);
    }

    const levels = [...new Set([
      ground.y, baseTop, facade.mainBodyTopY,
      ...face.openings.flatMap(opening => [windowBottom(opening), windowTop(opening)]),
    ])].sort((a, b) => a - b);
    for (let index = 1; index < levels.length; index++) {
      const bottom = levels[index - 1];
      const top = levels[index];
      const atBase = top <= baseTop;
      const name = atBase ? face.id + "-base" : front ? "building" : face.id + "-wall";
      function wall(start: number, end: number) {
        block(name, atBase ? materials.stone : materials.plaster, (start + end) / 2,
          (bottom + top) / 2, (finish - wallDepthMm) / 2, end - start, top - bottom, wallDepthMm + finish);
      }
      const openings = face.openings.filter(opening => windowBottom(opening) < top && windowTop(opening) > bottom)
        .sort((a, b) => a.center - b.center);
      let cursor = face.low;
      for (const opening of openings) {
        wall(cursor, opening.center - opening.width / 2);
        cursor = opening.center + opening.width / 2;
      }
      wall(cursor, face.high);
    }

    const trim = face.id + "-window-stone";
    const trimEdges = face.id + "-window-edges";
    const joinery = face.id + "-joinery";
    const revealDepth = -74;
    for (const opening of face.openings) {
      const { center, y, width, height, groundStorey } = opening;
      const bottom = windowBottom(opening);
      const top = windowTop(opening);
      const transomY = y + height * 0.21;
      const jamb = building.windowFrameMm;
      for (const side of [-1, 1]) {
        // The dark sash bears against the wall inside the cut opening.
        block(joinery, materials.sash, center + side * (width - jamb) / 2, y,
          revealDepth, jamb, height, 25);
        block(joinery, materials.sash, center, y + side * (height - jamb) / 2,
          revealDepth, width - jamb * 2, jamb, 25);
        block(trim, materials.trim, center + side * (width / 2 + 15), y,
          finish + 5, 30, height, 44);
        block(trimEdges, materials.cap, center + side * (width / 2 + 24), y,
          finish + 29, 10, height, 12);
        block(trim, materials.trim, center + side * (width / 2 - 40), bottom - 47,
          finish + 19, 35, 40, 66);
      }

      // Twin lights have one stone central mullion reaching the finish plane.
      // The two central scored window samples strike this continuous surface.
      const mullionProjection = front ? finish : revealDepth + 9;
      block(face.id + "-mullions", materials.mullion, center, y, (mullionProjection + revealDepth - 10) / 2,
        28, height, mullionProjection - revealDepth + 10);
      block(joinery, materials.sash, center, transomY, revealDepth,
        width - jamb * 2, 22, 26);
      const clearWidth = (width - jamb * 2 - 28) / 2;
      for (const side of [-1, 1]) {
        const u = center + side * (14 + clearWidth / 2);
        const lower = bottom + jamb;
        const upper = top - jamb;
        block(face.id + "-glazing", materials.glazing, u, (lower + transomY - 11) / 2,
          revealDepth - 9, clearWidth, transomY - 11 - lower, 9);
        block(face.id + "-transom", materials.transom, u, (upper + transomY + 11) / 2,
          revealDepth - 9, clearWidth, upper - transomY - 11, 9);
      }

      block(trim, materials.trim, center, bottom - 17, finish + 16, width + 62, 34, 86);
      block(trimEdges, materials.cap, center, bottom - 5, finish + 24, width + 72, 12, 89);
      block(trim, materials.trim, center, top + 23, finish + 9, width + 60, 46, 52);
      block(trimEdges, materials.cap, center, top + 49, finish + 17, width + 79, 13, 69);
      if (groundStorey) {
        block(trimEdges, materials.cap, center, top + 28, finish + 41, 54, 52, 23);
      }
    }

    // Quoins alternate in length and wrap visually into the adjacent elevation.
    const cornerLow = face.runsAlongX ? face.low : face.low - wallDepthMm;
    const cornerHigh = face.runsAlongX ? face.high : face.high + wallDepthMm;
    const quoinCourses = 19;
    const quoinPitch = (facade.mainBodyTopY - ground.y - 310) / quoinCourses;
    for (let course = 0; course < quoinCourses; course++) {
      const y = ground.y + 143 + (course + 0.5) * quoinPitch;
      const width = course % 2 === 0 ? 165 : 116;
      for (const u of [cornerLow + width / 2, cornerHigh - width / 2]) {
        block(face.id + "-quoins", materials.trim, u, y, finish + 5, width, quoinPitch - 6, 20);
      }
    }

    // A carved frieze uses the window rhythm to bridge the tall attic zone.
    for (const opening of face.openings.filter(opening => opening.y === windowRowCenters.at(-1))) {
      const y = facade.mainBodyTopY - 421;
      block(face.id + "-frieze-frames", materials.trim, opening.center, y, finish + 1, 300, 95, 23);
      block(face.id + "-frieze-panels", materials.cap, opening.center, y, finish + 12, 255, 58, 11);
    }
    shapes.finish();
  }
}
