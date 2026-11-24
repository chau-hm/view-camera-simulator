import * as THREE from "three";
import type { TableTiltPresentation } from "../../scenes/presentation/tableTilt";
import { createProceduralSurfaceMaterial } from "../ProceduralSurfaceMaterials";
import { toWorld } from "../rttUtils";
import { addTableTiltStudioFurnishings } from "./TableTiltStudioFurnishings";

type Floor = TableTiltPresentation["geometry"]["floor"];

const wallHeightMm = 4000;
const wallThicknessMm = 180;
const windowOpening = { zMm: 5350, yMm: 1010, widthMm: 1850, heightMm: 1740 };

function drawRectangle(path: THREE.Path, x: number, y: number, width: number, height: number) {
  path.moveTo(toWorld(x), toWorld(y));
  path.lineTo(toWorld(x + width), toWorld(y));
  path.lineTo(toWorld(x + width), toWorld(y + height));
  path.lineTo(toWorld(x), toWorld(y + height));
  path.closePath();
}

/** A solid panel with one continuous reveal when an opening is present. */
function panelGeometry(
  width: number,
  height: number,
  depth: number,
  opening?: { x: number; y: number; width: number; height: number },
) {
  const shape = new THREE.Shape();
  drawRectangle(shape, 0, 0, width, height);
  if (opening) {
    const hole = new THREE.Path();
    drawRectangle(hole, opening.x, opening.y, opening.width, opening.height);
    shape.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: toWorld(depth), bevelEnabled: false });
}

export const createTableTiltStudioFloorMaterial = (floor: Floor) =>
  createProceduralSurfaceMaterial({
    pattern: "concrete",
    color: "#c4bcb0",
    repeat: [floor.width / 2400, floor.depth / 2400],
    roughness: 0.84,
    normalStrength: 0.12,
  });

export function createTableTiltStudioEnvironment(floor: Floor): THREE.Group {
  const room = new THREE.Group();
  room.name = "table-tilt-studio-environment";

  const startX = floor.center.x - floor.width / 2;
  const sideFaceX = startX + wallThicknessMm;
  const rearFaceZ = floor.farZ - wallThicknessMm;
  const sideDepth = rearFaceZ - floor.nearZ;
  const floorY = floor.center.y;

  const plaster = createProceduralSurfaceMaterial({
    pattern: "plaster",
    color: "#eee1d1",
    repeat: [0.95, 0.95],
    roughness: 0.92,
    normalStrength: 0.11,
  });
  const trim = new THREE.MeshStandardMaterial({ color: "#d0c5b6", roughness: 0.74 });
  const windowPaint = new THREE.MeshStandardMaterial({ color: "#51483d", roughness: 0.68 });
  const hardware = new THREE.MeshStandardMaterial({ color: "#423c36", roughness: 0.71 });
  const timber = createProceduralSurfaceMaterial({
    pattern: "wood",
    color: "#ad8a67",
    repeat: [1.6, 1.15],
    roughness: 0.76,
    normalStrength: 0.18,
  });

  const rear = new THREE.Mesh(panelGeometry(floor.width, wallHeightMm, wallThicknessMm), plaster);
  rear.name = "table-tilt-studio-rear-wall";
  rear.position.set(toWorld(startX), toWorld(floorY), toWorld(rearFaceZ));
  room.add(rear);

  const side = new THREE.Mesh(panelGeometry(sideDepth, wallHeightMm, wallThicknessMm, {
    x: windowOpening.zMm,
    y: windowOpening.yMm,
    width: windowOpening.widthMm,
    height: windowOpening.heightMm,
  }), plaster);
  side.name = "table-tilt-studio-side-wall";
  side.position.set(toWorld(sideFaceX), toWorld(floorY), toWorld(floor.nearZ));
  side.rotation.y = -Math.PI / 2;
  room.add(side);

  const jambMm = 62;
  const frameInsetMm = 48;
  const frameEmbedMm = 2;
  const frame = new THREE.Mesh(panelGeometry(
    windowOpening.widthMm + frameEmbedMm * 2,
    windowOpening.heightMm + frameEmbedMm * 2,
    60,
    {
      x: jambMm + frameEmbedMm,
      y: jambMm + frameEmbedMm,
      width: windowOpening.widthMm - jambMm * 2,
      height: windowOpening.heightMm - jambMm * 2,
    },
  ), windowPaint);
  frame.name = "table-tilt-studio-window-frame";
  frame.rotation.y = side.rotation.y;
  frame.position.set(
    toWorld(sideFaceX - frameInsetMm),
    toWorld(floorY + windowOpening.yMm - frameEmbedMm),
    toWorld(floor.nearZ + windowOpening.zMm - frameEmbedMm),
  );
  room.add(frame);

  const addTrim = (
    name: string,
    [width, height, depth]: [number, number, number],
    [x, y, z]: [number, number, number],
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(toWorld(width), toWorld(height), toWorld(depth)), material);
    mesh.name = name;
    mesh.position.set(toWorld(x), toWorld(y), toWorld(z));
    room.add(mesh);
  };

  const windowCenterZ = floor.nearZ + windowOpening.zMm + windowOpening.widthMm / 2;
  const openingBottomY = floorY + windowOpening.yMm;
  const dividerX = sideFaceX - frameInsetMm - 23;
  addTrim(
    "table-tilt-studio-window-mullion",
    [46, windowOpening.heightMm - jambMm * 2, 44],
    [dividerX, openingBottomY + windowOpening.heightMm / 2, windowCenterZ],
    windowPaint,
  );
  addTrim(
    "table-tilt-studio-window-transom",
    [45, 40, windowOpening.widthMm - jambMm * 2],
    [dividerX, openingBottomY + 1090, windowCenterZ],
    windowPaint,
  );

  addTrim(
    "table-tilt-studio-window-sill",
    [230, 38, windowOpening.widthMm + 72],
    [sideFaceX - 44, floorY + windowOpening.yMm - 19, floor.nearZ + windowOpening.zMm + windowOpening.widthMm / 2],
    timber,
  );

  const baseboardThicknessMm = 18;
  const baseboardHeightMm = 88;
  const insideWidth = floor.width - wallThicknessMm;
  const sideBoardLength = sideDepth - baseboardThicknessMm;
  addTrim(
    "table-tilt-studio-rear-baseboard",
    [insideWidth, baseboardHeightMm, baseboardThicknessMm],
    [sideFaceX + insideWidth / 2, floorY + baseboardHeightMm / 2, rearFaceZ - baseboardThicknessMm / 2],
    trim,
  );
  addTrim(
    "table-tilt-studio-side-baseboard",
    [baseboardThicknessMm, baseboardHeightMm, sideBoardLength],
    [sideFaceX + baseboardThicknessMm / 2, floorY + baseboardHeightMm / 2, floor.nearZ + sideBoardLength / 2],
    trim,
  );

  addTableTiltStudioFurnishings(room, floorY, rearFaceZ, timber, hardware);
  return room;
}
