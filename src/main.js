import Alpine from "alpinejs";
import { marked } from "marked";
import { tinykeys } from "tinykeys";
import { speechText, splitIntoChunks, takeSentences, paragraphs } from "./markdown.js";
import { mapChunksToBlocks, invert } from "./mapping.js";
import { usableClip, usableTranscript } from "./guard.js";
import { Player } from "./player.js";
import { Tts } from "./tts.js";
import { Mic } from "./mic.js";
import { Stt } from "./stt.js";
import { askQuestion, buildContext } from "./llm.js";
import { loadSettings, saveSettings, newSessionId } from "./store.js";
import { VOICE_GROUPS, VOICES } from "./voices.js";
import { playSample } from "./preview.js";
import {
  listDocuments,
  saveDocument,
  deleteDocument,
  takeLegacySession,
  titleOf,
} from "./db.js";
import "./style.css";

const AHEAD = 3; // chunks synthesized ahead of playback
const CONTEXT_CHARS = 12000; // document text sent to the model when it fits
const AUDIO_CACHE_LIMIT = 40; // recently played chunks kept for instant seeking
const IDLE_UNLOAD_MS = 10 * 60 * 1000; // give the models' memory back after this much quiet

Alpine.data("app", () => {
  const player = new Player();
  const tts = new Tts();
  const mic = new Mic();
  const stt = new Stt();

  let chunks = [];
  let previewBlocks = []; // rendered markdown blocks, for highlighting
  let chunkBlock = []; // chunk index -> preview block index
  let blockChunk = []; // preview block index -> chunk index
  let activeBlock = null;
  let contextBlocks = []; // raw markdown blocks, for the model
  let currentDoc = null; // the IndexedDB record being read
  let llmSessionId = newSessionId();
  let nextIndex = 0;
  let preparedDoc = "";
  let snapshot = null; // position captured when narration was interrupted
  let pendingAudio = new Map();
  let audioCache = new Map();
  let inflight = new Set();
  let answer = null;
  let answerToken = 0;
  let replayOnly = false;
  let seekToken = 0;
  const synthQueue = new Map(); // chunk index -> in-flight synthesis, so clicks never queue duplicates
  const previewCache = new Map(); // voice id -> synthesized sample
  let previewContext = null;
  let askAbort = null;
  let saveTimer = null;
  let ticker = null;
  let micTimer = null;
  let unbindKeys = null;
  let lastActivity = Date.now();

  // Recently played chunks stay in memory so prev/next is instant.
  const remember = (index, audio) => {
    audioCache.set(index, audio);
    if (audioCache.size > AUDIO_CACHE_LIMIT) audioCache.delete(audioCache.keys().next().value);
  };

  const isTyping = (event) => {
    const target = event.target;
    return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  };

  return {
    mode: "idle",
    micState: "idle",
    askStage: "",
    tab: "doc",
    doc: "",
    docTitle: "Untitled",
    question: "",
    caption: "",
    progressText: "0 / 0",
    chunkCount: 0,
    error: "",
    copied: false,
    modelProgress: "",
    log: [],
    library: [],
    settings: loadSettings(),
    draft: loadSettings(),
    voiceGroups: VOICE_GROUPS,
    voices: VOICES,
    previewing: "",
    editing: true,
    unloaded: false,
    deployedAt: import.meta.env.DEV ? "" : __BUILD_TIME__,

    get deployedLabel() {
      if (!this.deployedAt) return "";
      const when = new Date(this.deployedAt).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `built ${when}`;
    },

    get statusLabel() {
      const parts = [this.mode];
      if (this.askStage) parts.push(this.askStage);
      if (this.modelProgress) parts.push(this.modelProgress);
      return parts.join(" · ");
    },

    init() {
      tts.onProgress = (progress) => {
        this.modelProgress = progress.total
          ? `model ${Math.round((progress.loaded / progress.total) * 100)}%`
          : "";
      };
      tts.onReady = () => {
        this.modelProgress = "";
      };
      tts.onError = (message) => this.fail(message);

      stt.onProgress = (progress) => {
        this.modelProgress = progress.total
          ? `whisper ${Math.round((progress.loaded / progress.total) * 100)}%`
          : "";
      };
      stt.onError = (message) => this.fail(message);

      player.onDrained = () => this.afterAudio();

      // Browsers and the OS can suspend audio when the tab or output device changes.
      const keepAudioAwake = () => {
        if (this.mode === "playing") player.resume();
      };
      document.addEventListener("pointerdown", keepAudioAwake);
      document.addEventListener("keydown", keepAudioAwake);
      document.addEventListener("visibilitychange", keepAudioAwake);

      ticker = setInterval(() => this.tick(), 120);

      unbindKeys = tinykeys(window, {
        Space: (event) => {
          if (isTyping(event)) return;
          event.preventDefault();
          this.togglePlay();
        },
        KeyI: () => this.askByKeyboard(),
        Escape: () => this.cancel(),
        KeyM: (event) => {
          if (isTyping(event)) return;
          this.toggleMic();
        },
        ArrowLeft: (event) => {
          if (isTyping(event)) return;
          this.seek(-1);
        },
        ArrowRight: (event) => {
          if (isTyping(event)) return;
          this.seek(1);
        },
      });

      if (import.meta.env.DEV) {
        window.listener = {
          player,
          tts,
          stt,
          mapping: () => ({
            chunkBlock,
            blockTags: previewBlocks.map((block) => block.tagName),
            blockTexts: previewBlocks.map((block) => block.textContent.replace(/\s+/g, " ").trim().slice(0, 40)),
            chunks,
          }),
          expireIdle: () => {
            lastActivity = 0;
          },
          state: () => ({
            mode: this.mode,
            inflight: inflight.size,
            pending: pendingAudio.size,
            idledForMs: Date.now() - lastActivity,
            loaded: tts.loaded,
          }),
        };
      }

      this.$refs.preview?.addEventListener("click", (event) => this.jumpToBlock(event.target));

      this.boot();
    },

    destroy() {
      clearInterval(ticker);
      clearTimeout(micTimer);
      clearTimeout(saveTimer);
      unbindKeys?.();
      mic.release();
    },

    /** Restore the last document the listener had open, migrating old storage once. */
    async boot() {
      try {
        const migrated = await takeLegacySession();
        const documents = await listDocuments();
        const document = migrated ?? documents[0];
        if (document) this.open(document);
        this.library = await listDocuments();
      } catch (error) {
        this.fail(`Could not open saved documents: ${error.message}`);
      }
    },

    open(document) {
      this.touch();
      currentDoc = document;
      this.doc = document.markdown;
      this.docTitle = document.title ?? titleOf(document.markdown);
      this.log = document.log ?? [];
      this.prepare(document.markdown, document.position ?? 0);
      this.editing = false;
      this.$refs.libraryDialog?.close();

      // Opening counts as recent activity, so reloads restore this document.
      saveDocument(currentDoc)
        .then((saved) => {
          currentDoc = saved;
        })
        .catch(() => {});
    },

    newDocument() {
      askAbort?.abort();
      answerToken += 1;
      player.clear();

      currentDoc = null;
      chunks = [];
      contextBlocks = [];
      nextIndex = 0;
      snapshot = null;
      pendingAudio = new Map();
      audioCache = new Map();
      inflight = new Set();
      answer = null;

      this.doc = "";
      this.docTitle = "Untitled";
      this.log = [];
      this.caption = "";
      this.mode = "idle";
      this.askStage = "";
      this.editing = true;
      this.refreshCounters();

      if (this.$refs.preview) this.$refs.preview.innerHTML = "";
      this.$refs.libraryDialog?.close();
    },

    async openLibrary() {
      try {
        this.library = await listDocuments();
        this.$refs.libraryDialog.showModal();
      } catch (error) {
        this.fail(`Could not read the library: ${error.message}`);
      }
    },

    async remove(document) {
      try {
        await deleteDocument(document.id);
        if (currentDoc?.id === document.id) this.newDocument();
        this.library = await listDocuments();
      } catch (error) {
        this.fail(`Could not delete: ${error.message}`);
      }
    },

    async start() {
      this.touch();
      const text = this.doc.trim();
      if (!text) return this.fail("Paste some markdown first.");

      this.clearError();
      player.clear();
      llmSessionId = newSessionId();

      const changed = !currentDoc || currentDoc.markdown !== text;

      try {
        currentDoc = await saveDocument({
          ...(currentDoc ?? {}),
          markdown: text,
          title: titleOf(text),
          position: changed ? 0 : (currentDoc?.position ?? 0),
        });
      } catch (error) {
        return this.fail(`Could not save document: ${error.message}`);
      }

      this.docTitle = currentDoc.title;
      this.prepare(text, changed ? 0 : (currentDoc.position ?? 0));
      await this.play();
    },

    async play() {
      this.touch();
      if (this.doc.trim() !== preparedDoc.trim()) {
        this.prepare(this.doc, 0);
      }
      if (!chunks.length) return this.fail("Paste some markdown first.");

      const first = nextIndex;
      this.mode = "loading";

      try {
        await player.unlock();
        await tts.warm();

        // Synthesize the first chunk up front so speech starts the moment we say "playing".
        if (first < chunks.length && !pendingAudio.has(first) && !audioCache.has(first) && !inflight.has(first)) {
          pendingAudio.set(first, await this.synthesize(first));
        }
      } catch (error) {
        this.mode = "idle";
        if (error.name !== "AbortError") this.fail(`Speech could not start: ${error.message}`);
        return;
      }

      await player.resume();
      this.mode = "playing";
      this.pump();
    },

    togglePlay() {
      if (this.mode === "playing") {
        player.pause();
        this.mode = "paused";
      } else if (this.mode === "paused") {
        player.resume();
        this.mode = "playing";
      } else if (this.mode === "interrupted") {
        this.resumeDocument();
      } else if (this.mode === "answering") {
        this.cancelAnswer();
      } else if (this.mode === "done") {
        player.clear();
        nextIndex = 0;
        this.refreshCounters();
        this.caption = chunks[0] ?? "";
        this.highlight(0);
        this.play();
      } else if (this.mode === "idle") {
        chunks.length ? this.play() : this.start();
      }
    },

    stop() {
      askAbort?.abort();
      answerToken += 1;
      tts.abandon();
      stt.abandon();
      synthQueue.clear();
      player.clear();
      snapshot = null;
      nextIndex = 0;
      pendingAudio = new Map();
      inflight = new Set();
      answer = null;
      this.mode = "idle";
      this.askStage = "";
      this.refreshCounters();
      this.caption = chunks[0] ?? "";
      this.highlight(0);
      this.persistPosition();
    },

    interruptForQuestion() {
      if (this.mode !== "playing" && this.mode !== "paused") return;
      snapshot = player.snapshot();
      player.clear();
      this.mode = "interrupted";
    },

    async ask() {
      this.touch();
      const question = this.question.trim();
      if (!question) return;

      if (this.mode === "answering") {
        askAbort?.abort();
        answerToken += 1;
        player.clear();
      } else {
        this.interruptForQuestion();
      }

      this.question = "";
      this.clearError();

      const at = snapshot?.index ?? Math.max(0, nextIndex - 1);
      // Context comes from the raw markdown, so tables and lists stay structured for the model.
      const contextIndex = chunks.length ? Math.round((at / chunks.length) * contextBlocks.length) : 0;
      const context = buildContext(contextBlocks, contextIndex, question, CONTEXT_CHARS);
      const current = { text: "", pending: "", inflight: 0, streamDone: false };
      const token = ++answerToken;

      answer = current;
      askAbort = new AbortController();
      replayOnly = false;
      this.mode = "answering";
      this.askStage = "sending";
      this.caption = question;

      try {
        const full = await askQuestion({
          settings: this.settings,
          sessionId: llmSessionId,
          question,
          context,
          signal: askAbort.signal,
          onDelta: (delta) => {
            if (token !== answerToken) return;
            if (this.askStage === "sending") {
              this.askStage = this.settings.speakAnswers ? "thinking" : "";
            }
            current.text += delta;
            current.pending += delta;
            this.caption = current.text;
            this.flushAnswer(false, current, token);
          },
        });
        if (token === answerToken && full) current.text = full;
      } catch (error) {
        if (error.name !== "AbortError" && token === answerToken) {
          this.fail(`Answer failed: ${error.message}`);
        }
      } finally {
        if (token === answerToken) {
          current.streamDone = true;
          this.flushAnswer(true, current, token);
          if (current.text.trim()) this.record(question, current.text, at);
        }
        askAbort = null;
      }
    },

    flushAnswer(final, current, token) {
      const { sentences, rest } = takeSentences(current.pending, final);
      current.pending = rest;
      for (const sentence of sentences) this.speak(sentence, current, token);
    },

    speak(sentence, current, token) {
      if (!this.settings.speakAnswers) return;

      current.inflight += 1;
      tts
        .synth(sentence, this.speechOptions())
        .then(({ samples, sampleRate }) => {
          if (token !== answerToken) return;
          this.askStage = "speaking";
          player.enqueue(samples, sampleRate, -1);
        })
        .catch((error) => {
          if (token === answerToken && error.name !== "AbortError") this.fail(`Speech failed: ${error.message}`);
        })
        .finally(() => {
          current.inflight -= 1;
          if (current.streamDone && current.inflight === 0) this.afterAudio();
        });
    },

    cancelAnswer() {
      askAbort?.abort();
      answerToken += 1;
      player.clear();
      answer = null;
      this.resumeDocument();
    },

    /** Jump whole sentences: -1 is the previous one, +1 the next. */
    seek(step) {
      if (!chunks.length) return;
      if (this.mode === "answering") return;

      const position =
        this.mode === "interrupted"
          ? (snapshot?.index ?? 0)
          : (player.snapshot()?.index ?? Math.max(0, nextIndex - 1));

      this.playFrom(position + step);
    },

    /** Clicking a paragraph in the preview starts narration there. */
    jumpToBlock(target) {
      if (this.mode === "answering") return;

      const block = target.closest?.("p, li, tr, h1, h2, h3, h4, h5, h6, blockquote, pre");
      if (!block) return;

      const index = previewBlocks.indexOf(block);
      if (index < 0) return;

      const chunk = blockChunk[index];
      if (chunk === undefined) return this.fail("That part is not narrated.");

      // Already reading this block: do not restart it.
      if (this.mode === "playing" && player.snapshot()?.index === chunk) return;

      this.playFrom(chunk);
    },

    /** Start narration at a chunk, from cache when it has been heard already. */
    async playFrom(index) {
      this.touch();
      if (!chunks.length) return;

      const target = Math.min(Math.max(index, 0), chunks.length - 1);
      const token = ++seekToken;

      tts.abandon();
      synthQueue.clear();
      inflight = new Set();

      player.clear();
      snapshot = null;
      nextIndex = target;
      this.refreshCounters();
      this.caption = chunks[target] ?? "";
      this.highlight(target);

      let audio = pendingAudio.get(target) ?? audioCache.get(target);

      if (!audio) {
        this.mode = "loading";
        this.askStage = `preparing sentence ${target + 1}`;

        try {
          await player.unlock();
          audio = await this.synthesize(target);
        } catch (error) {
          if (token !== seekToken) return;

          synthQueue.delete(target);
          if (error.name === "AbortError") {
            // A jump abandoned this request while it was in flight; ask once more.
            try {
              audio = await this.synthesize(target);
            } catch {
              audio = null;
            }
            if (!audio) {
              this.mode = "interrupted";
              this.askStage = "";
              return;
            }
          } else {
            this.mode = "interrupted";
            this.askStage = "";
            return this.fail(`Speech failed: ${error.message}`);
          }
        }

        // A newer jump arrived while this one was synthesizing; let it win.
        if (token !== seekToken) return;

        this.askStage = "";
        pendingAudio.set(target, audio);
      }

      this.mode = "playing";
      await player.resume();
      this.pump();
    },

    /** Synthesize one chunk, reusing a request that is already in flight. */
    synthesize(index) {
      const existing = synthQueue.get(index);
      if (existing) return existing;

      const request = tts
        .synth(chunks[index], this.speechOptions())
        .finally(() => synthQueue.delete(index));

      synthQueue.set(index, request);
      return request;
    },

    /** Speak a logged answer again, then pick narration back up. */
    replay(entry) {
      if (!entry.answer?.trim() || this.mode === "answering") return;

      if (!this.settings.speakAnswers) {
        this.caption = entry.answer;
        return;
      }

      if (this.mode === "playing" || this.mode === "paused") this.interruptForQuestion();

      const current = { text: entry.answer, pending: entry.answer, inflight: 0, streamDone: true };
      const token = ++answerToken;

      replayOnly = !snapshot;
      answer = current;
      this.mode = "answering";
      this.askStage = "speaking";
      this.caption = entry.answer;
      this.flushAnswer(true, current, token);
    },

    async resumeDocument() {
      const saved = snapshot;
      snapshot = null;
      this.askStage = "";

      if (!chunks.length) {
        this.mode = "idle";
        return;
      }

      await player.resume();
      if (!saved) {
        if (replayOnly) {
          replayOnly = false;
          this.mode = "idle";
          return;
        }
        return this.play();
      }

      nextIndex = saved.index + 1;
      player.restart(saved);
      this.refreshCounters();
      this.highlight(saved.index);
      this.mode = "playing";
      this.pump();
    },

    tick() {
      if (this.mode === "playing" || this.mode === "paused" || this.mode === "answering") {
        this.touch();
      } else {
        this.maybeUnload();
      }

      if (this.mode === "playing" || this.mode === "paused") {
        this.pump();
        this.followPlayback();
      } else if (this.mode === "answering") {
        this.afterAudio();
      }
    },

    /** Terminate the speech workers once nothing has needed them for a while. */
    maybeUnload() {
      if (this.mode === "playing" || this.mode === "loading" || this.mode === "answering") return;
      if (player.isActive() || tts.busy || stt.busy) return;
      if (pendingAudio.size > 0 || inflight.size > 0) return;
      if (Date.now() - lastActivity < IDLE_UNLOAD_MS) return;

      this.unloadModels();
    },

    unloadModels() {
      lastActivity = Date.now();
      if (!tts.loaded && !stt.loaded) return false;

      tts.dispose();
      stt.dispose();
      this.modelProgress = "";
      this.unloaded = true;
      setTimeout(() => (this.unloaded = false), 1500);
      return true;
    },

    /** Any action that needs the engines keeps them resident. */
    touch() {
      lastActivity = Date.now();
    },

    /** The queue ran dry (or a sentence finished synthesizing): decide what comes next. */
    afterAudio() {
      if (this.mode === "answering") {
        if (answer?.streamDone && answer.inflight === 0 && !player.isActive()) this.resumeDocument();
      } else if (this.mode === "playing" || this.mode === "paused") {
        this.pump();
      }
    },

    /** Keep a few chunks synthesized ahead and hand the next one to the player. */
    pump() {
      if (this.mode !== "playing" && this.mode !== "paused") return;

      for (let i = nextIndex; i < nextIndex + AHEAD && i < chunks.length; i++) {
        if (pendingAudio.has(i) || audioCache.has(i) || inflight.has(i)) continue;
        inflight.add(i);
        this.synthesize(i)
          .then((audio) => pendingAudio.set(i, audio))
          .catch((error) => {
            if (error.name !== "AbortError") this.fail(`Speech failed: ${error.message}`);
          })
          .finally(() => {
            inflight.delete(i);
            this.pump();
          });
      }

      for (;;) {
        const audio = pendingAudio.get(nextIndex) ?? audioCache.get(nextIndex);
        if (!audio) break;

        pendingAudio.delete(nextIndex);
        remember(nextIndex, audio);
        player.enqueue(audio.samples, audio.sampleRate, nextIndex);
        nextIndex += 1;
        this.refreshCounters();
        this.persistPosition();
      }

      if (nextIndex >= chunks.length && inflight.size === 0 && !player.isActive()) {
        this.mode = "done";
        this.caption = "";
        activeBlock?.classList.remove("active-block");
        activeBlock = null;
      }
    },

    followPlayback() {
      const current = player.snapshot();
      if (!current || current.index < 0) return;

      const text = chunks[current.index];
      if (text && text !== this.caption) this.caption = text;
      this.highlight(current.index);
    },

    /** Highlight the paragraph being narrated and keep it on screen. */
    highlight(index) {
      const block = previewBlocks[chunkBlock[index]];
      if (!block || block === activeBlock) return;

      activeBlock?.classList.remove("active-block");
      activeBlock = block;
      block.classList.add("active-block");
      block.scrollIntoView({ block: "center", behavior: "smooth" });
    },

    speechOptions() {
      return { voice: this.settings.voice, speed: this.settings.speed };
    },

    prepare(text, startAt) {
      chunks = splitIntoChunks(speechText(text));
      contextBlocks = paragraphs(text);

      nextIndex = Math.min(startAt, chunks.length);
      preparedDoc = text;
      snapshot = null;
      pendingAudio = new Map();
      audioCache = new Map();
      inflight = new Set();

      this.refreshCounters();
      this.caption = chunks[nextIndex] ?? "";
      this.renderPreview();
    },

    /** Render the markdown, then map each spoken chunk onto the block it came from. */
    renderPreview() {
      const preview = this.$refs.preview;
      preview.innerHTML = marked.parse(this.doc || "");

      // Wide tables scroll sideways instead of squeezing every cell into a thin column.
      preview.querySelectorAll("table").forEach((table) => {
        const wrapper = document.createElement("div");
        wrapper.className = "overflow-x-auto";
        table.replaceWith(wrapper);
        wrapper.append(table);
      });

      previewBlocks = [...preview.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, tr, blockquote, pre")].filter(
        (element) => !element.querySelector("p, li, tr"),
      );
      chunkBlock = mapChunksToBlocks(chunks, previewBlocks);
      blockChunk = invert(chunkBlock, previewBlocks.length);

      activeBlock = null;
      this.editing = false;
      this.highlight(nextIndex);
    },

    refreshCounters() {
      this.chunkCount = chunks.length;
      this.progressText = `${nextIndex} / ${chunks.length}`;
    },

    persistPosition() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        if (!currentDoc) return;
        try {
          currentDoc = await saveDocument({ ...currentDoc, position: nextIndex });
        } catch {
          // the next chunk will try again
        }
      }, 500);
    },

    record(question, text, at) {
      this.log = [{ at: Date.now(), chunk: at, question, answer: text }, ...this.log];

      if (!currentDoc) return;
      currentDoc = { ...currentDoc, log: this.log, position: nextIndex };
      saveDocument(currentDoc).catch((error) => this.fail(`Could not save: ${error.message}`));
    },

    async copyLog() {
      const text = this.log
        .map((entry) => `[${this.formatTime(entry.at)}] ${entry.question}\n${entry.answer}`)
        .join("\n\n");

      try {
        await navigator.clipboard.writeText(text);
        this.copied = true;
        setTimeout(() => (this.copied = false), 1500);
      } catch (error) {
        this.fail(`Copy failed: ${error.message}`);
      }
    },

    formatTime(at) {
      return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    },

    formatDate(at) {
      return new Date(at).toLocaleDateString([], { month: "short", day: "numeric" });
    },

    openSettings() {
      if (this.mode === "playing") {
        player.pause();
        this.mode = "paused";
      }
      this.previewing = "";
      this.draft = { ...this.settings };
      this.$refs.settingsDialog.showModal();
    },

    async previewVoice(voiceId) {
      if (this.previewing) return;

      this.previewing = voiceId;
      this.clearError();

      try {
        const audio = await this.voiceSample(voiceId);
        playSample(audio);
      } catch (error) {
        if (error.name !== "AbortError") this.fail(`Could not play that voice: ${error.message}`);
      } finally {
        this.previewing = "";
      }
    },

    voiceSample(voiceId) {
      const cached = previewCache.get(voiceId);
      if (cached) return Promise.resolve(cached);

      return tts.synth(PREVIEW_TEXT, { voice: voiceId, speed: 1 }).then((audio) => {
        previewCache.set(voiceId, audio);
        return audio;
      });
    },

    saveSettings() {
      this.settings = { ...this.draft, speed: Number(this.draft.speed) };
      saveSettings(this.settings);
      this.$refs.settingsDialog.close();
    },

    askByKeyboard() {
      this.interruptForQuestion();
      this.$refs.askInput.focus();
    },

    cancel() {
      if (this.micState === "recording") return this.stopMic(false);
      if (document.activeElement === this.$refs.askInput) {
        this.$refs.askInput.blur();
        if (this.mode === "interrupted") this.resumeDocument();
      }
    },

    async toggleMic() {
      this.touch();
      if (this.micState === "recording") return this.stopMic(true);
      if (this.micState === "transcribing") return;

      this.interruptForQuestion();
      this.clearError();

      try {
        await mic.start();
      } catch (error) {
        this.fail(`Microphone unavailable: ${error.message}`);
        return;
      }

      this.micState = "recording";
      this.caption = "Listening…";
      micTimer = setTimeout(() => this.stopMic(true), 20000);
    },

    async stopMic(transcribe) {
      clearTimeout(micTimer);
      if (this.micState !== "recording") return;
      this.micState = "transcribing";

      const samples = await mic.stop();

      if (!transcribe || !samples) {
        this.micState = "idle";
        if (!transcribe) this.resumeDocument();
        return;
      }

      // Silence and room noise make Whisper hallucinate; never spend a model call on that.
      if (!usableClip(samples)) {
        this.micState = "idle";
        this.fail("Didn't catch that. Try again.");
        return;
      }

      try {
        const text = await stt.transcribe(samples);
        this.modelProgress = "";
        this.micState = "idle";

        if (!usableTranscript(text)) {
          this.fail("Didn't catch that. Try again.");
          return;
        }

        this.question = text;
        await this.ask();
      } catch (error) {
        this.micState = "idle";
        this.fail(`Could not transcribe: ${error.message}`);
      }
    },

    fail(message) {
      this.error = message;
    },

    clearError() {
      this.error = "";
    },
  };
});

Alpine.start();
