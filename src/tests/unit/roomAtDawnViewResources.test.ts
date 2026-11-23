import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Development-only JavaScript asset owner.
import { createRoomView } from "../../../experiments/room-at-dawn/view-resources.js";

describe("Room-at-Dawn per-view resource ownership", () => {
  it("isolates GI uniforms and byte shader adaptation while borrowing geometry and textures", () => {
    const gi = {
      giScale: { value: 1 },
      giExt: { value: 1 },
      giBoxMin: { value: new THREE.Vector3(1, 2, 3) },
    };
    const texture = new THREE.Texture();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    material.defines = { STANDARD: "", USE_GI: "", GI_BACK: "" };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, gi);
    };
    const sky = new THREE.ShaderMaterial({ uniforms: { uExt: gi.giExt, map: { value: texture } } });
    const root = new THREE.Scene();
    root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, sky));
    const observer = createRoomView(root, [1, 2, 3], gi);
    const rtt = createRoomView(root, [1, 2, 3], gi, { bytePreExposure: 19 });
    const o = observer.group.children[0] as THREE.Mesh;
    const r = rtt.group.children[0] as THREE.Mesh;
    expect(o.geometry).toBe(geometry);
    expect(r.geometry).toBe(geometry);
    expect((o.material as THREE.MeshStandardMaterial).defines).toMatchObject({ STANDARD: "", USE_GI: "", GI_BACK: "" });
    expect((r.material as THREE.MeshStandardMaterial).defines?.USE_GI).toBe("");
    expect(o.material).not.toBe(material);
    expect(o.material).not.toBe(r.material);
    expect((o.material as THREE.MeshStandardMaterial).map).toBe(texture);
    const sourceSky = observer.group.children[1] as THREE.Mesh;
    expect((sourceSky.material as THREE.ShaderMaterial).uniforms.uExt).toBe(
      observer.uniforms.giExt,
    );
    expect((sourceSky.material as THREE.ShaderMaterial).uniforms.map.value).toBe(texture);
    const shader = () => ({
      uniforms: {},
      vertexShader: "",
      fragmentShader: "#include <opaque_fragment>",
    });
    const a = shader(),
      b = shader();
    (o.material as THREE.Material).onBeforeCompile(a as never, {} as never);
    (r.material as THREE.Material).onBeforeCompile(b as never, {} as never);
    expect(a.uniforms).toMatchObject({ giScale: observer.uniforms.giScale });
    expect(b.uniforms).toMatchObject({ giScale: rtt.uniforms.giScale });
    expect(a.fragmentShader).not.toContain("outgoingLight *= 19.0");
    expect(b.fragmentShader).toContain("outgoingLight *= 19.0");
    observer.uniforms.giExt.value = 0.2;
    expect(rtt.uniforms.giExt.value).toBe(1);
    expect(gi.giExt.value).toBe(1);
    const disposeSource = vi.spyOn(material, "dispose"),
      disposeTexture = vi.spyOn(texture, "dispose"),
      disposeGeometry = vi.spyOn(geometry, "dispose");
    const disposeVariant = vi.spyOn(o.material as THREE.Material, "dispose");
    observer.dispose();
    observer.dispose();
    expect(disposeVariant).toHaveBeenCalledTimes(1);
    expect(disposeSource).not.toHaveBeenCalled();
    expect(disposeTexture).not.toHaveBeenCalled();
    expect(disposeGeometry).not.toHaveBeenCalled();
    rtt.dispose();
  });
});
