import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  MaterialAwareMaterialTracker,
  createObserverControllerMaterialOutputOwner,
  isMaterialAwareRenderable,
  type MaterialAwareRenderable,
  type MaterialOutputOwner,
} from "../../render/backend/materialAwareMaterialTracker";
import { createAnatomyMaterialOutputVariantOwner } from "../../render/backend/anatomyMaterialOutputAdapter";
import { resolveArchitectureRiseMaterialOutputOwner } from "../../render/backend/architectureRiseMaterialOutputAdapter";
import {
  MaterialAwareBasicNodeMaterial,
  MaterialAwareLineNodeMaterial,
  MaterialAwareStandardNodeMaterial,
} from "../../render/backend/materialAwareNodeMaterials";
import {
  getObserverMaterialSignatures,
} from "../../render/backend/observerMaterialSignatures";
import {
  observerOutputOwnerIdentity,
  observerOutputTrackerIdentity,
} from "../../render/backend/observerMaterialOutputIdentity";
import { disposeTeachingSubjectResources } from "../../render/TeachingMaterials";

const reconcile = (
  tracker: MaterialAwareMaterialTracker,
  mesh: THREE.Mesh,
  owner: MaterialOutputOwner = tracker.controllerOwner,
  frame = 1,
): ReturnType<MaterialAwareMaterialTracker["reconcileRenderable"]> => {
  const result = tracker.reconcileRenderable(mesh, owner, frame, getObserverMaterialSignatures);
  if (result.materials.some((material, index) => material !== (
    Array.isArray(mesh.material) ? mesh.material[index] : mesh.material
  ))) {
    mesh.material = Array.isArray(mesh.material) ? result.materials : result.materials[0]!;
  }
  return result;
};

const outputMaterial = (mesh: THREE.Mesh): THREE.Material => {
  if (Array.isArray(mesh.material)) throw new Error("Expected a single attached material");
  return mesh.material;
};

const reconcileScene = (
  tracker: MaterialAwareMaterialTracker,
  scene: THREE.Scene,
  frame: number,
  resolveOwner: (renderable: MaterialAwareRenderable) => MaterialOutputOwner = () => tracker.controllerOwner,
): number => {
  scene.traverse((object) => {
    if (!isMaterialAwareRenderable(object)) return;
    const result = tracker.reconcileRenderable(
      object,
      resolveOwner(object),
      frame,
      getObserverMaterialSignatures,
    );
    const attached = Array.isArray(object.material) ? object.material : [object.material];
    if (result.materials.some((material, index) => material !== attached[index])) {
      object.material = Array.isArray(object.material) ? result.materials : result.materials[0]!;
    }
  });
  return tracker.releaseStaleMaterials(frame);
};

const createOwner = (
  kind: MaterialOutputOwner["kind"],
  identity: object = {},
) => {
  const outputs = new Set<THREE.Material>();
  const dispose = vi.fn((output: THREE.Material) => {
    if (outputs.delete(output)) output.dispose();
  });
  const owner: MaterialOutputOwner = {
    identity,
    kind,
    retain: (output) => { outputs.add(output); },
    release: dispose,
  };
  return { owner, outputs, dispose };
};

