import * as THREE from "three";
import { toneMappingExposure, vec4 } from "three/tsl";
import { describe, expect, it, vi } from "vitest";
import {
  MaterialAwareBasicNodeMaterial,
  MaterialAwareLineNodeMaterial,
  MaterialAwareStandardNodeMaterial,
  adaptObserverMaterialForOutput,
} from "../../render/backend/materialAwareNodeMaterials";
import { observerOutputSourceMaterial } from "../../render/backend/observerMaterialOutputIdentity";
import { disposeTeachingSubjectResources } from "../../render/TeachingMaterials";

type OutputGraphNode = {
  type?: string;
  target?: string;
  colorNode?: unknown;
  exposureNode?: unknown;
  getToneMapping?: () => number;
  setup?: (builder: never) => unknown;
};

const expectOutputGraph = (
  material: object,
  sourceOutput: unknown,
  toneMapped: boolean,
) => {
  const nodeMaterial = material as unknown as {
    fog: boolean;
    premultipliedAlpha: boolean;
    setupOutput: (builder: never, outputNode: never) => unknown;
  };
  nodeMaterial.fog = false;
  nodeMaterial.premultipliedAlpha = false;
  const displayOutput = nodeMaterial.setupOutput(
    {} as never,
    sourceOutput as never,
  ) as OutputGraphNode;

  expect(displayOutput.type).toBe("ColorSpaceNode");
  expect(displayOutput.target).toBe(THREE.SRGBColorSpace);

  if (!toneMapped) {
    expect(displayOutput.colorNode).toBe(sourceOutput);
    return;
  }

  const mappedOutput = displayOutput.colorNode as OutputGraphNode;
  expect(mappedOutput.type).toBe("ToneMappingNode");
  expect(mappedOutput.getToneMapping?.()).toBe(THREE.ACESFilmicToneMapping);
  expect(mappedOutput.exposureNode).toBe(toneMappingExposure);
  expect(mappedOutput.colorNode).toBe(sourceOutput);

  const mappedVec4 = mappedOutput.setup?.({
    context: { color: sourceOutput },
    renderer: {
      library: {
        getToneMappingFunction: () => (rgb: unknown) => rgb,
      },
    },
  } as never) as { node?: { nodes?: unknown[] } } | undefined;
  expect(mappedVec4?.node?.nodes?.[1]).toBe((sourceOutput as { a: unknown }).a);
};

const texture = (colorSpace: THREE.ColorSpace): THREE.DataTexture => {
  const value = new THREE.DataTexture(new Uint8Array([120, 140, 160, 255]), 1, 1);
  value.colorSpace = colorSpace;
  value.repeat.set(3, 5);
  value.wrapS = THREE.RepeatWrapping;
  value.wrapT = THREE.RepeatWrapping;
  value.needsUpdate = true;
  return value;
};

