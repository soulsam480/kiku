/**
 * Forwards chat completions to the provider configured in the app's settings.
 *
 * The browser cannot set User-Agent and most providers reject cross-origin calls,
 * so this hop happens server-side. The user's key is passed straight through and
 * never stored.
 */
const DEFAULT_TIMEOUT_MS = 120_000;

export async function chat(request) {
  const target = request.headers.get("x-llm-target");
  if (!target) return json({ error: { message: "Missing x-llm-target header" } }, 400);

  let base;
  try {
    base = new URL(target);
  } catch {
    return json({ error: { message: "Invalid x-llm-target" } }, 400);
  }

  if (base.protocol !== "https:") return json({ error: { message: "Target must be https" } }, 400);

  const path = new URL(request.url).pathname.replace(/^\/api\/llm/, "");
  if (path !== "/chat/completions") return json({ error: { message: "Unsupported path" } }, 404);

  const headers = new Headers({
    "Content-Type": "application/json",
    "User-Agent": "listener/1.0",
    "x-opencode-session": request.headers.get("x-llm-session") || "listener",
  });

  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${base.origin}${base.pathname.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers,
      body: request.body,
      signal: controller.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return json({ error: { message: error.message } }, 502);
  } finally {
    clearTimeout(timer);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
