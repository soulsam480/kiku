/**
 * Hugging Face answers with access-control-allow-origin set to its own origin, so a
 * browser can never fetch model weights directly. Serving them from our origin also
 * keeps cross-origin isolation intact (the wasm runtime needs it for threading).
 */
export async function huggingface(request) {
  const url = new URL(request.url);
  const target = `https://huggingface.co${url.pathname.replace(/^\/hf/, "")}${url.search}`;

  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "listener/1.0" },
      cf: { cacheEverything: true, cacheTtl: 86400 },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
