import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("../utils/webgl", () => ({
  isWebGLAvailable: () => true,
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}));

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
}));
