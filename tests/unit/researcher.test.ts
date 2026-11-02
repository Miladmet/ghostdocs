import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildCitation,
  synthesiseAnswer,
  type ScoredChunk,
} from '@/lib/agents/researcher';
import type { ChunkRecord } from '@/lib/db';

function makeChunk(text: string, id: string = 'doc-chunk-0'): ChunkRecord {
  return {
    chunkId: id,
    documentId: 'doc',
    text,
    pageNumber: 1,
    lineOffset: 0,
    tokenCount: Math.max(1, text.trim().split(/\s+/).length),
    truncated: false,
    chunkIndex: 0,
    embeddingStatus: 'complete',
  };
}

describe('lib/agents/researcher.ts (Req 4.1–4.9, R-PBT-1, R-PBT-2, Property 10)', () => {
  it('returns insufficient evidence message and zero citations when max score <= 0.3 (Req 4.6)', () => {
    const chunks: ScoredChunk[] = [
      { ...makeChunk('Some unrelated text'), score: 0.25 },
    ];
    const ans = synthesiseAnswer('What is the Q3 budget?', chunks);
    expect(ans.citations).toHaveLength(0);
    expect(ans.synthesisedText).toMatch(/do not contain sufficient information/i);
    expect(ans.uncertaintyNotice).not.toBeNull();
  });

  it('Property 1 (R-PBT-1): Citation Integrity Round-Trip — citation.excerpt is always a verbatim substring of chunk.text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 2000 }),
        (rawText) => {
          const chunk = makeChunk(rawText);
          const citation = buildCitation(chunk, 0.85, 'sample.pdf');
          const wordCount =
            citation.excerpt.trim().length === 0
              ? 0
              : citation.excerpt.trim().split(/\s+/).length;
          return chunk.text.includes(citation.excerpt) && wordCount <= 50;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2 (R-PBT-2) & Property 10: confidenceScore is in [0.0, 1.0] and uncertaintyNotice is attached whenever score < 0.6', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.double({ min: 0.0, max: 1.0, noNaN: true }),
          { minLength: 1, maxLength: 5 }
        ),
        (scores) => {
          const scoredChunks: ScoredChunk[] = scores.map((s, idx) => ({
            ...makeChunk(`Passage number ${idx} about budget approval`, `doc-chunk-${idx}`),
            score: s,
          }));

          const answer = synthesiseAnswer('What is the budget?', scoredChunks);
          const inRange =
            answer.confidenceScore >= 0.0 && answer.confidenceScore <= 1.0;

          const uncertaintyValid =
            answer.confidenceScore < 0.6
              ? typeof answer.uncertaintyNotice === 'string' &&
                answer.uncertaintyNotice.length > 0
              : answer.uncertaintyNotice === null;

          return inRange && uncertaintyValid;
        }
      ),
      { numRuns: 100 }
    );
  });
});
