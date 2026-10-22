const MAX_CHUNK_CHARS = 260;
const MAX_SENTENCE_CHARS = 420;

const HTML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

/**
 * Turn markdown into text that reads well out loud.
 * Code blocks, images, link targets and markup punctuation are dropped so the
 * narrator never says "asterisk asterisk" or "open bracket".
 */
export function speechText(markdown) {
  let text = markdown.replace(/\r\n/g, "\n");

  text = text.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? " ");

  text = text.replace(/^---\n[\s\S]*?\n---\n/, ""); // front matter
  text = text.replace(/```[\s\S]*?```/g, "\n"); // fenced code
  text = text.replace(/```[\s\S]*$/g, ""); // unterminated fence
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, ""); // quote markers, so wrapped quotes join
  text = text.replace(/[ \t]*[·•][ \t]*/g, ". "); // bullet separators become sentence breaks
  text = mergeSoftWraps(text); // hard-wrapped prose is one sentence, not many
  text = text.replace(/`([^`]*)`/g, "$1"); // inline code
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, " "); // images
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1"); // reference links
  text = text.replace(/\[\^[^\]]*\]/g, ""); // footnotes
  text = text.replace(/<https?:\/\/[^>]+>/g, " "); // autolinks
  text = text.replace(/https?:\/\/\S+/g, " link "); // bare urls
  text = replaceTables(text); // tables become sentences the listener can follow
  text = text.replace(/^\s{0,3}#{1,6}\s*/gm, ""); // headings
  text = text.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, ""); // task list markers
  text = text.replace(/^\s*[-*+]\s+/gm, ""); // bullets
  text = text.replace(/^\s*\d+[.)]\s+/gm, ""); // numbered lists
  text = text.replace(/^\s*([-*_]\s*){3,}$/gm, " "); // horizontal rules
  text = text.replace(/(\*\*\*|___)(.+?)\1/g, "$2"); // bold italic
  text = text.replace(/(\*\*|__)(.+?)\1/g, "$2"); // bold
  text = text.replace(/(\*|(?<![\w])_)([^*_]+)\1(?![\w])/g, "$2"); // italic, but not snake_case
  text = text.replace(/[*]/g, ""); // stray emphasis markers
  text = text.replace(/<[^>]+>/g, " "); // raw html
  text = normalizeEmoji(text); // say "check", not nothing
  text = normalizeNumbers(text); // "$1 per yr" → "1 dollar per year"
  text = text.replace(/\b([\p{L}\p{N}+$]+)(?:[\s,]+\1\b)+/giu, "$1"); // "check check" → "check"
  text = text.replace(/\band\/or\b/gi, "and or");
  text = text.replace(/(\d)\s*\/\s*(\d)/g, "$1 over $2"); // fractions
  text = text.replace(/\s*\/\s*/g, " "); // slashes: paths, separators
  text = text.replace(/#\s?(\d+)/g, "number $1"); // issue numbers
  text = text.replace(/\s*&\s*/g, " and ");
  text = text.replace(/[\[\]{}|•·^~<>]/g, " "); // leftover markup punctuation
  text = text.replace(/\s+([.,;:!?])/g, "$1"); // no gaps before punctuation
  text = text.replace(/[ \t]+/g, " "); // collapse spaces
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/\n{2,}/g, "\n\n");

  return tidySentences(text).trim();
}

/** Split text into chunks short enough for one Kokoro pass, cutting on sentence ends. */
export function splitIntoChunks(text) {
  return splitIntoBlocks(text).flatMap((block) => block.chunks);
}

/**
 * Same chunking, but keeps each spoken paragraph together with its chunks so the
 * reader can highlight the sentence being narrated.
 */
export function splitIntoBlocks(text) {
  const blocks = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const chunks = [];

    for (const sentence of splitSentences(paragraph)) {
      const previous = chunks[chunks.length - 1];

      if (previous && previous.length + sentence.length + 1 <= MAX_CHUNK_CHARS) {
        chunks[chunks.length - 1] = `${previous} ${sentence}`;
      } else if (sentence.length <= MAX_SENTENCE_CHARS) {
        chunks.push(sentence);
      } else {
        chunks.push(...splitLongSentence(sentence));
      }
    }

    if (chunks.length) blocks.push({ text: chunks.join(" "), chunks });
  }

  return blocks;
}

