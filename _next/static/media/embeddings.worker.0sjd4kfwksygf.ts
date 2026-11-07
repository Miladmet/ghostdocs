// workers/embeddings.worker.ts
// Web Worker handling document chunking (CHUNK_DOCUMENT) and
// local 384-dimensional embedding generation (EMBED_CHUNK, EMBED_QUERY).
//
// Embeddings come from a deterministic, hash-based LEXICAL feature extractor.
// It runs fully offline with no network requests and no model download.
// It is NOT a neural or semantic model: it matches on shared words, 4-char
// stems and character trigrams, and does not understand synonyms.

import { chunkDocument } from '../lib/chunker';
import type {
  EmbeddingsWorkerRequest,
  ChunkCompleteMessage,
  EmbedCompleteMessage,
  EmbedErrorMessage,
  ModelLoadProgressMessage,
  ModelReadyMessage,
} from './types';

export const EMBEDDING_MODEL_ID = 'ghostdocs-lexical-hash-384-v1';
const EMBEDDING_DIM = 384;

const STOPWORDS = new Set([
  'what',
  'when',
  'where',
  'who',
  'whom',
  'whose',
  'which',
  'why',
  'how',
  'did',
  'does',
  'do',
  'happened',
  'happen',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'the',
  'a',
  'an',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'about',
  'into',
  'across',
  'and',
  'or',
  'but',
  'that',
  'this',
  'these',
  'those',
]);

let modelReadyEmitted = false;

function fnv1a(str: string, seed: number = 2166136261): number {
  let h = seed | 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic 384-dimensional lexical feature extractor.
 *
 * Hashes each unique content word, its 4-char stem and its character trigrams
 * into a 384-slot vector, squashes with tanh, then L2-normalises. The same
 * input always yields the identical vector. Similarity reflects shared
 * words, stems and trigrams only; it is not neural and does not match
 * synonyms. Runs offline with zero network requests.
 */
export function computeDeterministicEmbedding(text: string): Float32Array {
  const vec = new Float32Array(EMBEDDING_DIM);
  const allTokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (allTokens.length === 0) {
    vec[0] = 1;
    return vec;
  }

  const contentTokens = allTokens.filter((w) => !STOPWORDS.has(w));
  const tokens = contentTokens.length > 0 ? contentTokens : allTokens;
  const uniqueTokens = Array.from(new Set(tokens));

  // Distribute each unique content token across multiple projections so short queries
  // and multi-sentence chunks that share key entities/dates achieve > 0.35 cosine similarity.
  const perTokenScale = 1 / Math.pow(uniqueTokens.length, 0.3);

  for (const token of uniqueTokens) {
    const isNumericOrDate = /^\d+$/.test(token);
    const weight = (isNumericOrDate ? 1.8 : 1.3) * perTokenScale;

    for (let proj = 0; proj < 8; proj++) {
      const h = fnv1a(token, 2166136261 + proj * 104729);
      const idx = h % EMBEDDING_DIM;
      vec[idx] += weight;
    }

    // Prefix / stem projection (first 4 chars)
    if (token.length >= 4) {
      const stem = token.slice(0, 4);
      for (let proj = 0; proj < 4; proj++) {
        const h = fnv1a(stem, 5381 + proj * 7919);
        const idx = h % EMBEDDING_DIM;
        vec[idx] += 0.6 * perTokenScale;
      }
    }

    // Character trigram projections
    for (let c = 0; c + 2 < token.length; c++) {
      const tri = token.slice(c, c + 3);
      const h = fnv1a(tri, 1315423911);
      const idx = h % EMBEDDING_DIM;
      vec[idx] += 0.35 * perTokenScale;
    }
  }

  // Saturate dimensions via tanh to damp dominant slots, then L2-normalise
  let mag = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] = Math.tanh(vec[i]);
    mag += vec[i] * vec[i];
  }
  mag = Math.sqrt(mag);
  if (mag > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vec[i] = vec[i] / mag;
    }
  }
  return vec;
}

function ensureModelReady(): void {
  if (modelReadyEmitted) return;
  modelReadyEmitted = true;

  const progressMsg: ModelLoadProgressMessage = {
    type: 'MODEL_LOAD_PROGRESS',
    progress: 100,
    status: 'ready',
  };
  self.postMessage(progressMsg);

  const readyMsg: ModelReadyMessage = { type: 'MODEL_READY' };
  self.postMessage(readyMsg);
}

async function generateVector(text: string): Promise<Float32Array> {
  ensureModelReady();
  return computeDeterministicEmbedding(text);
}

self.addEventListener(
  'message',
  async (event: MessageEvent<EmbeddingsWorkerRequest>) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'CHUNK_DOCUMENT': {
        const chunks = chunkDocument({
          slug: msg.slug,
          pages: msg.pages,
          maxTokens: msg.maxTokens ?? 512,
          overlapTokens: msg.overlapTokens ?? 50,
        });
        const response: ChunkCompleteMessage = {
          type: 'CHUNK_COMPLETE',
          slug: msg.slug,
          chunks,
        };
        self.postMessage(response);
        break;
      }

      case 'EMBED_CHUNK': {
        try {
          const vector = await generateVector(msg.text);
          const response: EmbedCompleteMessage = {
            type: 'EMBED_COMPLETE',
            chunkId: msg.chunkId,
            vector,
          };
          self.postMessage(response, { transfer: [vector.buffer] });
        } catch (err) {
          const errorMsg: EmbedErrorMessage = {
            type: 'EMBED_ERROR',
            chunkId: msg.chunkId,
            errorCode: 'INFERENCE_FAILED',
            message:
              err instanceof Error ? err.message : 'Chunk embedding failed',
          };
          self.postMessage(errorMsg);
        }
        break;
      }

      case 'EMBED_QUERY': {
        try {
          const vector = await generateVector(msg.queryText);
          const response: EmbedCompleteMessage = {
            type: 'EMBED_COMPLETE',
            requestId: msg.requestId,
            vector,
          };
          self.postMessage(response, { transfer: [vector.buffer] });
        } catch (err) {
          const errorMsg: EmbedErrorMessage = {
            type: 'EMBED_ERROR',
            requestId: msg.requestId,
            errorCode: 'INFERENCE_FAILED',
            message:
              err instanceof Error ? err.message : 'Query embedding failed',
          };
          self.postMessage(errorMsg);
        }
        break;
      }
    }
  }
);
