import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const basePath = process.env.VITE_BASE_PATH ?? "/view-camera-simulator/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("@react-three/fiber")) {
            return "react-fiber";
          }
          if (id.includes("@react-three/drei")) {
            return "react-drei";
          }
          if (id.includes("three-stdlib")) {
            return "three-stdlib";
          }
          if (id.includes("stats-gl")) {
            return "stats-gl";
          }
          if (id.includes("/three/") || id.endsWith("/three/build/three.module.js")) {
            return "three";
          }
          if (id.includes("react-dom") || id.includes("react-router-dom")) {
            return "react-runtime";
          }
          if (
            id.endsWith("/react/index.js") ||
            id.endsWith("/react/jsx-runtime.js") ||
            id.includes("/react/")
          ) {
            return "react";
          }
          return "vendor";
        },
      },
    },
  },
});
