/**
 * Listener service.
 *
 * One Bun process serves the app and everything it needs:
 *   /v1/audio/speech         OpenAI-compatible speech
 *   /v1/audio/voices         voice catalog
 *   /v1/models               served model
 *   /api/llm/*               provider hop for the reader's questions
 *   /api/transcribe          recorded question -> text
 *   /api/documents           upload, list, delete
 *   /api/documents/:id/generate   queue audiobook chapters
 *   /api/chapters/:id/audio  chapter MP3 with range support
 *   /health                  liveness and readiness
 */
import { resolve } from "node:path";
import { VOICES } from "./voices.js";
import { chat } from "./server-chat.js";
import { transcribe } from "./server-transcribe.js";
import { createDocument, deleteDocument, getChapter, getDocument, listDocuments, resetChapters } from "./server-db.js";
import { audioPath } from "./server-db.js";
import { parseUpload, parseText } from "./server-documents.js";
import { enqueueChapter, enqueueDocument, queueState } from "./server-episodes.js";
import { AUDIO_TYPES, encode, loadModel, modelName, queued, ready, synthesize } from "./server-speech.js";

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST ?? "0.0.0.0";
const apiKey = process.env.API_KEY ?? "";
const defaultVoice = process.env.VOICE ?? "af_heart";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const dist = `${resolve(process.env.DIST_DIR ?? "dist")}/`;

async function serveStatic(pathname) {
  const file = Bun.file(`${dist}${pathname === "/" ? "index.html" : pathname.slice(1)}`);
  if (await file.exists()) return new Response(file);

  const index = Bun.file(`${dist}index.html`);
  if (await index.exists()) return new Response(index);

  return new Response("Not built yet. Run: bun run build", { status: 404 });
}

function authorized(request) {
  if (!apiKey) return true;
  return (request.headers.get("authorization") ?? "") === `Bearer ${apiKey}`;
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
    const audio = await synthesize(input, { voice, speed });
    const bytes = await encode(audio, format);

    console.log(
      `speech ${format} ${input.length}ch ${voice} ${speed}x -> ${(bytes.byteLength / 1024).toFixed(0)}KB in ${Date.now() - started}ms`,
    );

    return new Response(/** @type {BodyInit} */ (bytes), {
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

async function upload(request) {
  const type = request.headers.get("content-type") ?? "";

  try {
    if (type.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const pasted = form.get("markdown");

      if (file instanceof File) {
        const parsed = parseUpload(file.name, await file.arrayBuffer());
        return json(createDocument(parsed), 201);
      }

      if (typeof pasted === "string" && pasted.trim()) {
        const parsed = parseText(String(form.get("title") ?? "Pasted document"), pasted);
        return json(createDocument(parsed), 201);
      }
    }

    const body = await request.json();
    if (typeof body.markdown === "string" && body.markdown.trim()) {
      const parsed = parseText(body.title ?? "Pasted document", body.markdown);
      return json(createDocument(parsed), 201);
    }
  } catch (error) {
    return json({ error: { message: error.message } }, 400);
  }

  return json({ error: { message: "Send a file or markdown" } }, 400);
}

async function chapterAudio(request, id) {
  const chapter = getChapter(id);
  if (!chapter?.file) return json({ error: { message: "This chapter has not been generated yet" } }, 404);

  const file = Bun.file(audioPath(chapter.file));
  if (!(await file.exists())) return json({ error: { message: "Audio file is missing" } }, 404);

  const size = file.size;
  const range = request.headers.get("range");

  if (!range) {
    return new Response(file, {
      headers: { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Content-Length": String(size) },
    });
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

  return new Response(file.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

const server = Bun.serve({
  port,
  hostname,
  idleTimeout: 120,
  maxRequestBodySize: 128 * 1024 * 1024,

  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        },
      });
    }

    if (pathname === "/health") {
      return json({ ok: ready(), model: modelName, voices: VOICES.length, ...queueState(), waiting: queued() });
    }

    if (pathname.startsWith("/api/llm/")) return chat(request);

    if (pathname === "/api/transcribe" && request.method === "POST") {
      const started = Date.now();
      try {
        const result = await transcribe(await request.arrayBuffer());
        console.log(`transcribe -> ${result.text.length}ch in ${Date.now() - started}ms`);
        return json(result);
      } catch (error) {
        console.error("transcribe failed:", error.message);
        return json({ error: { message: error.message } }, 500);
      }
    }

    // --- documents ---
    if (pathname === "/api/documents") {
      if (request.method === "GET") return json({ documents: listDocuments() });
      if (request.method === "POST") return upload(request);
    }

    const documentMatch = /^\/api\/documents\/([0-9a-f-]+)$/.exec(pathname);
    if (documentMatch) {
      const document = getDocument(documentMatch[1]);
      if (!document) return json({ error: { message: "Not found" } }, 404);

      if (request.method === "GET") return json(document);
      if (request.method === "DELETE") {
        deleteDocument(documentMatch[1]);
        return json({ ok: true });
      }
    }

    const generateMatch = /^\/api\/documents\/([0-9a-f-]+)\/generate$/.exec(pathname);
    if (generateMatch && request.method === "POST") {
      const document = getDocument(generateMatch[1]);
      if (!document) return json({ error: { message: "Not found" } }, 404);

      const body = await request.json().catch(() => ({}));
      if (body.reset) resetChapters(document.id);
      enqueueDocument(document.id, { voice: body.voice ?? defaultVoice, speed: Number(body.speed ?? 1) });
      return json({ ok: true, ...queueState() });
    }

    const chapterMatch = /^\/api\/chapters\/([0-9a-f-]+)(\/audio|\/generate)?$/.exec(pathname);
    if (chapterMatch) {
      const [, chapterId, action] = chapterMatch;

      if (action === "/audio" && request.method === "GET") return chapterAudio(request, chapterId);

      if (action === "/generate" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        enqueueChapter(chapterId, { voice: body.voice ?? defaultVoice, speed: Number(body.speed ?? 1) });
        return json({ ok: true, ...queueState() });
      }
    }

    // --- OpenAI-compatible speech ---
    if (!authorized(request)) return json({ error: { message: "Unauthorized" } }, 401);

    if (pathname === "/v1/models") {
      return json({ object: "list", data: [{ id: "kokoro", object: "model", owned_by: "listener" }] });
    }

    if (pathname === "/v1/audio/voices" || pathname === "/v1/voices") {
      return json({ voices: VOICES.map((voice) => ({ id: voice.id, name: voice.name, group: voice.group })) });
    }

    if (pathname === "/v1/audio/speech" && request.method === "POST") return speak(request);

    return serveStatic(pathname);
  },
});

console.log(`listener on http://${hostname}:${server.port}`);
loadModel().catch((error) => {
  console.error("voice model failed to load:", error.message);
  process.exit(1);
});
