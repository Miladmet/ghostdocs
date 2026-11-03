import { describe, expect, it } from 'vitest';
import {
  extractMetadataFromChunks,
  generateSummaryFromChunks,
  resolveDocumentType,
} from '@/lib/agents/archivist';
import type { ChunkRecord } from '@/lib/db';

function makeChunk(text: string, index = 0): ChunkRecord {
  return {
    chunkId: `chunk-${index}`,
    documentId: 'doc-1',
    text,
    pageNumber: 1,
    lineOffset: 0,
    tokenCount: text.split(/\s+/).filter(Boolean).length,
    truncated: false,
    chunkIndex: index,
    embeddingStatus: 'complete',
  };
}

describe('lib/agents/archivist.ts', () => {
  describe('resolveDocumentType', () => {
    it('identifies pdf from MIME or extension', () => {
      expect(resolveDocumentType('application/pdf', 'doc.pdf')).toBe('pdf');
      expect(resolveDocumentType('application/octet-stream', 'manual.PDF')).toBe('pdf');
      expect(resolveDocumentType('application/pdf', '')).toBe('pdf');
    });

    it('identifies markdown from MIME or extension', () => {
      expect(resolveDocumentType('text/markdown', 'notes.md')).toBe('markdown');
      expect(resolveDocumentType('text/x-markdown', 'readme.markdown')).toBe('markdown');
      expect(resolveDocumentType('application/octet-stream', 'doc.md')).toBe('markdown');
    });

    it('falls back to plaintext', () => {
      expect(resolveDocumentType('text/plain', 'notes.txt')).toBe('plaintext');
      expect(resolveDocumentType('application/octet-stream', 'data.dat')).toBe('plaintext');
    });
  });

  describe('extractMetadataFromChunks', () => {
    it('extracts Markdown heading as title', () => {
      const chunk = makeChunk('# GhostDocs Architecture Design\nThis document outlines the architecture.');
      const meta = extractMetadataFromChunks([chunk], 'text/markdown', 'arch.md');
      expect(meta.title).toBe('GhostDocs Architecture Design');
    });

    it('detects ISO 8601 dates', () => {
      const chunk = makeChunk('Meeting held on 2026-11-02 to discuss specifications.');
      const meta = extractMetadataFromChunks([chunk]);
      expect(meta.detectedDate).toBe('2026-11-02');
    });

    it('detects written dates', () => {
      const chunk = makeChunk("Schwab's speech on the night of December 12, 1900, carried the inference.");
      const meta = extractMetadataFromChunks([chunk]);
      expect(meta.detectedDate).toBe('1900-12-12');
    });

    it('extracts author with "Author:" prefix and normalizes case', () => {
      const chunk = makeChunk('Author: ALBERT EINSTEIN\nGeneral relativity notes.');
      const meta = extractMetadataFromChunks([chunk]);
      expect(meta.author).toBe('Albert Einstein');
    });

    it('extracts author from "PHOTO OF THE AUTHOR, NAPOLEON HILL"', () => {
      const chunk = makeChunk('PHOTO OF THE AUTHOR, NAPOLEON HILL\nThink and grow rich.');
      const meta = extractMetadataFromChunks([chunk]);
      expect(meta.author).toBe('Napoleon Hill');
    });

    it('extracts author from "Written by" and "By: "', () => {
      const chunk1 = makeChunk('Written by Arthur Conan Doyle\nA Study in Scarlet.');
      expect(extractMetadataFromChunks([chunk1]).author).toBe('Arthur Conan Doyle');

      const chunk2 = makeChunk('By: Evelyn Cross\nQuarterly financial review.');
      expect(extractMetadataFromChunks([chunk2]).author).toBe('Evelyn Cross');
    });

    it('rejects procedural sentences or noise as author', () => {
      const chunk = makeChunk('By step recap of chapter three\nContent follows.');
      expect(extractMetadataFromChunks([chunk]).author).toBeNull();

      const chunkLong = makeChunk('By a very long descriptive phrase that exceeds four words completely.');
      expect(extractMetadataFromChunks([chunkLong]).author).toBeNull();
    });

    it('handles empty chunks gracefully', () => {
      const meta = extractMetadataFromChunks([], 'text/plain', 'empty.txt');
      expect(meta.title).toBeNull();
      expect(meta.author).toBeNull();
      expect(meta.detectedDate).toBeNull();
      expect(meta.documentType).toBe('plaintext');
    });
  });

  describe('generateSummaryFromChunks', () => {
    it('returns null if fewer than 20 words exist', () => {
      const chunk = makeChunk('This is a very short text with under twenty words.');
      expect(generateSummaryFromChunks([chunk])).toBeNull();
    });

    it('generates summary capped at 200 words for larger content', () => {
      const words = Array.from({ length: 250 }, (_, i) => `word${i}`);
      const chunk = makeChunk(words.join(' '));
      const summary = generateSummaryFromChunks([chunk]);
      expect(summary).not.toBeNull();
      const count = summary!.split(/\s+/).length;
      expect(count).toBe(200);
      expect(summary).toContain('word0');
      expect(summary).toContain('word199');
      expect(summary).not.toContain('word200');
    });
  });
});
