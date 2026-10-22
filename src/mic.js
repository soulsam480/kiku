const TARGET_RATE = 16000;

/** Records a short clip from the microphone and returns 16 kHz mono samples. */
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

  /** Stops recording. Returns null when the clip was too short to be speech. */
  /** @returns {Promise<Float32Array<ArrayBuffer> | null>} null when the clip was too short */
  async stop() {
    const recorder = this.#recorder;
    if (!recorder || recorder.state !== "recording") return null;

    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.stop();
    await stopped;

    const clip = new Blob(this.#chunks, { type: recorder.mimeType });
    this.#chunks = [];
    if (Date.now() - this.#startedAt < 300) return null;

    return toSamples(clip);
  }

  release() {
    for (const track of this.#stream?.getTracks() ?? []) track.stop();
    this.#stream = null;
  }
}

async function toSamples(clip) {
  const context = new AudioContext();
  const decoded = await context.decodeAudioData(await clip.arrayBuffer());
  await context.close();

  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * TARGET_RATE), TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
