# Listener

Self-hosted audiobooks from your own documents. Upload markdown, text or EPUB,
the server splits it into chapters, narrates them with
[Kokoro](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) and plays them
in a small player. The reader can also narrate live and answer questions about the
text without losing its place.

One Bun process runs everything: the app, the speech API, chapter generation,
transcription and the audio files.

## Run

```sh
git clone <this repo> listener
cd listener
bun install
bun start            # build the frontend, then serve http://127.0.0.1:8787
```

`bun start` builds the frontend into `dist/` and starts the server. The first
narration downloads the Kokoro model (about 90 MB) once, then runs offline on CPU.

| Command | What it does |
| --- | --- |
| `bun start` | Build the frontend and serve the whole app on `:8787` |
| `bun run serve` | Serve an existing `dist/` without rebuilding |
| `bun run dev` | Vite on `:5173` with HMR, proxying the API to `:8787` |
| `bun test` | Unit tests and type check |
| `bun run typecheck` | `tsc` with `checkJs` over `src/`, `tests/` |

Requires `ffmpeg` on `PATH` (MP3 encoding and speech-to-text decoding) and Bun
1.4+. On a fresh clone `bun start` is the only command you need.

## Data

Everything mutable lives under `data/`, relative to where you run the command:

```
data/listener.db          SQLite: documents, chapters, status, durations
data/audio/<id>.mp3       64 kbps mono chapter audio, served with range requests
```

`data/` is gitignored; `data/corpus.md` is a test fixture. Point `DATA_DIR`
somewhere else to keep books outside the repo.

## Configuration

All optional, read from the environment:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8787` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `data` | SQLite and audio location |
| `DIST_DIR` | `dist` | Built frontend location |
| `VOICE` | `af_heart` | Default Kokoro voice |
| `API_KEY` | empty | If set, the speech API requires `Authorization: Bearer <key>` |
| `STT_MODEL` | `Xenova/whisper-tiny.en` | Transcription model |

The reader's LLM settings (base URL, model, key) are entered in **Settings** and
stay in this browser's storage; the server only forwards the request.

## Use

1. **Library** → **Upload book** (`.md`, `.txt`, `.epub`) or paste text.
2. Open the book, press **Generate all**. Chapters synthesize one at a time in the
   background; the list fills in as each finishes.
3. Press play on any ready chapter. The player has transport, scrubber, speed and
   lock-screen controls, and continues to the next chapter.
4. **Reader** narrates the document live. Click a paragraph to jump there, `space`
   pauses, `i` interrupts, `m` talks. Ask a question and narration resumes where it
   stopped.

Markdown is normalized for speech before synthesis: tables are read with their
column names, emoji become Unicode CLDR names, money and units are spelled out, and
no table row or cell is skipped.

## API

OpenAI-compatible speech, usable from other clients:

```sh
curl -s http://127.0.0.1:8787/v1/audio/speech \
  -H 'content-type: application/json' \
  -d '{"model":"kokoro","input":"Hello from Kokoro.","voice":"af_heart","response_format":"mp3"}' \
  --output hello.mp3
```

| Route | Purpose |
| --- | --- |
| `POST /v1/audio/speech` | OpenAI-compatible synthesis (mp3, wav, opus) |
| `GET /v1/audio/voices` | Voice catalog |
| `GET /v1/models` | Served model |
| `POST /api/documents` | Upload a file or JSON `{ "markdown": "…" }` |
| `GET /api/documents` | Documents with chapter counts |
| `GET /api/documents/:id` | Document with chapters |
| `POST /api/documents/:id/generate` | Queue every pending chapter |
| `POST /api/chapters/:id/generate` | Queue one chapter |
| `GET /api/chapters/:id/audio` | Chapter MP3, supports `Range` |
| `POST /api/transcribe` | Audio blob to text |
| `POST /api/llm/chat/completions` | Forwards to the configured provider |
| `GET /health` | Model state and queue depth |

## Notes

- Synthesis is single-concurrency by design (one CPU, one model). Chapters are
  resumable: each one records `pending`, `queued`, `running`, `done` or `error`.
- Audio is 64 kbps mono MP3, roughly 0.5 MB per minute — a 10-hour book is about
  300 MB.
- The build timestamp appears in Settings; it comes from the bundle, so a stale
  value means the browser is serving an old build.
- Serving over Tailscale or a reverse proxy works as-is. Microphone access needs
  HTTPS (or `localhost`), so recording questions requires a TLS terminator such as
  Caddy.
