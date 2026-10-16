import * as THREE from "three";
import {
  adaptObserverMaterialForOutput,
  type MaterialAwareNode,
} from "./materialAwareNodeMaterials";
import {
  observerOutputOwnerIdentity,
  observerOutputSourceMaterial,
  observerOutputTrackerIdentity,
} from "./observerMaterialOutputIdentity";
import type { ObserverMaterialSignatures } from "./observerMaterialSignatures";

export type MaterialOutputOwnerKind = "observer-controller" | "registered-subject";

/**
 * Disposal authority for adapted NodeMaterials. `identity` is the cache
 * boundary: one source material may have separate adapted copies for separate
 * scene owners, even when traversal encounters both usages in one frame.
 */
export type MaterialOutputOwner = Readonly<{
  identity: object;
  kind: MaterialOutputOwnerKind;
  retain: (output: MaterialAwareNode) => void;
  release: (output: MaterialAwareNode) => void;
}>;

export type MaterialAwareRenderable = (THREE.Mesh | THREE.Line | THREE.Points) & {
  material: THREE.Material | THREE.Material[];
};

export type UnsupportedMaterialAssignment = Readonly<{
  objectName: string;
  materialFamily: string;
}>;

export type MaterialRenderableReconciliation = Readonly<{
  materials: THREE.Material[];
  unsupported: readonly UnsupportedMaterialAssignment[];
  assignmentReplacements: number;
  dirty: boolean;
}>;

export type MaterialAdaptationMeasure = <T>(operation: () => T) => T;

type ManagedMaterial = {
  source: THREE.Material;
  output: MaterialAwareNode;
  owner: MaterialOutputOwner;
  lastSeenFrame: number;
  signature: string;
  shaderSignature: string;
  attachments: Set<MaterialAttachment>;
  released: boolean;
};

type MaterialAttachment = Readonly<{
  renderable: MaterialAwareRenderable;
  materialIndex: number;
  record: ManagedMaterial;
}>;

export const isMaterialAwareRenderable = (
  object: THREE.Object3D,
): object is MaterialAwareRenderable =>
  (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) &&
  "material" in object;

export const readObserverOutputSourceMaterial = (
  material: THREE.Material,
): THREE.Material | null =>
  (material as THREE.Material & { [observerOutputSourceMaterial]?: THREE.Material })[
    observerOutputSourceMaterial
  ] ?? null;

/** A controller owner is scoped to one tracker/renderer generation. */
export const createObserverControllerMaterialOutputOwner = (): MaterialOutputOwner => {
  const identity = {};
  const ownedOutputs = new Set<MaterialAwareNode>();
  return {
    identity,
    kind: "observer-controller",
    retain: (output) => {
      ownedOutputs.add(output);
    },
    release: (output) => {
      if (!ownedOutputs.delete(output)) return;
      output.dispose();
    },
  };
};

/**
 * Renderer-generation-scoped source-to-NodeMaterial tracker. Source resources
 * are borrowed only; every adapted material is released through its explicit
 * owner. Renderable assignments are restored only while the corresponding
 * adapted copy is still attached, so a later R3F-authored assignment wins.
 */
export class MaterialAwareMaterialTracker {
  readonly identity = {};
  readonly controllerOwner = createObserverControllerMaterialOutputOwner();

  private readonly records = new Map<THREE.Material, Map<object, ManagedMaterial>>();
  private readonly attachmentsByRenderable = new Map<MaterialAwareRenderable, MaterialAttachment[]>();
  private recordCount = 0;
  readonly rendererGeneration: number;
  private readonly onOutputCreated?: (output: MaterialAwareNode) => void;

  constructor(
    rendererGeneration: number,
    onOutputCreated?: (output: MaterialAwareNode) => void,
  ) {
    this.rendererGeneration = rendererGeneration;
    this.onOutputCreated = onOutputCreated;
  }

  get managedMaterialCount(): number {
    return this.recordCount;
  }

