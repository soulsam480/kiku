/**
 * Server-side speech-to-text. Browsers record webm/opus; ffmpeg decodes it to the
 * 16 kHz mono float samples Whisper expects, then the transcript is returned.
 */
import { pipeline } from "@huggingface/transformers";
import { usableClip, usableTranscript } from "../src/guard.js";

const MODEL_ID = process.env.STT_MODEL ?? "Xenova/whisper-tiny.en";
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";

let transcriber = null;
let loading = null;

function load() {
  loading ??= pipeline("automatic-speech-recognition", MODEL_ID, {
    dtype: "q8",
    device: "cpu",
    progress_callback: (progress) => {
      if (progress.status === "progress" && progress.file && progress.total) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        process.stdout.write(`\r  downloading ${progress.file} ${percent}%   `);
      }
    },
  }).then((model) => {
    transcriber = model;
    process.stdout.write("\r  transcription model ready                \n");
    return model;
  });

  return loading;
}

/** Decode any audio the browser sends into 16 kHz mono samples. */
async function decode(bytes) {
  const process_ = Bun.spawn(
    [ffmpeg, "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ar", "16000", "-ac", "1", "pipe:1"],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );

  process_.stdin.write(bytes);
  process_.stdin.end();

  const [pcm, error] = await Promise.all([
    new Response(process_.stdout).arrayBuffer(),
    new Response(process_.stderr).text(),
    process_.exited,
  ]);

  if (!pcm.byteLength) throw new Error(`Could not decode audio: ${error.trim() || "empty"}`);

  const view = new DataView(pcm);
  const samples = new Float32Array(pcm.byteLength / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }

  return samples;
}


/** @param {ArrayBuffer} bytes recorded audio, any container ffmpeg understands */
export async function transcribe(bytes) {
  const samples = await decode(bytes);
  if (!usableClip(samples)) return { text: "", reason: "silent" };

  const model = await load();
  const { text } = await model(samples);

  return usableTranscript(text) ? { text: text.trim(), reason: "" } : { text: "", reason: "unclear" };
}
