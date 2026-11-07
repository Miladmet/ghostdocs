// lib/agents/researcher.ts
// The Researcher Agent: synthesises source-cited answers exclusively from the top-5
// retrieved chunks (zero hallucination, Req 4.7), computes confidence scores, and
// attaches plain-language uncertainty notices when confidence < 0.6.

import { v4 as uuidv4 } from 'uuid';
import type { AnswerRecord, ChunkRecord, CitationRecord } from '@/lib/db';

export type ScoredChunk = ChunkRecord & { score: number };

const QUERY_STOPWORDS = new Set([
  'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'happened', 'happen', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'about', 'tell', 'me', 'about', 'explain'
]);

/**
 * Extracts question keywords (filtering stopwords).
 */
function getQuestionKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !QUERY_STOPWORDS.has(w));
}

/**
 * Scores how well a text matches question keywords, giving bonus to exact number/date/entity matches.
 */
function scoreSentenceRelevance(sentence: string, keywords: string[]): number {
  const sLower = sentence.toLowerCase();
  let score = 0;
  for (const k of keywords) {
    if (sLower.includes(k)) {
      // Extra weight for numbers / dates (e.g. "12", "1900", "december")
      const isDateOrNumber = /^\d+$/.test(k) || ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].includes(k);
      score += isDateOrNumber ? 3 : 1;
    }
  }
  return score;
}

/**
 * Returns the character span of the single most relevant sentence in `text`
 * (scored by question keywords). Falls back to the first sentence, or the
 * whole text when no sentence can be identified. Never joins sentences.
 */
export function findRelevantSpan(text: string, question: string): { start: number; end: number } {
  if (!text) return { start: 0, end: 0 };
  const keywords = getQuestionKeywords(question);

  const spans: { start: number; end: number }[] = [];
  const re = /\S[\s\S]*?(?:[.!?\n]+(?=\s|$)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    const raw = m[0];
    const trimmed = raw.replace(/\s+$/, '');
    if (trimmed.length > 10) {
      spans.push({ start: m.index, end: m.index + trimmed.length });
    }
  }

  if (spans.length === 0) {
    const first = text.search(/\S/);
    return first === -1 ? { start: 0, end: 0 } : { start: first, end: text.replace(/\s+$/, '').length };
  }

  let best = spans[0];
  let bestScore = 0;
  for (const sp of spans) {
    const sc = scoreSentenceRelevance(text.slice(sp.start, sp.end), keywords);
    if (sc > bestScore) {
      bestScore = sc;
      best = sp;
    }
  }
  return best;
}

/**
 * Returns a contiguous verbatim substring of `text` with at most `maxWords` words,
 * centred on `span`. If the span itself exceeds `maxWords`, returns the first
 * `maxWords` words starting at the span start.
 */
export function extractExcerptAround(
  text: string,
  span: { start: number; end: number },
  maxWords: number = 50
): string {
  if (!text) return '';
  const words: { start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    words.push({ start: m.index, end: m.index + m[0].length });
  }
  if (words.length === 0 || maxWords < 1) return extractVerbatimPassage(text, maxWords);

  let fw = words.findIndex((w) => w.end > span.start);
  if (fw === -1) fw = words.length - 1;
  let lw = fw;
  for (let i = fw; i < words.length && words[i].start < span.end; i++) lw = i;

  const n = lw - fw + 1;
  let s: number;
  let e: number;
  if (n >= maxWords) {
    s = fw;
    e = fw + maxWords - 1;
  } else {
    const extra = maxWords - n;
    s = fw - Math.floor(extra / 2);
    e = lw + (extra - Math.floor(extra / 2));
    if (s < 0) { e -= s; s = 0; }
    if (e > words.length - 1) { s -= e - (words.length - 1); e = words.length - 1; }
    s = Math.max(0, s);
  }
  return text.slice(words[s].start, words[e].end);
}
/**
 * Extracts a verbatim substring of at most 50 whitespace-delimited words from `text`.
 * Guarantees `text.includes(excerpt)` for any non-empty input string (Property 1 / R-PBT-1).
 */
export function extractVerbatimPassage(text: string, maxWords: number = 50): string {
  if (!text) return '';

  const wordRegex = /\S+/g;
  let match: RegExpExecArray | null;
  let firstStart = -1;
  let lastEnd = -1;
  let count = 0;

  while ((match = wordRegex.exec(text)) !== null) {
    if (count === 0) {
      firstStart = match.index;
    }
    lastEnd = match.index + match[0].length;
    count++;
    if (count >= maxWords) break;
  }

  if (firstStart === -1) {
    // Whitespace-only or empty string: return exact slice of original text
    return text.slice(0, Math.min(text.length, 50));
  }

  return text.slice(firstStart, lastEnd);
}

/**
 * Pure helper that builds a CitationRecord from a ChunkRecord.
 * Satisfies Property 1 (Citation Integrity): `chunk.text.includes(citation.excerpt)`.
 */
export function buildCitation(
  chunk: ChunkRecord,
  score: number = 1.0,
  documentName?: string,
  question?: string
): CitationRecord {
  void score;
  const excerpt = question
    ? extractExcerptAround(chunk.text, findRelevantSpan(chunk.text, question), 50)
    : extractVerbatimPassage(chunk.text, 50);

  return {
    chunkId: chunk.chunkId,
    documentName: documentName ?? chunk.documentId,
    pageNumber: chunk.pageNumber,
    lineSection:
      chunk.pageNumber === null
        ? `line ${(chunk.lineOffset ?? 0) + 1}`
        : null,
    excerpt,
  };
}