/**
 * Pull complete sentences out of a growing buffer (used for streaming answers).
 * Returns the finished sentences and whatever is still incomplete.
 */
export function takeSentences(buffer, flush = false) {
  const sentences = [];
  let rest = buffer;

  for (;;) {
    const match = /^[^.!?]*[.!?]+["')\]]*\s+/.exec(rest);
    if (!match) break;
    sentences.push(match[0].trim());
    rest = rest.slice(match[0].length);
  }

  if (flush && rest.trim()) {
    sentences.push(rest.trim());
    rest = "";
  }

  return { sentences, rest };
}

/** Raw markdown blocks, kept for the model's context so tables stay structured. */
export function paragraphs(markdown) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/**
 * Tables read badly as comma runs, so narrate them by shape:
 * two columns become term/definition pairs, wider ones announce the columns once
 * and lead each row with its first cell, and huge ones are trimmed to one detail column.
 */
function replaceTables(text) {
  const lines = text.split("\n");
  const output = [];
  let block = [];

  const flush = () => {
    if (block.length) output.push(narrateTable(block));
    block = [];
  };

  for (const line of lines) {
    if (/^[ \t]*\|.*\|[ \t]*$/.test(line)) block.push(line);
    else {
      flush();
      output.push(line);
    }
  }

  flush();
  return output.filter((line) => line !== null).join("\n");
}

function narrateTable(rows) {
  const cellsOf = (row) =>
    row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim().replace(/\.$/, "")); // the narrator adds its own full stop

  const isRule = (cells) => cells.length > 0 && cells.every((cell) => cell === "" || /^:?-{2,}:?$/.test(cell));

  const all = rows.map(cellsOf);
  const hasHeader = all.length > 1 && isRule(all[1]);
  const header = hasHeader ? all[0] : null;
  const data = all.filter(
    (cells, index) => !(hasHeader && index <= 1) && !isRule(cells) && cells.some(Boolean),
  );

  if (!data.length) return null;

  const columns = Math.max(header?.length ?? 0, ...data.map((cells) => cells.length));
  const labels = header ?? [];

  if (columns <= 2) {
    return data
      .map((cells) => {
        const [term = "", ...rest] = cells;
        const value = rest.filter(Boolean).join(", ");
        return value ? `${term}: ${value}.` : `${term}.`;
      })
      .join("\n\n");
  }

  if (columns <= 4 && data.length <= 20) return rowWise(data, labels);
  if (isMatrix(labels, columns)) return columnWise(data, labels);

  return rowWise(data, labels);
}

/** Comparison matrices put entities across the top and attributes down the side. */
function isMatrix(labels, columns) {
  return columns >= 5 && !labels[0];
}

/** Read one column at a time: "Blinq. Model: freemium seat. Entry price: $5." */
function columnWise(data, labels) {
  const headers = labels.slice(1);
  const blocks = [];

  for (let column = 0; column < headers.length; column += 1) {
    const values = data
      .map((cells) => {
        const value = cells[column + 1];
        if (!value || isFalsy(value)) return "";
        return cells[0] ? `${cells[0]}: ${value}` : value;
      })
      .filter(Boolean);

    if (values.length) blocks.push(`${headers[column] || `Column ${column + 2}`}. ${values.join(". ")}.`);
  }

  const intro = `Table with ${data.length} rows and ${headers.length} columns.`;

  return [intro, ...blocks].join("\n\n");
}

/** Read row by row with column labels, keeping every column and every row. */
function rowWise(data, labels) {
  const lines = data.map((cells) => {
    const [first = "", ...rest] = cells;
    const details = rest
      .map((cell, index) => {
        if (!cell || isFalsy(cell)) return "";
        return labels[index + 1] ? `${labels[index + 1]}: ${cell}` : cell;
      })
      .filter(Boolean)
      .join(". ");

    return details ? `${first}. ${details}.` : `${first}.`;
  });

  const intro = `Table with ${data.length} row${data.length === 1 ? "" : "s"}. Columns: ${labels.filter(Boolean).join(", ")}.`;

  return [intro, ...lines].join("\n\n");
}

/** Cells that carry no information when spoken. */
function isFalsy(value) {
  return /^(|[-—–]|n\/?a|none|no|false|0|x|✗|✘|❌|·)$/i.test(value.trim());
}

import emojiNames from "./emoji-names.json" with { type: "json" };

