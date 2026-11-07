import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildCitation,
  extractExcerptAround,
  findRelevantSpan,
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

  describe('citation excerpt anchoring', () => {
    const wc = (s: string) => s.trim().split(/\s+/).length;

    it('centres the excerpt on the relevant sentence located late in a long chunk', () => {
      const filler = Array.from({ length: 10 }, (_, i) =>
        `Filler sentence number ${i} talks about unrelated office matters today.`
      ).join(' ');
      const target = 'The board approved the budget on 14 September after review.';
      const chunk = makeChunk(`${filler} ${target}`);
      expect(wc(chunk.text)).toBeGreaterThan(100);
      const ans = synthesiseAnswer('When was the budget approved in September?', [
        { ...chunk, score: 0.9 },
      ]);
      const excerpt = ans.citations[0].excerpt;
      expect(excerpt).toContain(target);
      expect(chunk.text.includes(excerpt)).toBe(true);
      expect(wc(excerpt)).toBeLessThanOrEqual(50);
      expect(ans.synthesisedText).toContain(excerpt);
    });

    it('returns exactly the first 50 words when the sentence exceeds 50 words', () => {
      const words = Array.from({ length: 80 }, (_, i) => `word${i}`);
      const text = `${words.join(' ')}.`;
      const chunk = makeChunk(text);
      const citation = buildCitation(chunk, 0.9, 'd.txt', 'word70 word71');
      expect(citation.excerpt).toBe(words.slice(0, 50).join(' '));
      expect(chunk.text.includes(citation.excerpt)).toBe(true);
    });

    it('extractExcerptAround / findRelevantSpan stay verbatim and bounded', () => {
      const text = 'Alpha beta gamma delta epsilon. Zeta budget september eta theta.';
      const span = findRelevantSpan(text, 'budget september');
      expect(text.slice(span.start, span.end)).toBe('Zeta budget september eta theta.');
      expect(extractExcerptAround(text, span, 5)).toBe('Zeta budget september eta theta.');
    });

    it('Property: excerpts are verbatim, <= 50 words, and quoted in the answer', () => {
      const word = fc.stringMatching(/^[a-z]{3,8}$/);
      const sentence = fc
        .array(word, { minLength: 3, maxLength: 20 })
        .map((ws) => `${ws.join(' ')}.`);
      fc.assert(
        fc.property(
          fc.array(sentence, { minLength: 3, maxLength: 15 }),
          fc.nat(),
          (sentences, pick) => {
            const chunk = makeChunk(sentences.join(' '));
            const src = sentences[pick % sentences.length].replace('.', '').split(' ');
            const question = `what about ${src.slice(0, 3).join(' ')}`;
            const ans = synthesiseAnswer(question, [{ ...chunk, score: 0.9 }]);
            const c = ans.citations[0];
            return (
              chunk.text.includes(c.excerpt) &&
              wc(c.excerpt) <= 50 &&
              ans.synthesisedText.includes(`"${c.excerpt}"`)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });});
