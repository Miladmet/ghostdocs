// lib/capsule.ts
// Time Capsule creation, JSON export, and schema-validated import (Req 2.1–2.8).

import { v4 as uuidv4 } from 'uuid';
import {
  db,
  type CapsuleBundledData,
  type CapsuleRecord,
  type ChunkRecord,
  type DocumentRecord,
  type EmbeddingRecord,
  type TimelineEntryRecord,
} from '@/lib/db';
import {
  extractMetadataFromChunks,
  generateSummaryFromChunks,
} from '@/lib/agents/archivist';

export const CURRENT_CAPSULE_VERSION = 1;

export interface ImportResult {
  restoredCount: number;
  skippedCount: number;
}

/**
 * Converts a Float32Array to a plain number[] for JSON serialisation.
 */
export function serialiseVector(vector: Float32Array): number[] {
  return Array.from(vector);
}

/**
 * Reconstructs a Float32Array from a plain number[] parsed from JSON.
 */
export function deserialiseVector(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

/**
 * Bundles all ingested Documents, Chunks, Embeddings, summaries, and Timeline_Entries
 * into a single Time_Capsule record in IndexedDB (Req 2.1, 2.7, 2.8).
 */
export async function createCapsule(): Promise<CapsuleRecord> {
  const [documents, chunks, embeddings, timelineEntries] = await Promise.all([
    db.documents.toArray(),
    db.chunks.toArray(),
    db.embeddings.toArray(),
    db.timelines.toArray(),
  ]);

  // Ensure every document has Archivist metadata and summary populated (Req 2.1, 2.7, 2.8)
  const updatedDocuments: DocumentRecord[] = [];
  for (const doc of documents) {
    const docChunks = chunks.filter((c) => c.documentId === doc.slug);
    const metadata = extractMetadataFromChunks(
      docChunks,
      doc.mimeType,
      doc.filename
    );
    const rawSummary = generateSummaryFromChunks(docChunks);
    const summary = rawSummary ?? 'No summary available';

    const updatedDoc: DocumentRecord = {
      ...doc,
      metadata,
      summary,
    };
    updatedDocuments.push(updatedDoc);
    await db.documents.put(updatedDoc);
  }

  const serialisedEmbeddings = embeddings.map((e) => ({
    chunkId: e.chunkId,
    vector: serialiseVector(e.vector),
  }));

  const utcDate = new Date().toISOString().slice(0, 10);
  const capsule: CapsuleRecord = {
    capsuleId: uuidv4(),
    capsuleVersion: CURRENT_CAPSULE_VERSION,
    createdAt: Date.now(),
    documentCount: updatedDocuments.length,
    exportFilename: `ghostdocs-capsule-${utcDate}.json`,
    bundledData: {
      documents: updatedDocuments,
      chunks,
      embeddings: serialisedEmbeddings,
      timelineEntries,
    },
  };

  await db.capsules.put(capsule);
  return capsule;
}

/**
 * Serialises a CapsuleRecord to a UTF-8 JSON string and triggers a browser file download
 * with filename `ghostdocs-capsule-{YYYY-MM-DD}.json` (Req 2.2).
 */
export async function exportCapsule(capsuleId?: string): Promise<string> {
  let capsule: CapsuleRecord | undefined;

  if (capsuleId) {
    capsule = await db.capsules.get(capsuleId);
  } else {
    const all = await db.capsules.orderBy('createdAt').reverse().toArray();
    capsule = all[0];
  }

  if (!capsule) {
    capsule = await createCapsule();
  }

  const json = JSON.stringify(capsule, null, 2);

  if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = capsule.exportFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return json;
}

/**
 * Validates and imports a Time Capsule JSON file or string into IndexedDB (Req 2.3–2.6).
 * - Rejects malformed JSON or invalid schema with zero database modifications (Req 2.4).
 * - Rejects capsules with `capsuleVersion > CURRENT_CAPSULE_VERSION` (Req 2.6).
 * - Skips existing `slug` or `chunkId` records without error and reports counts (Req 2.3).
 */
export async function importCapsule(
  source: File | string
): Promise<ImportResult> {
  const rawText =
    typeof source === 'string' ? source : await source.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      'Malformed Time Capsule file: The uploaded file is not valid JSON.'
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      'Invalid Time Capsule schema: Root value must be a JSON object.'
    );
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    typeof candidate.capsuleVersion !== 'number' ||
    !Number.isInteger(candidate.capsuleVersion) ||
    candidate.capsuleVersion < 1
  ) {
    throw new Error(
      'Invalid Time Capsule schema: Missing or invalid positive integer capsuleVersion.'
    );
  }

  if (candidate.capsuleVersion > CURRENT_CAPSULE_VERSION) {
    throw new Error(
      `Unsupported Time Capsule version (${candidate.capsuleVersion}): This capsule requires a newer application version (current max supported version is ${CURRENT_CAPSULE_VERSION}).`
    );
  }

  const bundled = candidate.bundledData as Record<string, unknown> | undefined;
  if (
    !bundled ||
    typeof bundled !== 'object' ||
    !Array.isArray(bundled.documents) ||
    !Array.isArray(bundled.chunks) ||
    !Array.isArray(bundled.embeddings) ||
    !Array.isArray(bundled.timelineEntries)
  ) {
    throw new Error(
      'Invalid Time Capsule schema: bundledData must contain documents, chunks, embeddings, and timelineEntries arrays.'
    );
  }

  // Validate basic record shapes before touching IndexedDB
  for (const doc of bundled.documents) {
    if (!doc || typeof doc !== 'object' || typeof (doc as DocumentRecord).slug !== 'string') {
      throw new Error('Invalid Time Capsule schema: Document record missing string slug.');
    }
  }
  for (const chunk of bundled.chunks) {
    if (!chunk || typeof chunk !== 'object' || typeof (chunk as ChunkRecord).chunkId !== 'string') {
      throw new Error('Invalid Time Capsule schema: Chunk record missing string chunkId.');
    }
  }

  const data = bundled as unknown as CapsuleBundledData;
  let restoredCount = 0;
  let skippedCount = 0;

  await db.transaction(
    'rw',
    [db.documents, db.chunks, db.embeddings, db.timelines],
    async () => {
      for (const doc of data.documents) {
        const exists = await db.documents.get(doc.slug);
        if (exists) {
          skippedCount++;
        } else {
          await db.documents.add(doc);
          restoredCount++;
        }
      }

      for (const chunk of data.chunks) {
        const exists = await db.chunks.get(chunk.chunkId);
        if (exists) {
          skippedCount++;
        } else {
          await db.chunks.add(chunk);
          restoredCount++;
        }
      }

      for (const emb of data.embeddings) {
        const exists = await db.embeddings.get(emb.chunkId);
        if (!exists) {
          const record: EmbeddingRecord = {
            chunkId: emb.chunkId,
            vector: deserialiseVector(emb.vector),
          };
          await db.embeddings.add(record);
        }
      }

      for (const entry of data.timelineEntries as TimelineEntryRecord[]) {
        const exists = await db.timelines.get(entry.entryId);
        if (!exists) {
          await db.timelines.add(entry);
        }
      }
    }
  );

  return { restoredCount, skippedCount };
}
