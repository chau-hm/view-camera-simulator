import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const FULL_TURN = 2 * Math.PI
const CAGE_Y = -10.4
const BARREL = [6.35, 6.35]
const CENTER = [-0.95, 2.65]
const THIRD = [-5.6, 0.1]
const CAGE_DRIVE = [-7.35, -4.55]
const WINDING = [12.95, 0.25]

function add(group, name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(x, y, z)
  group.add(mesh)
  return mesh
}

function assembly(parent, name) {
  const group = new THREE.Group()
  group.name = name
  parent.add(group)
  return group
}

function circle(radius, x = 0, y = 0) {
  const path = new THREE.Path()
  path.absarc(x, y, radius, 0, FULL_TURN, false)
  return path
}

function disk(radius, x = 0, y = 0) {
  const shape = new THREE.Shape()
  shape.absarc(x, y, radius, 0, FULL_TURN, false)
  return shape
}

function plate(shape, depth, bevel = 0, planarFinish = false, curveSegments = 48) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel * 0.8,
  })
  if (planarFinish) {
    const uv = geometry.getAttribute('uv')
    const position = geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, 0.5 + position.getX(i) / 36, 0.5 + position.getY(i) / 36)
    }
  }
  return geometry
}

// The meridian is traced around the actual cross section, including any bore.
function turned(profile, segments = 56) {
  const geometry = new THREE.LatheGeometry(
    profile.map(([radius, z]) => new THREE.Vector2(radius, z)),
    segments,
  )
  geometry.rotateX(Math.PI / 2)
  return geometry
}

function ring(outer, inner, height, bevel = 0.045, segments = 56) {
  return turned([
    [inner, bevel], [inner + bevel, 0], [outer - bevel, 0], [outer, bevel],
    [outer, height - bevel], [outer - bevel, height], [inner + bevel, height],
    [inner, height - bevel], [inner, bevel],
  ], segments)
}

function cylinder(radius, depth, segments = 32) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, segments)
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, 0, depth / 2)
  return geometry
}

function toothShape(radius, teeth, style) {
  const shape = new THREE.Shape()
  const pitch = FULL_TURN / teeth
  const cut = style === 'ratchet' ? 0.22 : Math.min(0.16, radius / 8)
  const tooth = style === 'ratchet'
    ? [[0, radius - cut], [0.15, radius - cut], [0.24, radius], [0.38, radius], [0.94, radius - cut]]
    : [[0, radius - cut], [0.22, radius - cut], [0.34, radius], [0.66, radius], [0.78, radius - cut]]
  for (let i = 0; i < teeth; i++) {
    for (const [part, r] of tooth) {
      const angle = (i + part) * pitch
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      if (i === 0 && part === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }
  }
  shape.closePath()
  return shape
}

function wheelWindow(radius, angle, width) {
  const low = angle - width / 2
  const high = angle + width / 2
  const outer = radius - 0.48
  const inner = radius * 0.32
  const hole = new THREE.Path()
  hole.absarc(0, 0, outer, low, high, false)
  hole.absarc(0, 0, inner, high + 0.10, low - 0.10, true)
  hole.closePath()
  return hole
}

function gear(group, material, name, at, z, radius, teeth, { web, style, phase = 0, depth = 0.20 } = {}) {
  const shape = toothShape(radius, teeth, style)
  shape.holes.push(circle(radius * (web ? 0.15 : 0.20)))
  if (web) {
    for (let i = 0; i < web; i++) {
      shape.holes.push(wheelWindow(radius, (i + 0.5) * FULL_TURN / web, FULL_TURN / web - 0.35))
    }
  }
  const mesh = add(group, name, plate(shape, depth, 0.017, false, 8), material, ...at, z)
  mesh.rotation.z = phase
  return mesh
}

function screwCrown(radius) {
  const depth = radius * 0.14
  const lip = radius * 0.145
  const angle = Math.asin(lip / radius)
  const geometry = []
  for (const start of [angle, Math.PI + angle]) {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, radius, start, start + Math.PI - 2 * angle, false)
    shape.closePath()
    geometry.push(plate(shape, depth, 0.016, false, 12))
  }
  return geometry
}

