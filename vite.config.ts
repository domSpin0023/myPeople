import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Google and Supabase are set up to send people back to http://localhost:5174, so the dev server must always
  // use that port (and fail loudly rather than quietly picking another).
  server: { port: 5174, strictPort: true },
  // MapLibre finds its web worker next to its own module, so in dev it must not be moved into .vite/deps.
  optimizeDeps: { exclude: ["maplibre-gl"] },
});
