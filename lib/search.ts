// lib/search.ts
// Cosine similarity search over in-memory embedding vectors.
//
// Performance strategy: batch cosine similarity computations via
// requestIdleCallback to avoid blocking the main thread for > 50ms
// (Req 9.3–9.4). Each batch processes up to BATCH_SIZE embeddings.
//
// Satisfies:
//   R-PBT-4 (Cosine Similarity Range): result ∈ [-1.0, 1.0]
//   R-PBT-8 (Search Determinism): identical inputs → identical outputs

import type { EmbeddingRecord } from '@/lib/db';

/** A chunk ranked by cosine similarity to the query vector. */
export interface RankedChunk {
  chunkId: string;
  score: number; // Cosine similarity ∈ [-1.0, 1.0]
}

const BATCH_SIZE = 100;
const IDLE_CALLBACK_TIMEOUT_MS = 50;

/**
 * Computes the cosine similarity between two Float32Array vectors.
 *
 * Returns a value in [-1.0, 1.0]:
 *   1.0  → identical direction
 *   0.0  → orthogonal
 *  -1.0  → opposite direction
 *
 * If either vector has zero magnitude, returns 0.0 (not NaN/Infinity).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);

  if (magnitude === 0) return 0;

  // Clamp to [-1, 1] to correct for floating-point rounding errors
  return Math.max(-1, Math.min(1, dot / magnitude));
}

/**
 * Ranks all provided embeddings by cosine similarity to the query vector,
 * using requestIdleCallback batching to avoid blocking the main thread.
 *
 * Returns the top-N results (default: 10) in descending similarity order.
 * If fewer than N embeddings exist, returns all of them.
 *
 * @param query      - The query embedding vector
 * @param embeddings - All chunk embeddings to search against
 * @param topN       - Number of results to return (default: 10)
 * @param batchSize  - Number of embeddings per idle callback batch (default: 100)
 */
export function rankByCosine(
  query: Float32Array,
  embeddings: EmbeddingRecord[],
  topN: number = 10,
  batchSize: number = BATCH_SIZE
): Promise<RankedChunk[]> {
  return new Promise((resolve) => {
    const results: RankedChunk[] = [];
    let index = 0;

    function processBatch(deadline?: IdleDeadline): void {
      const limit = Math.min(index + batchSize, embeddings.length);

      while (index < limit) {
        const embedding = embeddings[index];
        const score = cosineSimilarity(query, embedding.vector);
        results.push({ chunkId: embedding.chunkId, score });
        index++;
      }

      if (index < embeddings.length) {
        // More batches to process — yield to the browser
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processBatch, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
        } else {
          // Fallback for environments without requestIdleCallback (e.g., tests)
          setTimeout(() => processBatch(), 0);
        }
      } else {
        // All embeddings processed — sort descending, take top N
        results.sort((a, b) => b.score - a.score);
        resolve(results.slice(0, topN));
      }
    }

    if (embeddings.length === 0) {
      resolve([]);
      return;
    }

    // Start first batch
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(processBatch, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
    } else {
      setTimeout(() => processBatch(), 0);
    }
  });
}
