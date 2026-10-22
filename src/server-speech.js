/**
 * Kokoro synthesis and audio encoding, shared by the OpenAI-compatible endpoint and
 * the audiobook jobs. One synthesis runs at a time so memory stays flat and latency
 * is predictable on a laptop.
 */
import { KokoroTTS } from "kokoro-js";
import { speechText, splitIntoChunks } from "./markdown.js";

const modelId = process.env.MODEL_ID ?? "onnx-community/Kokoro-82M-v1.0-ONNX";
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const maxQueued = Number(process.env.MAX_QUEUED ?? 8);

/** @type {KokoroTTS | null} */
let model = null;
let loading = null;
let running = 0;
const waiting = [];

export const AUDIO_TYPES = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

export const modelName = modelId;
export const ready = () => Boolean(model);
export const queued = () => waiting.length;

export function loadModel() {
  loading ??= KokoroTTS.from_pretrained(modelId, {
    dtype: "q8",
    device: "cpu",
    progress_callback: (progress) => {
      if (progress.status === "progress" && progress.file && progress.total) {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        process.stdout.write(`\r  downloading ${progress.file} ${percent}%   `);
      }
    },
  }).then((loaded) => {
    model = loaded;
    process.stdout.write("\r  voice model ready                          \n");
    return loaded;
  });

  return loading;
}

function slot() {
  if (running === 0) {
    running += 1;
    return Promise.resolve();
  }
  if (waiting.length >= maxQueued) return null;
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else running -= 1;
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

/**
 * Synthesize any length of text.
 * @param {string} text
 * @param {{ voice?: string, speed?: number }} [options]
 * @returns {Promise<AudioChunk>}
 */
export async function synthesize(text, { voice = "af_heart", speed = 1 } = {}) {
  const turn = slot();
  if (!turn) throw new Error("Too many queued requests");

  await turn;
  try {
    const tts = await loadModel();
    const chunks = splitIntoChunks(speechText(text));
    const parts = [];
    let sampleRate = 24000;

    for (const chunk of chunks) {
      const audio = await tts.generate(chunk, { voice, speed });
      sampleRate = audio.sampling_rate;
      parts.push(audio.audio);
    }

    return { samples: concat(parts), sampleRate };
  } finally {
    release();
  }
}

export function toWav({ samples, sampleRate }) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const write = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, clamped * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

function toPcm16(samples) {
  const pcm = new Uint8Array(samples.length * 2);
  const view = new DataView(pcm.buffer);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, clamped * 0x7fff, true);
  }

  return pcm;
}

const FFMPEG_ARGS = {
  mp3: ["-f", "mp3", "-b:a", "64k"],
  opus: ["-c:a", "libopus", "-b:a", "32k", "-f", "ogg"],
  flac: ["-f", "flac"],
  aac: ["-c:a", "aac", "-b:a", "64k", "-f", "adts"],
};

/** @param {AudioChunk} audio @param {string} format @returns {Promise<Uint8Array>} */
export async function encode(audio, format) {
  if (format === "wav") return toWav(audio);
  if (!FFMPEG_ARGS[format]) throw new Error(`Unsupported response_format: ${format}`);

  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "s16le",
    "-ar",
    String(audio.sampleRate),
    "-ac",
    "1",
    "-i",
    "pipe:0",
    ...FFMPEG_ARGS[format],
    "pipe:1",
  ];

  const process_ = Bun.spawn([ffmpeg, ...args], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  process_.stdin.write(toPcm16(audio.samples));
  process_.stdin.end();

  const [output, error] = await Promise.all([
    new Response(process_.stdout).arrayBuffer(),
    new Response(process_.stderr).text(),
    process_.exited,
  ]);

  if (!output.byteLength) throw new Error(`ffmpeg failed: ${error.trim() || "no output"}`);
  return new Uint8Array(output);
}
