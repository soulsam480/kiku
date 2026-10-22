const SYSTEM_PROMPT = `You are answering a question from someone who is listening to a document being read aloud.
They interrupted the narration to ask you something.

Rules:
- Answer in one to three short sentences of plain speech.
- No markdown, no lists, no code, no links, no emoji.
- Everything you write is spoken aloud, so write it the way people talk.
- Use the document context. If the answer is not in it, say that briefly and answer from general knowledge.`;

const STOP_WORDS = new Set(
  `the and for with that this from what how why when who whom whose which are was were does did
   you your about into than then them they there here have has had can could should would will
   just not but all any can't dont doesn't isn't it's its of in on at to a an is do be`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Choose the part of the document the answer should be grounded in.
 * Short documents are sent whole; long ones get the chunks around the listener
 * plus chunks that mention the question's keywords.
 */
/**
 * @param {string[]} chunks raw markdown blocks
 * @param {number} currentIndex block nearest the listener
 * @param {string} question
 * @param {number} [maxChars]
 * @returns {string} context to send with the question
 */
export function buildContext(chunks, currentIndex, question, maxChars = 12000) {
  const whole = chunks.join(" ");
  if (whole.length <= maxChars) return whole;

  const terms = keywords(question);
  const scored = chunks.map((text, index) => {
    const lower = text.toLowerCase();
    const hits = terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
    const distance = Math.abs(index - currentIndex);
    return { index, text, score: hits * 10 + (distance < 6 ? 6 - distance : 0) };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked = [];
  let used = 0;
  for (const chunk of scored) {
    if (chunk.score === 0 && picked.length > 0) break;
    if (used + chunk.text.length > maxChars) continue;
    picked.push(chunk);
    used += chunk.text.length;
  }

  if (picked.length === 0) picked.push(...scored.slice(0, 1));
  picked.sort((a, b) => a.index - b.index);

  return picked.map((chunk) => chunk.text).join("\n\n");
}

/** Stream a chat completion, calling `onDelta` with each new piece of text. */
/**
 * @param {{ settings: TtsSettings, sessionId: string, question: string, context: string, signal: AbortSignal, onDelta: (delta: string) => void }} request
 * @returns {Promise<string>} the full answer
 */
export async function askQuestion({ settings, sessionId, question, context, signal, onDelta }) {
  const payload = JSON.stringify({
    model: settings.model,
    stream: true,
    temperature: 0.3,
    // A stable id plus an identical document prefix on every call lets the provider cache it.
    user: sessionId,
    prompt_cache_key: sessionId,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Document context:\n\n${context}\n\nQuestion: ${question}` },
    ],
  });

  const response = await send({ settings, sessionId, payload, signal });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail.slice(0, 200)}` : ""}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.body || contentType.includes("application/json")) {
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    if (text) onDelta(text);
    return text;
  }

  return readStream(response.body, onDelta);
}

/**
 * The dev and preview servers relay the call so providers that block browser CORS
 * (and want a client User-Agent) still work. A plain static deploy falls back to
 * calling the endpoint directly.
 */
async function send({ settings, sessionId, payload, signal }) {
  const authorization = `Bearer ${settings.apiKey}`;

  const relayed = await fetch("/llm/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      "x-llm-target": settings.baseUrl,
      "x-llm-session": sessionId,
    },
    body: payload,
  }).catch(() => null);

  if (relayed && relayed.status !== 404) return relayed;

  return fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: payload,
  });
}

async function readStream(body, onDelta) {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let text = "";

  const consume = (event) => {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let delta = "";
      try {
        delta = JSON.parse(payload).choices?.[0]?.delta?.content ?? "";
      } catch {
        continue;
      }
      if (!delta) continue;

      text += delta;
      onDelta(delta);
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) consume(event);
  }

  if (buffer.trim()) consume(buffer);
  return text;
}

function keywords(question) {
  const words = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return [...new Set(words)].filter((word) => !STOP_WORDS.has(word));
}
