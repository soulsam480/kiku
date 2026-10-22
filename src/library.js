/**
 * Library: upload a document, generate its chapters, play them back.
 * Polls the server while anything is generating; the server owns the truth.
 */
import Alpine from "alpinejs";
import { VOICES } from "./voices.js";

const POLL_MS = 2000;

Alpine.data("library", () => ({
  documents: [],
  current: null,
  pasted: "",
  showPaste: false,
  busy: false,
  error: "",
  voice: localStorage.getItem("listener.voice") ?? "af_heart",
  voices: VOICES,
  playing: null,
  audio: null,
  timer: null,
  speed: 1,

  init() {
    this.refresh();
    this.timer = setInterval(() => this.refresh(), POLL_MS);
    this.$watch("voice", (value) => localStorage.setItem("listener.voice", value));

    this.$nextTick(() => {
      this.audio = new Audio();
      this.audio.addEventListener("ended", () => this.next());
      this.audio.addEventListener("play", () => (this.playing = this.audio.dataset.chapter));
      this.audio.addEventListener("pause", () => {
        if (!this.audio.ended) this.playing = this.audio.dataset.chapter;
      });
    });

  },

  destroy() {
    clearInterval(this.timer);
    this.audio?.pause();
  },

  async refresh() {
    try {
      const response = await fetch("/api/documents");
      const data = await response.json();
      this.documents = data.documents ?? [];

      if (this.current) {
        const detail = await fetch(`/api/documents/${this.current.id}`);
        if (detail.ok) this.current = await detail.json();
      }
    } catch {
      // the service is restarting; next tick will retry
    }
  },

  async upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    await this.send("/api/documents", { method: "POST", body: form });
    event.target.value = "";
  },

  async paste() {
    if (!this.pasted.trim()) return;
    await this.send("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: this.pasted }),
    });
    this.pasted = "";
    this.showPaste = false;
  },

  async send(url, options) {
    this.busy = true;
    this.error = "";
    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? `Request failed (${response.status})`);
      await this.refresh();
      return data;
    } catch (error) {
      this.error = error.message;
    } finally {
      this.busy = false;
    }
  },

  async open(document) {
    const response = await fetch(`/api/documents/${document.id}`);
    if (response.ok) this.current = await response.json();
  },

  async remove(document) {
    await this.send(`/api/documents/${document.id}`, { method: "DELETE" });
    if (this.current?.id === document.id) this.current = null;
  },

  async generateAll() {
    if (!this.current) return;
    await this.send(`/api/documents/${this.current.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice: this.voice }),
    });
  },

  async generate(chapter) {
    await this.send(`/api/chapters/${chapter.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice: this.voice }),
    });
  },

  play(chapter) {
    if (!this.audio || chapter.status !== "done") return;

    if (this.audio.dataset.chapter !== chapter.id) {
      this.audio.src = `/api/chapters/${chapter.id}/audio`;
      this.audio.dataset.chapter = chapter.id;
    }

    this.audio.playbackRate = this.speed;
    this.audio.play();
    this.playing = chapter.id;

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter.title,
        artist: this.current?.author || "Listener",
        album: this.current?.title ?? "",
      });
    }
  },

  toggle(chapter) {
    if (!this.audio) return;
    if (this.playing === chapter.id && !this.audio.paused) this.audio.pause();
    else this.play(chapter);
  },

  next() {
    const chapters = (this.current?.chapters ?? []).filter((chapter) => chapter.status === "done");
    const index = chapters.findIndex((chapter) => chapter.id === this.audio?.dataset.chapter);
    const follow = chapters[index + 1];
    if (follow) this.play(follow);
  },

  previous() {
    const chapters = (this.current?.chapters ?? []).filter((chapter) => chapter.status === "done");
    const index = chapters.findIndex((chapter) => chapter.id === this.audio?.dataset.chapter);
    const before = chapters[index - 1];
    if (before) this.play(before);
  },

  setSpeed() {
    if (this.audio) this.audio.playbackRate = this.speed;
  },

  duration(seconds) {
    if (!seconds) return "";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  },

  size(bytes) {
    if (!bytes) return "";
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  },

  status(chapter) {
    if (chapter.status === "done") return `${this.duration(chapter.duration)}`;
    if (chapter.status === "running") return "generating…";
    if (chapter.status === "queued") return "queued";
    if (chapter.status === "error") return chapter.error || "failed";
    return "not generated";
  },
}));
