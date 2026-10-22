# Listener

Paste markdown, listen to it read aloud by [Kokoro](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) running
in your browser. Interrupt with a question, hear the answer, and narration picks up
where it stopped. Every interruption is logged.

## Run

```sh
mise install          # Node 24, per .mise.toml
npm install
npm run dev           # http://localhost:5173
```

Production build and deploy:

```sh
npm run deploy        # vite build + wrangler deploy
```

This deploys the Worker named `listener` (see `wrangler.jsonc`) to your Cloudflare
account. For a throwaway deploy without logging in, use
`npx wrangler deploy --temporary`.

## Configure

Open **Settings** once. Values live in this browser's storage; there is no `.env`.

| Field | Notes |
| --- | --- |
| API base URL | Any OpenAI-compatible endpoint. For OpenCode Go use `https://opencode.ai/inference/go/openai/v1` |
| API key | Sent straight from the browser to your endpoint |
| Model | e.g. `gpt-4o-mini`, or `minimax-m3.1-flash-free` for OpenCode Go |
| Voice | Six Kokoro voices, US and UK |
| Speed | 0.6× – 1.4× |
| Speak answers aloud | Off keeps answers text-only in the log, so narration is never interrupted by audio |

## Storage

Documents live in IndexedDB (`listener` → `documents`), not localStorage. Each record
keeps its markdown, title, reading position and interruption log, so switching
documents resumes exactly where you stopped and keeps the questions with the text they
were asked about. The **Documents** dialog lists them by last activity, with open and
delete; a document saved by the older localStorage version is migrated automatically
on first load. Settings still live in localStorage.

During narration the paragraph being spoken is highlighted in the preview and scrolled
into view; the exact sentence is shown in the caption bar.

## Use

1. Paste markdown, press **Start listening**.
2. `space` pauses and resumes, `←` `→` jump one sentence, `i` interrupts and focuses the ask box, `m` talks, `esc` cancels.
3. **Click any paragraph, heading, list item or table row in the preview** to start narration there — clicking a heading is the fastest way to jump to a section.
4. Clicking the ask box or the mic interrupts. Type or speak, then send. The badge shows `sending`, `thinking`, `speaking`.
5. The answer is spoken, then narration resumes from the exact sentence. `↺` on a log entry speaks that answer again.
6. Interruptions are listed on the right; **Copy** copies the whole log.

Markdown is converted to speech text: code blocks, images, link targets, bare URLs
and markup punctuation are rewritten so the narrator never says "asterisk" or "open
bracket", and slashes read as words (`and/or` → "and or", `1/2` → "1 over 2"). Emoji
are spoken rather than dropped: common ones use short words (`✅` → "check", `⚠️` →
"warning"), and the rest fall back to Unicode CLDR names (`🇺🇸` → "United States",
`🫠` → "melting face"). That table is `src/emoji-names.json`, generated from
[unicode-emoji-json](https://github.com/muan/unicode-emoji-json) (MIT); it adds about
20 KB gzipped to the bundle.

Tables are narrated by shape: two-column tables read as term/definition pairs, normal
tables read row by row with their column names, and comparison matrices (entities
across the top) read one column at a time — e.g. "Blinq. Model: freemium seat.
Entry price: $4.99." No cell is skipped.

Text is split into chunks on sentence boundaries, so interruption resumes
mid-document and long documents never hit model limits.

## Why the app has a server hop

Two things cannot be done from a web page:

- **Model weights.** Hugging Face answers with `access-control-allow-origin: https://huggingface.co`,
  so no browser can fetch them. Model files are served from `/hf/*` by the Worker
  (and by a Vite proxy in dev).
- **LLM calls.** Providers such as OpenCode Go reject the CORS preflight and expect a
  client `User-Agent`, which browsers are forbidden from setting. The Worker forwards
  `/llm/*` and adds `User-Agent` and `x-opencode-session`.

Both hops only forward: the model files are public, and your API key is passed
through from the browser, never stored on the server. The Worker also sets
`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy`, which lets the wasm
runtime use every core — without that, speech synthesis is several times slower.

A purely static host without these routes will not work; deploy the Worker.

## What leaves your machine

Only the interrupt question and the surrounding document context go to your LLM
endpoint, on your key. Speech synthesis and speech-to-text run locally
(`kokoro-js` and Whisper `tiny.en`, both q8 on wasm); the models download once and
are then cached by the browser. Text and audio are not uploaded anywhere.

## Phone

The app is a PWA: open the deployed URL on your phone and use "Add to Home Screen".
Installation, the microphone and offline caching all require HTTPS, which the
`workers.dev` URL provides. A plain `http://` LAN address will not install and will
not get microphone access.

## Notes

- First sound after a reload takes a while: the wasm runtime compiles and the first
  chunk is synthesized before the badge says `playing`. The badge shows `loading`
  and model download progress until then.
- One document session at a time. Reloading restores the text, the reading
  position and the log.
- Streaming to a locked phone screen is not possible: browsers suspend the page, so
  synthesis stops. Listening works with the screen on, or with the phone unlocked
  and the app in the foreground.
