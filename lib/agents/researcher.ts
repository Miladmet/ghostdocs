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
 * Extracts sentences from chunk text that best match question keywords.
 */
function extractRelevantSentences(text: string, question: string, maxSentences: number = 2): string {
  if (!text) return '';
  const qTokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !QUERY_STOPWORDS.has(w));

  // Split into sentences (by period, newline, or punctuation followed by whitespace)
  const rawSentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (rawSentences.length === 0) {
    return extractVerbatimPassage(text, 50);
  }

  // Score sentences by token overlap
  const scored = rawSentences.map((s) => {
    const sLower = s.toLowerCase();
    let matches = 0;
    for (const t of qTokens) {
      if (sLower.includes(t)) matches++;
    }
    return { sentence: s, matches };
  });

  scored.sort((a, b) => b.matches - a.matches);
  const top = scored.filter((s) => s.matches > 0).slice(0, maxSentences);

  if (top.length > 0) {
    return top.map((s) => s.sentence).join(' ');
  }

  // Fallback to first non-empty sentence or first passage
  return rawSentences[0] || extractVerbatimPassage(text, 50);
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
  documentName?: string
): CitationRecord {
  void score;
  const excerpt = extractVerbatimPassage(chunk.text, 50);

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
    buildCitation(chunk, chunk.score, documentNames[chunk.documentId] ?? chunk.documentId)
  );

  // Synthesise a direct informative synthesis from the most relevant chunk passages
  const primaryChunk = usedChunks[0];
  const primaryDoc = documentNames[primaryChunk.documentId] ?? primaryChunk.documentId;
  const primaryLoc = primaryChunk.pageNumber !== null ? `p. ${primaryChunk.pageNumber}` : `section 1`;
  const primaryExcerpt = extractRelevantSentences(primaryChunk.text, questionText, 2);

  // Additional supporting findings from other chunks
  const supportingPassages = usedChunks.slice(1).map((c, idx) => {
    const docName = documentNames[c.documentId] ?? c.documentId;
    const loc = c.pageNumber !== null ? `p. ${c.pageNumber}` : `section 1`;
    const snippet = extractRelevantSentences(c.text, questionText, 1);
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
