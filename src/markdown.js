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
  text = text.replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}]/gu, ""); // emoji and arrows
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

  if (columns <= 2) {
    return data
      .map((cells) => {
        const [term = "", ...rest] = cells;
        const value = rest.filter(Boolean).join(", ");
        return value ? `${term}: ${value}.` : `${term}.`;
      })
      .join("\n\n");
  }

  const labels = header ?? [];

  if (columns <= 4 && data.length <= 20) {
    const intro = `Table with ${data.length} row${data.length === 1 ? "" : "s"}. Columns: ${labels.filter(Boolean).join(", ")}.`;
    const lines = data.map((cells) => {
      const [first = "", ...rest] = cells;
      const details = rest
        .map((cell, index) => (cell ? `${labels[index + 1] ? `${labels[index + 1]}: ` : ""}${cell}` : ""))
        .filter(Boolean)
        .join(". ");
      return details ? `${first}. ${details}.` : `${first}.`;
    });
    return [intro, ...lines].join("\n\n");
  }

  const detailColumn = widestColumn(data, columns);
  const shown = data.slice(0, 8);
  const hidden = data.length - shown.length;

  const intro = `Table with ${data.length} rows and ${columns} columns. Reading ${labels[0] ?? "the first column"} and ${labels[detailColumn] ?? "one detail column"}.`;
  const lines = shown.map((cells) => {
    const first = cells[0] ?? "";
    const detail = cells[detailColumn] ?? "";
    if (!detail) return `${first}.`;
    return `${first}. ${labels[detailColumn] ? `${labels[detailColumn]}: ` : ""}${detail}.`;
  });
  const tail = hidden > 0 ? `And ${hidden} more rows.` : "";

  return [intro, ...lines, tail].filter(Boolean).join("\n\n");
}

/** The column (after the first) holding the most text is usually the explanatory one. */
function widestColumn(data, columns) {
  let best = 1;
  let bestLength = -1;

  for (let column = 1; column < columns; column += 1) {
    const length = data.reduce((total, cells) => total + (cells[column]?.length ?? 0), 0);
    if (length > bestLength) {
      bestLength = length;
      best = column;
    }
  }

  return best;
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