function fastenerKit(materials) {
  const inventory = new Map()
  return (parent, name, at, z, angle, radius = 0.49, finish = materials.blue) => {
    const unit = assembly(parent, name)
    unit.position.set(...at, z)
    unit.rotation.z = angle
    if (!inventory.has(radius)) {
      const floor = plate(disk(radius - 0.023), 0.12, 0.023, false, 16).translate(0, 0, -0.132)
      const slotWalls = screwCrown(radius * 0.95)
      for (const wall of slotWalls) wall.translate(0, 0, -0.198)
      const pieces = [floor, ...slotWalls]
      const head = mergeGeometries(pieces)
      for (const piece of pieces) piece.dispose()
      inventory.set(radius, {
        seat: ring(radius * 1.15, radius * 0.79, 0.15, 0.022, 32),
        head,
        shank: cylinder(radius * 0.52, 0.36, 16),
      })
    }
    const parts = inventory.get(radius)
    add(unit, 'Countersink', parts.seat, materials.steel, 0, 0, -0.085)
    add(unit, 'Screw shank', parts.shank, materials.steelDark, 0, 0, 0.027)
    add(unit, 'Machined slotted head', parts.head, finish)
    return unit
  }
}

function chaton(group, materials, name, at, z, outer = 0.58) {
  const jewelRadius = outer * 0.62
  const inner = outer * 0.21
  add(group, `${name} · polished gold setting`, ring(outer, jewelRadius - 0.026, 0.24, 0.045, 40), materials.brass, ...at, z)
  add(group, `${name} · drilled ruby`, turned([
    [inner, 0.06], [inner + 0.08, 0.015], [jewelRadius - 0.05, 0],
    [jewelRadius, 0.058], [jewelRadius, 0.18], [inner, 0.18], [inner, 0.06],
  ], 40), materials.ruby, ...at, z + 0.011)
}

function bridge(group, materials, name, shape, z, depth, bevel = 0.12) {
  return add(group, name, plate(shape, depth, bevel, true, 16), [materials.striped, materials.steel], 0, 0, z)
}

function barrelBridgeOutline() {
  const shape = new THREE.Shape()
  shape.moveTo(0.0, 14.5)
  shape.bezierCurveTo(2.4, 15.7, 4.8, 15.95, 7.0, 15.2)
  shape.bezierCurveTo(11.25, 13.2, 15.2, 9.45, 16.0, 5.8)
  shape.bezierCurveTo(16.75, 3.7, 15.9, 2.45, 14.54, 2.55)
  shape.bezierCurveTo(12.50, 2.55, 10.55, -0.35, 8.75, -0.55)
  shape.bezierCurveTo(6.0, -0.75, 5.33, 1.35, 3.25, 1.43)
  shape.bezierCurveTo(2.39, 1.52, 1.8, 2.2, 1.75, 3.3)
  shape.bezierCurveTo(1.7, 5.2, 0.4, 5.6, -1.24, 6.35)
  shape.bezierCurveTo(-4.08, 7.47, -2.70, 10.06, -1.75, 10.68)
  shape.bezierCurveTo(-0.95, 11.36, -0.9, 13.75, 0, 14.5)
  shape.closePath()
  shape.holes.push(circle(0.63, ...BARREL))
  return shape
}

function trainBridgeOutline() {
  const shape = new THREE.Shape()
  shape.moveTo(-8.7, 12.4)
  shape.bezierCurveTo(-7.0, 12.7, -6.31, 10.98, -6.49, 9.30)
  shape.bezierCurveTo(-6.87, 5.68, -3.90, 4.48, -0.65, 4.15)
  shape.bezierCurveTo(1.02, 4.05, 1.12, 1.78, 0.15, 1.19)
  shape.bezierCurveTo(-1.09, 0.26, -2.82, 2.64, -4.43, 1.92)
  shape.bezierCurveTo(-5.47, 1.47, -4.15, 0.25, -4.36, -0.63)
  shape.bezierCurveTo(-4.76, -2.04, -6.90, -1.22, -7.34, -2.59)
  shape.bezierCurveTo(-7.76, -3.35, -5.64, -3.75, -5.85, -4.96)
  shape.bezierCurveTo(-6.10, -6.56, -8.29, -5.88, -9.40, -5.62)
  shape.bezierCurveTo(-11.34, -5.18, -13.56, -8.01, -14.71, -6.44)
  shape.bezierCurveTo(-16.22, -4.11, -13.71, -3.47, -12.25, -3.28)
  shape.bezierCurveTo(-10.40, -3.05, -9.42, -3.02, -9.19, -1.40)
  shape.bezierCurveTo(-8.95, 0.37, -7.33, 0.60, -7.81, 2.05)
  shape.bezierCurveTo(-8.50, 3.97, -10.66, 5.30, -11.32, 7.48)
  shape.bezierCurveTo(-11.92, 9.53, -10.50, 12.28, -8.70, 12.40)
  shape.closePath()
  for (const [x, y] of [CENTER, THIRD, CAGE_DRIVE]) shape.holes.push(circle(0.42, x, y))
  return shape
}

