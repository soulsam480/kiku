import { Readable } from "node:stream";
import { readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Cross-origin isolation lets the wasm runtime use SharedArrayBuffer and all cores,
// which is several times faster than single-threaded speech synthesis.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

// Model weights come through our own origin: Hugging Face only allows its own in CORS.
const huggingfaceProxy = {
  target: "https://huggingface.co",
  changeOrigin: true,
  followRedirects: true,
  rewrite: (path) => path.replace(/^\/hf/, ""),
};

export default defineConfig({
  plugins: [
    tailwindcss(),
    llmRelay(),
    dropRuntimeWasm(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png", "icon.svg"],
      manifest: {
        name: "Listener",
        short_name: "Listener",
        description: "Listen to markdown, interrupt to ask a question, keep listening.",
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
        // The 21 MB speech runtime stays out of the precache; the browser caches it on first use.
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/llm\//],
      },
    }),
  ],
  worker: { format: "es" },
  server: {
    host: true,
    headers: isolationHeaders,
    proxy: { "/hf": huggingfaceProxy },
  },
  preview: {
    host: true,
    headers: isolationHeaders,
    proxy: { "/hf": huggingfaceProxy },
  },
});

/**
 * Providers such as OpenCode Go reject cross-origin browser requests and ask for a
 * client User-Agent, which browsers refuse to set. This relay forwards /llm/* from
 * the same origin, adds those headers, and passes the user's own key straight through.
 * Configuration still comes from the Settings dialog.
 */
function llmRelay() {
  const middleware = async (request, response) => {
    const target = request.headers["x-llm-target"];
    if (!target) return respond(response, 400, "Missing x-llm-target header");

    const sessionId = request.headers["x-llm-session"] || "listener";
    const url = `${target.replace(/\/+$/, "")}${request.url}`;

    try {
      const upstream = await fetch(url, {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          "x-opencode-session": sessionId,
          ...(request.headers.authorization ? { Authorization: request.headers.authorization } : {}),
        },
        body: request.method === "POST" ? await readBody(request) : undefined,
      });

      response.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-cache",
      });

      if (!upstream.body) return response.end();
      Readable.fromWeb(upstream.body).pipe(response);
    } catch (error) {
      respond(response, 502, error.message);
    }
  };

  return {
    name: "llm-relay",
    configureServer(server) {
      server.middlewares.use("/llm", middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/llm", middleware);
    },
  };
}

function respond(response, status, message) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: { message } }));
}

/**
 * onnxruntime's wasm is 21 MB and Workers assets cap files at 5 MB. Transformers.js
 * loads that runtime from its own CDN by default, so the bundled copy is unused.
 */
function dropRuntimeWasm() {
  return {
    name: "drop-runtime-wasm",
    closeBundle() {
      const assets = resolve("dist", "assets");
      for (const file of readdirSync(assets)) {
        if (file.startsWith("ort-wasm") && file.endsWith(".wasm")) rmSync(join(assets, file));
      }
    },
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
