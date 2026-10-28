import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MapLibre finds its web worker next to its own module, so in dev it must not be moved into .vite/deps.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