  reconcileRenderable(
    renderable: MaterialAwareRenderable,
    owner: MaterialOutputOwner,
    frame: number,
    getSignatures: (source: THREE.Material) => ObserverMaterialSignatures,
    measureAdaptation: MaterialAdaptationMeasure = (operation) => operation(),
  ): MaterialRenderableReconciliation {
    const previousAttachments = this.attachmentsByRenderable.get(renderable) ?? [];

    const attachedMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    const nextMaterials: THREE.Material[] = [];
    const nextAttachments: MaterialAttachment[] = [];
    const unsupported: UnsupportedMaterialAssignment[] = [];
    let assignmentReplacements = 0;
    let dirty = false;

    attachedMaterials.forEach((attached, materialIndex) => {
      const source = readObserverOutputSourceMaterial(attached) ?? attached;
      const existing = this.getRecord(source, owner);
      let record = existing;

      if (record) {
        const currentRecord = record;
        if (currentRecord.released) {
          throw new Error("A released material-aware output was found in the tracker cache");
        }
        const signatures = getSignatures(source);
        if (signatures.signature !== currentRecord.signature) {
          measureAdaptation(() => {
            currentRecord.output.copy(source);
            if (signatures.shaderSignature !== currentRecord.shaderSignature) {
              currentRecord.output.needsUpdate = true;
            }
          });
          currentRecord.signature = signatures.signature;
          currentRecord.shaderSignature = signatures.shaderSignature;
          dirty = true;
        }
      } else {
        const output = measureAdaptation(() => adaptObserverMaterialForOutput(source));
        if (!output) {
          unsupported.push({
            objectName: renderable.name || renderable.type,
            materialFamily: source.type,
          });
          nextMaterials.push(attached);
          return;
        }
        const signatures = getSignatures(source);

        Object.defineProperties(output, {
          [observerOutputOwnerIdentity]: {
            configurable: false,
            enumerable: false,
            value: owner.identity,
          },
          [observerOutputTrackerIdentity]: {
            configurable: false,
            enumerable: false,
            value: this.identity,
          },
        });

        record = {
          source,
          output,
          owner,
          lastSeenFrame: frame,
          signature: signatures.signature,
          shaderSignature: signatures.shaderSignature,
          attachments: new Set(),
          released: false,
        };
        let retained = false;
        try {
          owner.retain(output);
          retained = true;
          this.onOutputCreated?.(output);
        } catch (error) {
          if (retained) owner.release(output);
          else output.dispose();
          throw error;
        }
        this.setRecord(source, owner, record);
        this.recordCount += 1;
        dirty = true;
      }

      const activeRecord = record;
      if (!activeRecord) throw new Error("Material-aware adaptation did not produce a managed output");
      activeRecord.lastSeenFrame = frame;
      const output = activeRecord.output;
      if (output !== attached) assignmentReplacements += 1;
      nextMaterials.push(output);
      const previousAttachment = previousAttachments.find(
        (attachment) => attachment.materialIndex === materialIndex,
      );
      const attachment = previousAttachment?.record === activeRecord
        ? previousAttachment
        : {
          renderable,
          materialIndex,
          record: activeRecord,
        };
      if (attachment !== previousAttachment) activeRecord.attachments.add(attachment);
      nextAttachments.push(attachment);
    });

    previousAttachments.forEach((attachment) => {
      if (!nextAttachments.includes(attachment)) attachment.record.attachments.delete(attachment);
    });
    this.attachmentsByRenderable.set(renderable, nextAttachments);
    return {
      materials: nextMaterials,
      unsupported,
      assignmentReplacements,
      dirty,
    };
  }

  /** Release copies absent from the scene for two complete frames. */
  releaseStaleMaterials(frame: number): number {
    const stale: ManagedMaterial[] = [];
    this.records.forEach((byOwner) => {
      byOwner.forEach((record) => {
        if (frame - record.lastSeenFrame >= 2) stale.push(record);
      });
    });
    stale.forEach((record) => this.releaseRecord(record, true));
    return stale.length;
  }

  /** Restore authored assignments, then release each adapted copy exactly once. */
  dispose(): void {
    const allRecords: ManagedMaterial[] = [];
    this.records.forEach((byOwner) => byOwner.forEach((record) => allRecords.push(record)));
    allRecords.forEach((record) => this.releaseRecord(record, true));
    this.attachmentsByRenderable.clear();
    this.records.clear();
    this.recordCount = 0;
  }

  private getRecord(
    source: THREE.Material,
    owner: MaterialOutputOwner,
  ): ManagedMaterial | undefined {
    const record = this.records.get(source)?.get(owner.identity);
    if (record && record.owner !== owner) {
      throw new Error("Conflicting material-output ownership policies share one owner identity");
    }
    return record;
  }

  private setRecord(
    source: THREE.Material,
    owner: MaterialOutputOwner,
    record: ManagedMaterial,
  ): void {
    const byOwner = this.records.get(source) ?? new Map<object, ManagedMaterial>();
    const existing = byOwner.get(owner.identity);
    if (existing && existing.owner !== owner) {
      throw new Error("Conflicting material-output ownership policies share one owner identity");
    }
    byOwner.set(owner.identity, record);
    this.records.set(source, byOwner);
  }

  private restoreAttachment(attachment: MaterialAttachment): void {
    const { renderable, materialIndex, record } = attachment;
    const attached = renderable.material;
    if (Array.isArray(attached)) {
      const current = attached[materialIndex];
      if (current !== record.output) return;
      const restored = [...attached];
      restored[materialIndex] = record.source;
      renderable.material = restored;
    } else if (materialIndex === 0 && attached === record.output) {
      renderable.material = record.source;
    }
  }

  private releaseRecord(record: ManagedMaterial, restore: boolean): void {
    if (record.released) return;
    record.released = true;
    const attachments = [...record.attachments];
    if (restore) attachments.forEach((attachment) => this.restoreAttachment(attachment));
    attachments.forEach((attachment) => {
      record.attachments.delete(attachment);
      const renderableAttachments = this.attachmentsByRenderable.get(attachment.renderable);
      if (!renderableAttachments) return;
      const remaining = renderableAttachments.filter((candidate) => candidate !== attachment);
      if (remaining.length === 0) this.attachmentsByRenderable.delete(attachment.renderable);
      else this.attachmentsByRenderable.set(attachment.renderable, remaining);
    });

    const byOwner = this.records.get(record.source);
    byOwner?.delete(record.owner.identity);
    if (byOwner?.size === 0) this.records.delete(record.source);
    this.recordCount = Math.max(0, this.recordCount - 1);
    record.owner.release(record.output);
  }
}
