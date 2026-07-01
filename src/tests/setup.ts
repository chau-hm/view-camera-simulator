import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("../utils/webgl", () => ({
  isWebGLAvailable: () => true,
}));

vi.mock("@react-three/fiber", async () => {
  const actual = await vi.importActual<typeof import("@react-three/fiber")>("@react-three/fiber");
  return {
    ...actual,
    Canvas: () => null,
  };
});