function lowerCockOutline() {
  const shape = new THREE.Shape()
  shape.moveTo(-3.65, -2.8)
  shape.bezierCurveTo(-2.86, -1.25, -1.29, -1.30, 0, -2.48)
  shape.bezierCurveTo(1.0, -1.37, 2.76, -1.24, 3.61, -2.83)
  shape.bezierCurveTo(4.05, -4.68, 1.82, -4.48, 1.28, -5.95)
  shape.bezierCurveTo(0.90, -7.35, 0.70, -7.83, 1.04, -9.48)
  shape.bezierCurveTo(2.0, -10.75, 1.04, -11.95, 0, -11.97)
  shape.bezierCurveTo(-1.04, -11.95, -2.0, -10.75, -1.04, -9.48)
  shape.bezierCurveTo(-0.70, -7.83, -0.90, -7.35, -1.28, -5.95)
  shape.bezierCurveTo(-1.82, -4.48, -4.05, -4.68, -3.65, -2.8)
  shape.closePath()
  shape.holes.push(circle(0.38, 0, CAGE_Y))
  return shape
}

function trainChannel() {
  const channel = new THREE.Path()
  channel.moveTo(-0.2, 7.15)
  channel.bezierCurveTo(2.46, 6.9, 3.84, 4.42, 3.02, 2.38)
  channel.bezierCurveTo(2.38, 0.82, 0.30, -0.63, -1.41, -1.95)
  channel.bezierCurveTo(-3.15, -3.29, -4.9, -4.5, -6.54, -7.12)
  channel.bezierCurveTo(-8.02, -9.28, -11.16, -8.07, -11.36, -5.62)
  channel.bezierCurveTo(-11.53, -3.42, -9.21, -1.81, -9.17, 0.44)
  channel.bezierCurveTo(-9.11, 3.25, -6.68, 5.80, -3.49, 6.72)
  channel.bezierCurveTo(-2.43, 7.03, -1.16, 7.19, -0.2, 7.15)
  channel.closePath()
  return channel
}

function buildBase(parent, materials) {
  const base = assembly(parent, 'Mainplate and movement seat')
  const carrier = turned([
    [17.48, -3.65], [17.56, -3.73], [18.4, -3.73], [18.54, -3.52],
    [19.25, -3.52], [19.25, 2.50], [18.55, 2.50], [18.55, 2.88],
    [17.53, 2.88], [17.48, 2.83], [17.48, -3.65],
  ], 144)
  add(base, 'Recessed stepped movement carrier', carrier, materials.goldShadow)
  const footprint = disk(17.61)
  footprint.holes.push(circle(6.54, 0, CAGE_Y))
  add(base, 'Mainplate core with tourbillon opening', plate(footprint, 0.86, 0.035, true, 64), [materials.perlage, materials.steel], 0, 0, -1.41)

  const rearFace = disk(17.57)
  rearFace.holes.push(circle(6.54, 0, CAGE_Y))
  rearFace.holes.push(trainChannel())
  add(base, 'Perlage mainplate land with recessed going-train channel',
    plate(rearFace, 0.36, 0.075, true, 48), [materials.perlage, materials.steel], 0, 0, -1.81)
  add(base, 'Turned perimeter shoulder of the mainplate', ring(17.60, 17.10, 0.185, 0.045, 112),
    materials.steel, 0, 0, -1.995)
}

function support(group, materials, name, at, z, width = 0.70) {
  add(group, name, cylinder(width, -1.41 - z), materials.silver, ...at, z)
}

