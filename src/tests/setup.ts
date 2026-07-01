import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  // Mock canvas getContext to avoid noisy jsdom console errors during tests
  HTMLCanvasElement.prototype.getContext = () => null;
}
