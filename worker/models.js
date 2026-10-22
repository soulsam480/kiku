/**
 * Serves model weights from Hugging Face under our own origin. Hugging Face answers
 * with access-control-allow-origin set to its own origin, so a browser can never fetch
 * weights directly, and cross-origin isolation would break the wasm runtime anyway.
 *
 * Only the two repositories this app uses are reachable, and only with GET, so this
 * cannot be used as a general download proxy.
 */
const ALLOWED_PATHS = [
  "/onnx-community/Kokoro-82M-v1.0-ONNX/",
  "/Xenova/whisper-tiny.en/",
];

export async function huggingface(request) {
  if (request.method !== "GET") return notFound();

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/hf/, "");

  if (!ALLOWED_PATHS.some((allowed) => path.startsWith(allowed))) return notFound();

  const target = `https://huggingface.co${path}${url.search}`;

  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "listener/1.0" },
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });

    if (!upstream.ok) return notFound();

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}

function notFound() {
  return new Response("Not found", { status: 404 });
}