function buildBridges(parent, materials, screw) {
  const barrel = assembly(parent, 'Barrel bridge and winding click')
  const train = assembly(parent, 'Going-train bridge and bearings')
  const cock = assembly(parent, 'Lower tourbillon cock and bearing')
  bridge(barrel, materials, 'Barrel bridge · striped with polished anglage', barrelBridgeOutline(), -3.89, 0.61)
  bridge(train, materials, 'Going-train bridge · striped with polished anglage', trainBridgeOutline(), -4.02, 0.58)
  bridge(cock, materials, 'Lower tourbillon cock · striped with polished anglage', lowerCockOutline(), -3.99, 0.55, 0.10)

  for (const [i, at] of [[3.5, 14.5], [-1.31, 8.18], [14.38, 5.18]].entries()) {
    support(barrel, materials, 'Barrel-bridge foot', at, -3.29, 0.79)
    screw(barrel, 'Barrel-bridge screw', at, -3.98, 0.41 + i * 0.84)
  }
  for (const [i, at] of [[-9.05, 10.18], [-13.46, -5.07]].entries()) {
    support(train, materials, 'Going-train bridge foot', at, -3.45, 0.86)
    screw(train, 'Going-train bridge screw', at, -4.12, 0.8 + i * 1.32)
  }
  for (const [i, at] of [[-2.45, -2.91], [2.45, -2.91]].entries()) {
    support(cock, materials, 'Tourbillon cock foot', at, -3.48, 0.71)
    screw(cock, 'Tourbillon cock screw', at, -4.08, 0.45 + i * 1.1, 0.44)
  }
  for (const [i, at] of [CENTER, THIRD, CAGE_DRIVE].entries()) {
    chaton(train, materials, `Going train bearing ${i + 1}`, at, -4.22, 0.57 - 0.04 * i)
  }
  add(cock, 'Coaxial lower bearing sleeve with staff bore', ring(0.63, 0.20, 0.75, 0.032, 48), materials.steel, 0, CAGE_Y, -3.99)
  chaton(cock, materials, 'Lower cage bearing', [0, CAGE_Y], -4.23, 0.77)

  const click = new THREE.Shape()
  click.moveTo(-0.76, 0.42)
  click.bezierCurveTo(-0.95, 1.24, -0.55, 1.33, -0.14, 1.26)
  click.bezierCurveTo(0.38, 1.08, 0.22, 0.36, 0.73, 0.23)
  click.lineTo(1.1, -0.40)
  click.lineTo(0.48, -0.54)
  click.bezierCurveTo(0.07, 0.07, -0.34, 0.14, -0.76, 0.42)
  click.closePath()
  const at = [3.3, 12.49]
  const clickMesh = add(barrel, 'Winding ratchet click with shaped tip', plate(click, 0.20, 0.055, false, 16), materials.steel, ...at, -4.64)
  clickMesh.rotation.z = -0.38
  const clickPivot = [3.34, 13.26]
  add(barrel, 'Click pivot seat', cylinder(0.39, 0.65), materials.steelDark, ...clickPivot, -4.63)
  screw(barrel, 'Click pivot screw', clickPivot, -4.66, 0.9, 0.32, materials.steelDark)

  const spring = new THREE.Shape()
  spring.moveTo(1.37, 13.59)
  spring.bezierCurveTo(1.86, 13.21, 2.53, 12.88, 2.91, 13.13)
  spring.lineTo(2.97, 13.30)
  spring.bezierCurveTo(2.54, 13.16, 2.05, 13.46, 1.57, 13.89)
  spring.closePath()
  add(barrel, 'Tempered click spring', plate(spring, 0.16, 0.021, false, 10), materials.blue, 0, 0, -4.58)
  add(barrel, 'Click-spring foot', cylinder(0.31, 0.49), materials.steelDark, 1.53, 13.70, -4.47)
  screw(barrel, 'Click-spring fastening screw', [1.53, 13.70], -4.60, 1.14, 0.31)
}

