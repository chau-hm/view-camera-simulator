import { describe, it, expect } from "vitest";
import { publicAssetUrl } from "../../../src/utils/publicAssetUrl";

describe("publicAssetUrl", () => {
  it("prepends BASE_URL and normalizes leading slashes", () => {
    const base = import.meta.env.BASE_URL ?? "/";
    const a = publicAssetUrl("assets/image.png");
    const b = publicAssetUrl("/assets/image.png");

    expect(a.startsWith(base)).toBe(true);
    expect(b.startsWith(base)).toBe(true);

    // after the base, the next character should not be another slash
    expect(a.slice(base.length).startsWith("/")).toBe(false);
    expect(b.slice(base.length).startsWith("/")).toBe(false);

    // both results should be identical
    expect(a).toBe(b);
  });
});
