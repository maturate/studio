const TARGET_CHUNK_CHARS = 1400;
const OVERLAP_CHARS = 150;

/**
 * Paragraph-aware chunker: merges paragraphs up to a target size, splitting
 * any single oversized paragraph, and carries a small tail of overlap
 * forward so a fact split across a chunk boundary isn't lost from either
 * side's context.
 */
export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    if (para.length > TARGET_CHUNK_CHARS) {
      flush();
      for (let i = 0; i < para.length; i += TARGET_CHUNK_CHARS) {
        chunks.push(para.slice(i, i + TARGET_CHUNK_CHARS));
      }
      continue;
    }

    if (current.length + para.length + 2 > TARGET_CHUNK_CHARS) {
      flush();
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  flush();

  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prevTail = chunks[i - 1]!.slice(-OVERLAP_CHARS);
    return `${prevTail}\n\n${chunk}`;
  });
}
