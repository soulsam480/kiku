/** Client for the Whisper worker: one clip in, one transcript out. */
export class Stt {
  #worker;
  #requests = new Map();
  #nextId = 1;

  onProgress = () => {};
  onError = () => {};

  constructor() {
    this.#worker = new Worker(new URL("./stt.worker.js", import.meta.url), { type: "module" });
    this.#worker.onmessage = ({ data }) => this.#handle(data);
    this.#worker.onerror = ({ message }) => {
      for (const request of this.#requests.values()) request.reject(new Error(message));
      this.#requests.clear();
    };
  }

  /** Transcribe 16 kHz mono samples. Resolves to the transcript text. */
  transcribe(samples) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#requests.set(id, { resolve, reject });
      this.#worker.postMessage({ id, audio: samples }, [samples.buffer]);
    });
  }

  #handle(message) {
    if (message.type === "progress") {
      this.onProgress(message);
      return;
    }

    const request = this.#requests.get(message.id);
    if (!request) {
      if (message.type === "error") this.onError(message.message);
      return;
    }

    this.#requests.delete(message.id);
    if (message.type === "error") request.reject(new Error(message.message));
    else request.resolve(message.text);
  }
}
