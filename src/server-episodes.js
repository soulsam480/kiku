/**
 * Audiobook jobs: synthesize one chapter at a time, write an MP3, record progress.
 * Single concurrency by design; a laptop should not be asked to run three voices
 * at once while you are also using it.
 */
import { getChapter, listChapters, updateChapter, audioPath } from "./server-db.js";
import { synthesize, encode } from "./server-speech.js";

const queue = [];
const tasks = new Map();
let running = false;

/** @param {string} chapterId @param {{ voice?: string, speed?: number }} options */
export function enqueueChapter(chapterId, options = {}) {
  if (!tasks.has(chapterId)) {
    queue.push(chapterId);
    tasks.set(chapterId, options);
    updateChapter(chapterId, { status: "queued", error: "" });
  }

  void run();
}

export function enqueueDocument(documentId, options = {}) {
  for (const chapter of listChapters(documentId)) {
    if (chapter.status !== "done" && chapter.status !== "running") enqueueChapter(chapter.id, options);
  }
  return queue.length;
}

export const queueState = () => ({ running, queued: queue.length });

async function run() {
  if (running) return;

  const chapterId = queue.shift();
  if (!chapterId) return;

  running = true;
  const options = tasks.get(chapterId) ?? {};
  const chapter = getChapter(chapterId);

  try {
    if (!chapter) throw new Error("Chapter disappeared");

    updateChapter(chapterId, { status: "running", error: "" });

    const audio = await synthesize(chapter.text, options);
    const bytes = await encode(audio, "mp3");
    const file = `${chapterId}.mp3`;
    await Bun.write(audioPath(file), bytes);

    updateChapter(chapterId, {
      status: "done",
      file,
      duration: audio.samples.length / audio.sampleRate,
      bytes: bytes.byteLength,
      voice: options.voice ?? "af_heart",
    });

    console.log(
      `chapter ${chapter.idx + 1} "${chapter.title}" -> ${(bytes.byteLength / 1024).toFixed(0)}KB, ${Math.round(audio.samples.length / audio.sampleRate)}s`,
    );
  } catch (error) {
    console.error(`chapter ${chapterId} failed:`, error.message);
    updateChapter(chapterId, { status: "error", error: error.message });
  } finally {
    tasks.delete(chapterId);
    running = false;
    if (queue.length) setTimeout(run, 0);
  }
}
