import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("../render/backend/rendererBackend", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../render/backend/rendererBackend")
  >();
  return {
    ...actual,
    detectAvailableRendererBackend: () => "webgl",
  };
});

vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
}));
