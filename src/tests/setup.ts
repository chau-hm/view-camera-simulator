import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("../render/backend/rendererBackend", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../render/backend/rendererBackend")
  >();
  return {
    ...actual,
    detectAvailableWebGLBackend: () => "webgl",
  };
});

vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
  useThree: (selector: (state: { scene: { getObjectByName: () => null }; gl: { domElement: HTMLCanvasElement } }) => unknown) =>
    selector({
      scene: { getObjectByName: () => null },
      gl: { domElement: document.createElement("canvas") },
    }),
  useFrame: () => undefined,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
}));
