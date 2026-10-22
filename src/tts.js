/**
 * Client for the Kokoro worker. One request in, one synthesized chunk out;
 * requests are answered in the order they were sent.
 *
 * The worker is created on first use and can be terminated with `dispose()` to give
 * the model's memory back. The next request simply starts a fresh worker, which
 * reloads the weights from the browser cache.
 */
export class Tts {
  #worker = null;
  #requests = new Map();
  #nextId = 1;

  onProgress = () => {};
  onReady = () => {};
  onError = () => {};

  get busy() {
    return this.#requests.size > 0;
  }

  get loaded() {
    return this.#worker !== null;
  }

  /** Download and initialize the model. */
  warm() {
    return this.#send({ type: "warm" }, 300000);
  }

  /** Synthesize one chunk of text. Resolves to { samples, sampleRate }. */
  synth(text, options = {}) {
    return this.#send({ type: "synth", text, ...options }, 60000);
  }

  /** Give up on queued requests without unloading the model (used when the reader stops). */
  abandon() {
    const error = new DOMException("Speech request abandoned", "AbortError");
    for (const request of this.#requests.values()) request.reject(error);
    this.#requests.clear();
  }

  /** Terminate the worker and free the model. Returns false when nothing was loaded. */
  dispose() {
    if (!this.#worker) return false;

    this.#worker.terminate();
    this.#worker = null;

    const error = new DOMException("Speech engine unloaded", "AbortError");
    for (const request of this.#requests.values()) request.reject(error);
    this.#requests.clear();
    return true;
  }

  #ensureWorker() {
    if (this.#worker) return this.#worker;

    this.#worker = new Worker(new URL("./tts.worker.js", import.meta.url), { type: "module" });
    this.#worker.onmessage = ({ data }) => this.#handle(data);
    this.#worker.onerror = ({ message }) => {
      for (const request of this.#requests.values()) request.reject(new Error(message));
      this.#requests.clear();
    };

    return this.#worker;
  }

  #send(message, timeout) {
    const id = this.#nextId++;
    const worker = this.#ensureWorker();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.#requests.delete(id)) reject(new Error("Speech engine stopped responding"));
      }, timeout);

      this.#requests.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      worker.postMessage({ ...message, id });
    });
  }

  #handle(message) {
    if (message.type === "progress") {
      this.onProgress(message);
      return;
    }
    if (message.type === "ready") {
      this.onReady();
      return;
    }

    const request = this.#requests.get(message.id);
    if (!request) {
      if (message.type === "error") this.onError(message.message);
      return;
    }

    this.#requests.delete(message.id);
    if (message.type === "error") request.reject(new Error(message.message));
    else request.resolve({ samples: message.samples, sampleRate: message.sampleRate });
  }
}
