import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

const DATA = new URL("../data/", import.meta.url).pathname;
mkdirSync(`${DATA}audio`, { recursive: true });

/** @type {Database} */
export const db = new Database(`${DATA}listener.db`);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    markdown TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT NOT NULL DEFAULT '',
    file TEXT NOT NULL DEFAULT '',
    duration REAL NOT NULL DEFAULT 0,
    bytes INTEGER NOT NULL DEFAULT 0,
    voice TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS chapters_by_document ON chapters(document_id, idx);
`);

export const audioPath = (name) => `${DATA}audio/${name}`;

export function listDocuments() {
  return db
    .query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM chapters c WHERE c.document_id = d.id) AS chapters,
        (SELECT COUNT(*) FROM chapters c WHERE c.document_id = d.id AND c.status = 'done') AS done,
        (SELECT COALESCE(SUM(c.duration), 0) FROM chapters c WHERE c.document_id = d.id AND c.status = 'done') AS duration
       FROM documents d ORDER BY d.created_at DESC`,
    )
    .all();
}

export function getDocument(id) {
  const document = db.query("SELECT * FROM documents WHERE id = ?").get(id);
  if (!document) return null;
  return { ...document, chapters: listChapters(id) };
}

export function listChapters(documentId) {
  return db.query("SELECT * FROM chapters WHERE document_id = ? ORDER BY idx").all(documentId);
}

export function getChapter(id) {
  return db.query("SELECT * FROM chapters WHERE id = ?").get(id);
}

export function createDocument({ title, author, markdown, chapters }) {
  const now = Date.now();
  const id = crypto.randomUUID();

  const insert = db.transaction(() => {
    db.query("INSERT INTO documents (id, title, author, markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      id,
      title,
      author,
      markdown,
      now,
      now,
    );

    chapters.forEach((chapter, index) => {
      db.query(
        "INSERT INTO chapters (id, document_id, idx, title, text, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(crypto.randomUUID(), id, index, chapter.title, chapter.text, now);
    });
  });

  insert();
  return getDocument(id);
}

export function deleteDocument(id) {
  db.query("DELETE FROM documents WHERE id = ?").run(id);
}

export function updateChapter(id, patch) {
  const allowed = ["status", "error", "file", "duration", "bytes", "voice"];
  const keys = Object.keys(patch).filter((key) => allowed.includes(key));
  if (!keys.length) return;

  const assignments = keys.map((key) => `${key} = ?`).join(", ");
  db.query(`UPDATE chapters SET ${assignments}, updated_at = ? WHERE id = ?`).run(
    ...keys.map((key) => patch[key]),
    Date.now(),
    id,
  );
}

export function resetChapters(documentId) {
  db.query("UPDATE chapters SET status = 'pending', error = '', updated_at = ? WHERE document_id = ?").run(
    Date.now(),
    documentId,
  );
}
