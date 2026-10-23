import { newId } from "./id.js";
import { DEFAULT_VOICE } from "./voices.js";

const SETTINGS_KEY = "listener.settings.v1";
const SESSION_KEY = "listener.session.v1";

export const DEFAULT_SETTINGS = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  voice: DEFAULT_VOICE,
  speed: 1,
  speakAnswers: true,
};

/** @returns {TtsSettings} */
export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

/** @param {TtsSettings} settings */
export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function loadSession() {
  return { id: newSessionId(), doc: "", nextIndex: 0, log: [], ...read(SESSION_KEY, {}) };
}

export function saveSession(session) {
  write(SESSION_KEY, session);
}

/** One id per listening session, reused on every model call so the provider can cache the document prefix. */
/** @returns {string} */
export function newSessionId() {
  return newId();
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage is full or blocked; in-memory state still works
  }
}
