import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createTourbillonWatch } from "../../render/assets/tourbillon-watch/watch.mjs";

describe("watch procedural texture ownership", () => {
  it("preserves authored texels while independently owning each pixel buffer", () => {
    const a = createTourbillonWatch({ includeStrap: false });
    const b = createTourbillonWatch({ includeStrap: false });
    const full = createTourbillonWatch({ includeStrap: true });
    try {
      const texture = (watch: typeof a, name: string) => {
        for (const material of watch.materials) {
          for (const value of Object.values(material)) {
            if (value instanceof THREE.DataTexture && value.name === name) return value;
          }
        }
        return undefined;
      };
      const hashes = {
        "Concentric dial graining": "90171cb2dd09525e61b9e29aa04fecbd765dbf53121d465a7c03c4566d633315",
        "Côtes de Genève cuts": "77d3fdc6387a718b9f4b52d69e810c31f5a1d514dc356395d77539bf99ee7774",
        "Overlapping perlage graining": "2dbe247957a8b8ec68b6edd6d7fd43e98f748854757f84dc3744f4dfeb3cd449",
        "Fine concentric ratchet tool marks": "9cc95d3cbb1d7fdd0c2f7cbae36f5e260d8b4ddb4e11ccf94d8ef09bebefbdf6",
      };
      for (const [name, hash] of Object.entries(hashes)) {
        const first = texture(a, name)!;
        const second = texture(b, name)!;
        expect(first === second).toBe(false);
        const firstPixels = first.image.data as Uint8Array;
        const secondPixels = second.image.data as Uint8Array;
        expect(firstPixels === secondPixels).toBe(false);
        expect(createHash("sha256").update(firstPixels).digest("hex")).toBe(hash);
        const original = secondPixels[0];
        firstPixels[0] ^= 255;
        expect(secondPixels[0]).toBe(original);
      }
      expect(texture(a, "Leather grain")).toBeUndefined();
      expect(texture(full, "Leather grain")).toBeDefined();
      expect(full.strap).not.toBeNull();
    } finally { a.dispose(); b.dispose(); full.dispose(); }
  });
});
