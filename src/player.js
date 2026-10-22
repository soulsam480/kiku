const LEAD_IN_SECONDS = 0.06;
const GAP_SECONDS = 0.12;

/**
 * Plays a queue of synthesized chunks through one AudioContext, so chunks run
 * together without gaps and stop instantly when the listener interrupts.
 */
export class Player {
  #context = null;
  #segments = [];
  #nextStart = 0;

  /** Called when the queue runs dry. Driven by audio events, not timers. */
  onDrained = () => {};

  async unlock() {
    if (!this.#context) {
      this.#context = new AudioContext();
      this.#nextStart = this.#context.currentTime;
    }
    if (this.#context.state !== "running") await this.#context.resume();
  }

  enqueue(samples, sampleRate, index) {
    const buffer = this.#context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    this.#schedule(buffer, index, 0);
  }

  /** Resume playback of an interrupted segment from the offset in `snapshot()`. */
  restart({ buffer, index, offset }) {
    if (this.#context) this.#schedule(buffer, index, offset);
  }

  /** What is playing right now: the chunk index plus how far into it we are. */
  snapshot() {
    if (!this.#context) return null;

    const now = this.#context.currentTime;
    const segment = this.#segments.find((item) => now < item.end);
    if (!segment) return null;

    const elapsed = Math.max(0, now - segment.start);
    const offset = Math.max(0, Math.min(segment.offset + elapsed, segment.buffer.duration - 0.05));

    return { index: segment.index, buffer: segment.buffer, offset };
  }

  isActive() {
    if (!this.#context) return false;
    const now = this.#context.currentTime;
    return this.#segments.some((segment) => segment.end > now);
  }

  get state() {
    return this.#context?.state ?? "none";
  }

  async pause() {
    if (this.#context?.state === "running") await this.#context.suspend();
  }

  async resume() {
    if (this.#context && this.#context.state !== "running") await this.#context.resume();
  }

  clear() {
    for (const segment of this.#segments) {
      try {
        segment.source.stop();
      } catch {
        // already finished
      }
    }
    this.#segments = [];
    if (this.#context) this.#nextStart = this.#context.currentTime;
  }

  #schedule(buffer, index, offset) {
    const source = this.#context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#context.destination);

    const start = Math.max(this.#context.currentTime + LEAD_IN_SECONDS, this.#nextStart);
    source.start(start, offset);

    const segment = { index, buffer, offset, start, end: start + buffer.duration - offset, source };
    this.#nextStart = segment.end + GAP_SECONDS;
    this.#segments.push(segment);

    source.onended = () => {
      this.#segments = this.#segments.filter((item) => item !== segment);
      if (!this.isActive()) this.onDrained();
    };
  }
}
