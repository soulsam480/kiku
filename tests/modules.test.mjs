import { test } from "node:test";
import assert from "node:assert/strict";
import { mapChunksToBlocks, invert } from "../src/mapping.js";
import { usableClip, usableTranscript } from "../src/guard.js";

const blocks = (...texts) => texts.map((textContent) => ({ textContent }));

test("chunks map to the block that contains their words", () => {
  const rendered = blocks("Layer The job Owners", "1. Capture Get the identity", "2. Routing Pick an owner");
  const mapping = mapChunksToBlocks(
    ["Table with 2 rows. Columns: Layer, The job, Owners.", "1. Capture. The job: Get the identity.", "2. Routing. The job: Pick an owner."],
    rendered,
  );

  assert.deepEqual(mapping, [0, 1, 2]);
});

test("the mapping never jumps backwards and stays put when nothing matches", () => {
  const rendered = blocks("alpha beta", "gamma delta");
  const mapping = mapChunksToBlocks(["gamma delta", "completely unrelated words", "alpha beta"], rendered);

  assert.equal(mapping[0], 1);
  assert.equal(mapping[1], 1, "unmatched chunk keeps the cursor");
  assert.equal(mapping[2], 0, "later block still wins if it scores higher inside the window");
});

test("inverting gives every block a starting chunk", () => {
  assert.deepEqual(invert([0, 0, 2], 4), [0, 2, 2, undefined]);
  assert.deepEqual(invert([0, 1], 2), [0, 1]);
  assert.deepEqual(invert([], 2), [undefined, undefined]);
});

test("silent and very short clips are rejected", () => {
  assert.equal(usableClip(new Float32Array(0)), false);
  assert.equal(usableClip(new Float32Array(1600)), false, "0.1s is too short");
  assert.equal(usableClip(new Float32Array(16000)), false, "digital silence");

  const speech = new Float32Array(16000);
  for (let index = 0; index < speech.length; index += 1) speech[index] = Math.sin(index / 8) * 0.2;
  assert.equal(usableClip(speech), true);
});

test("whisper hallucinations never reach the model", () => {
  for (const text of ["you", "Thank you.", "Thanks for watching!", "...", "okay"]) {
    assert.equal(usableTranscript(text), false, text);
  }

  for (const text of ["what is the main idea", "How does routing work?"]) {
    assert.equal(usableTranscript(text), true, text);
  }
});
