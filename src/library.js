/**
 * Library and player: upload a document, generate its chapters, listen back.
 * The server owns the truth; this polls while anything is generating.
 */
import Alpine from "alpinejs";
import { VOICES } from "./voices.js";

const POLL_MS = 2000;
const SETTINGS_KEY = "listener.player.v1";

Alpine.data("library", () => ({
  documents: [],
  current: null,
  now: null,
  pasted: "",
  showPaste: false,
  busy: false,
  error: "",
  voices: VOICES,
  voice: localStorage.getItem("listener.voice") ?? "af_heart",
  audio: null,
  timer: null,

  // player state
  playing: false,
  position: 0,
  total: 0,
  speed: 1,
  volume: 1,

  init() {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    this.speed = saved.speed ?? 1;
    this.volume = saved.volume ?? 1;

    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => (this.position = this.audio.currentTime));
    this.audio.addEventListener("durationchange", () => (this.total = this.audio.duration || 0));
    this.audio.addEventListener("play", () => (this.playing = true));
    this.audio.addEventListener("pause", () => (this.playing = false));
    this.audio.addEventListener("ended", () => this.next());
    this.audio.volume = this.volume;

    this.refresh();
    this.$watch("voice", (value) => localStorage.setItem("listener.voice", value));
  },

  destroy() {
    this.stopPolling();
    this.audio?.pause();
  },

  /** Poll only while the server is synthesising; idle costs nothing. */
  startPolling() {
    if (!this.timer) this.timer = setInterval(() => this.refresh(), POLL_MS);
  },

  stopPolling() {
    clearInterval(this.timer);
    this.timer = null;
  },

  generating() {
    const chapters = this.current?.chapters ?? [];
    const open = chapters.some((chapter) => chapter.status === "queued" || chapter.status === "running");
    return open || this.documents.some((document) => document.active > 0);
  },

  async refresh() {
    try {
      const response = await fetch("/api/documents");
      if (!response.ok) return;
      const data = await response.json();
      this.documents = data.documents ?? [];

      if (this.current) {
        const detail = await fetch(`/api/documents/${this.current.id}`);
        if (detail.ok) this.current = await detail.json();
      }

      if (this.generating()) this.startPolling();
      else this.stopPolling();
    } catch {
      // service is restarting; the next tick retries
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
    if (this.generating()) this.startPolling();
  },

  close() {
    this.current = null;
  },

  async remove(document) {
    await this.send(`/api/documents/${document.id}`, { method: "DELETE" });
    if (this.current?.id === document.id) this.current = null;
    if (this.now?.documentId === document.id) this.stop();
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
    if (!chapter || chapter.status !== "done" || !this.audio) return;

    if (this.now?.id !== chapter.id) {
      this.now = chapter;
      this.position = 0;
      this.total = chapter.duration || 0;
      this.audio.src = `/api/chapters/${chapter.id}/audio`;
      this.audio.playbackRate = this.speed;
    }

    this.audio.play();
    this.setSession(chapter);
  },

  toggle(chapter) {
    if (this.now?.id === chapter.id && !this.audio.paused) this.audio.pause();
    else this.play(chapter);
  },

  stop() {
    this.audio?.pause();
    if (this.audio) this.audio.removeAttribute("src");
    this.now = null;
    this.playing = false;
  },

  seek(event) {
    const value = Number(event.target.value);
    this.position = value;
    if (this.audio && Number.isFinite(this.audio.duration)) this.audio.currentTime = value;
  },

  skip(seconds) {
    if (!this.audio) return;
    this.audio.currentTime = Math.max(0, Math.min(this.audio.currentTime + seconds, this.total || this.audio.duration));
  },

  next() {
    const chapters = this.doneChapters();
    const follow = chapters[chapters.findIndex((chapter) => chapter.id === this.now?.id) + 1];
    if (follow) this.play(follow);
  },

  previous() {
    const chapters = this.doneChapters();
    const index = chapters.findIndex((chapter) => chapter.id === this.now?.id);
    if (index > 0) this.play(chapters[index - 1]);
    else this.audio.currentTime = 0;
  },

  doneChapters() {
    return (this.current?.chapters ?? []).filter((chapter) => chapter.status === "done");
  },

  setSpeed() {
    if (this.audio) this.audio.playbackRate = this.speed;
    this.persist();
  },

  setVolume() {
    if (this.audio) this.audio.volume = this.volume;
    this.persist();
  },

  persist() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ speed: this.speed, volume: this.volume }));
  },

  setSession(chapter) {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapter.title,
      artist: this.current?.author || "Listener",
      album: this.current?.title ?? "",
    });

    navigator.mediaSession.setActionHandler("play", () => this.audio.play());
    navigator.mediaSession.setActionHandler("pause", () => this.audio.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => this.next());
    navigator.mediaSession.setActionHandler("previoustrack", () => this.previous());
  },

  // --- formatting ---

  clock(seconds) {
    const value = Math.max(0, Math.round(seconds || 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const rest = String(value % 60).padStart(2, "0");
    return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
  },

  duration(seconds) {
    const total = Math.round(seconds || 0);
    if (!total) return "";
    if (total < 60) return `${total}s`;
    if (total < 3600) return `${Math.round(total / 60)} min`;
    return `${Math.floor(total / 3600)}h ${Math.round((total % 3600) / 60)}m`;
  },

  size(bytes) {
    if (!bytes) return "";
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  },

  status(chapter) {
    if (chapter.status === "done") return this.duration(chapter.duration);
    if (chapter.status === "running") return "generating…";
    if (chapter.status === "queued") return "queued";
    if (chapter.status === "error") return "failed";
    return "";
  },

  totalDuration(document) {
    return this.duration(document.duration);
  },
}));