const EMOJI_WORDS = new Map(
  Object.entries({
    "✅": " check ",
    "✔️": " check ",
    "☑️": " check ",
    "❌": " cross ",
    "✖️": " cross ",
    "❎": " cross ",
    "⚠️": " warning ",
    "⚠": " warning ",
    "❗": " important ",
    "❓": " question ",
    "ℹ️": " note ",
    "⭐": " star ",
    "🌟": " star ",
    "🔥": " hot ",
    "💡": " idea ",
    "📌": " pinned ",
    "🚀": " launch ",
    "🎯": " target ",
    "📈": " growth ",
    "📉": " decline ",
    "❤️": " heart ",
    "👍": " thumbs up ",
    "👎": " thumbs down ",
    "🔴": " red ",
    "🟢": " green ",
    "🟡": " yellow ",
    "🔵": " blue ",
    "👀": " look ",
    "🎉": " celebrate ",
    "🧠": " thinking ",
    "➡️": " arrow ",
    "→": " to ",
    "←": " from ",
    "↑": " up ",
    "↓": " down ",
  }),
);

const EMOJI_PATTERN = /[\p{Extended_Pictographic}\u2190-\u21FF\u2B00-\u2BFF\u{1F1E6}-\u{1F1FF}]/u;
const EMOJI_NAMES = new Map(Object.entries(emojiNames));

/**
 * Say emoji instead of dropping them. Common ones use short, natural words
 * ("❌" → "cross"); everything else falls back to its Unicode CLDR name
 * ("🇺🇸" → "United States", "🚀" → "rocket"). Truly unknown glyphs are removed.
 */
function normalizeEmoji(text) {
  if (!EMOJI_PATTERN.test(text)) return text;

  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  let output = "";

  for (const { segment } of segmenter.segment(text)) {
    const isEmoji = EMOJI_PATTERN.test(segment) || /[\uFE0F\u20E3]/u.test(segment);
    if (!isEmoji) {
      output += segment;
      continue;
    }

    output += ` ${emojiWord(segment)} `;
  }

  return output;
}

function emojiWord(segment) {
  const bare = segment.replace(/\uFE0F/g, "");
  const plain = bare.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""); // skin tone modifiers

  return (
    EMOJI_WORDS.get(segment) ??
    EMOJI_WORDS.get(bare) ??
    EMOJI_NAMES.get(segment) ??
    EMOJI_NAMES.get(bare) ??
    EMOJI_NAMES.get(plain) ??
    EMOJI_WORDS.get(plain) ??
    ""
  );
}

const CURRENCY_WORDS = {
  $: ["dollar", "dollars"],
  "£": ["pound", "pounds"],
  "€": ["euro", "euros"],
  "₹": ["rupee", "rupees"],
  "¥": ["yen", "yen"],
};

const SCALE_WORDS = { k: "thousand", m: "million", b: "billion" };

const UNIT_WORDS = {
  mo: ["month", "months"],
  yr: ["year", "years"],
  wk: ["week", "weeks"],
  hr: ["hour", "hours"],
  min: ["minute", "minutes"],
  sec: ["second", "seconds"],
};

const ABBREVIATIONS = {
  approx: "approximately",
  avg: "average",
  incl: "including",
  excl: "excluding",
  est: "estimated",
  qty: "quantity",
};

/**
 * Say money, units and abbreviations the way a person reads them:
 * "$1 per yr" → "1 dollar per year", "£49.99/mo" → "49.99 pounds per month".
 * Models pronounce whatever characters they are given, so this has to happen here.
 */
