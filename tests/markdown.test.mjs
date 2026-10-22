import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { speechText, splitIntoChunks, splitIntoBlocks, takeSentences } from "../src/markdown.js";

const spoken = (markdown) => speechText(markdown).replace(/\s+/g, " ").trim();

test("markdown punctuation never reaches the narrator", () => {
  const text = spoken("# Title\n\nSome **bold**, _italic_ and `code` plus a [link](https://example.com).");
  assert.ok(!/[*_`#[\]]/.test(text), text);
  assert.match(text, /Some bold, italic and code plus a link\./);
});

test("money, units and abbreviations read as words", () => {
  assert.equal(spoken("It costs $1 per yr."), "It costs 1 dollar per year.");
  assert.match(spoken("Plans from £49.99/mo."), /49\.99 pounds per month/);
  assert.match(spoken("400K+ companies, 2.5M users."), /400 thousand plus companies, 2\.5 million users/);
  assert.match(spoken("Growth 50% in 2024–2026."), /50 percent in 2024 to 2026/);
  assert.match(spoken("approx 5 min, e.g. this."), /approximately 5 minutes, for example this/);
});

test("emoji become words, including flags", () => {
  assert.equal(spoken("✅ done ❌ blocked"), "check done cross blocked.");
  assert.equal(spoken("Shipped 🚀 to 🇺🇸"), "Shipped launch to United States.");
  assert.equal(spoken("Warning ⚠️ ahead"), "Warning ahead.");
});

test("tables keep every row and every column", () => {
  const table = [
    "| Layer | Job | Vendors |",
    "| --- | --- | --- |",
    "| Capture | Read a badge | Popsl, Blinq |",
    "| Routing | Pick an owner | Chili Piper |",
  ].join("\n");

  const text = spoken(table);
  for (const cell of ["Capture", "Read a badge", "Popsl, Blinq", "Routing", "Pick an owner", "Chili Piper"]) {
    assert.match(text, new RegExp(cell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing ${cell}`);
  }
  assert.doesNotMatch(text, /more rows|more columns/);
});

test("comparison matrices read column by column", () => {
  const table = [
    "|  | Blinq | HiHello | Popl | Mobilo | Dot |",
    "| --- | --- | --- | --- | --- | --- |",
    "| Model | freemium | quote | quote | hardware | hardware |",
    "| Price | $5 | $6 | $7 | $8 | $9 |",
  ].join("\n");

  const text = spoken(table);
  assert.match(text, /Blinq\. Model: freemium\. Price: 5 dollars\./);
  assert.match(text, /Dot\. Model: hardware\. Price: 9 dollars\./);
  assert.doesNotMatch(text, /more columns/);
});

test("narrow tables read row by row with column names", () => {
  const text = spoken("|  | Blinq | HiHello |\n| --- | --- | --- |\n| Model | freemium | quote |");
  assert.match(text, /Model\. Blinq: freemium\. HiHello: quote\./);
});

test("hard-wrapped prose stays one sentence", () => {
  const text = spoken("Event lead capture, badge\nscanning and digital business\ncards.");
  assert.equal(text, "Event lead capture, badge scanning and digital business cards.");
});

test("chunks break on sentence boundaries, not mid-sentence", () => {
  const corpus = readFileSync(new URL("../data/corpus.md", import.meta.url), "utf8");
  const chunks = splitIntoChunks(speechText(corpus));
  const broken = chunks.filter((chunk, index) => index > 0 && !/[.!?]["')\]]*$/.test(chunks[index - 1].trim()));

  assert.ok(chunks.length > 100, `expected many chunks, got ${chunks.length}`);
  assert.ok(broken.length <= 5, `${broken.length} chunks break mid-sentence`);
});

test("blocks keep their chunks for highlighting", () => {
  const blocks = splitIntoBlocks(speechText("# One\n\nFirst line.\nSecond line.\n\n## Two\n\nThird line."));
  assert.equal(blocks.flatMap((block) => block.chunks).length, blocks.reduce((n, block) => n + block.chunks.length, 0));
  assert.ok(blocks.every((block) => block.text.length > 0));
});

test("streamed answers split into sentences", () => {
  const { sentences, rest } = takeSentences("One thing. Two things. Three", false);
  assert.deepEqual(sentences, ["One thing.", "Two things."]);
  assert.equal(rest, "Three");
  assert.deepEqual(takeSentences("Trailing", true).sentences, ["Trailing"]);
});
