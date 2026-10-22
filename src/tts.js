/**
 * Client for the server's speech endpoint. Same contract the reader expects from an
 * engine: warm(), synth(text, { voice, speed }) → { samples, sampleRate }.
 *
 * Audio comes back as WAV and is decoded locally, so the player can schedule chunks
 * ahead of playback.
 */
export class Tts {
  #decoder = null;
  #loaded = false;
  #pending = 0;

  /** @type {(progress: { loaded: number, total: number }) => void} */
  onProgress = () => {};
  /** @type {() => void} */
  onReady = () => {};
  /** @type {(message: string) => void} */
  onError = () => {};

  get busy() {
    return this.#pending > 0;
  }

  get loaded() {
    return this.#loaded;
  }

  /** @returns {Promise<void>} resolves once the server reports its model ready */
  async warm() {
    await this.check();
    this.#loaded = true;
    this.onReady();
  }

  async check() {
    const response = await fetch("/health");
    if (!response.ok) throw new Error(`Speech server unavailable (${response.status})`);

    const health = await response.json();
    if (!health.ok) throw new Error("Speech server is still loading the voice model");
    return health;
  }

  /**
   * @param {string} text
   * @param {{ voice?: string, speed?: number }} [options]
   * @returns {Promise<AudioChunk>}
   */
  async synth(text, { voice, speed } = {}) {
    this.#pending += 1;

    try {
      const response = await fetch("/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, voice, speed, response_format: "wav" }),
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error?.message ?? `Speech failed (${response.status})`);
      }

      const decoded = await this.#decode(await response.arrayBuffer());
      return { samples: decoded.samples, sampleRate: decoded.sampleRate };
    } finally {
      this.#pending -= 1;
    }
  }

  abandon() {
    // Local requests are short; nothing to cancel.
  }

  dispose() {
    this.#loaded = false;
    return true;
  }

  async #decode(buffer) {
    this.#decoder ??= new OfflineAudioContext(1, 1, 24000);
    const audio = await this.#decoder.decodeAudioData(buffer);
    return { samples: audio.getChannelData(0).slice(), sampleRate: audio.sampleRate };
  }
}