function normalizeNumbers(text) {
  let out = text;

  const unitWord = (unit, amount = "2") => {
    const pair = UNIT_WORDS[unit.slice(0, 3).toLowerCase()];
    if (!pair) return unit;
    const singular = Number(amount) === 1 || amount === "1";
    return singular ? pair[0] : pair[1];
  };

  const money = (amount, symbol) => {
    const [singular, plural] = CURRENCY_WORDS[symbol];
    const clean = amount.replace(/,/g, "");
    return `${clean} ${Number(clean) === 1 ? singular : plural}`;
  };

  // £49.99/mo → 49.99 pounds per month
  out = out.replace(
    /\/\s*(mo|mos|yr|yrs|wk|wks|hr|hrs|min|mins|sec|secs|month|months|year|years|week|weeks|hour|hours|minute|minutes|second|seconds)\b/gi,
    (_, unit) => ` per ${unitWord(unit, "1")}`,
  );

  out = out.replace(/\bper\s+(mo|mos|yr|yrs|wk|wks|hr|hrs|min|mins|sec|secs)\b/gi, (_, unit) => `per ${unitWord(unit, "1")}`);

  // $4.99 and 1$ → 4.99 dollars, 1 dollar
  out = out.replace(/([$£€₹¥])\s?(\d[\d,]*(?:\.\d+)?)/g, (_, symbol, amount) => money(amount, symbol));
  out = out.replace(/(\d[\d,]*(?:\.\d+)?)\s?([$£€₹¥])/g, (_, amount, symbol) => money(amount, symbol));

  // 400K → 400 thousand
  out = out.replace(/\b(\d+(?:\.\d+)?)\s?([KkMmBb])\b/g, (_, amount, scale) => `${amount} ${SCALE_WORDS[scale.toLowerCase()]}`);

  // 50% → 50 percent, 400K+ → ... plus
  out = out.replace(/(\d)\s?%/g, "$1 percent");
  out = out.replace(/\b(thousand|million|billion)\+/gi, "$1 plus");
  out = out.replace(/(\d)\+/g, "$1 plus");

  // 2024–2026 → 2024 to 2026 (hyphens inside words are untouched)
  out = out.replace(/(\d)\s?[–—]\s?(\d)/g, "$1 to $2");

  // 5 min → 5 minutes
  out = out.replace(/\b(\d+(?:\.\d+)?)\s?(mo|mos|yr|yrs|wk|wks|hr|hrs|min|mins|sec|secs)\b/gi, (_, amount, unit) =>
    `${amount} ${unitWord(unit, amount)}`,
  );

  // Standalone abbreviations
  out = out.replace(/\be\.g\.|\beg\b/gi, "for example");
  out = out.replace(/\bi\.e\.|\bie\b/gi, "that is");
  out = out.replace(/\bvs\.?(?=\s|$)/gi, "versus");
  out = out.replace(/\betc\.?(?=\s|$)/gi, "etcetera");
  out = out.replace(/\bno\.\s?(\d)/gi, "number $1");
  out = out.replace(/\b(approx|avg|incl|excl|est|qty)\.?(?=\s|$)/gi, (match) => {
    return ABBREVIATIONS[match.replace(/\./g, "").toLowerCase()] ?? match;
  });

  return out;
}

/** Add a full stop to lines that would otherwise run together, and drop empty ones. */
function tidySentences(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/[.!?:;,]$/.test(line) ? line : `${line}.`))
    .join("\n\n");
}

/**
 * Markdown ignores single newlines inside a paragraph, and source files are usually
 * hard-wrapped. Joining them keeps a wrapped sentence from becoming several fake
 * one-line sentences.
 */
function mergeSoftWraps(text) {
  const startsBlock = (line) => /^[ \t]*([-*+]\s|\d+[.)]\s|#{1,6}\s|>|\||```|<)/.test(line);
  const canAttach = (line) => !/^[ \t]*(#{1,6}\s|\||>|```)/.test(line);

  const merged = [];

  for (const line of text.split("\n")) {
    const previous = merged[merged.length - 1];
    const joinable =
      previous !== undefined &&
      previous.trim() !== "" &&
      line.trim() !== "" &&
      canAttach(previous) &&
      !startsBlock(line);

    if (joinable) merged[merged.length - 1] = `${previous.trimEnd()} ${line.trimStart()}`;
    else merged.push(line);
  }

  return merged.join("\n");
}

function splitSentences(paragraph) {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Cut an over-long sentence at the latest natural pause, not wherever the limit lands. */
function splitLongSentence(sentence) {
  const parts = [];
  let rest = sentence;

  while (rest.length > MAX_SENTENCE_CHARS) {
    const window = rest.slice(0, MAX_SENTENCE_CHARS);
    const minimum = MAX_SENTENCE_CHARS * 0.5;

    const clause = Math.max(
      window.lastIndexOf("; "),
      window.lastIndexOf(": "),
      window.lastIndexOf(", "),
      window.lastIndexOf(" — "),
      window.lastIndexOf(" – "),
    );

    let cut = clause >= minimum ? clause + 1 : window.lastIndexOf(" ");
    if (cut < minimum) cut = MAX_SENTENCE_CHARS;

    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) parts.push(rest);
  return parts;

}
