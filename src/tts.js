/**
 * Client for the Kokoro worker. One request in, one synthesized chunk out;
 * requests are answered in the order they were sent.
 */
export class Tts {
  #worker;
  #requests = new Map();
  #nextId = 1;

  onProgress = () => {};
  onReady = () => {};
  onError = () => {};

  constructor() {
    this.#worker = new Worker(new URL("./tts.worker.js", import.meta.url), { type: "module" });
    this.#worker.onmessage = ({ data }) => this.#handle(data);
    this.#worker.onerror = ({ message }) => {
      for (const request of this.#requests.values()) request.reject(new Error(message));
      this.#requests.clear();
    };
  }

  /** Download and initialize the model. */
  warm() {
    return this.#send({ type: "warm" }, 300000);
  }

  /** Synthesize one chunk of text. Resolves to { samples, sampleRate }. */
  synth(text, options = {}) {
    return this.#send({ type: "synth", text, ...options }, 60000);
  }

  #send(message, timeout) {
    const id = this.#nextId++;
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

      this.#worker.postMessage({ ...message, id });
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
