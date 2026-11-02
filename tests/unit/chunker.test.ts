import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { chunkDocument, chunkText } from '@/lib/chunker';

describe('lib/chunker.ts (Req 1.5, R-PBT-5, R-PBT-6)', () => {
  it('handles a single-token document', () => {
    const chunks = chunkText('GhostDocs', 'doc-1');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBe(1);
    expect(chunks[0].text).toBe('GhostDocs');
    expect(chunks[0].truncated).toBe(false);
  });

  it('handles an exact 512-token document in a single chunk', () => {
    const words = Array.from({ length: 512 }, (_, i) => `word${i}`);
    const chunks = chunkText(words.join(' '), 'doc-512');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBe(512);
    expect(chunks[0].truncated).toBe(false);
  });

  it('produces overlapping windows with 50-token overlap for >512 tokens', () => {
    const words = Array.from({ length: 600 }, (_, i) => `tok${i}`);
    const chunks = chunkText(words.join(' '), 'doc-600', 0, 1, 0, 512, 50);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].tokenCount).toBe(512);
    expect(chunks[0].truncated).toBe(true);
    expect(chunks[1].tokenCount).toBe(600 - (512 - 50));
    // Verify 50-token overlap
    const firstChunkTokens = chunks[0].text.split(' ');
    const secondChunkTokens = chunks[1].text.split(' ');
    expect(secondChunkTokens.slice(0, 50)).toEqual(firstChunkTokens.slice(462, 512));
  });

  it('throws on invalid maxTokens or overlapTokens', () => {
    expect(() =>
      chunkDocument({ slug: 'x', pages: [], maxTokens: 0, overlapTokens: 0 })
    ).toThrow();
    expect(() =>
      chunkDocument({ slug: 'x', pages: [], maxTokens: 10, overlapTokens: 10 })
    ).toThrow();
  });

  it('Property 5 (R-PBT-5): every chunk has 1 <= tokenCount <= 512', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }),
        (rawText) => {
          const text = rawText.trim().length > 0 ? rawText : 'fallbacktoken';
          const chunks = chunkText(text, 'pbt-slug', 0, 1, 0, 512, 50);
          return (
            chunks.length >= 1 &&
            chunks.every((c) => c.tokenCount >= 1 && c.tokenCount <= 512)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 6 (R-PBT-6): chunking coverage round-trip preserves all non-whitespace characters', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.stringMatching(/^[A-Za-z0-9]{1,12}$/),
          { minLength: 1, maxLength: 1200 }
        ),
        (words) => {
          const originalText = words.join(' ');
          const chunks = chunkText(originalText, 'cov-slug', 0, 1, 0, 512, 50);
          const joinedNoWs = chunks
            .map((c) => c.text)
            .join('')
            .replace(/\s+/g, '');
          const origNoWs = originalText.replace(/\s+/g, '');
          // Every word from originalText is present in at least one chunk
          return (
            joinedNoWs.length >= origNoWs.length &&
            words.every((w) => chunks.some((c) => c.text.includes(w)))
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
