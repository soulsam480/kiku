/** Map the text that was spoken onto the markdown blocks that were rendered. */

const wordsOf = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * Map each spoken chunk onto the rendered block that contains it, so the reader can
 * highlight where narration is even though the audio text is normalised.
 *
 * Blocks are scored by the *distinctive* words they share with the chunk (rare words
 * count for more), and only a small window around the cursor is considered. Synthetic
 * narration such as "Table with 6 rows. Columns: …" therefore lands on the table
 * itself instead of drifting to some later paragraph.
 *
 * @param {string[]} chunkTexts
 * @param {Array<{textContent: string}>} blocks
 * @returns {number[]} block index per chunk
 */
export function mapChunksToBlocks(chunkTexts, blocks) {
  const blockWords = blocks.map((block) => new Set(wordsOf(block.textContent)));

  const frequency = new Map();
  for (const words of blockWords) {
    for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const weight = (word) => 1 / (frequency.get(word) ?? 1);

  const mapping = [];
  let cursor = 0;

  for (const chunk of chunkTexts) {
    const words = [...new Set(wordsOf(chunk))];
    const from = Math.max(0, cursor - 2);
    const to = Math.min(blocks.length - 1, cursor + 8);

    let best = cursor;
    let bestScore = 0;

    for (let block = from; block <= to; block += 1) {
      let score = 0;
      for (const word of words) {
        if (blockWords[block].has(word)) score += weight(word);
      }
      if (score > bestScore) {
        bestScore = score;
        best = block;
      }
    }

    mapping.push(bestScore > 0 ? best : cursor);
    cursor = best;
  }

  return mapping;
}

/**
 * Reverse the chunk mapping: for every rendered block, the chunk narration should
 * start at. Blocks the narrator skips (code, images) fall through to the next one.
 *
 * @param {number[]} chunkBlock
 * @param {number} blockCount
 * @returns {Array<number | undefined>}
 */
export function invert(chunkBlock, blockCount) {
  const blockChunk = new Array(blockCount).fill(undefined);

  chunkBlock.forEach((block, chunk) => {
    if (blockChunk[block] === undefined) blockChunk[block] = chunk;
  });

  let next;
  for (let block = blockCount - 1; block >= 0; block -= 1) {
    if (blockChunk[block] === undefined) blockChunk[block] = next;
    else next = blockChunk[block];
  }

  return blockChunk;
}
