import Alpine from "alpinejs";
import { marked } from "marked";
import { tinykeys } from "tinykeys";
import { speechText, splitIntoChunks, takeSentences, paragraphs } from "./markdown.js";
import { Player } from "./player.js";
import { Tts } from "./tts.js";
import { Mic } from "./mic.js";
import { Stt } from "./stt.js";
import { askQuestion, buildContext } from "./llm.js";
import { loadSession, saveSession, loadSettings, saveSettings, newSessionId } from "./store.js";
import "./style.css";

const AHEAD = 3; // chunks synthesized ahead of playback
const CONTEXT_CHARS = 12000; // document text sent to the model when it fits

Alpine.data("app", () => {
  const player = new Player();
  const tts = new Tts();
  const mic = new Mic();
  const stt = new Stt();
  const session = loadSession();

  let chunks = [];
  let contextBlocks = [];
  let nextIndex = 0;
  let preparedDoc = "";
  let snapshot = null; // position captured when narration was interrupted
  let pendingAudio = new Map();
  let audioCache = new Map();
  let inflight = new Set();
  let answer = null;
  let answerToken = 0;
  let replayOnly = false;
  let askAbort = null;
  let saveTimer = null;
  let ticker = null;
  let micTimer = null;
  let unbindKeys = null;

  const AUDIO_CACHE_LIMIT = 40;

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
    doc: session.doc ?? "",
    question: "",
    caption: "",
    progressText: "0 / 0",
    chunkCount: 0,
    error: "",
    copied: false,
    modelProgress: "",
    log: session.log ?? [],
    settings: loadSettings(),
    draft: loadSettings(),
    editing: !session.doc,

    get statusLabel() {
      const parts = [this.mode];
      if (this.askStage) parts.push(this.askStage);
      if (this.modelProgress) parts.push(this.modelProgress);
      return parts.join(" · ");
    },

    init() {
      if (this.doc) {
        chunks = splitIntoChunks(speechText(this.doc));
        contextBlocks = paragraphs(this.doc);
        nextIndex = Math.min(session.nextIndex ?? 0, chunks.length);
        preparedDoc = this.doc;
        this.refreshCounters();
        this.caption = chunks[nextIndex] ?? "";
        this.$nextTick(() => this.renderPreview(this.doc));
      }

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

      if (import.meta.env.DEV) window.listener = { player, tts, stt };
    },

    destroy() {
      clearInterval(ticker);
      clearTimeout(micTimer);
      unbindKeys?.();
      mic.release();
    },

    async start() {
      const text = this.doc.trim();
      if (!text) return this.fail("Paste some markdown first.");

      this.clearError();
      player.clear();
      session.id = newSessionId();
      this.prepare(text, 0);
      await this.play();
    },

    async play() {
      if (this.doc.trim() !== preparedDoc.trim()) this.prepare(this.doc, 0);
      if (!chunks.length) return this.fail("Paste some markdown first.");

      const first = nextIndex;
      this.mode = "loading";

      try {
        await player.unlock();
        await tts.warm();

        // Synthesize the first chunk up front so speech starts the moment we say "playing".
        if (first < chunks.length && !pendingAudio.has(first) && !audioCache.has(first) && !inflight.has(first)) {
          pendingAudio.set(first, await tts.synth(chunks[first], this.speechOptions()));
        }
      } catch (error) {
        this.mode = "idle";
        return this.fail(`Speech could not start: ${error.message}`);
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
        this.play();
      } else if (this.mode === "idle") {
        chunks.length ? this.play() : this.start();
      }
    },

    stop() {
      askAbort?.abort();
      answerToken += 1;
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
      this.persistPosition();
    },

    interruptForQuestion() {
      if (this.mode !== "playing" && this.mode !== "paused") return;
      snapshot = player.snapshot();
      player.clear();
      this.mode = "interrupted";
    },

    async ask() {
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
          sessionId: session.id,
          question,
          context,
          signal: askAbort.signal,
          onDelta: (delta) => {
            if (token !== answerToken) return;
            if (this.askStage === "sending") this.askStage = "thinking";
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
      current.inflight += 1;
      tts
        .synth(sentence, this.speechOptions())
        .then(({ samples, sampleRate }) => {
          if (token !== answerToken) return;
          this.askStage = "speaking";
          player.enqueue(samples, sampleRate, -1);
        })
        .catch((error) => {
          if (token === answerToken) this.fail(`Speech failed: ${error.message}`);
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
    async seek(step) {
      if (!chunks.length) return;
      if (!["playing", "paused", "interrupted", "done"].includes(this.mode)) return;

      const position =
        this.mode === "interrupted"
          ? (snapshot?.index ?? 0)
          : (player.snapshot()?.index ?? Math.max(0, nextIndex - 1));
      const target = Math.min(Math.max(position + step, 0), chunks.length - 1);

      player.clear();
      snapshot = null;
      nextIndex = target;
      this.refreshCounters();
      this.caption = chunks[target] ?? "";

      let audio = pendingAudio.get(target) ?? audioCache.get(target);

      if (!audio) {
        this.mode = "loading";
        this.askStage = "preparing sentence";

        try {
          audio = await tts.synth(chunks[target], this.speechOptions());
        } catch (error) {
          this.mode = "interrupted";
          this.askStage = "";
          return this.fail(`Speech failed: ${error.message}`);
        }

        this.askStage = "";
        pendingAudio.set(target, audio);
      }

      this.mode = "playing";
      await player.resume();
      this.pump();
    },

    /** Speak a logged answer again, then pick narration back up. */
    replay(entry) {
      if (!entry.answer?.trim() || this.mode === "answering") return;
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
      this.mode = "playing";
      this.pump();
    },

    tick() {
      if (this.mode === "playing" || this.mode === "paused") {
        this.pump();
        this.followPlayback();
      } else if (this.mode === "answering") {
        this.afterAudio();
      }
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
        tts
          .synth(chunks[i], this.speechOptions())
          .then((audio) => pendingAudio.set(i, audio))
          .catch((error) => this.fail(`Speech failed: ${error.message}`))
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
      }
    },

    followPlayback() {
      const current = player.snapshot();
      if (!current || current.index < 0) return;
      const text = chunks[current.index];
      if (text && text !== this.caption) this.caption = text;
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
      this.renderPreview(text);

      session.doc = text;
      session.nextIndex = nextIndex;
      saveSession(session);
    },

    renderPreview(text) {
      this.$refs.preview.innerHTML = marked.parse(text);
      this.editing = false;
    },

    refreshCounters() {
      this.chunkCount = chunks.length;
      this.progressText = `${nextIndex} / ${chunks.length}`;
    },

    persistPosition() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        session.doc = preparedDoc;
        session.nextIndex = nextIndex;
        saveSession(session);
      }, 500);
    },

    record(question, text, at) {
      this.log = [{ at: Date.now(), chunk: at, question, answer: text }, ...this.log];
      session.log = this.log;
      saveSession(session);
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

    openSettings() {
      this.draft = { ...this.settings };
      this.$refs.settingsDialog.showModal();
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

      try {
        const text = await stt.transcribe(samples);
        this.modelProgress = "";
        this.micState = "idle";

        if (!text) {
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
