import { createHash } from "node:crypto";
import * as THREE from "three";

type SignatureOptions = Readonly<{
  skipSubtreeNames?: readonly string[];
}>;

const hashBytes = (bytes: ArrayBufferView): string => createHash("sha256")
  .update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  .digest("hex");

const normalizedGeometryParameters = (geometry: THREE.BufferGeometry): unknown => {
  const parameters = (geometry as THREE.BufferGeometry & { parameters?: unknown }).parameters;
  if (geometry.type !== "ExtrudeGeometry" || !parameters || typeof parameters !== "object") {
    return parameters;
  }
  const geometryParameters = parameters as Record<string, unknown>;
  const shape = geometryParameters.shapes;
  if (
    !shape || Array.isArray(shape) || typeof shape !== "object" ||
    (shape as { type?: unknown }).type !== "Shape" ||
    typeof (shape as { uuid?: unknown }).uuid !== "string"
  ) {
    return geometryParameters;
  }

  // ExtrudeGeometry preserves this generated Shape identity in its parameters.
  // Keep the complete Shape, including its curves and holes, while replacing
  // only the demonstrated runtime-only field.
  return {
    ...geometryParameters,
    shapes: { ...(shape as Record<string, unknown>), uuid: "<generated-shape-uuid>" },
  };
};

const attributeSignature = (
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): unknown => {
  const interleaved = (attribute as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute;
  const data = interleaved
    ? (attribute as THREE.InterleavedBufferAttribute).data.array
    : (attribute as THREE.BufferAttribute).array;
  return {
    kind: interleaved ? "interleaved" : "buffer",
    arrayType: data.constructor.name,
    itemSize: attribute.itemSize,
    count: attribute.count,
    normalized: attribute.normalized,
    data: hashBytes(data),
    ...(interleaved
      ? {
          stride: (attribute as THREE.InterleavedBufferAttribute).data.stride,
          offset: (attribute as THREE.InterleavedBufferAttribute).offset,
        }
      : { usage: (attribute as THREE.BufferAttribute).usage }),
  };
};

const objectPath = (object: THREE.Object3D): string => {
  const segments: string[] = [];
  let current: THREE.Object3D | null = object;
  while (current) {
    const siblingIndex = current.parent ? current.parent.children.indexOf(current) : 0;
    segments.push(`${current.name || current.type}[${siblingIndex}]`);
    current = current.parent;
  }
  return segments.reverse().join("/");
};

const includedObjects = (root: THREE.Object3D, options: SignatureOptions): THREE.Object3D[] => {
  const skippedNames = new Set(options.skipSubtreeNames ?? []);
  const objects: THREE.Object3D[] = [];
  const visit = (object: THREE.Object3D, isRoot = false): void => {
    if (!isRoot && skippedNames.has(object.name)) return;
    objects.push(object);
    object.children.forEach((child) => visit(child));
  };
  visit(root, true);
  return objects;
};

const attributeRecord = (
  attributes: Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute>,
): unknown => Object.fromEntries(
  Object.entries(attributes)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([name, attribute]) => [name, attributeSignature(attribute)]),
);

const geometrySignatureValue = (geometry: THREE.BufferGeometry): unknown => ({
  type: geometry.type,
  parameters: normalizedGeometryParameters(geometry),
  attributes: attributeRecord(
    geometry.attributes as Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute>,
  ),
  morphAttributes: Object.fromEntries(
    Object.entries(geometry.morphAttributes)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([name, attributes]) => [
        name,
        attributes.map((attribute) => attributeSignature(attribute)),
      ]),
  ),
  morphTargetsRelative: geometry.morphTargetsRelative,
  index: geometry.index ? attributeSignature(geometry.index) : null,
  groups: geometry.groups.map(({ start, count, materialIndex }) => ({ start, count, materialIndex })),
  drawRange: {
    start: Number.isFinite(geometry.drawRange.start) ? geometry.drawRange.start : String(geometry.drawRange.start),
    count: Number.isFinite(geometry.drawRange.count) ? geometry.drawRange.count : String(geometry.drawRange.count),
  },
});

const geometryManifest = (root: THREE.Object3D, options: SignatureOptions): unknown[] => {
  root.updateMatrixWorld(true);
  return includedObjects(root, options).map((object) => ({
    path: objectPath(object),
    type: object.type,
    name: object.name,
    visible: object.visible,
    layers: object.layers.mask,
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    matrix: object.matrix.elements,
    matrixWorld: object.matrixWorld.elements,
    userData: object.userData,
    geometry: object instanceof THREE.Mesh ? geometrySignatureValue(object.geometry) : null,
  }));
};

const textureSlots = [
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "lightMap",
  "map",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "specularMap",
] as const;

const textureSignature = (texture: THREE.Texture): unknown => {
  const image = texture.image as { data?: unknown; width?: number; height?: number } | null;
  const imageData = image?.data;
  const imageBytes = ArrayBuffer.isView(imageData)
    ? hashBytes(imageData)
    : null;
  return {
    type: texture.type,
    mapping: texture.mapping,
    channel: texture.channel,
    colorSpace: texture.colorSpace,
    wrap: [texture.wrapS, texture.wrapT],
    filter: [texture.magFilter, texture.minFilter],
    repeat: texture.repeat.toArray(),
    offset: texture.offset.toArray(),
    center: texture.center.toArray(),
    rotation: texture.rotation,
    flipY: texture.flipY,
    generateMipmaps: texture.generateMipmaps,
    premultiplyAlpha: texture.premultiplyAlpha,
    unpackAlignment: texture.unpackAlignment,
    image: { width: image?.width, height: image?.height, bytes: imageBytes },
  };
};

