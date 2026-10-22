import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Vite is the frontend dev server and bundler only. The Bun server owns the
// API and audio, so dev proxies those to it; `bun run build` emits dist/,
// which the same Bun server serves in one piece.
const API = { target: "http://127.0.0.1:8787", changeOrigin: true };
const proxy = { "/v1": API, "/api": API, "/health": API };

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [tailwindcss()],
  server: { host: true, proxy },
  preview: { host: true, proxy },
});