/**
 * Clamps a numeric score to [0.0, 1.0], handling NaN/Infinity safely (Property 2 / R-PBT-2).
 */
export function clampConfidenceScore(rawScore: number): number {
  if (!Number.isFinite(rawScore)) return 0.0;
  return Math.max(0.0, Math.min(1.0, rawScore));
}

/**
 * Synthesises an AnswerRecord exclusively from the top-5 retrieved chunks.
 *
 * Rules enforced:
 * - Zero hallucination: answer text is constructed directly from retrieved chunk passages (Req 4.7).
 * - Confidence score: arithmetic mean of the cosine similarity scores of the used chunks, clamped to [0.0, 1.0] (Req 4.3).
 * - If no chunk has score > 0.3, returns an insufficient-information response with no citations (Req 4.6).
 * - If confidenceScore < 0.6, attaches a plain-language UncertaintyNotice (Req 4.4, Property 10).
 */
export function synthesiseAnswer(
  questionText: string,
  topChunks: ScoredChunk[],
  documentNames: Record<string, string> = {}
): AnswerRecord {
  const usedChunks = topChunks.slice(0, 5);

  if (usedChunks.length === 0) {
    return {
      answerId: uuidv4(),
      questionText,
      synthesisedText:
        'The uploaded documents do not contain sufficient information to answer this question.',
      citations: [],
      confidenceScore: 0.0,
      uncertaintyNotice:
        'Insufficient evidence: The documents do not contain enough information to answer this with confidence.',
      createdAt: Date.now(),
      chunkIds: [],
    };
  }

  const rawMean =
    usedChunks.reduce((sum, c) => sum + (Number.isFinite(c.score) ? c.score : 0), 0) /
    usedChunks.length;
  const confidenceScore = clampConfidenceScore(rawMean);
  const maxScore = Math.max(
    ...usedChunks.map((c) => (Number.isFinite(c.score) ? c.score : 0))
  );

  // Req 4.6: If no chunk in the store has a cosine similarity score above 0.3
  if (maxScore <= 0.3) {
    return {
      answerId: uuidv4(),
      questionText,
      synthesisedText:
        'The uploaded documents do not contain sufficient information to answer this question.',
      citations: [],
      confidenceScore,
      uncertaintyNotice:
        'Insufficient evidence: No passage in the uploaded documents exceeded the minimum relevance threshold (0.30) for this query.',
      createdAt: Date.now(),
      chunkIds: usedChunks.map((c) => c.chunkId),
    };
  }

  const citations = usedChunks.map((chunk) =>
    buildCitation(chunk, chunk.score, documentNames[chunk.documentId] ?? chunk.documentId, questionText)
  );

  // Identify the single chunk with the highest keyword relevance to answer the question directly
  const keywords = getQuestionKeywords(questionText);
  let bestChunk = usedChunks[0];
  let highestKeywordScore = -1;

  for (const chunk of usedChunks) {
    const s = scoreSentenceRelevance(chunk.text, keywords);
    if (s > highestKeywordScore) {
      highestKeywordScore = s;
      bestChunk = chunk;
    }
  }

  const primaryDoc = documentNames[bestChunk.documentId] ?? bestChunk.documentId;
  const primaryLoc = bestChunk.pageNumber !== null ? `p. ${bestChunk.pageNumber}` : `section 1`;
  const primaryExcerpt = citations[usedChunks.indexOf(bestChunk)].excerpt;

  // Remaining chunks as supporting citations
  const otherChunks = usedChunks.filter((c) => c !== bestChunk);
  const supportingPassages = otherChunks.map((c, idx) => {
    const docName = documentNames[c.documentId] ?? c.documentId;
    const loc = c.pageNumber !== null ? `p. ${c.pageNumber}` : `section 1`;
    const snippet = citations[usedChunks.indexOf(c)].excerpt;
    return `• [${idx + 2}] From ${docName} (${loc}): "${snippet}"`;
  });

  let synthesisedText = `According to ${primaryDoc} (${primaryLoc}):\n"${primaryExcerpt}"`;
  if (supportingPassages.length > 0) {
    synthesisedText += `\n\nSupporting evidence from retrieved passages:\n${supportingPassages.join('\n')}`;
  }

  let uncertaintyNotice: string | null = null;
  if (confidenceScore < 0.6) {
    const distinctDocs = new Set(usedChunks.map((c) => c.documentId));
    if (distinctDocs.size > 1) {
      uncertaintyNotice =
        'Partial coverage & potential conflicting sources: Retrieved passages have moderate similarity scores (< 0.60) across multiple documents; verify the cited excerpts directly.';
    } else {
      uncertaintyNotice =
        'Partial coverage: Only limited evidence in the uploaded documents matched this question (confidence score below 0.60).';
    }
  }

  return {
    answerId: uuidv4(),
    questionText,
    synthesisedText,
    citations,
    confidenceScore,
    uncertaintyNotice,
    createdAt: Date.now(),
    chunkIds: usedChunks.map((c) => c.chunkId),
  };
}
