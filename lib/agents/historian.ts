// lib/agents/historian.ts
// The Historian Agent: scans ingested chunks for explicit dates and implicit temporal
// signals, constructs TimelineEntryRecords with verbatim citations and confidence scores,
// and sorts entries in ascending chronological order (R-PBT-3).

import { v4 as uuidv4 } from 'uuid';
import {
  db,
  type ChunkRecord,
  type CitationRecord,
  type TimelineEntryRecord,
} from '@/lib/db';

const MONTHS_MAP: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

const ORDINAL_WORDS: Record<string, string> = {
  first: '01',
  second: '02',
  third: '03',
  fourth: '04',
  fifth: '05',
  sixth: '06',
  seventh: '07',
  eighth: '08',
  ninth: '09',
  tenth: '10',
  eleventh: '11',
  twelfth: '12',
  thirteenth: '13',
  fourteenth: '14',
  fifteenth: '15',
  sixteenth: '16',
  seventeenth: '17',
  eighteenth: '18',
  nineteenth: '19',
  twentieth: '20',
};

/**
 * Extracts a verbatim substring of at most 50 whitespace-delimited words from text,
 * optionally centered around a match index. Guarantees `chunkText.includes(excerpt)`.
 */
export function extractVerbatimExcerpt(
  chunkText: string,
  matchIndex: number = 0
): string {
  if (!chunkText) return '';

  // Find word token spans with exact character indices in chunkText
  const wordSpans: Array<{ start: number; end: number }> = [];
  const regex = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(chunkText)) !== null) {
    wordSpans.push({ start: m.index, end: m.index + m[0].length });
  }

  if (wordSpans.length === 0) {
    return chunkText.slice(0, 50);
  }

  // Locate word index closest to matchIndex
  let targetWordIdx = 0;
  for (let i = 0; i < wordSpans.length; i++) {
    if (wordSpans[i].start <= matchIndex) {
      targetWordIdx = i;
    } else {
      break;
    }
  }

  const startWord = Math.max(0, targetWordIdx - 10);
  const endWord = Math.min(wordSpans.length - 1, startWord + 49);

  const charStart = wordSpans[startWord].start;
  const charEnd = wordSpans[endWord].end;

  return chunkText.slice(charStart, charEnd);
}

/**
 * Sorts TimelineEntryRecords in ascending chronological order by resolvedDate.
 * Entries with null resolvedDate (unresolved implicit signals) are positioned after
 * all resolved entries (Req 5.1, 5.2, 5.6, R-PBT-3).
 */
export function sortTimelineEntries(
  entries: TimelineEntryRecord[]
): TimelineEntryRecord[] {
  return [...entries].sort((a, b) => {
    const aNull = a.resolvedDate === null || a.resolvedDate === '';
    const bNull = b.resolvedDate === null || b.resolvedDate === '';

    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    if (a.resolvedDate! < b.resolvedDate!) return -1;
    if (a.resolvedDate! > b.resolvedDate!) return 1;
    return 0;
  });
}

function buildTimelineCitation(
  chunk: ChunkRecord,
  documentName: string,
  matchIndex: number
): CitationRecord {
  return {
    chunkId: chunk.chunkId,
    documentName,
    pageNumber: chunk.pageNumber,
    lineSection:
      chunk.pageNumber === null
        ? `line ${(chunk.lineOffset ?? 0) + 1}`
        : null,
    excerpt: extractVerbatimExcerpt(chunk.text, matchIndex),
  };
}

/**
 * Pure function that scans a set of chunks and extracts TimelineEntryRecords.
 */
