// lib/embeddings.ts
// Main-thread wrapper for the embeddings Web Worker.
//
// Embedding implementation: offline deterministic lexical feature extractor
// (see computeDeterministicEmbedding in workers/embeddings.worker.ts).
//   - 384-dimensional, L2-normalised output vectors
//   - Hash-based features from words, 4-char stems and character trigrams
//   - No model download, no network requests, identical results online/offline
//   - NOT a neural/semantic model: it matches shared lexical features and
//     does not understand synonyms
//
// The onModelLoadProgress API is retained for protocol compatibility; the
// worker reports 'ready' immediately because there is nothing to download.
//
// Usage pattern:
//   const service = new EmbeddingsService();
//   service.onModelLoadProgress((progress, status) => console.log(progress, status));
//   const vector = await service.embedQuery('What is the Q3 budget?');

import { v4 as uuidv4 } from 'uuid';
import type {
  EmbeddingsWorkerRequest,
  EmbeddingsWorkerMessage,
  EmbedCompleteMessage,
  EmbedErrorMessage,
} from '@/workers/types';

/** Identifier of the offline lexical feature extractor; matches EMBEDDING_MODEL_ID in the worker. */
export const DEFAULT_EMBEDDING_MODEL = 'ghostdocs-lexical-hash-384-v1';

/** Timeout for a single embed query (Req 4.10: 10 seconds). */
const EMBED_TIMEOUT_MS = 10_000;

type ProgressCallback = (progress: number, status: string) => void;

/**
 * Main-thread service that wraps the embeddings Web Worker.
 * Manages the worker lifecycle, routes messages, and exposes a clean async API.
 *
 * Must be instantiated inside a browser context (not during SSR).
 */
export class EmbeddingsService {
  private worker: Worker;
  private pendingRequests = new Map<
    string,
    {
      resolve: (vector: Float32Array) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private progressCallbacks: ProgressCallback[] = [];

  constructor() {
    // Instantiate the worker. The URL must be relative to this file.
    // Next.js (and bundlers) resolve `new URL(...)` at build time.
    this.worker = new Worker(
      new URL('../workers/embeddings.worker.ts', import.meta.url)
    );
    this.worker.addEventListener('message', this.handleMessage.bind(this));
    this.worker.addEventListener('error', (e) => {
      console.error('[EmbeddingsService] Worker error:', e);
    });
  }

  /**
   * Register a callback to receive model load progress updates.
   * Called with progress (0–100) and a human-readable status string.
   */
  onModelLoadProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Embeds a query string and returns a Float32Array vector.
   * Rejects with an error if the worker fails or does not respond within 10s.
   */
  embedQuery(queryText: string): Promise<Float32Array> {
    const requestId = uuidv4();

    return new Promise<Float32Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Embedding query timed out after ${EMBED_TIMEOUT_MS}ms`));
      }, EMBED_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      const request: EmbeddingsWorkerRequest = {
        type: 'EMBED_QUERY',
        requestId,
        queryText,
      };
      this.worker.postMessage(request);
    });
  }

  /**
   * Terminate the worker and clean up all pending requests.
   * Call this when the parent component unmounts.
   */
  terminate(): void {
    for (const { reject, timer } of this.pendingRequests.values()) {
      clearTimeout(timer);
      reject(new Error('EmbeddingsService terminated'));
    }
    this.pendingRequests.clear();
    this.worker.terminate();
  }

  private handleMessage(event: MessageEvent<EmbeddingsWorkerMessage>): void {
    const msg = event.data;

    switch (msg.type) {
      case 'MODEL_LOAD_PROGRESS':
        for (const cb of this.progressCallbacks) {
          cb(msg.progress, msg.status);
        }
        break;

      case 'MODEL_READY':
        for (const cb of this.progressCallbacks) {
          cb(100, 'ready');
        }
        break;

      case 'EMBED_COMPLETE': {
        const { requestId, vector } = msg as EmbedCompleteMessage;
        if (requestId) {
          const pending = this.pendingRequests.get(requestId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(requestId);
            pending.resolve(vector);
          }
        }
        break;
      }

      case 'EMBED_ERROR': {
        const { requestId, message } = msg as EmbedErrorMessage;
        if (requestId) {
          const pending = this.pendingRequests.get(requestId);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(requestId);
            pending.reject(new Error(message));
          }
        }
        break;
      }

      // CHUNK_COMPLETE is handled by the orchestrator directly, not here
      case 'CHUNK_COMPLETE':
        break;

      default:
        break;
    }
  }
}
