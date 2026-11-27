import * as THREE from 'three';

const smoothstep = (low, high, x) => {
  const t = THREE.MathUtils.clamp((x - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

// Only the finite set of authored procedural surfaces is cached; each texture
// receives its own pixel buffer and remains independently disposable.
const surfacePixels = new Map();

function surfaceTexture(size, label, heightAt, grayscaleColor = false) {
  const channels = grayscaleColor ? 4 : 1;
  let source = surfacePixels.get(label);
  if (!source) {
    source = new Uint8Array(size * size * channels);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const h = Math.round(255 * THREE.MathUtils.clamp(heightAt(x / size, y / size), 0, 1));
        const offset = (y * size + x) * channels;
        if (grayscaleColor) source.set([h, h, h, 255], offset);
        else source[offset] = h;
      }
    }
    surfacePixels.set(label, source);
  }
  const texture = new THREE.DataTexture(source.slice(), size, size, grayscaleColor ? THREE.RGBAFormat : THREE.RedFormat);
  texture.name = label;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export function createWatchMaterials({ includeStrap = true } = {}) {
  const metal = (name, color, roughness, extra) =>
    new THREE.MeshStandardMaterial({ name, color, metalness: 0.92, roughness, ...extra });
  const soft = (name, color, roughness, extra) =>
    new THREE.MeshStandardMaterial({ name, color, roughness, ...extra });

  const satin = surfaceTexture(1024, 'Concentric dial graining', (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5);
    return 0.50 + Math.sin(2 * Math.PI * r * 398) * 0.19;
  });
  const stripes = surfaceTexture(1024, 'Côtes de Genève cuts', (u, v) => {
    const band = (u + 0.16 * v) * 16;
    const phase = band - Math.floor(band);
    const ledge = smoothstep(0.01, 0.14, phase) * (1 - smoothstep(0.22, 1, phase));
    const tool = Math.sin((v + 0.28 * (phase - 0.55) ** 2) * 2050);
    return 0.79 + 0.155 * ledge + 0.045 * tool;
  }, true);
  const pearls = surfaceTexture(1024, 'Overlapping perlage graining', (u, v) => {
    const x = u * 20;
    const y = v * 23;
    // The upper edge of the preceding tool pass survives under each new cut.
    const row = Math.floor(y + 0.57);
    const shift = row % 2 ? 0.5 : 0;
    const dx = x + shift - Math.round(x + shift);
    const dy = y - row;
    const r = Math.hypot(dx, dy);
    const direction = Math.atan2(dy, dx) + 0.31;
    const swirls = Math.cos(direction * 2) * 0.068 + Math.sin(r * 74 + direction) * 0.061;
    return 0.80 + (swirls + 0.11) * (1 - smoothstep(0.47, 0.66, r));
  }, true);
  const pores = includeStrap ? surfaceTexture(512, 'Leather grain', (u, v) => {
    const warp = 0.6 * Math.sin(u * 126 + v * 151) + 0.25 * Math.cos(v * 472 - u * 173);
    const grain = Math.cos(u * 487 + warp) * Math.sin(v * 960 - warp);
    return 0.76 + 0.11 * grain + 0.075 * Math.sin(u * 1980 - v * 2419) * Math.cos(v * 1732) +
      0.055 * Math.cos(u * 167 + v * 154);
  }, true) : null;

  return {
    gold: metal('Polished rose gold', 0xd29a7d, 0.165),
    goldSatin: metal('Machined rose gold', 0xcc8865, 0.26),
    goldShadow: metal('Rose gold shoulders', 0xbd7d5e, 0.32),
    steel: metal('Polished steel', 0xd6e0e4, 0.19),
    steelDark: metal('Gray steel', 0x777e86, 0.31),
    blue: metal('Heat blued steel', 0x0e3d81, 0.23, { metalness: 0.81 }),
    ink: soft('Lacquer inlay', 0x11141b, 0.58),
    silver: metal('Silver facing', 0xd9d4c9, 0.35, { metalness: 0.72 }),
    dialField: metal('Hobnail silver', 0xd7d2c8, 0.33, { metalness: 0.80 }),
    chapter: metal('Spun silver chapter ring', 0xe3ded1, 0.45, {
      metalness: 0.69, bumpMap: satin, bumpScale: 0.14,
    }),
    brass: metal('Gilt brass', 0xddb45d, 0.28),
    striped: metal('Rhodium bridges', 0xc8c8c2, 0.37, {
      metalness: 0.76, map: stripes, bumpMap: stripes, bumpScale: 0.30,
    }),
    perlage: metal('Perlage mainplate', 0xafa8a0, 0.43, {
      metalness: 0.78, map: pearls, bumpMap: pearls, bumpScale: 0.38,
    }),
    ruby: new THREE.MeshPhysicalMaterial({
      name: 'Polished synthetic ruby', color: 0x9f174a, roughness: 0.17,
      metalness: 0.18, clearcoat: 0.86, clearcoatRoughness: 0.08,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      // Low-reflection sapphire approximation. Alpha avoids a full transmission
      // pass and keeps the underlying dial sharp in both observer and RTT use.
      name: 'AR sapphire', color: 0xb6c3d1, transparent: true, opacity: 0.115,
      depthWrite: false, ior: 1.76, roughness: 0.11, specularIntensity: 0.68,
      clearcoat: 0.27, clearcoatRoughness: 0.08,
    }),
    rubber: soft('Black compression gasket', 0x2f2625, 0.82),
    ...(includeStrap ? { leather: soft('Dark chestnut calfskin', 0x40251a, 0.51, { map: pores, bumpMap: pores, bumpScale: 0.40 }),
    leatherEdge: soft('Burnished hide edge', 0x241710, 0.52),
    lining: soft('Matte saddle lining', 0x9d6847, 0.80, { bumpMap: pores, bumpScale: 0.08 }),
    thread: soft('Saddle thread', 0xc29664, 0.86), } : {}),
  };
}