export const materialSignature = (material: THREE.Material): unknown => {
  const candidate = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    roughness?: number;
    metalness?: number;
    normalScale?: THREE.Vector2;
    emissiveIntensity?: number;
    vertexColors?: boolean;
    flatShading?: boolean;
    wireframe?: boolean;
  };
  const properties = material as THREE.Material & Record<string, unknown>;
  const roleTextureSlots = ["map", "roughnessMap", "normalMap"] as const;
  return {
    type: material.type,
    color: candidate.color?.getHexString(),
    roughness: candidate.roughness,
    metalness: candidate.metalness,
    normalScale: candidate.normalScale?.toArray(),
    textures: roleTextureSlots.map((slot) => {
      const texture = properties[slot];
      if (!(texture instanceof THREE.DataTexture)) return [slot, null];
      const image = texture.image as { data: Uint8Array; width: number; height: number };
      return [slot, hashBytes(image.data), image.width, image.height, texture.repeat.toArray(), texture.colorSpace];
    }),
  };
};

const completeMaterialSignature = (material: THREE.Material): unknown => {
  const candidate = material as THREE.Material & {
    emissive?: THREE.Color;
    emissiveIntensity?: number;
    vertexColors?: boolean;
    flatShading?: boolean;
    wireframe?: boolean;
  };
  const properties = material as THREE.Material & Record<string, unknown>;
  const roleSignature = materialSignature(material) as Record<string, unknown>;
  return {
    type: material.type,
    name: material.name,
    visible: material.visible,
    color: roleSignature.color,
    emissive: candidate.emissive?.getHexString(),
    roughness: roleSignature.roughness,
    metalness: roleSignature.metalness,
    normalScale: roleSignature.normalScale,
    emissiveIntensity: candidate.emissiveIntensity,
    opacity: material.opacity,
    transparent: material.transparent,
    side: material.side,
    alphaTest: material.alphaTest,
    depthTest: material.depthTest,
    depthWrite: material.depthWrite,
    colorWrite: material.colorWrite,
    vertexColors: candidate.vertexColors,
    flatShading: candidate.flatShading,
    wireframe: candidate.wireframe,
    textures: textureSlots.map((slot) => {
      const texture = properties[slot];
      return [slot, texture instanceof THREE.Texture ? textureSignature(texture) : null];
    }),
    userData: material.userData,
  };
};

const materialManifest = (root: THREE.Object3D, options: SignatureOptions): unknown => {
  const materialIds = new Map<THREE.Material, number>();
  const textureIds = new Map<THREE.Texture, number>();
  const materialDefinitions: unknown[] = [];
  const textureDefinitions: unknown[] = [];
  const assignTextureId = (texture: THREE.Texture): number => {
    const existing = textureIds.get(texture);
    if (existing !== undefined) return existing;
    const id = textureIds.size;
    textureIds.set(texture, id);
    textureDefinitions.push({ id, signature: textureSignature(texture) });
    return id;
  };
  const assignMaterialId = (material: THREE.Material): number => {
    const existing = materialIds.get(material);
    if (existing !== undefined) return existing;
    const id = materialIds.size;
    materialIds.set(material, id);
    materialDefinitions.push({
      id,
      signature: completeMaterialSignature(material),
      textureAssignments: textureSlots.map((slot) => {
        const texture = (material as THREE.Material & Record<string, unknown>)[slot];
        return [slot, texture instanceof THREE.Texture ? assignTextureId(texture) : null];
      }),
    });
    return id;
  };
  const assignments = includedObjects(root, options).map((object) => ({
    path: objectPath(object),
    materialIds: object instanceof THREE.Mesh
      ? (Array.isArray(object.material) ? object.material : [object.material]).map(assignMaterialId)
      : [],
  }));
  return { assignments, materialDefinitions, textureDefinitions };
};

export const canonicalGeometrySignature = (
  root: THREE.Object3D,
  options: SignatureOptions = {},
): string => createHash("sha256")
  .update(JSON.stringify(geometryManifest(root, options)))
  .digest("hex");

export const completeSubjectSignature = (
  root: THREE.Object3D,
  options: SignatureOptions = {},
): string => {
  const geometry = geometryManifest(root, options);
  const materials = materialManifest(root, options);
  return createHash("sha256")
    .update(JSON.stringify({ geometry, materials }))
    .digest("hex");
};

export const namedMaterialSignature = (
  root: THREE.Object3D,
  names: readonly string[],
): Readonly<Record<string, unknown>> => Object.fromEntries(
  names.map((name) => {
    const object = root.getObjectByName(name);
    if (!(object instanceof THREE.Mesh)) throw new Error(`Missing mesh ${name}`);
    const material = Array.isArray(object.material) ? object.material[0]! : object.material;
    return [name, materialSignature(material)];
  }),
);