describe("material-aware Observer NodeMaterial adaptation", () => {
  it("preserves Standard material maps, PBR values, and authored render policy", () => {
    const albedo = texture(THREE.SRGBColorSpace);
    const roughnessMap = texture(THREE.NoColorSpace);
    const normalMap = texture(THREE.NoColorSpace);
    const source = new THREE.MeshStandardMaterial({
      color: "#d7c19c",
      map: albedo,
      roughnessMap,
      normalMap,
      roughness: 0.94,
      metalness: 0.08,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    source.normalScale.set(0.3, 0.3);

    const adapted = adaptObserverMaterialForOutput(source) as MaterialAwareStandardNodeMaterial | null;

    expect(adapted).toBeInstanceOf(MaterialAwareStandardNodeMaterial);
    expect(adapted?.map).toBe(albedo);
    expect(adapted?.roughnessMap).toBe(roughnessMap);
    expect(adapted?.normalMap).toBe(normalMap);
    expect(adapted?.color.getHexString()).toBe(source.color.getHexString());
    expect(adapted?.roughness).toBe(0.94);
    expect(adapted?.metalness).toBe(0.08);
    expect(adapted?.normalScale.toArray()).toEqual([0.3, 0.3]);
    expect(adapted?.map?.repeat.toArray()).toEqual([3, 5]);
    expect(adapted?.map?.wrapS).toBe(THREE.RepeatWrapping);
    expect(adapted?.map?.wrapT).toBe(THREE.RepeatWrapping);
    expect(adapted?.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(adapted?.roughnessMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(adapted?.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(adapted).toMatchObject({
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    expect((adapted as typeof adapted & { [observerOutputSourceMaterial]?: THREE.Material })[
      observerOutputSourceMaterial
    ]).toBe(source);
    expectOutputGraph(adapted as MaterialAwareStandardNodeMaterial, vec4(0.8, 0.6, 0.4, 0.37), false);

    adapted?.dispose();
    source.dispose();
    albedo.dispose();
    roughnessMap.dispose();
    normalMap.dispose();
  });

  it("uses the unlit NodeMaterial equivalents for Basic and line families", () => {
    const basic = new THREE.MeshBasicMaterial({
      color: "#16a34a",
      transparent: true,
      opacity: 0.42,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const line = new THREE.LineBasicMaterial({
      color: "#60a5fa",
      transparent: true,
      opacity: 0.69,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const adaptedBasic = adaptObserverMaterialForOutput(basic);
    const adaptedLine = adaptObserverMaterialForOutput(line);

    expect(adaptedBasic).toBeInstanceOf(MaterialAwareBasicNodeMaterial);
    expect(adaptedLine).toBeInstanceOf(MaterialAwareLineNodeMaterial);
    expect(adaptedBasic).toMatchObject({
      color: basic.color,
      transparent: true,
      opacity: 0.42,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    expect(adaptedLine).toMatchObject({
      transparent: true,
      opacity: 0.69,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    expectOutputGraph(adaptedBasic as MaterialAwareBasicNodeMaterial, vec4(0.8, 0.6, 0.4, 0.37), false);
    expectOutputGraph(adaptedLine as MaterialAwareLineNodeMaterial, vec4(0.8, 0.6, 0.4, 0.37), false);

    adaptedBasic?.dispose();
    adaptedLine?.dispose();
    basic.dispose();
    line.dispose();
  });

  it("applies material-level ACES to default tone-mapped Basic and LineBasic outputs", () => {
    const basic = new THREE.MeshBasicMaterial({ color: "#f5f8fa", transparent: true, opacity: 0.73 });
    const line = new THREE.LineBasicMaterial({ color: "#06b6d4", transparent: true, opacity: 0.91 });
    const standard = new THREE.MeshStandardMaterial({ color: "#d7c19c" });
    const adaptedBasic = adaptObserverMaterialForOutput(basic);
    const adaptedLine = adaptObserverMaterialForOutput(line);
    const adaptedStandard = adaptObserverMaterialForOutput(standard);

    expect(basic.toneMapped).toBe(true);
    expect(line.toneMapped).toBe(true);
    expect(standard.toneMapped).toBe(true);
    expect(adaptedBasic).toBeInstanceOf(MaterialAwareBasicNodeMaterial);
    expect(adaptedLine).toBeInstanceOf(MaterialAwareLineNodeMaterial);
    expect(adaptedStandard).toBeInstanceOf(MaterialAwareStandardNodeMaterial);
    expect(adaptedBasic).toMatchObject({ toneMapped: true, transparent: true, opacity: 0.73 });
    expect(adaptedLine).toMatchObject({ toneMapped: true, transparent: true, opacity: 0.91 });
    expect(adaptedStandard).toMatchObject({ toneMapped: true });

    const rgba = () => vec4(0.8, 0.6, 0.4, 0.37);
    expectOutputGraph(adaptedBasic as MaterialAwareBasicNodeMaterial, rgba(), true);
    expectOutputGraph(adaptedLine as MaterialAwareLineNodeMaterial, rgba(), true);
    expectOutputGraph(adaptedStandard as MaterialAwareStandardNodeMaterial, rgba(), true);

    adaptedBasic?.dispose();
    adaptedLine?.dispose();
    adaptedStandard?.dispose();
    basic.dispose();
    line.dispose();
    standard.dispose();
  });

  it("builds distinct RGB output graphs and compile identities for B1-B3 without changing alpha", () => {
    const source = new THREE.MeshStandardMaterial({
      color: "#d7c19c",
      toneMapped: true,
      transparent: true,
      opacity: 0.25,
      premultipliedAlpha: false,
      depthWrite: false,
    });
    const input = vec4(0.8, 0.6, 0.4, 0.37);
    const transforms = [
      "bypass-rgb-transform",
      "bypass-tone-mapping",
      "bypass-color-space",
    ] as const;
    const outputs = transforms.map((transform, index) => {
      const output = adaptObserverMaterialForOutput(
        source,
        transform,
        (["B1", "B2", "B3"] as const)[index],
      ) as MaterialAwareStandardNodeMaterial | null;
      if (!output) throw new Error("Expected an adapted standard material");
      output.fog = false;
      const graph = output.setupOutput({} as never, input as never) as OutputGraphNode;
      expect(output.outputGraphBuildCount).toBe(1);
      expect(output.version).toBeGreaterThan(0);
      expect(output.outputTransform).toBe(transform);
      expect(output).toMatchObject({
        outputInterventionId: ["B1", "B2", "B3"][index],
        transparent: source.transparent,
        opacity: source.opacity,
        premultipliedAlpha: source.premultipliedAlpha,
        depthWrite: source.depthWrite,
        toneMapped: source.toneMapped,
      });
      return { output, graph };
    });

    expect(outputs[0]?.graph).toBe(input);
    expect(outputs[1]?.graph.type).toBe("ColorSpaceNode");
    expect(outputs[1]?.graph.target).toBe(THREE.SRGBColorSpace);
    expect(outputs[1]?.graph.colorNode).toBe(input);
    expect(outputs[2]?.graph.type).toBe("ToneMappingNode");
    expect(outputs[2]?.graph.getToneMapping?.()).toBe(THREE.ACESFilmicToneMapping);
    expect(new Set(outputs.map(({ output }) => output.customProgramCacheKey())).size).toBe(3);
    expect(source).toMatchObject({
      transparent: true,
      opacity: 0.25,
      premultipliedAlpha: false,
      depthWrite: false,
      toneMapped: true,
    });

    outputs.forEach(({ output }) => output.dispose());
    source.dispose();
  });

  it("fails closed for a material family outside the audited set", () => {
    const unsupported = new THREE.MeshPhysicalMaterial({ clearcoat: 0.5 });
    expect(adaptObserverMaterialForOutput(unsupported)).toBeNull();
    unsupported.dispose();
  });

  it("lets the registered subject owner dispose the source, NodeMaterial, texture, and geometry once", () => {
    const albedo = texture(THREE.SRGBColorSpace);
    const source = new THREE.MeshStandardMaterial({ map: albedo });
    const adapted = adaptObserverMaterialForOutput(source);
    if (!adapted) throw new Error("Expected an adapted standard material");
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const root = new THREE.Group();
    root.name = "architecture-rise-subject";
    root.userData.resources = { source, geometry, albedo };
    root.add(new THREE.Mesh(geometry, adapted));
    const sourceDispose = vi.spyOn(source, "dispose");
    const adaptedDispose = vi.spyOn(adapted, "dispose");
    const textureDispose = vi.spyOn(albedo, "dispose");
    const geometryDispose = vi.spyOn(geometry, "dispose");

    disposeTeachingSubjectResources(root);

    expect(sourceDispose).toHaveBeenCalledTimes(1);
    expect(adaptedDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });
});
