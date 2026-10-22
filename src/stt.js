/**
 * Client for the Whisper worker: one clip in, one transcript out.
 *
 * Like the speech engine, the worker is created on first use and can be disposed to
 * release the model; the next transcription starts a fresh one.
 */
export class Stt {
  #worker = null;
  #requests = new Map();
  #nextId = 1;

  onProgress = () => {};
  onError = () => {};

  get busy() {
    return this.#requests.size > 0;
  }

  get loaded() {
    return this.#worker !== null;
  }

  /** Transcribe 16 kHz mono samples. Resolves to the transcript text. */
  transcribe(samples) {
    const id = this.#nextId++;
    const worker = this.#ensureWorker();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.#requests.delete(id)) reject(new Error("Transcription timed out"));
      }, 120000);

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

      worker.postMessage({ id, audio: samples }, [samples.buffer]);
    });
  }

  dispose() {
    if (!this.#worker) return false;

    this.#worker.terminate();
    this.#worker = null;

    for (const request of this.#requests.values()) request.reject(new Error("Transcription unloaded"));
    this.#requests.clear();
    return true;
  }

  #ensureWorker() {
    if (this.#worker) return this.#worker;

    this.#worker = new Worker(new URL("./stt.worker.js", import.meta.url), { type: "module" });
    this.#worker.onmessage = ({ data }) => this.#handle(data);
    this.#worker.onerror = ({ message }) => {
      for (const request of this.#requests.values()) request.reject(new Error(message));
      this.#requests.clear();
    };

    return this.#worker;
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
