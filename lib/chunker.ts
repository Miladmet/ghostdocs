// lib/chunker.ts
// Document chunker: splits parsed text into overlapping token windows.
//
// Token definition (from Req 1.5): a whitespace-delimited word.
// Window size: maxTokens (default 512), with overlapTokens (default 50) overlap.
// Satisfies:
//   R-PBT-5 (Chunk Size Invariant): 1 ≤ tokenCount ≤ 512
//   R-PBT-6 (Chunking Coverage Round-Trip): no content lost

import type { ParsedPage } from '@/workers/types';
import type { ChunkedOutput } from '@/workers/types';

export interface ChunkInput {
  slug: string;
  pages: ParsedPage[];
  maxTokens?: number;     // Default: 512
  overlapTokens?: number; // Default: 50
}

/**
 * Chunks all pages of a parsed document into overlapping token windows.
 *
 * @param input - The document pages and chunking parameters
 * @returns An ordered array of ChunkedOutput records
 */
export function chunkDocument(input: ChunkInput): ChunkedOutput[] {
  const { slug, pages, maxTokens = 512, overlapTokens = 50 } = input;

  if (maxTokens < 1) throw new Error('maxTokens must be ≥ 1');
  if (overlapTokens >= maxTokens) throw new Error('overlapTokens must be < maxTokens');

  const allChunks: ChunkedOutput[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    if (!page.text || page.text.trim().length === 0) continue;

    const tokens = page.text.split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length === 0) continue;

    let start = 0;

    while (start < tokens.length) {
      const end = Math.min(start + maxTokens, tokens.length);
      const windowTokens = tokens.slice(start, end);
      const text = windowTokens.join(' ');
      const tokenCount = windowTokens.length;

      allChunks.push({
        chunkId: `${slug}-chunk-${globalChunkIndex}`,
        documentId: slug,
        text,
        pageNumber: page.pageNumber,
        lineOffset: page.lineOffset,
        tokenCount,
        truncated: tokenCount === maxTokens && end < tokens.length,
        chunkIndex: globalChunkIndex,
      });

      globalChunkIndex++;

      // Advance by (maxTokens - overlapTokens) to create the overlap.
      // If we've reached the end of tokens, stop.
      if (end >= tokens.length) break;
      start += maxTokens - overlapTokens;
    }
  }

  return allChunks;
}

/**
 * Chunks a single token sequence (for testing or direct use).
 * Used when chunking is invoked directly without page structure.
 */
export function chunkText(
  text: string,
  slug: string,
  startIndex: number = 0,
  pageNumber: number | null = null,
  lineOffset: number | null = null,
  maxTokens: number = 512,
  overlapTokens: number = 50
): ChunkedOutput[] {
  return chunkDocument({
    slug,
    pages: [{ text, pageNumber, lineOffset: lineOffset ?? 0 }],
    maxTokens,
    overlapTokens,
  }).map((chunk) => ({ ...chunk, chunkIndex: chunk.chunkIndex + startIndex }));
}
