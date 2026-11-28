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
      vertexShader: "vGiW = gw.xyz;",
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

  it("keeps overlapping Observer and RTT origins independent until their own disposal", () => {
    const gi = { giScale: { value: 1 } };
    const sharedSourceOrigin = { value: new THREE.Vector3(99, 99, 99) };
    const material = new THREE.MeshStandardMaterial();
    material.defines = { USE_GI: "" };
    // Model a source hook that installs an origin itself: the view must replace
    // it after invoking that hook, not assume that cloning GI wraps every input.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.roomOrigin = sharedSourceOrigin;
      shader.vertexShader += "vGiW = gw.xyz;";
    };
    const source = new THREE.Scene();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    const wideOrigin = [1.7, 0.85, 0.35];
    const deskOrigin = [3.2, 0.84, 0.08];
    const wideObserver = createRoomView(source, wideOrigin, gi);
    const wideRtt = createRoomView(source, wideOrigin, gi);
    const deskObserver = createRoomView(source, deskOrigin, gi);
    const deskRtt = createRoomView(source, deskOrigin, gi);
    const views = [wideObserver, wideRtt, deskObserver, deskRtt];
    const shaders = views.map((view) => {
      const shader = { uniforms: {}, vertexShader: "", fragmentShader: "" };
      const mesh = view.group.children[0] as THREE.Mesh;
      (mesh.material as THREE.Material).onBeforeCompile(shader as never, {} as never);
      return shader;
    });
    expect(new Set(views.map((view) => view.roomOriginUniform)).size).toBe(4);
    expect(new Set(views.map((view) => view.roomOrigin)).size).toBe(4);
    views.forEach((view, i) => {
      expect(shaders[i].uniforms).toHaveProperty("roomOrigin", view.roomOriginUniform);
      expect(shaders[i].vertexShader).toContain("vGiW = gw.xyz + roomOrigin;");
      expect(view.group.position.toArray()).toEqual(view.roomOrigin.toArray().map((x: number) => -x));
    });
    // Preset changes cannot mutate already mounted views, and retirement of A
    // cannot invalidate either independently mounted B view.
    wideOrigin[0] = -50;
    deskOrigin[0] = -60;
    wideObserver.dispose();
    wideRtt.dispose();
    expect(wideObserver.roomOrigin.toArray()).toEqual([1.7, 0.85, 0.35]);
    expect(wideRtt.roomOrigin.toArray()).toEqual([1.7, 0.85, 0.35]);
    expect(deskObserver.roomOrigin.toArray()).toEqual([3.2, 0.84, 0.08]);
    expect(deskRtt.roomOrigin.toArray()).toEqual([3.2, 0.84, 0.08]);
    expect(sharedSourceOrigin.value.toArray()).toEqual([99, 99, 99]);
    deskObserver.dispose();
    expect(deskRtt.roomOrigin.toArray()).toEqual([3.2, 0.84, 0.08]);
    deskRtt.dispose();
  });
});
