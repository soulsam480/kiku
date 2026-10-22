/**
 * Forwards /llm/* to the provider named in the x-llm-target header.
 * The browser cannot set User-Agent, and providers such as OpenCode Go reject
 * cross-origin requests, so the hop has to happen server-side. The user's own
 * key is passed straight through; nothing is stored here.
 */
export async function relay(request) {
  const target = request.headers.get("x-llm-target");
  if (!target) return fail(400, "Missing x-llm-target header");

  const path = new URL(request.url).pathname.replace(/^\/llm/, "");
  const sessionId = request.headers.get("x-llm-session") || "listener";

  const headers = new Headers({
    "Content-Type": "application/json",
    "User-Agent": "listener/1.0",
    "x-opencode-session": sessionId,
  });

  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  try {
    const upstream = await fetch(`${target.replace(/\/+$/, "")}${path}`, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
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

function fail(status, message) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
