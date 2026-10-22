/** Decide whether a microphone clip is worth transcribing, and worth asking about. */

const MIN_SECONDS = 0.4;
const MIN_RMS = 0.003; // loose, so quiet speech still passes
const SAMPLE_RATE = 16000;

// Whisper invents these for silence or room noise; they must never reach the model.
const HALLUCINATIONS = new Set([
  "you",
  "thank you",
  "thank you so much",
  "thanks",
  "thanks for watching",
  "thank you for watching",
  "please subscribe",
  "subscribe",
  "bye",
  "bye bye",
  "okay",
  "ok",
  "yeah",
  "mm",
  "hmm",
  "uh",
  "um",
  "silence",
  "blank audio",
  "music",
  "see you next time",
]);

/** True when a clip is long enough and loud enough to plausibly contain speech. */
export function usableClip(samples) {
  if (samples.length / SAMPLE_RATE < MIN_SECONDS) return false;

  let energy = 0;
  for (const sample of samples) energy += sample * sample;

  return Math.sqrt(energy / samples.length) > MIN_RMS;
}

/** True when a transcript is more than punctuation, filler or a known hallucination. */
export function usableTranscript(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (words.length < 3) return false;
  return !HALLUCINATIONS.has(words);
}