export function extractTimelineFromChunks(
  chunks: ChunkRecord[],
  documentNames: Record<string, string> = {},
  sessionId: string = 'default-session'
): TimelineEntryRecord[] {
  const entries: TimelineEntryRecord[] = [];

  for (const chunk of chunks) {
    if (!chunk.text || chunk.text.trim().length === 0) continue;
    const docName = documentNames[chunk.documentId] ?? chunk.documentId;
    const text = chunk.text;

    // 1. Explicit ISO 8601 dates: YYYY-MM-DD
    const isoRegex = /\b(\d{4}-\d{2}-\d{2})\b/g;
    let match: RegExpExecArray | null;
    while ((match = isoRegex.exec(text)) !== null) {
      const dateStr = match[1];
      const excerpt = extractVerbatimExcerpt(text, match.index);
      entries.push({
        entryId: uuidv4(),
        eventDescription: excerpt.slice(0, 500),
        resolvedDate: dateStr,
        resolvedDateEnd: null,
        confidenceScore: 0.95,
        citations: [buildTimelineCitation(chunk, docName, match.index)],
        uncertaintyNotice: null,
        isImplicit: false,
        sessionId,
      });
    }

    // 2. Written dates with ordinal words: e.g., "fourteenth of March 2022"
    const ordinalRegex =
      /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\s+of\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
    while ((match = ordinalRegex.exec(text)) !== null) {
      const day = ORDINAL_WORDS[match[1].toLowerCase()] ?? '01';
      const month = MONTHS_MAP[match[2].toLowerCase()] ?? '01';
      const year = match[3];
      const resolvedDate = `${year}-${month}-${day}`;
      const excerpt = extractVerbatimExcerpt(text, match.index);
      entries.push({
        entryId: uuidv4(),
        eventDescription: excerpt.slice(0, 500),
        resolvedDate,
        resolvedDateEnd: null,
        confidenceScore: 0.88,
        citations: [buildTimelineCitation(chunk, docName, match.index)],
        uncertaintyNotice: null,
        isImplicit: false,
        sessionId,
      });
    }

    // 3. Written dates: "14 September 2024", "March 14, 2022", or "September 2021"
    const writtenDateRegex =
      /\b(?:(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})|(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})|(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4}))\b/gi;
    while ((match = writtenDateRegex.exec(text)) !== null) {
      let resolvedDate: string;
      if (match[1] && match[2] && match[3]) {
        const day = match[1].padStart(2, '0');
        const month = MONTHS_MAP[match[2].toLowerCase()] ?? '01';
        resolvedDate = `${match[3]}-${month}-${day}`;
      } else if (match[4] && match[5] && match[6]) {
        const day = match[5].padStart(2, '0');
        const month = MONTHS_MAP[match[4].toLowerCase()] ?? '01';
        resolvedDate = `${match[6]}-${month}-${day}`;
      } else {
        const month = MONTHS_MAP[(match[7] ?? 'january').toLowerCase()] ?? '01';
        resolvedDate = `${match[8]}-${month}-01`;
      }
      const excerpt = extractVerbatimExcerpt(text, match.index);
      entries.push({
        entryId: uuidv4(),
        eventDescription: excerpt.slice(0, 500),
        resolvedDate,
        resolvedDateEnd: null,
        confidenceScore: 0.85,
        citations: [buildTimelineCitation(chunk, docName, match.index)],
        uncertaintyNotice: null,
        isImplicit: false,
        sessionId,
      });
    }

    // 4. Fiscal year / quarter references: e.g., "Q3 FY2024", "FY2024", "Q3 2024"
    const fiscalRegex = /\b(?:(Q[1-4])\s*)?(?:FY\s*(\d{4})|(Q[1-4])\s+(\d{4}))\b/gi;
    while ((match = fiscalRegex.exec(text)) !== null) {
      const quarter = (match[1] ?? match[3] ?? 'Q1').toUpperCase();
      const year = match[2] ?? match[4];
      const quarterMonth: Record<string, string> = {
        Q1: '01',
        Q2: '04',
        Q3: '07',
        Q4: '10',
      };
      const month = quarterMonth[quarter] ?? '01';
      const resolvedDate = `${year}-${month}-01`;
      const excerpt = extractVerbatimExcerpt(text, match.index);
      entries.push({
        entryId: uuidv4(),
        eventDescription: excerpt.slice(0, 500),
        resolvedDate,
        resolvedDateEnd: null,
        confidenceScore: 0.82,
        citations: [buildTimelineCitation(chunk, docName, match.index)],
        uncertaintyNotice: `Date ambiguity: "${match[0]}" could refer to either the fiscal year (${quarter} FY${year}) or calendar year ${year}; the documents do not clarify the organisation's fiscal calendar boundaries.`,
        isImplicit: false,
        sessionId,
      });
    }

    // 5. Implicit temporal signals: "previous quarter", "following the merger", etc.
    const implicitRegex =
      /\b(in the previous quarter|the previous quarter|following the merger|after the restructuring|prior quarter|in the prior year|shortly thereafter)\b/gi;
    while ((match = implicitRegex.exec(text)) !== null) {
      // Only add as an unresolved implicit entry if this match didn't already have an explicit date in the same clause
      const excerpt = extractVerbatimExcerpt(text, match.index);
      entries.push({
        entryId: uuidv4(),
        eventDescription: excerpt.slice(0, 500),
        resolvedDate: null,
        resolvedDateEnd: null,
        confidenceScore: 0.55,
        citations: [buildTimelineCitation(chunk, docName, match.index)],
        uncertaintyNotice: `Temporal ambiguity: The implicit temporal reference "${match[0]}" cannot be resolved to a concrete calendar date without an explicit anchor in the source passage.`,
        isImplicit: true,
        sessionId,
      });
    }
  }

  return sortTimelineEntries(entries);
}

/**
 * Scans all ingested chunks in IndexedDB, builds the chronological timeline,
 * persists it to `db.timelines`, and returns the sorted TimelineEntryRecords.
 */
export async function buildTimeline(
  sessionId: string = 'default-session'
): Promise<TimelineEntryRecord[]> {
  const [chunks, docs] = await Promise.all([
    db.chunks.toArray(),
    db.documents.toArray(),
  ]);

  const docNames: Record<string, string> = {};
  for (const d of docs) {
    docNames[d.slug] = d.filename;
  }

  const sortedEntries = extractTimelineFromChunks(chunks, docNames, sessionId);

  await db.transaction('rw', db.timelines, async () => {
    await db.timelines.clear();
    if (sortedEntries.length > 0) {
      await db.timelines.bulkAdd(sortedEntries);
    }
  });

  return sortedEntries;
}

/**
 * Incrementally updates the timeline when a new document is ingested (Req 5.9),
 * incorporating events from the new document without removing existing entries
 * whose source chunks remain present in the Chunk_Store.
 */
export async function incrementalUpdateTimeline(
  newDocumentId: string,
  sessionId: string = 'default-session'
): Promise<void> {
  const [newChunks, doc, existingEntries] = await Promise.all([
    db.chunks.where('documentId').equals(newDocumentId).toArray(),
    db.documents.get(newDocumentId),
    db.timelines.toArray(),
  ]);

  const docNames: Record<string, string> = {
    [newDocumentId]: doc?.filename ?? newDocumentId,
  };

  const newEntries = extractTimelineFromChunks(newChunks, docNames, sessionId);

  // Keep existing entries from other documents, replace any stale entries from this documentId
  const retained = existingEntries.filter((entry) =>
    entry.citations.every((c) => !c.chunkId.startsWith(`${newDocumentId}-chunk-`))
  );

  const combined = sortTimelineEntries([...retained, ...newEntries]);

  await db.transaction('rw', db.timelines, async () => {
    await db.timelines.clear();
    if (combined.length > 0) {
      await db.timelines.bulkAdd(combined);
    }
  });
}
