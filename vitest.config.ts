import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    include: ["src/tests/unit/**/*.test.ts", "src/tests/unit/**/*.test.tsx", "src/tests/integration/**/*.test.tsx"],
  },
});
