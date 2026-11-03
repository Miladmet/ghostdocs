// lib/agents/archivist.ts
// The Archivist Agent: responsible for document organisation, metadata extraction,
// extractive summarisation (1–200 words), and duplicate detection.

import {
  db,
  type ChunkRecord,
  type DocumentMetadata,
  type DocumentType,
} from '@/lib/db';

const WRITTEN_MONTHS =
  '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

/**
 * Pure helper to determine DocumentType from MIME type or filename.
 */
export function resolveDocumentType(
  mimeType: string,
  filename: string = ''
): DocumentType {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = filename.toLowerCase();
  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    lowerMime === 'text/markdown' ||
    lowerMime === 'text/x-markdown' ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown')
  ) {
    return 'markdown';
  }
  return 'plaintext';
}

/**
 * Pure helper to extract metadata from a document's chunks.
 */
export function extractMetadataFromChunks(
  chunks: ChunkRecord[],
  mimeType: string = 'text/plain',
  filename: string = ''
): DocumentMetadata {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const combinedText = sorted.map((c) => c.text).join('\n');

  // 1. Title: first non-empty line or Markdown heading
  let title: string | null = null;
  const lines = combinedText
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .filter((l) => l.length > 0);

  if (lines.length > 0) {
    const firstLine = lines[0];
    // Take first sentence or up to 80 chars if the chunk was flattened
    const candidate = firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine;
    title = candidate.slice(0, 80).trim() || null;
  }

  // 2. Detected date: ISO 8601 first, then written date
  let detectedDate: string | null = null;
  const isoMatch = combinedText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    detectedDate = isoMatch[1];
  } else {
    const writtenRegex = new RegExp(
      `\\b(\\d{1,2}\\s+${WRITTEN_MONTHS}\\s+\\d{4}|${WRITTEN_MONTHS}\\s+\\d{1,2},?\\s+\\d{4}|${WRITTEN_MONTHS}\\s+\\d{4})\\b`,
      'i'
    );
    const writtenMatch = combinedText.match(writtenRegex);
    if (writtenMatch) {
      const parsed = new Date(writtenMatch[1]);
      if (!Number.isNaN(parsed.getTime())) {
        detectedDate = parsed.toISOString().slice(0, 10);
      } else {
        detectedDate = writtenMatch[1];
      }
    }
  }

  // 3. Author: look for "Author: ...", "By ...", "PHOTO OF THE AUTHOR, <NAME>", or all-caps name patterns
  let author: string | null = null;
  const authorMatch = combinedText.match(
    /\b(?:Author|Prepared by|Written by)\s*[:\-]\s*([A-Za-z0-9\s.,'-]{2,50})/i
  );
  if (authorMatch && authorMatch[1]) {
    author = authorMatch[1].split(/\r?\n|\.|;/)[0].trim() || null;
  } else {
    // Check for "PHOTO OF THE AUTHOR, <NAME>" or "AUTHOR, <NAME>" (common in books)
    const authorPhotoMatch = combinedText.match(
      /\bAUTHOR\s*,\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,2})\b/i
    );
    if (authorPhotoMatch && authorPhotoMatch[1]) {
      author = authorPhotoMatch[1].trim() || null;
    } else {
      // If using "By: Name" or "By Name", ensure it matches a proper person's name (2-3 words)
      const byMatch = combinedText.match(
        /\bBy\s*[:\-]?\s+([A-Za-z]+(?:\s+[A-Za-z]+){1,2})\b/i
      );
      if (byMatch && byMatch[1]) {
        author = byMatch[1].trim() || null;
      }
    }
  }

  // Clean author name: remove phrases like "step recap of..." or sentences
  if (author) {
    if (
      /\b(step|recap|summary|view|process|chapter|section|edition|table|content|page)\b/i.test(author) ||
      author.split(/\s+/).length > 4
    ) {
      author = null;
    } else {
      // Normalize casing (e.g. "NAPOLEON HILL" -> "Napoleon Hill")
      author = author
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  const documentType = resolveDocumentType(mimeType, filename);

  return {
    title,
    detectedDate,
    author,
    documentType,
  };
}

/**
 * Pure helper to generate a 1–200 word extractive summary from chunks.
 * Returns null if fewer than 20 words of body content exist (Req 2.7–2.8).
 */
export function generateSummaryFromChunks(
  chunks: ChunkRecord[]
): string | null {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const words: string[] = [];

  for (const chunk of sorted) {
    const tokens = chunk.text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    for (const token of tokens) {
      words.push(token);
      if (words.length >= 200) break;
    }
    if (words.length >= 200) break;
  }

  if (words.length < 20) {
    return null;
  }

  return words.slice(0, 200).join(' ');
}

/**
 * Reads all ChunkRecords for a document from IndexedDB, extracts metadata,
 * updates the DocumentRecord, and returns the extracted DocumentMetadata.
 */
export async function extractMetadata(
  documentId: string
): Promise<DocumentMetadata> {
  const [doc, chunks] = await Promise.all([
    db.documents.get(documentId),
    db.chunks.where('documentId').equals(documentId).toArray(),
  ]);

  const metadata = extractMetadataFromChunks(
    chunks,
    doc?.mimeType ?? 'text/plain',
    doc?.filename ?? documentId
  );

  if (doc) {
    const summary = generateSummaryFromChunks(chunks);
    await db.documents.update(documentId, {
      metadata,
      summary: summary ?? 'No summary available',
    });
  }

  return metadata;
}

/**
 * Generates a 1–200 word extractive summary for a document stored in IndexedDB.
 * Returns null if the document has fewer than 20 words of extractable content (Req 2.7–2.8).
 */
export async function generateSummary(
  documentId: string
): Promise<string | null> {
  const chunks = await db.chunks
    .where('documentId')
    .equals(documentId)
    .toArray();
  const summary = generateSummaryFromChunks(chunks);

  await db.documents.update(documentId, {
    summary: summary ?? 'No summary available',
  });

  return summary;
}

/**
 * Checks whether a document with the given slug already exists in IndexedDB (Req 1.11).
 */
export async function checkDuplicate(slug: string): Promise<boolean> {
  const existing = await db.documents.get(slug);
  return existing !== undefined;
}