function keylessWorksBridge() {
  const shape = new THREE.Shape()
  shape.moveTo(16.27, -1.38)
  shape.bezierCurveTo(17.02, -2.64, 16.49, -4.6, 15.58, -6.14)
  shape.bezierCurveTo(14.13, -8.56, 12.54, -10.07, 10.71, -11.25)
  shape.bezierCurveTo(8.51, -12.36, 7.8, -10.5, 9.36, -9.3)
  shape.bezierCurveTo(11.21, -8.04, 11.62, -6.43, 11.65, -4.08)
  shape.bezierCurveTo(11.53, -2.47, 12.48, -1.85, 13.3, -1.74)
  shape.bezierCurveTo(14.75, -1.31, 15.04, -0.26, 16.27, -1.38)
  shape.closePath()
  return shape
}

function buildKeylessWorks(parent, materials, screw) {
  const keyless = assembly(parent, 'Keyless-works cover and setting lever')
  bridge(keyless, materials, 'Keyless-works bridge and lever seat', keylessWorksBridge(), -3.69, 0.55, 0.105)
  for (const [i, at] of [[15.12, -4.25], [10.13, -9.95], [15.7, -1.95]].entries()) {
    support(keyless, materials, 'Keyless-works support foot', at, -3.18, 0.65)
    screw(keyless, 'Keyless-works bridge screw', at, -3.77, 0.25 + i * 1.1, 0.41)
  }

  const lever = new THREE.Shape()
  lever.moveTo(14.86, -5.1)
  lever.bezierCurveTo(14.15, -5.21, 13.6, -4.66, 13.41, -4.1)
  lever.bezierCurveTo(13.06, -3.42, 12.65, -3.24, 12.46, -3.03)
  lever.lineTo(12.92, -2.62)
  lever.bezierCurveTo(13.25, -2.93, 13.71, -3.05, 14.1, -3.7)
  lever.bezierCurveTo(14.35, -4.12, 15.11, -4.2, 15.3, -4.48)
  lever.bezierCurveTo(15.49, -4.72, 15.17, -5.0, 14.86, -5.1)
  lever.closePath()
  add(keyless, 'Polished setting lever and retaining shoulder', plate(lever, 0.23, 0.042, false, 14),
    [materials.steel, materials.steelDark], 0, 0, -4.12)
  const pivot = [14.84, -4.72]
  add(keyless, 'Setting lever pivot seat', cylinder(0.38, 0.25), materials.steelDark, ...pivot, -4.01)
  screw(keyless, 'Setting lever pivot screw', pivot, -4.14, 0.76, 0.316, materials.steelDark)
}

let ratchetPixels;
function ratchetFacing(materials) {
  const size = 512
  if (!ratchetPixels) {
    const data = new Uint8Array(size * size * 4)
    for (let ix = 0; ix < size; ix++) {
      const x = 2 * (ix + 0.5) / size - 1
      for (let iy = 0; iy < size; iy++) {
        const y = 2 * (iy + 0.5) / size - 1
        const r = Math.hypot(x, y)
        const groovePhase = FULL_TURN * r
        const grooves = 17 * Math.sin(52 * groovePhase + 0.32 * Math.sin(7 * groovePhase))
          + 5 * Math.sin(81 * groovePhase)
        const height = Math.round(128 + THREE.MathUtils.smoothstep(r, 0.17, 0.32) * grooves)
        const index = (iy * size + ix) * 4
        data.set([height, height, height, 255], index)
      }
    }
    ratchetPixels = data
  }
  const grain = new THREE.DataTexture(ratchetPixels.slice(), size, size, THREE.RGBAFormat)
  grain.name = 'Fine concentric ratchet tool marks'
  grain.generateMipmaps = true
  grain.minFilter = THREE.LinearMipmapLinearFilter
  grain.magFilter = THREE.LinearFilter
  grain.anisotropy = 8
  grain.needsUpdate = true
  const finish = materials.silver.clone()
  finish.name = 'Concentrically brushed ratchet steel'
  finish.color.multiplyScalar(0.81)
  finish.roughness = 0.27
  finish.metalness = 0.87
  finish.bumpMap = grain
  finish.bumpScale = 0.073

  const facing = ring(5.43, 1.29, 0.073, 0.014, 96)
  const position = facing.getAttribute('position')
  const uv = facing.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, 0.5 + position.getX(i) / 10.86, 0.5 + position.getY(i) / 10.86)
  }
  return { finish, facing }
}

