import { relay } from "./relay.js";
import { huggingface } from "./models.js";

const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    let response;
    if (pathname.startsWith("/llm/")) response = await relay(request);
    else if (pathname.startsWith("/hf/")) response = await huggingface(request);
    else response = await env.ASSETS.fetch(request);

    // Speech synthesis runs multi-threaded only on a cross-origin isolated page.
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(ISOLATION_HEADERS)) headers.set(name, value);

    return new Response(response.body, { status: response.status, headers });
  },
};
