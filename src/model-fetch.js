/**
 * Route Hugging Face requests through our own origin.
 * Libraries such as kokoro-js hardcode huggingface.co URLs, and Hugging Face only
 * allows its own origin in CORS, so those requests must be rewritten.
 */
export function routeModelWeights() {
  const nativeFetch = self.fetch.bind(self);

  self.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://huggingface.co/")) return nativeFetch(input, init);

    const path = url.slice("https://huggingface.co/".length);
    const response = await nativeFetch(`${self.location.origin}/hf/${path}`, init);

    // A dev server or proxy can answer unknown paths with an HTML page; failing loudly
    // here keeps that page out of the model cache, where it would poison later runs.
    if ((response.headers.get("content-type") ?? "").includes("text/html")) {
      throw new Error(`Model file ${path} came back as HTML, expected binary data`);
    }

    return response;
  };
}