function buildWinding(parent, materials, screw) {
  const winding = assembly(parent, 'Winding wheels and barrel')
  add(winding, 'Closed mainspring barrel drum', cylinder(5.69, 0.98, 100), materials.brass, ...BARREL, -2.77)
  gear(winding, materials.brass, 'Mainspring barrel gear', BARREL, -2.59, 6.02, 77, { depth: 0.30, phase: 0.07 })
  add(winding, 'Barrel arbor', cylinder(0.61, 3.40, 40), materials.steel, ...BARREL, -4.98)

  gear(winding, materials.steel, 'Winding ratchet wheel', BARREL, -4.79, 5.72, 76, { style: 'ratchet', depth: 0.30, phase: -0.05 })
  const ratchet = ratchetFacing(materials)
  add(winding, 'Ratchet · circular brushed face', ratchet.facing, ratchet.finish, ...BARREL, -4.817)
  for (const [i, radius] of [1.47, 5.25].entries()) {
    add(winding, `Ratchet turned boundary ${i + 1}`, ring(radius, radius - 0.055, 0.026, 0.008, 96), materials.steel, ...BARREL, -4.831)
  }
  add(winding, 'Ratchet mounting washer', ring(1.73, 0.68, 0.20, 0.065, 64), materials.steel, ...BARREL, -4.94)
  screw(winding, 'Barrel arbor screw', BARREL, -5.02, 0.56, 0.77, materials.steelDark)

  add(winding, 'Crown-wheel post', cylinder(0.64, 3.03, 42), materials.steelDark, ...WINDING, -4.53)
  gear(winding, materials.steel, 'Crown winding wheel', WINDING, -4.68, 3.34, 43, { web: 5, depth: 0.28, phase: 0.09 })
  add(winding, 'Crown-wheel collar', ring(0.98, 0.5, 0.19, 0.03, 48), materials.steel, ...WINDING, -4.79)
  screw(winding, 'Crown-wheel retaining screw', WINDING, -4.84, 1.26, 0.59)
  const stem = add(winding, 'Crown winding stem extension', cylinder(0.35, 6.45, 32), materials.steel, 14.2, 0, -0.45)
  stem.rotateY(Math.PI / 2)
}

function buildTrain(parent, materials) {
  const train = assembly(parent, 'Fixed-pose going wheels and pinions')
  for (const [at, z, radius, hubRadius, teeth, web, phase, name] of [
    [CENTER, -3.15, 3.91, 0.69, 61, 5, 0.01, 'Center going wheel'],
    [THIRD, -2.12, 3.43, 0.55, 53, 5, 0.06, 'Third going wheel'],
    [CAGE_DRIVE, -2.84, 3.78, 0.61, 57, 5, -0.03, 'Cage drive wheel'],
  ]) {
    gear(train, materials.brass, name, at, z, radius, teeth, { web, phase })
    add(train, `${name} · hub press-fit on arbor`, cylinder(hubRadius, 0.34), materials.brass, ...at, z - 0.065)
    add(train, `${name} · steel arbor`, cylinder(0.16, 2.86, 24), materials.steel, ...at, -4.21)
  }
  for (const [at, z, radius, teeth, phase, hubStart, hubEnd, name] of [
    [CENTER, -2.59, 2.25, 29, 0.22833, -2.90, -2.36, 'Center pinion'],
    [THIRD, -3.15, 1.42, 20, 0.10904, -3.17, -1.98, 'Third-wheel pinion'],
    [CAGE_DRIVE, -2.12, 1.57, 21, 0.21781, -2.72, -1.89, 'Cage-drive pinion'],
  ]) {
    gear(train, materials.steelDark, name, at, z, radius, teeth, { phase, depth: 0.22 })
    add(train, `${name} · coupling sleeve`, ring(radius * 0.20 + 0.007, 0.15, hubEnd - hubStart, 0.014, 32), materials.steel, ...at, hubStart)
  }
}

export function buildMovement(materials) {
  const movement = new THREE.Group()
  movement.name = 'Rear movement'
  const screw = fastenerKit(materials)
  buildBase(movement, materials)
  buildWinding(movement, materials, screw)
  buildTrain(movement, materials)
  buildBridges(movement, materials, screw)
  buildKeylessWorks(movement, materials, screw)
  return movement
}
