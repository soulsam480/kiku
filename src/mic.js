const MIN_SECONDS = 0.3;

/** Records a short clip from the microphone and returns it as a Blob. */
export class Mic {
  #stream = null;
  #recorder = null;
  #chunks = [];
  #startedAt = 0;

  /** @returns {Promise<void>} */
  async start() {
    this.#stream ??= await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });

    this.#chunks = [];
    this.#recorder = new MediaRecorder(this.#stream);
    this.#recorder.ondataavailable = ({ data }) => {
      if (data.size) this.#chunks.push(data);
    };
    this.#recorder.start();
    this.#startedAt = Date.now();
  }

  /** @returns {Promise<Blob | null>} null when the clip was too short to be speech */
  async stop() {
    const recorder = this.#recorder;
    if (!recorder || recorder.state !== "recording") return null;

    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.stop();
    await stopped;

    const clip = new Blob(this.#chunks, { type: recorder.mimeType });
    this.#chunks = [];
    if (Date.now() - this.#startedAt < MIN_SECONDS * 1000) return null;

    return clip;
  }

  release() {
    for (const track of this.#stream?.getTracks() ?? []) track.stop();
    this.#stream = null;
  }
}
