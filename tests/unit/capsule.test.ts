import { describe, expect, it, vi } from 'vitest';
import {
  CURRENT_CAPSULE_VERSION,
  createCapsule,
  deserialiseVector,
  exportCapsule,
  importCapsule,
  serialiseVector,
} from '@/lib/capsule';
import {
  extractMetadataFromChunks,
  generateSummaryFromChunks,
  resolveDocumentType,
} from '@/lib/agents/archivist';
import { db, type ChunkRecord } from '@/lib/db';

describe('lib/capsule.ts & lib/agents/archivist.ts (Req 2.1–2.8)', () => {
  it('round-trips Float32Array vectors through number[] JSON serialisation', () => {
    const original = new Float32Array([0.125, -0.5, 0.875, 0.0, 1.0]);
    const json = JSON.stringify(serialiseVector(original));
    const restored = deserialiseVector(JSON.parse(json) as number[]);

    expect(restored).toBeInstanceOf(Float32Array);
    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i], 6);
    }
  });

  it('rejects malformed JSON before touching IndexedDB (Req 2.4)', async () => {
    await expect(importCapsule('{ not valid json ')).rejects.toThrow(
      /Malformed Time Capsule/i
    );
  });

  it('rejects capsules with missing or invalid schema fields (Req 2.4)', async () => {
    await expect(
      importCapsule(JSON.stringify({ capsuleVersion: 1 }))
    ).rejects.toThrow(/Invalid Time Capsule schema/i);
  });

  it('rejects capsules with capsuleVersion > CURRENT_CAPSULE_VERSION (Req 2.6)', async () => {
    const futureCapsule = {
      capsuleId: 'cap-999',
      capsuleVersion: CURRENT_CAPSULE_VERSION + 10,
      createdAt: Date.now(),
      documentCount: 0,
      exportFilename: 'ghostdocs-capsule-2026-11-01.json',
      bundledData: {
        documents: [],
        chunks: [],
        embeddings: [],
        timelineEntries: [],
      },
    };

    await expect(importCapsule(JSON.stringify(futureCapsule))).rejects.toThrow(
      /newer application version/i
    );
  });

  it('rejects capsules with invalid document record or chunk record structure', async () => {
    const invalidDocCapsule = {
      capsuleId: 'cap-1',
      capsuleVersion: CURRENT_CAPSULE_VERSION,
      createdAt: Date.now(),
      documentCount: 1,
      exportFilename: 'test.json',
      bundledData: {
        documents: [{ noSlug: true }],
        chunks: [],
        embeddings: [],
        timelineEntries: [],
      },
    };
    await expect(importCapsule(JSON.stringify(invalidDocCapsule))).rejects.toThrow(
      /Document record missing string slug/i
    );

    const invalidChunkCapsule = {
      capsuleId: 'cap-2',
      capsuleVersion: CURRENT_CAPSULE_VERSION,
      createdAt: Date.now(),
      documentCount: 1,
      exportFilename: 'test.json',
      bundledData: {
        documents: [{ slug: 'valid-slug' }],
        chunks: [{ noChunkId: true }],
        embeddings: [],
        timelineEntries: [],
      },
    };
    await expect(importCapsule(JSON.stringify(invalidChunkCapsule))).rejects.toThrow(
      /Chunk record missing string chunkId/i
    );
  });

  it('creates and exports a Time Capsule from stored documents', async () => {
    vi.spyOn(db.documents, 'toArray').mockResolvedValue([
      {
        slug: 'doc-1',
        filename: 'doc-1.md',
        mimeType: 'text/markdown',
        sizeBytes: 100,
        status: 'complete',
        metadata: { title: 'Doc 1', detectedDate: null, author: null, documentType: 'markdown' },
        summary: 'Summary 1',
        ingestedAt: 123456789,
        pageCount: null,
        skippedPages: [],
        errorMessage: null,
      },
    ]);
    vi.spyOn(db.chunks, 'toArray').mockResolvedValue([
      {
        chunkId: 'doc-1-chunk-0',
        documentId: 'doc-1',
        text: 'This is the document content for testing export.',
        pageNumber: null,
        lineOffset: 0,
        tokenCount: 8,
        truncated: false,
        chunkIndex: 0,
        embeddingStatus: 'complete',
      },
    ]);
    vi.spyOn(db.embeddings, 'toArray').mockResolvedValue([
      {
        chunkId: 'doc-1-chunk-0',
        vector: new Float32Array([0.1, 0.2, 0.3]),
      },
    ]);
    vi.spyOn(db.timelines, 'toArray').mockResolvedValue([]);
    vi.spyOn(db.capsules, 'put').mockResolvedValue('cap-1' as any);
    vi.spyOn(db.documents, 'put').mockResolvedValue('doc-1' as any);
    vi.spyOn(db.capsules, 'get').mockResolvedValue(undefined);

    const capsule = await createCapsule();
    expect(capsule.capsuleVersion).toBe(CURRENT_CAPSULE_VERSION);
    expect(capsule.documentCount).toBe(1);
    expect(capsule.bundledData.embeddings[0].vector.length).toBe(3);

    const exportedJson = await exportCapsule('cap-1');
    expect(JSON.parse(exportedJson).capsuleVersion).toBe(CURRENT_CAPSULE_VERSION);
  });

  it('extracts metadata and generates summaries for >=20 words vs <20 words (Req 2.7–2.8)', () => {
    expect(resolveDocumentType('application/pdf', 'a.pdf')).toBe('pdf');
    expect(resolveDocumentType('text/markdown', 'a.md')).toBe('markdown');
    expect(resolveDocumentType('text/plain', 'a.txt')).toBe('plaintext');

    const shortChunk: ChunkRecord = {
      chunkId: 's-0',
      documentId: 's',
      text: 'Too short to summarise.',
      pageNumber: 1,
      lineOffset: 0,
      tokenCount: 4,
      truncated: false,
      chunkIndex: 0,
      embeddingStatus: 'complete',
    };
    expect(generateSummaryFromChunks([shortChunk])).toBeNull();

    const longWords = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const fullChunk: ChunkRecord = {
      ...shortChunk,
      text: `# Quarterly Report\nAuthor: Clara Vance\nPublished on 2023-06-15.\n${longWords}`,
      tokenCount: 50,
    };

    const meta = extractMetadataFromChunks([fullChunk], 'application/pdf', 'report.pdf');
    expect(meta.title).toBe('Quarterly Report');
    expect(meta.author).toBe('Clara Vance');
    expect(meta.detectedDate).toBe('2023-06-15');
    expect(meta.documentType).toBe('pdf');

    const summary = generateSummaryFromChunks([fullChunk]);
    expect(summary).not.toBeNull();
    expect(summary!.split(/\s+/).length).toBeGreaterThanOrEqual(20);
  });
});
