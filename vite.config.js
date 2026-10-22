import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Vite builds the frontend. The Bun server serves it, the API and the audio;
// during development Vite proxies the API so both can run side by side.
const API = { target: "http://127.0.0.1:8787", changeOrigin: true };
const proxy = { "/v1": API, "/api": API, "/health": API };

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      manifest: {
        name: "Listener",
        short_name: "Listener",
        description: "Listen to documents, upload books, generate audiobooks.",
        theme_color: "#0f1115",
        background_color: "#0f1115",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        navigateFallbackDenylist: [/^\/v1\//, /^\/api\//],
      },
    }),
  ],
  server: { host: true, proxy },
  preview: { host: true, proxy },
});
