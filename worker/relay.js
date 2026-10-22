/**
 * Forwards POST /llm/chat/completions to the provider named in the x-llm-target header.
 * The browser cannot set User-Agent, and providers such as OpenCode Go reject
 * cross-origin requests, so the hop has to happen server-side. The user's own key is
 * passed straight through; nothing is stored here.
 *
 * The target is restricted to an allowlist (LLM_HOSTS) and to a single path. Without
 * that this endpoint would be an open proxy: anyone could point it at any URL and use
 * this Worker as free egress.
 */
export async function relay(request) {
  if (request.method !== "POST") return fail(405, "Only POST is allowed");

  const path = new URL(request.url).pathname.replace(/^\/llm/, "");
  if (path !== "/chat/completions") return fail(404, "Unsupported path");

  const target = allowedTarget(request.headers.get("x-llm-target"));
  if (!target) return fail(403, "Target not allowed");

  const sessionId = request.headers.get("x-llm-session") || "listener";

  const headers = new Headers({
    "Content-Type": "application/json",
    "User-Agent": "listener/1.0",
    "x-opencode-session": sessionId,
  });

  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  try {
    const upstream = await fetch(`${target}${path}`, {
      method: "POST",
      headers,
      body: request.body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return fail(502, error.message);
  }
}

/** Only https origins listed in the LLM_HOSTS var, e.g. "opencode.ai,api.openai.com". */
function allowedTarget(raw) {
  if (!raw) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return null;

  return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "");
}

let ALLOWED_HOSTS = new Set();

export function configureRelay(env) {
  ALLOWED_HOSTS = new Set(
    (env.LLM_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function fail(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
