import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  extractTimelineFromChunks,
  sortTimelineEntries,
} from '@/lib/agents/historian';
import type { ChunkRecord, TimelineEntryRecord } from '@/lib/db';

describe('lib/agents/historian.ts (Req 5.1–5.8, R-PBT-3)', () => {
  const sampleChunks: ChunkRecord[] = [
    {
      chunkId: 'doc-1-chunk-0',
      documentId: 'doc-1',
      text: 'The project launched on 2023-06-15. Earlier, on the fourteenth of March 2022, the board met. During Q3 FY2024 the budget was reviewed. In the previous quarter, revenues fell.',
      pageNumber: 1,
      lineOffset: 0,
      tokenCount: 30,
      truncated: false,
      chunkIndex: 0,
      embeddingStatus: 'complete',
    },
    {
      chunkId: 'doc-2-chunk-0',
      documentId: 'doc-2',
      text: 'Following the merger in September 2021, on 14 September 2024 the policy was finalised.',
      pageNumber: null,
      lineOffset: 4,
      tokenCount: 15,
      truncated: false,
      chunkIndex: 0,
      embeddingStatus: 'complete',
    },
  ];

  it('extracts explicit ISO dates, written dates, fiscal references, and implicit signals with correct confidence bounds', () => {
    const entries = extractTimelineFromChunks(sampleChunks, {
      'doc-1': 'sample.pdf',
      'doc-2': 'sample.md',
    });

    expect(entries.length).toBeGreaterThanOrEqual(5);

    const explicitEntries = entries.filter((e) => !e.isImplicit);
    const implicitEntries = entries.filter((e) => e.isImplicit);

    expect(explicitEntries.every((e) => e.confidenceScore >= 0.8)).toBe(true);
    expect(implicitEntries.every((e) => e.confidenceScore < 0.8)).toBe(true);
    expect(implicitEntries.every((e) => e.uncertaintyNotice !== null)).toBe(true);

    // Fiscal year entry includes date ambiguity UncertaintyNotice (Req 5.4)
    const fiscalEntry = entries.find((e) => e.resolvedDate === '2024-07-01');
    expect(fiscalEntry).toBeDefined();
    expect(fiscalEntry?.uncertaintyNotice).toMatch(/fiscal/i);

    // Citation integrity (R-PBT-1) for timeline entries
    for (const entry of entries) {
      for (const citation of entry.citations) {
        const src = sampleChunks.find((c) => c.chunkId === citation.chunkId);
        expect(src?.text.includes(citation.excerpt)).toBe(true);
      }
    }
  });

  it('Property 3 (R-PBT-3): sortTimelineEntries produces ascending chronological order with null dates last', () => {
    const entryArb = fc.record<TimelineEntryRecord>({
      entryId: fc.uuid(),
      eventDescription: fc.string({ minLength: 1, maxLength: 100 }),
      resolvedDate: fc.option(
        fc
          .date({
            min: new Date('1990-01-01T00:00:00.000Z'),
            max: new Date('2035-12-31T00:00:00.000Z'),
            noInvalidDate: true,
          })
          .map((d) => d.toISOString().slice(0, 10)),
        { nil: null }
      ),
      resolvedDateEnd: fc.constant(null),
      confidenceScore: fc.double({ min: 0, max: 1, noNaN: true }),
      citations: fc.constant([]),
      uncertaintyNotice: fc.option(fc.string(), { nil: null }),
      isImplicit: fc.boolean(),
      sessionId: fc.constant('test-session'),
    });

    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 1, maxLength: 50 }), (entries) => {
        const sorted = sortTimelineEntries(entries);
        let seenNull = false;
        for (let i = 0; i < sorted.length; i++) {
          const cur = sorted[i].resolvedDate;
          if (cur === null) {
            seenNull = true;
          } else {
            if (seenNull) return false; // non-null cannot appear after null
            if (i > 0 && sorted[i - 1].resolvedDate !== null) {
              if (sorted[i - 1].resolvedDate! > cur) return false;
            }
          }
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  describe('overlap handling', () => {
    const mk = (text: string): ChunkRecord => ({
      chunkId: 'd-chunk-0',
      documentId: 'd',
      text,
      pageNumber: 1,
      lineOffset: 0,
      tokenCount: 10,
      truncated: false,
      chunkIndex: 0,
      embeddingStatus: 'complete',
    });

    it('ordinal date yields a single entry (no month-year duplicate)', () => {
      const entries = extractTimelineFromChunks([
        mk('On the fourteenth of March 2022 the board met.'),
      ]);
      expect(entries).toHaveLength(1);
      expect(entries[0].resolvedDate).toBe('2022-03-14');
    });

    it('day-month-year and month-day-year each yield a single full-date entry', () => {
      const a = extractTimelineFromChunks([mk('Approved on 14 September 2024.')]);
      expect(a).toHaveLength(1);
      expect(a[0].resolvedDate).toBe('2024-09-14');
      const b = extractTimelineFromChunks([mk('Signed March 14, 2022.')]);
      expect(b).toHaveLength(1);
      expect(b[0].resolvedDate).toBe('2022-03-14');
    });

    it('month-year plus implicit signal gives one explicit and one implicit entry', () => {
      const entries = extractTimelineFromChunks([
        mk('Following the merger in September 2021, staff moved.'),
      ]);
      const explicit = entries.filter((e) => !e.isImplicit);
      const implicit = entries.filter((e) => e.isImplicit);
      expect(explicit).toHaveLength(1);
      expect(explicit[0].resolvedDate).toBe('2021-09-01');
      expect(implicit).toHaveLength(1);
      expect(implicit[0].eventDescription.toLowerCase()).toContain('following the merger');
    });

    it('Property: exactly one explicit entry per embedded date phrase', () => {
      const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December',
      ];
      const ORDINALS = [
        'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth',
        'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth',
        'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
      ];
      const pad = (n: number): string => String(n).padStart(2, '0');
      const dateArb = fc
        .record({
          kind: fc.constantFrom('ordinal', 'dmy', 'mdy', 'iso'),
          day: fc.integer({ min: 1, max: 28 }),
          month: fc.integer({ min: 1, max: 12 }),
          year: fc.integer({ min: 1990, max: 2035 }),
        })
        .map(({ kind, day, month, year }) => {
          const mn = MONTH_NAMES[month - 1];
          const iso = `${year}-${pad(month)}-${pad(day)}`;
          const useOrdinal = kind === 'ordinal' && day <= 20;
          if (useOrdinal) {
            return { phrase: `${ORDINALS[day - 1]} of ${mn} ${year}`, iso };
          }
          if (kind === 'mdy') return { phrase: `${mn} ${day}, ${year}`, iso };
          if (kind === 'iso') return { phrase: iso, iso };
          return { phrase: `${day} ${mn} ${year}`, iso };
        });
      const fillerArb = fc.array(
        fc.constantFrom('the', 'board', 'met', 'report', 'was', 'signed', 'budget', 'staff', 'office'),
        { maxLength: 6 }
      );

      fc.assert(
        fc.property(fillerArb, fillerArb, dateArb, (before, after, d) => {
          const text = [...before, d.phrase, ...after].join(' ');
          const explicit = extractTimelineFromChunks([mk(text)]).filter((e) => !e.isImplicit);
          return explicit.length === 1 && explicit[0].resolvedDate === d.iso;
        }),
        { numRuns: 100 }
      );
    });
  });});
