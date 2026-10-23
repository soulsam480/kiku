import { newId } from "./id.js";

const DB_NAME = "listener";
const DB_VERSION = 1;
const STORE = "documents";
const LEGACY_SESSION_KEY = "listener.session.v1";

let connection = null;

function open() {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) return;
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return connection;
}

function request(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const result = store[method](...args);
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
  });
}

async function withStore(mode, run) {
  const db = await open();
  const transaction = db.transaction(STORE, mode);
  const store = transaction.objectStore(STORE);

  const value = await run(store);
  await new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  return value;
}

/** Newest first. */
/** @returns {Promise<DocumentRecord[]>} newest first */
export async function listDocuments() {
  const documents = await withStore("readonly", (store) => request(store, "getAll"));
  return documents.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * @param {string} id
 * @returns {Promise<DocumentRecord | undefined>}
 */
export function getDocument(id) {
  return withStore("readonly", (store) => request(store, "get", id));
}

/**
 * @param {Partial<DocumentRecord>} document
 * @returns {Promise<DocumentRecord>}
 */
export async function saveDocument(document) {
  const record = plain({
    log: [],
    position: 0,
    ...document,
    id: document.id ?? newId(),
    updatedAt: Date.now(),
  });

  await withStore("readwrite", (store) => request(store, "put", record));
  return record;
}

/**
 * Alpine wraps anything it renders in a reactive Proxy, and IndexedDB refuses to
 * structured-clone a Proxy. Records are plain data, so a JSON round-trip is enough
 * and keeps the caller from having to know about reactivity.
 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export function deleteDocument(id) {
  return withStore("readwrite", (store) => request(store, "delete", id));
}

/**
 * Move a document saved by the previous localStorage version into IndexedDB once.
 * Returns the migrated document, or null when there is nothing to move.
 */
/** @returns {Promise<DocumentRecord | null>} */
export async function takeLegacySession() {
  let raw = null;
  try {
    raw = localStorage.getItem(LEGACY_SESSION_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!session?.doc?.trim()) return null;

    return await saveDocument({
      title: titleOf(session.doc),
      markdown: session.doc,
      position: session.nextIndex ?? 0,
      log: session.log ?? [],
    });
  } catch {
    return null;
  }
}

/**
 * @param {string} markdown
 * @returns {string} first heading or line, trimmed for display
 */
export function titleOf(markdown) {
  const line = markdown
    .split("\n")
    .map((text) => text.trim())
    .find(Boolean);

  if (!line) return "Untitled";

  return (
    line
      .replace(/^#{1,6}\s*/, "")
      .replace(/[*_`[\]]/g, "")
      .trim()
      .slice(0, 80) || "Untitled"
  );
}