describe("material-aware Observer output tracking", () => {
  it("applies Bellows render-state overrides to an owned output and releases it on restoration", () => {
    const texture = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: 0.16,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const sourceDispose = vi.spyOn(source, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(17);
    const variantOwner = createAnatomyMaterialOutputVariantOwner(
      tracker.controllerOwner,
      {},
      "material-aware",
      "B0",
      { forceSinglePass: true, blending: THREE.NoBlending },
    );

    const interventionOutput = reconcile(tracker, mesh, variantOwner).materials[0]!;
    const outputDispose = vi.spyOn(interventionOutput, "dispose");
    expect(interventionOutput).toMatchObject({
      transparent: true,
      opacity: 0.16,
      blending: THREE.NoBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
    });
    expect(source).toMatchObject({
      transparent: true,
      opacity: 0.16,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: false,
    });
    expect((source as THREE.MeshStandardMaterial).map).toBe(texture);
    expect((interventionOutput as THREE.Material & { map?: THREE.Texture | null }).map).toBe(texture);

    reconcile(tracker, mesh, tracker.controllerOwner, 2);
    expect(mesh.material).not.toBe(interventionOutput);
    tracker.releaseStaleMaterials(3);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    tracker.dispose();
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    source.dispose();
    texture.dispose();
    mesh.geometry.dispose();
  });

  it("retains the exact base output while a per-renderable native variant is attached", () => {
    const source = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16 });
    const sourceDispose = vi.spyOn(source, "dispose");
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), source) as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const tracker = new MaterialAwareMaterialTracker(18);
    const baseOutput = reconcile(tracker, mesh, tracker.controllerOwner, 1).materials[0]!;
    const baseDispose = vi.spyOn(baseOutput, "dispose");
    const releaseBaseOutput = tracker.retainOutput(source, tracker.controllerOwner);
    const variantOwner = createAnatomyMaterialOutputVariantOwner(
      tracker.controllerOwner,
      {},
      "material-aware",
      "B0",
      { forceSinglePass: true },
    );
    const variantOutput = reconcile(tracker, mesh, variantOwner, 2).materials[0]!;
    const variantDispose = vi.spyOn(variantOutput, "dispose");

    expect(variantOutput).not.toBe(baseOutput);
    // The controller reconciles active renderables every frame before stale cleanup.
    reconcile(tracker, mesh, variantOwner, 3);
    tracker.releaseStaleMaterials(4);
    expect(baseDispose).not.toHaveBeenCalled();
    expect(mesh.material).toBe(variantOutput);

    const restored = reconcile(tracker, mesh, tracker.controllerOwner, 5).materials[0]!;
    releaseBaseOutput();
    expect(restored).toBe(baseOutput);
    reconcile(tracker, mesh, tracker.controllerOwner, 6);
    tracker.releaseStaleMaterials(7);
    expect(variantDispose).toHaveBeenCalledTimes(1);
    expect(baseDispose).not.toHaveBeenCalled();
    tracker.dispose();
    expect(baseDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();
    source.dispose();
    mesh.geometry.dispose();
  });

  it("isolates shared source assignments across a scoped Anatomy output intervention", () => {
    const source = new THREE.MeshStandardMaterial({
      color: "#d7c19c",
      transparent: true,
      opacity: 0.25,
      premultipliedAlpha: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    const sourceDispose = vi.spyOn(source, "dispose");
    const dimmed = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const highlighted = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(42);
    const owner = createOwner("observer-controller");
    const dimmedOwner = createAnatomyMaterialOutputVariantOwner(
      owner.owner,
      {},
      "bypass-rgb-transform",
      "B1",
    );
    const dimmedOutput = reconcile(tracker, dimmed, dimmedOwner).materials[0]!;
    const highlightedOutput = reconcile(tracker, highlighted, owner.owner).materials[0]!;

    expect(dimmedOutput).not.toBe(highlightedOutput);
    expect(dimmed.material).toBe(dimmedOutput);
    expect(highlighted.material).toBe(highlightedOutput);
    expect(dimmedOutput).toMatchObject({
      outputTransform: "bypass-rgb-transform",
      outputInterventionId: "B1",
      transparent: true,
      opacity: 0.25,
      premultipliedAlpha: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    expect(highlightedOutput).toMatchObject({
      outputTransform: "material-aware",
      outputInterventionId: "B0",
      transparent: true,
      opacity: 0.25,
      premultipliedAlpha: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    expect(source).toMatchObject({
      transparent: true,
      opacity: 0.25,
      premultipliedAlpha: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
    });
    expect(owner.outputs.size).toBe(2);

    tracker.dispose();
    expect(dimmed.material).toBe(source);
    expect(highlighted.material).toBe(source);
    expect(owner.outputs.size).toBe(0);
    expect(sourceDispose).not.toHaveBeenCalled();
    source.dispose();
    dimmed.geometry.dispose();
    highlighted.geometry.dispose();
  });

  it("releases one missing shared-source attachment while keeping the active sibling output", () => {
    const source = new THREE.MeshStandardMaterial();
    const sourceDispose = vi.spyOn(source, "dispose");
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const scene = new THREE.Scene();
    scene.add(meshA, meshB);
    const tracker = new MaterialAwareMaterialTracker(1);

    reconcileScene(tracker, scene, 1);
    const sharedOutput = outputMaterial(meshA);
    expect(outputMaterial(meshB)).toBe(sharedOutput);
    expect(tracker.attachmentCount).toBe(2);
    expect(tracker.trackedRenderableCount).toBe(2);
    expect(tracker.managedMaterialCount).toBe(1);
    const outputDispose = vi.spyOn(sharedOutput, "dispose");

    scene.remove(meshA);
    reconcileScene(tracker, scene, 2);
    expect(tracker.attachmentCount).toBe(2);
    expect(tracker.managedMaterialCount).toBe(1);
    expect(outputDispose).not.toHaveBeenCalled();

    reconcileScene(tracker, scene, 3);
    expect(scene.children).not.toContain(meshA);
    expect(tracker.attachmentCount).toBe(1);
    expect(tracker.trackedRenderableCount).toBe(1);
    expect(tracker.managedMaterialCount).toBe(1);
    expect(meshA.material).toBe(source);
    expect(outputMaterial(meshB)).toBe(sharedOutput);
    expect(outputDispose).not.toHaveBeenCalled();
    expect(sourceDispose).not.toHaveBeenCalled();

    scene.remove(meshB);
    reconcileScene(tracker, scene, 4);
    expect(tracker.attachmentCount).toBe(1);
    expect(tracker.managedMaterialCount).toBe(1);
    reconcileScene(tracker, scene, 5);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.trackedRenderableCount).toBe(0);
    expect(tracker.managedMaterialCount).toBe(0);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();

    tracker.dispose();
    source.dispose();
    meshA.geometry.dispose();
    meshB.geometry.dispose();
  });

  it("keeps attachment counts bounded through 100 shared-material mount/unmount cycles", () => {
    const source = new THREE.MeshStandardMaterial();
    const sourceDispose = vi.spyOn(source, "dispose");
    const persistentMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const scene = new THREE.Scene();
    scene.add(persistentMesh);
    const tracker = new MaterialAwareMaterialTracker(2);
    reconcileScene(tracker, scene, 1);
    const sharedOutput = outputMaterial(persistentMesh);
    const outputDispose = vi.spyOn(sharedOutput, "dispose");
    let frame = 1;

    for (let cycle = 0; cycle < 100; cycle += 1) {
      const temporaryMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
      scene.add(temporaryMesh);
      frame += 1;
      reconcileScene(tracker, scene, frame);
      expect(outputMaterial(temporaryMesh)).toBe(sharedOutput);
      expect(outputMaterial(persistentMesh)).toBe(sharedOutput);
      expect(tracker.attachmentCount).toBe(2);
      expect(tracker.trackedRenderableCount).toBe(2);
      expect(tracker.managedMaterialCount).toBe(1);

      scene.remove(temporaryMesh);
      frame += 1;
      reconcileScene(tracker, scene, frame);
      expect(tracker.attachmentCount).toBe(2);
      expect(outputDispose).not.toHaveBeenCalled();

      frame += 1;
      reconcileScene(tracker, scene, frame);
      expect(temporaryMesh.material).toBe(source);
      expect(tracker.attachmentCount).toBe(1);
      expect(tracker.trackedRenderableCount).toBe(1);
      expect(tracker.managedMaterialCount).toBe(1);
      expect(outputMaterial(persistentMesh)).toBe(sharedOutput);
      expect(outputDispose).not.toHaveBeenCalled();
      temporaryMesh.geometry.dispose();
    }

    scene.remove(persistentMesh);
    frame += 1;
    reconcileScene(tracker, scene, frame);
    frame += 1;
    reconcileScene(tracker, scene, frame);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.trackedRenderableCount).toBe(0);
    expect(tracker.managedMaterialCount).toBe(0);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();

    tracker.dispose();
    source.dispose();
    persistentMesh.geometry.dispose();
  });

  it("detaches an old shared-source slot when one renderable replaces its source", () => {
    const sourceA = new THREE.MeshStandardMaterial();
    const sourceB = new THREE.MeshStandardMaterial();
    const sourceADispose = vi.spyOn(sourceA, "dispose");
    const sourceBDispose = vi.spyOn(sourceB, "dispose");
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), sourceA);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), sourceA);
    const scene = new THREE.Scene();
    scene.add(meshA, meshB);
    const tracker = new MaterialAwareMaterialTracker(3);
    reconcileScene(tracker, scene, 1);
    const outputA = outputMaterial(meshA);
    const outputADispose = vi.spyOn(outputA, "dispose");
    const outputB = outputMaterial(meshB);

    meshA.material = sourceB;
    reconcileScene(tracker, scene, 2);
    const outputForSourceB = outputMaterial(meshA);
    const outputBDispose = vi.spyOn(outputForSourceB, "dispose");
    expect(outputForSourceB).not.toBe(outputA);
    expect(outputMaterial(meshB)).toBe(outputB);
    expect(tracker.attachmentCount).toBe(2);
    expect(tracker.trackedRenderableCount).toBe(2);
    expect(tracker.managedMaterialCount).toBe(2);
    expect(outputADispose).not.toHaveBeenCalled();
    expect(sourceADispose).not.toHaveBeenCalled();

    tracker.dispose();
    expect(meshA.material).toBe(sourceB);
    expect(meshB.material).toBe(sourceA);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.trackedRenderableCount).toBe(0);
    expect(outputADispose).toHaveBeenCalledTimes(1);
    expect(outputBDispose).toHaveBeenCalledTimes(1);
    expect(sourceADispose).not.toHaveBeenCalled();
    expect(sourceBDispose).not.toHaveBeenCalled();
    sourceA.dispose();
    sourceB.dispose();
    meshA.geometry.dispose();
    meshB.geometry.dispose();
  });

  it("tracks multi-material slots and array reordering without retaining obsolete slots", () => {
    const sourceA = new THREE.MeshStandardMaterial();
    const sourceB = new THREE.MeshStandardMaterial();
    const sourceC = new THREE.MeshStandardMaterial();
    const sourceDisposals = [sourceA, sourceB, sourceC].map((source) => vi.spyOn(source, "dispose"));
    const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> = new THREE.Mesh(
      new THREE.BoxGeometry(),
      [sourceA, sourceB],
    );
    const scene = new THREE.Scene();
    scene.add(mesh);
    const tracker = new MaterialAwareMaterialTracker(4);
    reconcileScene(tracker, scene, 1);
    const [outputA, outputB] = mesh.material as THREE.Material[];
    if (!outputA || !outputB) throw new Error("Expected two adapted material slots");
    const outputADispose = vi.spyOn(outputA, "dispose");
    const outputBDispose = vi.spyOn(outputB, "dispose");

    mesh.material = [outputB, outputA];
    reconcileScene(tracker, scene, 2);
    expect((mesh.material as THREE.Material[])[0]).toBe(outputB);
    expect((mesh.material as THREE.Material[])[1]).toBe(outputA);
    expect(tracker.attachmentCount).toBe(2);
    expect(tracker.managedMaterialCount).toBe(2);

    mesh.material = [outputB, sourceC];
    reconcileScene(tracker, scene, 3);
    const [retainedOutputB, outputC] = mesh.material as THREE.Material[];
    expect(retainedOutputB).toBe(outputB);
    expect(outputC).not.toBe(sourceC);
    expect(tracker.attachmentCount).toBe(2);
    expect(tracker.trackedRenderableCount).toBe(1);
    expect(tracker.managedMaterialCount).toBe(3);
    expect(outputADispose).not.toHaveBeenCalled();
    expect(outputBDispose).not.toHaveBeenCalled();

    scene.remove(mesh);
    reconcileScene(tracker, scene, 4);
    reconcileScene(tracker, scene, 5);
    expect((mesh.material as THREE.Material[])[0]).toBe(sourceB);
    expect((mesh.material as THREE.Material[])[1]).toBe(sourceC);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.managedMaterialCount).toBe(0);
    expect(outputADispose).toHaveBeenCalledTimes(1);
    expect(outputBDispose).toHaveBeenCalledTimes(1);
    expect(sourceDisposals.every((dispose) => dispose.mock.calls.length === 0)).toBe(true);

    tracker.dispose();
    sourceA.dispose();
    sourceB.dispose();
    sourceC.dispose();
    mesh.geometry.dispose();
  });

  it("reuses an attachment reattached before the two-frame stale window", () => {
    const source = new THREE.MeshStandardMaterial();
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const scene = new THREE.Scene();
    scene.add(meshA, meshB);
    const tracker = new MaterialAwareMaterialTracker(5);
    reconcileScene(tracker, scene, 1);
    const output = outputMaterial(meshA);
    const outputDispose = vi.spyOn(output, "dispose");

    scene.remove(meshA);
    reconcileScene(tracker, scene, 2);
    expect(tracker.attachmentCount).toBe(2);
    scene.add(meshA);
    reconcileScene(tracker, scene, 3);
    expect(outputMaterial(meshA)).toBe(output);
    expect(outputMaterial(meshB)).toBe(output);
    expect(tracker.attachmentCount).toBe(2);
    expect(tracker.trackedRenderableCount).toBe(2);
    expect(tracker.managedMaterialCount).toBe(1);
    expect(outputDispose).not.toHaveBeenCalled();

    tracker.dispose();
    expect(meshA.material).toBe(source);
    expect(meshB.material).toBe(source);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    source.dispose();
    meshA.geometry.dispose();
    meshB.geometry.dispose();
  });

  it("cleans up owner domains independently when shared-source renderables separate", () => {
    const source = new THREE.MeshStandardMaterial();
    const sourceDispose = vi.spyOn(source, "dispose");
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const scene = new THREE.Scene();
    scene.add(meshA, meshB);
    const tracker = new MaterialAwareMaterialTracker(6);
    const ownerA = createOwner("registered-subject");
    const ownerB = createOwner("observer-controller");
    const resolveOwner = (renderable: MaterialAwareRenderable) => renderable === meshA ? ownerA.owner : ownerB.owner;
    reconcileScene(tracker, scene, 1, resolveOwner);
    const outputA = outputMaterial(meshA);
    const outputB = outputMaterial(meshB);
    const outputADispose = vi.spyOn(outputA, "dispose");
    const outputBDispose = vi.spyOn(outputB, "dispose");

    scene.remove(meshA);
    reconcileScene(tracker, scene, 2, resolveOwner);
    reconcileScene(tracker, scene, 3, resolveOwner);
    expect(tracker.attachmentCount).toBe(1);
    expect(tracker.trackedRenderableCount).toBe(1);
    expect(tracker.managedMaterialCount).toBe(1);
    expect(ownerA.dispose).toHaveBeenCalledTimes(1);
    expect(outputADispose).toHaveBeenCalledTimes(1);
    expect(outputBDispose).not.toHaveBeenCalled();
    expect(outputMaterial(meshB)).toBe(outputB);
    expect(sourceDispose).not.toHaveBeenCalled();

    scene.remove(meshB);
    reconcileScene(tracker, scene, 4, resolveOwner);
    reconcileScene(tracker, scene, 5, resolveOwner);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.managedMaterialCount).toBe(0);
    expect(ownerB.dispose).toHaveBeenCalledTimes(1);
    expect(outputBDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();

    tracker.dispose();
    source.dispose();
    meshA.geometry.dispose();
    meshB.geometry.dispose();
  });

  it("preserves a newer R3F-authored assignment when a detached attachment expires", () => {
    const source = new THREE.MeshStandardMaterial();
    const newerMaterial = new THREE.MeshBasicMaterial({ color: "#abcdef" });
    const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material> = new THREE.Mesh(
      new THREE.BoxGeometry(),
      source,
    );
    const scene = new THREE.Scene();
    scene.add(mesh);
    const tracker = new MaterialAwareMaterialTracker(7);
    reconcileScene(tracker, scene, 1);
    const output = outputMaterial(mesh);
    const outputDispose = vi.spyOn(output, "dispose");
    const sourceDispose = vi.spyOn(source, "dispose");

    mesh.material = newerMaterial;
    scene.remove(mesh);
    reconcileScene(tracker, scene, 2);
    reconcileScene(tracker, scene, 3);
    expect(mesh.material).toBe(newerMaterial);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.trackedRenderableCount).toBe(0);
    expect(tracker.managedMaterialCount).toBe(0);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).not.toHaveBeenCalled();

    tracker.dispose();
    mesh.geometry.dispose();
    newerMaterial.dispose();
    source.dispose();
  });

  it("separates uniform property changes from shader-relevant changes", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#334455" });
    const initial = getObserverMaterialSignatures(source);

    source.color.set("#ddeeff");
    const colorChanged = getObserverMaterialSignatures(source);
    expect(colorChanged.signature).not.toBe(initial.signature);
    expect(colorChanged.shaderSignature).toBe(initial.shaderSignature);

    source.side = THREE.DoubleSide;
    const sideChanged = getObserverMaterialSignatures(source);
    expect(sideChanged.signature).not.toBe(colorChanged.signature);
    expect(sideChanged.shaderSignature).not.toBe(colorChanged.shaderSignature);
    source.dispose();
  });

  it("updates in-place source properties and recompiles only for shader changes", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#334455" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(7);
    const first = reconcile(tracker, mesh).materials[0]!;
    const firstVersion = first.version;

    source.color.set("#ddeeff");
    source.opacity = 0.42;
    reconcile(tracker, mesh, tracker.controllerOwner, 2);
    expect(outputMaterial(mesh)).toBe(first);
    expect((first as THREE.MeshStandardMaterial).color.getHexString()).toBe("ddeeff");
    expect(first.opacity).toBe(0.42);
    expect(first.version).toBe(firstVersion);

    source.transparent = true;
    const versionBeforeTransparencyChange = first.version;
    reconcile(tracker, mesh, tracker.controllerOwner, 3);
    expect(first.transparent).toBe(true);
    expect(first.version).toBeGreaterThan(versionBeforeTransparencyChange);

    source.side = THREE.DoubleSide;
    const versionBeforeShaderChange = first.version;
    reconcile(tracker, mesh, tracker.controllerOwner, 4);
    expect(first.side).toBe(THREE.DoubleSide);
    expect(first.version).toBeGreaterThan(versionBeforeShaderChange);

    tracker.dispose();
    expect(mesh.material).toBe(source);
    source.dispose();
    mesh.geometry.dispose();
  });

  it("adapts supported families and reports an unsupported family without replacing it", () => {
    const standard = new THREE.MeshStandardMaterial();
    const basic = new THREE.MeshBasicMaterial();
    const line = new THREE.LineBasicMaterial();
    const unsupported = new THREE.MeshPhysicalMaterial({ clearcoat: 0.5 });
    const tracker = new MaterialAwareMaterialTracker(1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), standard);
    const standardOutput = reconcile(tracker, mesh).materials[0]!;
    const basicMesh = new THREE.Mesh(new THREE.BoxGeometry(), basic);
    const basicOutput = reconcile(tracker, basicMesh).materials[0]!;
    const lineMesh = new THREE.Line(new THREE.BufferGeometry(), line);
    const lineOutput = tracker.reconcileRenderable(
      lineMesh as THREE.Line & { material: THREE.Material | THREE.Material[] },
      tracker.controllerOwner,
      1,
      getObserverMaterialSignatures,
    ).materials[0]!;
    lineMesh.material = lineOutput as THREE.LineBasicMaterial;
    const unsupportedMesh = new THREE.Mesh(new THREE.BoxGeometry(), unsupported);
    const unsupportedResult = reconcile(tracker, unsupportedMesh);

    expect(standardOutput).toBeInstanceOf(MaterialAwareStandardNodeMaterial);
    expect(basicOutput).toBeInstanceOf(MaterialAwareBasicNodeMaterial);
    expect(lineOutput).toBeInstanceOf(MaterialAwareLineNodeMaterial);
    expect(unsupportedResult.unsupported).toEqual([
      { objectName: "Mesh", materialFamily: "MeshPhysicalMaterial" },
    ]);
    expect(unsupportedResult.materials[0]).toBe(unsupported);
    expect(unsupportedMesh.material).toBe(unsupported);

    tracker.dispose();
    standard.dispose();
    basic.dispose();
    line.dispose();
    unsupported.dispose();
    mesh.geometry.dispose();
    basicMesh.geometry.dispose();
    lineMesh.geometry.dispose();
    unsupportedMesh.geometry.dispose();
  });

  it("adapts a replacement source and releases the old copy after its stale window", () => {
    const sourceA = new THREE.MeshStandardMaterial({ color: "#223344" });
    const sourceB = new THREE.MeshStandardMaterial({ color: "#aa8844" });
    const sourceADispose = vi.spyOn(sourceA, "dispose");
    const sourceBDispose = vi.spyOn(sourceB, "dispose");
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), sourceA);
    const tracker = new MaterialAwareMaterialTracker(2);
    const outputA = reconcile(tracker, mesh).materials[0]!;
    const outputADispose = vi.spyOn(outputA, "dispose");

    mesh.material = sourceB;
    const outputB = reconcile(tracker, mesh, tracker.controllerOwner, 2).materials[0]!;
    const outputBDispose = vi.spyOn(outputB, "dispose");
    expect(outputB).not.toBe(outputA);
    expect(mesh.material).toBe(outputB);
    expect(tracker.releaseStaleMaterials(2)).toBe(0);
    expect(tracker.releaseStaleMaterials(3)).toBe(1);
    expect(outputADispose).toHaveBeenCalledTimes(1);
    expect(sourceADispose).not.toHaveBeenCalled();

    tracker.dispose();
    expect(mesh.material).toBe(sourceB);
    expect(outputBDispose).toHaveBeenCalledTimes(1);
    expect(sourceBDispose).not.toHaveBeenCalled();
    sourceA.dispose();
    sourceB.dispose();
    mesh.geometry.dispose();
  });

  it("reuses one output for same-owner mesh assignments and keeps it until the final reference leaves", () => {
    const source = new THREE.MeshStandardMaterial();
    const firstMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const secondMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(3);
    const firstOutput = reconcile(tracker, firstMesh).materials[0]!;
    const secondOutput = reconcile(tracker, secondMesh).materials[0]!;
    const outputDispose = vi.spyOn(firstOutput, "dispose");

    expect(secondOutput).toBe(firstOutput);
    const secondReplacement = new THREE.MeshPhysicalMaterial();
    secondMesh.material = secondReplacement;
    reconcile(tracker, secondMesh, tracker.controllerOwner, 2);
    reconcile(tracker, firstMesh, tracker.controllerOwner, 2);
    expect(tracker.releaseStaleMaterials(2)).toBe(0);
    expect(outputDispose).not.toHaveBeenCalled();

    const firstReplacement = new THREE.MeshPhysicalMaterial();
    firstMesh.material = firstReplacement;
    reconcile(tracker, firstMesh, tracker.controllerOwner, 3);
    expect(tracker.releaseStaleMaterials(3)).toBe(0);
    expect(tracker.releaseStaleMaterials(4)).toBe(1);
    expect(outputDispose).toHaveBeenCalledTimes(1);

    tracker.dispose();
    source.dispose();
    firstMesh.geometry.dispose();
    secondMesh.geometry.dispose();
    firstReplacement.dispose();
    secondReplacement.dispose();
  });

  it("keeps different owner domains separate and rejects conflicting reuse of one owner identity", () => {
    const source = new THREE.MeshStandardMaterial();
    const firstMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const secondMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const tracker = new MaterialAwareMaterialTracker(4);
    const registered = createOwner("registered-subject");
    const controller = createOwner("observer-controller");

    const registeredOutput = reconcile(tracker, firstMesh, registered.owner).materials[0]!;
    const controllerOutput = reconcile(tracker, secondMesh, controller.owner).materials[0]!;
    expect(controllerOutput).not.toBe(registeredOutput);
    expect(registered.outputs.has(registeredOutput)).toBe(true);
    expect(controller.outputs.has(controllerOutput)).toBe(true);

    const conflictingOwner = createOwner("observer-controller", registered.owner.identity);
    const conflictingMesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    expect(() => reconcile(tracker, conflictingMesh, conflictingOwner.owner, 2)).toThrow(
      "Conflicting material-output ownership policies share one owner identity",
    );

    tracker.dispose();
    expect(registered.dispose).toHaveBeenCalledWith(registeredOutput);
    expect(controller.dispose).toHaveBeenCalledWith(controllerOutput);
    source.dispose();
    firstMesh.geometry.dispose();
    secondMesh.geometry.dispose();
    conflictingMesh.geometry.dispose();
  });

  it("lets the Architecture Rise subject disposer own adapted copies without double disposal", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#8899aa" });
    const geometry = new THREE.BoxGeometry();
    const root = new THREE.Group();
    root.name = "architecture-rise-subject";
    const adaptedOutputMaterials = new Set<THREE.Material>();
    root.userData.resources = { source, adaptedOutputMaterials };
    const mesh = new THREE.Mesh(geometry, source);
    root.add(mesh);
    const tracker = new MaterialAwareMaterialTracker(8);
    const owner = resolveArchitectureRiseMaterialOutputOwner(mesh, tracker.controllerOwner);
    const output = tracker.reconcileRenderable(mesh, owner, 1, getObserverMaterialSignatures).materials[0]!;
    const outputDispose = vi.spyOn(output, "dispose");
    const sourceDispose = vi.spyOn(source, "dispose");
    const geometryDispose = vi.spyOn(geometry, "dispose");

    expect(owner.kind).toBe("registered-subject");
    expect(adaptedOutputMaterials.has(output)).toBe(true);
    disposeTeachingSubjectResources(root, adaptedOutputMaterials);
    adaptedOutputMaterials.clear();
    tracker.dispose();

    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(adaptedOutputMaterials.size).toBe(0);
  });

  it("keeps an Architecture Rise subject-owned output until its final shared renderable leaves", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#8899aa" });
    const root = new THREE.Group();
    root.name = "architecture-rise-subject";
    const adaptedOutputMaterials = new Set<THREE.Material>();
    root.userData.resources = { source, adaptedOutputMaterials };
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), source);
    root.add(meshA, meshB);
    const scene = new THREE.Scene();
    scene.add(root);
    const tracker = new MaterialAwareMaterialTracker(9);
    const resolveOwner = (renderable: MaterialAwareRenderable) =>
      resolveArchitectureRiseMaterialOutputOwner(renderable, tracker.controllerOwner);

    reconcileScene(tracker, scene, 1, resolveOwner);
    const output = outputMaterial(meshA);
    const outputDispose = vi.spyOn(output, "dispose");
    expect(outputMaterial(meshB)).toBe(output);
    expect(adaptedOutputMaterials).toEqual(new Set([output]));

    root.remove(meshA);
    reconcileScene(tracker, scene, 2, resolveOwner);
    reconcileScene(tracker, scene, 3, resolveOwner);
    expect(meshA.material).toBe(source);
    expect(tracker.attachmentCount).toBe(1);
    expect(tracker.managedMaterialCount).toBe(1);
    expect(adaptedOutputMaterials.has(output)).toBe(true);
    expect(outputDispose).not.toHaveBeenCalled();

    root.remove(meshB);
    reconcileScene(tracker, scene, 4, resolveOwner);
    reconcileScene(tracker, scene, 5, resolveOwner);
    expect(meshB.material).toBe(source);
    expect(tracker.attachmentCount).toBe(0);
    expect(tracker.managedMaterialCount).toBe(0);
    expect(adaptedOutputMaterials.has(output)).toBe(false);
    expect(outputDispose).toHaveBeenCalledTimes(1);

    tracker.dispose();
    disposeTeachingSubjectResources(root, adaptedOutputMaterials);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(adaptedOutputMaterials.size).toBe(0);
    source.dispose();
    meshA.geometry.dispose();
    meshB.geometry.dispose();
  });

  it("restores only still-attached copies and isolates tracker generations", () => {
    const source = new THREE.MeshStandardMaterial({ color: "#445566" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source);
    const firstTracker = new MaterialAwareMaterialTracker(11);
    const firstOutput = reconcile(firstTracker, mesh).materials[0]!;
    const firstOutputDispose = vi.spyOn(firstOutput, "dispose");
    const firstTrackerIdentity = (firstOutput as THREE.Material & {
      [observerOutputTrackerIdentity]?: object;
    })[observerOutputTrackerIdentity];
    const firstOwnerIdentity = (firstOutput as THREE.Material & {
      [observerOutputOwnerIdentity]?: object;
    })[observerOutputOwnerIdentity];

    const secondTracker = new MaterialAwareMaterialTracker(12);
    const secondOutput = reconcile(secondTracker, mesh).materials[0]!;
    const secondOutputDispose = vi.spyOn(secondOutput, "dispose");
    expect(secondOutput).not.toBe(firstOutput);
    expect(firstTrackerIdentity).toBe(firstTracker.identity);
    expect(firstOwnerIdentity).toBe(firstTracker.controllerOwner.identity);
    expect((secondOutput as THREE.Material & {
      [observerOutputTrackerIdentity]?: object;
    })[observerOutputTrackerIdentity]).toBe(secondTracker.identity);

    firstTracker.dispose();
    expect(firstOutputDispose).toHaveBeenCalledTimes(1);
    expect(mesh.material).toBe(secondOutput);
    secondTracker.dispose();
    expect(secondOutputDispose).toHaveBeenCalledTimes(1);
    expect(mesh.material).toBe(source);
    source.dispose();
    mesh.geometry.dispose();
  });

  it("does not dispose source textures or source resources with a controller-owned copy", () => {
    const texture = new THREE.DataTexture(new Uint8Array([1, 2, 3, 255]), 1, 1);
    const source = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, source);
    const sourceDispose = vi.spyOn(source, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const geometryDispose = vi.spyOn(geometry, "dispose");
    const tracker = new MaterialAwareMaterialTracker(5);
    const output = reconcile(tracker, mesh).materials[0]!;

    tracker.dispose();
    expect(mesh.material).toBe(source);
    expect((output as THREE.MeshStandardMaterial).map).toBe(texture);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();

    output.dispose();
    source.dispose();
    texture.dispose();
    geometry.dispose();
  });

  it("uses a fresh owner token for every controller tracker", () => {
    const first = createObserverControllerMaterialOutputOwner();
    const second = createObserverControllerMaterialOutputOwner();
    expect(first.identity).not.toBe(second.identity);
  });
});
