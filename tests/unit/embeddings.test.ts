import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EMBEDDING_MODEL, EmbeddingsService } from '@/lib/embeddings';

class MockWorker {
  listeners: Record<string, ((event: any) => void)[]> = {};
  messages: any[] = [];
  terminated = false;

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  postMessage(message: any) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  // Helper to simulate worker dispatching a message
  emitMessage(data: any) {
    const list = this.listeners['message'] || [];
    for (const cb of list) {
      cb({ data });
    }
  }

  emitError(error: any) {
    const list = this.listeners['error'] || [];
    for (const cb of list) {
      cb(error);
    }
  }
}

describe('lib/embeddings.ts', () => {
  let originalWorker: any;
  let activeMockWorker: MockWorker | null = null;

  beforeEach(() => {
    originalWorker = (globalThis as any).Worker;
    (globalThis as any).Worker = class extends MockWorker {
      constructor() {
        super();
        activeMockWorker = this;
      }
    };
  });

  afterEach(() => {
    (globalThis as any).Worker = originalWorker;
    activeMockWorker = null;
    vi.restoreAllMocks();
  });

  it('exports the default embedding model constant', () => {
    expect(DEFAULT_EMBEDDING_MODEL).toBe('ghostdocs-lexical-hash-384-v1');
  });

  describe('computeDeterministicEmbedding (offline lexical extractor)', () => {
    const samples = [
      'The board approved the Q3 budget on 14 September 2024.',
      'merger',
      'Following the merger, headcount grew by 12%.',
    ];

    async function load() {
      // The worker module registers a message listener on `self` at import time.
      vi.stubGlobal('self', { addEventListener: () => {}, postMessage: () => {} });
      const mod = await import('@/workers/embeddings.worker');
      vi.unstubAllGlobals();
      return mod;
    }

    it('is deterministic, 384-dimensional and L2-normalised', async () => {
      const { computeDeterministicEmbedding, EMBEDDING_MODEL_ID } = await load();
      expect(EMBEDDING_MODEL_ID).toBe(DEFAULT_EMBEDDING_MODEL);
      for (const text of samples) {
        const a = computeDeterministicEmbedding(text);
        const b = computeDeterministicEmbedding(text);
        expect(a).toHaveLength(384);
        expect(Array.from(a)).toEqual(Array.from(b));
        let sumSq = 0;
        for (const v of a) sumSq += v * v;
        expect(Math.abs(Math.sqrt(sumSq) - 1)).toBeLessThan(1e-5);
      }
    });
  });

  it('instantiates EmbeddingsService and tracks progress', () => {
    const service = new EmbeddingsService();
    const progressUpdates: Array<{ progress: number; status: string }> = [];

    service.onModelLoadProgress((progress, status) => {
      progressUpdates.push({ progress, status });
    });

    activeMockWorker?.emitMessage({
      type: 'MODEL_LOAD_PROGRESS',
      progress: 45,
      status: 'loading weights',
    });
    activeMockWorker?.emitMessage({
      type: 'MODEL_READY',
    });

    expect(progressUpdates).toHaveLength(2);
    expect(progressUpdates[0]).toEqual({ progress: 45, status: 'loading weights' });
    expect(progressUpdates[1]).toEqual({ progress: 100, status: 'ready' });

    service.terminate();
    expect(activeMockWorker?.terminated).toBe(true);
  });

  it('embedQuery resolves when worker returns EMBED_COMPLETE', async () => {
    const service = new EmbeddingsService();
    const mockVector = new Float32Array([0.1, 0.2, 0.3]);

    const queryPromise = service.embedQuery('test search query');

    expect(activeMockWorker?.messages).toHaveLength(1);
    const sent = activeMockWorker?.messages[0];
    expect(sent.type).toBe('EMBED_QUERY');
    expect(sent.queryText).toBe('test search query');

    activeMockWorker?.emitMessage({
      type: 'EMBED_COMPLETE',
      requestId: sent.requestId,
      vector: mockVector,
    });

    const result = await queryPromise;
    expect(result).toBe(mockVector);

    service.terminate();
  });

  it('embedQuery rejects when worker returns EMBED_ERROR', async () => {
    const service = new EmbeddingsService();
    const queryPromise = service.embedQuery('faulty query');

    const sent = activeMockWorker?.messages[0];
    activeMockWorker?.emitMessage({
      type: 'EMBED_ERROR',
      requestId: sent.requestId,
      message: 'Worker failed to compute vector',
    });

    await expect(queryPromise).rejects.toThrow('Worker failed to compute vector');
    service.terminate();
  });

  it('terminate rejects all pending queries', async () => {
    const service = new EmbeddingsService();
    const queryPromise = service.embedQuery('pending query');

    service.terminate();

    await expect(queryPromise).rejects.toThrow('EmbeddingsService terminated');
    expect(activeMockWorker?.terminated).toBe(true);
  });
});
