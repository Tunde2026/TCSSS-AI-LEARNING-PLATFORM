// Splits text into overlapping chunks suitable for embedding.

const TARGET_CHARS  = 800;   // aim for this size per chunk
const MAX_CHARS     = 1400;  // never exceed
const OVERLAP_CHARS = 120;   // tail of previous chunk repeated at start of next

// Break text into paragraphs (blank-line separated).
function paragraphs(text) {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

// Break a paragraph into sentences (rough but effective for prose).
function sentences(paragraph) {
  // Split on . ! ? followed by whitespace or end of string.
  // Keep the punctuation attached to the sentence.
  const parts = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  return parts.map(s => s.trim()).filter(Boolean);
}

// Build chunks from a single paragraph's sentences.
function chunkParagraph(paragraph, chunks) {
  const sents = sentences(paragraph);
  if (!sents.length) return;

  let current = '';

  for (const s of sents) {
    // If adding this sentence would blow the max, flush first.
    if (current && (current.length + 1 + s.length) > MAX_CHARS) {
      chunks.push(current.trim());
      // Overlap: start the next chunk with the tail of the previous one.
      const tail = current.length > OVERLAP_CHARS
        ? current.slice(-OVERLAP_CHARS)
        : current;
      current = tail + ' ' + s;
    } else {
      current = current ? current + ' ' + s : s;
    }

    // If we hit the target size, flush proactively to avoid giant chunks.
    if (current.length >= TARGET_CHARS) {
      chunks.push(current.trim());
      const tail = current.length > OVERLAP_CHARS
        ? current.slice(-OVERLAP_CHARS)
        : current;
      current = tail;
    }
  }

  if (current.trim().length > 40) chunks.push(current.trim());
}

function chunkText(text) {
  const paras = paragraphs(text);
  const chunks = [];

  for (const p of paras) {
    // Very short paragraphs (headings, list items) get buffered with
    // the next one. We handle that by treating each paragraph on its
    // own for simplicity and letting tiny chunks be dropped.
    if (p.length < 40) continue;
    chunkParagraph(p, chunks);
  }

  // Deduplicate near-identical chunks and drop very short ones.
  const seen = new Set();
  return chunks
    .map(c => c.trim())
    .filter(c => c.length >= 50)
    .filter(c => {
      const key = c.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

module.exports = { chunkText, TARGET_CHARS, MAX_CHARS, OVERLAP_CHARS };