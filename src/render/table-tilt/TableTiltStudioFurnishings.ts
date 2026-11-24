import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { toWorld } from "../rttUtils";
import { easedBox } from "./TableTiltFinishes";

const centerX = -2160;

function addMesh(
  parent: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  [x, y, z]: [number, number, number],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "table-tilt-studio-" + name;
  mesh.position.set(toWorld(x), toWorld(y), toWorld(z));
  parent.add(mesh);
  return mesh;
}

const box = (width: number, height: number, depth: number) =>
  new THREE.BoxGeometry(toWorld(width), toWorld(height), toWorld(depth));

/** An original low-contrast ink landscape, sampled as a single matte print. */
function landscapeMap() {
  const width = 128;
  const height = 80;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      const shore = 0.40 + 0.04 * Math.sin(10 * u);
      const hills = 0.52 + 0.045 * Math.sin(14 * u + 1.8) + 0.025 * Math.sin(28 * u);
      const distant = 0.61 + 0.07 * Math.sin(9 * u - 0.5) + 0.03 * Math.sin(18 * u);
      const tone = v < shore ? 140 + 90 * v
        : v < hills ? 118 + 38 * v
          : v < distant ? 143 + 48 * v
            : 190 + 15 * v;
      pixels.set([tone + 4, tone + 2, tone, 255], (y * width + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function addTableTiltStudioFurnishings(
  room: THREE.Group,
  floorY: number,
  rearFaceZ: number,
  timber: THREE.Material,
  hardware: THREE.Material,
) {
  const cabinet = new THREE.Group();
  cabinet.name = "table-tilt-studio-sideboard";
  cabinet.position.set(toWorld(centerX), toWorld(floorY), toWorld(rearFaceZ - 550));
  room.add(cabinet);

  addMesh(cabinet, "sideboard-plinth", box(1910, 94, 420), hardware, [0, 47, 260]);
  addMesh(cabinet, "sideboard-carcass", box(2110, 704, 514), timber, [0, 446, 260]);
  addMesh(cabinet, "sideboard-top", easedBox(2150, 38, 542, 4), timber, [0, 817, 258]);

  const pulls: THREE.BufferGeometry[] = [];
  const addFront = (name: string, x: number, y: number, w: number, h: number, handleY: number) => {
    addMesh(cabinet, name, box(w, h, 24), timber, [x, y, -8]);
    pulls.push(box(112, 13, 24).translate(toWorld(x), toWorld(handleY), toWorld(-23)));
  };
  for (const [index, y] of [226, 444, 662].entries()) {
    addFront("sideboard-drawer-" + (index + 1), -744, y, 590, 206, y + 51);
  }
  for (const [index, x] of [-70, 674].entries()) {
    addFront("sideboard-door-" + (index + 1), x, 444, 732, 642, 708);
  }
  const pullGeometry = mergeGeometries(pulls);
  pulls.forEach(geometry => geometry.dispose());
  addMesh(cabinet, "sideboard-pulls", pullGeometry, hardware, [0, 0, 0]);

  // The silhouette suggests a compact film camera without introducing a
  // second simulator camera or an interactive object.
  const camera = new THREE.Group();
  camera.name = "table-tilt-studio-display-camera";
  camera.position.set(toWorld(-370), toWorld(836), toWorld(174));
  camera.rotation.y = -0.21;
  cabinet.add(camera);
  addMesh(camera, "display-camera-body", easedBox(186, 110, 77, 8), hardware, [0, 55, 0]);
  const alloy = new THREE.MeshStandardMaterial({ color: "#a29684", roughness: 0.54, metalness: 0.30 });
  addMesh(camera, "display-camera-top", easedBox(175, 15, 72, 3), alloy, [0, 110, 0]);
  const barrel = addMesh(camera, "display-camera-lens", new THREE.CylinderGeometry(
    toWorld(43), toWorld(43), toWorld(55), 20,
  ), hardware, [13, 53, -65]);
  barrel.rotation.x = Math.PI / 2;
  addMesh(camera, "display-camera-lens-rim", new THREE.TorusGeometry(
    toWorld(38), toWorld(3), 6, 20,
  ), alloy, [13, 53, -93]);

  const print = new THREE.Group();
  print.name = "table-tilt-studio-landscape-print";
  print.position.set(toWorld(centerX), toWorld(floorY + 1660), toWorld(rearFaceZ));
  room.add(print);
  addMesh(print, "print-frame", box(1070, 720, 32), hardware, [0, 0, -16]);
  const mat = new THREE.MeshStandardMaterial({ color: "#d5cbb9", roughness: 0.94 });
  addMesh(print, "print-mat", box(1004, 654, 8), mat, [0, 0, -33]);
  const ink = new THREE.MeshStandardMaterial({ map: landscapeMap(), roughness: 0.97 });
  const image = addMesh(print, "print-ink", new THREE.PlaneGeometry(toWorld(852), toWorld(502)), ink, [0, 0, -38]);
  image.rotation.y = Math.PI;
}
