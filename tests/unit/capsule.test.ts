import { describe, expect, it } from 'vitest';
import {
  CURRENT_CAPSULE_VERSION,
  deserialiseVector,
  importCapsule,
  serialiseVector,
} from '@/lib/capsule';
import {
  extractMetadataFromChunks,
  generateSummaryFromChunks,
  resolveDocumentType,
} from '@/lib/agents/archivist';
import type { ChunkRecord } from '@/lib/db';

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
