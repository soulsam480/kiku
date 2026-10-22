/**
 * Listener TTS service.
 *
 * A small, resident Kokoro server for a home machine:
 *   POST /v1/audio/speech   OpenAI-compatible speech endpoint
 *   GET  /v1/models         the model this box serves
 *   GET  /v1/audio/voices   the voice catalog
 *   GET  /health            liveness and readiness
 *
 * Input is not limited to OpenAI's 4096 characters: text is normalised and split
 * with the same chunker the reader uses, synthesized chunk by chunk, then joined.
 */
import { KokoroTTS } from "kokoro-js";
import { speechText, splitIntoChunks } from "../src/markdown.js";
import { VOICES } from "../src/voices.js";
import { chat } from "./chat.js";
import { transcribe } from "./transcribe.js";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "0.0.0.0";
const modelId = process.env.MODEL_ID ?? "onnx-community/Kokoro-82M-v1.0-ONNX";
const defaultVoice = process.env.VOICE ?? "af_heart";
const apiKey = process.env.API_KEY ?? "";
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const maxQueued = Number(process.env.MAX_QUEUED ?? 8);

/** @type {KokoroTTS | null} */
let model = null;
let loading = null;

const AUDIO_TYPES = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
};

function loadModel() {
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
    process.stdout.write("\r  model ready                              \n");
    return loaded;
  });

  return loading;
}

// --- inference queue -------------------------------------------------------
// One synthesis at a time keeps memory flat and latency predictable on a laptop.

let running = 0;
const waiting = [];

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

async function synthesize(text, voice, speed) {
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

// --- encoding --------------------------------------------------------------

function toWav({ samples, sampleRate }) {
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

async function encode(audio, format) {
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

// --- http ------------------------------------------------------------------

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function authorized(request) {
  if (!apiKey) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${apiKey}`;
}

const dist = new URL("../dist/", import.meta.url).pathname;

/** Serve the built app; unknown paths fall back to index.html. */
async function serveStatic(pathname) {
  const file = Bun.file(`${dist}${pathname === "/" ? "index.html" : pathname.slice(1)}`);
  if (await file.exists()) return new Response(file);

  const index = Bun.file(`${dist}index.html`);
  if (await index.exists()) return new Response(index);

  return new Response("Not built yet. Run: bun run build", { status: 404 });
}

async function speak(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: "Body must be JSON" } }, 400);
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) return json({ error: { message: "input is required" } }, 400);
  if (input.length > 500_000) return json({ error: { message: "input is too long" } }, 413);

  const voice = body.voice ?? defaultVoice;
  const speed = Number(body.speed ?? 1);
  const format = String(body.response_format ?? "wav").toLowerCase();

  if (!VOICES.some((candidate) => candidate.id === voice)) {
    return json({ error: { message: `Unknown voice: ${voice}` } }, 400);
  }
  if (!(speed >= 0.5 && speed <= 2)) return json({ error: { message: "speed must be 0.5-2" } }, 400);
  if (!AUDIO_TYPES[format]) return json({ error: { message: `Unsupported response_format: ${format}` } }, 400);

  const started = Date.now();

  try {
    const audio = await synthesize(input, voice, speed);
    const bytes = await encode(audio, format);

    // Log sizes and timing only; never the spoken text.
    console.log(
      `speech ${format} ${input.length}ch ${voice} ${speed}x -> ${(bytes.byteLength / 1024).toFixed(0)}KB in ${Date.now() - started}ms`,
    );

    return new Response(bytes, {
      headers: {
        "Content-Type": AUDIO_TYPES[format],
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("speech failed:", error.message);
    return json({ error: { message: error.message } }, 500);
  }
}

const server = Bun.serve({
  port,
  hostname,
  idleTimeout: 120,

  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
      });
    }

    if (pathname.startsWith("/api/llm/")) return chat(request);

    if (pathname === "/api/transcribe" && request.method === "POST") {
      const started = Date.now();
      try {
        const bytes = await request.arrayBuffer();
        const result = await transcribe(bytes);
        console.log(`transcribe ${(bytes.byteLength / 1024).toFixed(0)}KB -> ${result.text.length}ch in ${Date.now() - started}ms`);
        return json(result);
      } catch (error) {
        console.error("transcribe failed:", error.message);
        return json({ error: { message: error.message } }, 500);
      }
    }

    if (pathname === "/health") {
      return json({ ok: Boolean(model), model: modelId, voices: VOICES.length, queued: waiting.length });
    }

    if (!authorized(request)) return json({ error: { message: "Unauthorized" } }, 401);

    if (pathname === "/v1/models") {
      return json({
        object: "list",
        data: [{ id: "kokoro", object: "model", owned_by: "listener" }],
      });
    }

    if (pathname === "/v1/audio/voices" || pathname === "/v1/voices") {
      return json({
        voices: VOICES.map((voice) => ({ id: voice.id, name: voice.name, group: voice.group })),
      });
    }

    if (pathname === "/v1/audio/speech" && request.method === "POST") return speak(request);

    // Everything else is the built single-page app.
    return serveStatic(pathname);
  },
});

console.log(`listener tts on http://${hostname}:${server.port}`);
loadModel().catch((error) => {
  console.error("model failed to load:", error.message);
  process.exit(1);
});
