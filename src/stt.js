/**
 * Client for the server's transcription endpoint. The server decodes the recording,
 * gates on loudness and filters Whisper hallucinations, so the client only has to
 * send the blob and read the text back.
 */
export class Stt {
  /** @type {(progress: { loaded: number, total: number }) => void} */
  onProgress = () => {};
  /** @type {(message: string) => void} */
  onError = () => {};

  get busy() {
    return false;
  }

  get loaded() {
    return false;
  }

  /** @param {Blob} audio recorded clip */
  async transcribe(audio) {
    const response = await fetch("/api/transcribe", { method: "POST", body: audio });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(result.error?.message ?? `Transcription failed (${response.status})`);
    return result.text ?? "";
  }

  abandon() {
    // Transcription requests are short; nothing to cancel.
  }

  dispose() {
    return false;
  }
}
