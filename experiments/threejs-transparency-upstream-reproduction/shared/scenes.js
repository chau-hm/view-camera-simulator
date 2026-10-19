import * as THREE from "three";

const plane = (name, colorHex, opacity, family, output, backend, dimensions, position, renderOrder, createMaterial) => {
  const geometry = new THREE.PlaneGeometry(dimensions[0], dimensions[1]);
  const material = createMaterial({
    backend,
    output,
    family,
    colorHex,
    opacity,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.renderOrder = renderOrder;
  mesh.userData.fixtureRole = name;
  return mesh;
};

const makeFoldedGeometry = () => {
  const positions = [];
  const addPanel = (centerX, centerZ, slope) => {
    const halfWidth = 1.2;
    const halfHeight = 1.15;
    const leftX = centerX - halfWidth;
    const rightX = centerX + halfWidth;
    const zAt = (x) => centerZ + (x - centerX) * slope;
    positions.push(
      leftX, -halfHeight, zAt(leftX),
      rightX, -halfHeight, zAt(rightX),
      rightX, halfHeight, zAt(rightX),
      leftX, halfHeight, zAt(leftX),
    );
  };
  // Two angled pleats share a projection but remain distinct, depth-separated surfaces.
  addPanel(-0.16, 0.34, -0.48);
  addPanel(0.16, -0.34, 0.48);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
  ]);
  geometry.computeVertexNormals();
  return geometry;
};

export const createSceneFixture = ({ backend, output, fixture, family, opacity, createMaterial, describeMaterial }) => {
  const scene = new THREE.Scene();
  const ownedGeometry = new Set();
  const ownedMaterials = new Set();
  const objects = [];
  const register = (object) => {
    object.updateMatrixWorld(true);
    ownedGeometry.add(object.geometry);
    ownedMaterials.add(object.material);
    objects.push(object);
    object.onBeforeRender = () => window.__fixtureDrawCalls.push({
      name: object.name,
      renderOrder: object.renderOrder,
      z: Number(object.position.z.toFixed(4)),
    });
    scene.add(object);
    return object;
  };

  if (family === "standard") {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(-2, 3, 6);
    scene.add(key);
  }

  if (fixture === "F0") {
    register(plane("single-transparent-plane", "#c9364a", opacity, family, output, backend, [2.2, 2.5], [0, 0, 0], 1, createMaterial));
  } else if (fixture === "F1") {
    register(plane("far-overlap-plane", "#c9364a", opacity, family, output, backend, [2.3, 2.5], [-0.25, 0, -0.3], 0, createMaterial));
    register(plane("near-overlap-plane", "#315fd4", opacity, family, output, backend, [2.3, 2.5], [0.25, 0, 0], 1, createMaterial));
  } else if (fixture === "F2") {
    const geometry = makeFoldedGeometry();
    const material = createMaterial({
      backend,
      output,
      family,
      colorHex: "#c9364a",
      opacity,
    });
    const folded = new THREE.Mesh(geometry, material);
    folded.name = "folded-bellows-analogue";
    folded.renderOrder = 1;
    folded.userData.fixtureRole = "two-angle-pleat-surfaces";
    register(folded);
  } else {
    throw new Error(`Unknown fixture: ${fixture}`);
  }

  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 30);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const centerIntersections = fixture === "F1" || fixture === "F2"
    ? raycaster.intersectObjects(objects, false).map((hit) => ({
        object: hit.object.name,
        distance: Number(hit.distance.toFixed(5)),
        point: hit.point.toArray().map((value) => Number(value.toFixed(5))),
      }))
    : [];

  return {
    scene,
    camera,
    objects,
    ownedGeometry,
    ownedMaterials,
    fixtureEvidence: {
      fixture,
      objectNames: objects.map((object) => object.name),
      camera: {
        type: camera.constructor.name,
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom,
        near: camera.near,
        far: camera.far,
      },
      resolution: { width: 320, height: 320, deviceScaleFactor: 1 },
      centerIntersectionCount: centerIntersections.length,
      centerIntersections,
      materialDescriptions: [...ownedMaterials].map(describeMaterial),
    },
  };
};
