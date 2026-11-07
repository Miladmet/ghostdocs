import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_VAULT_FILES, createSampleVaultFiles } from '@/lib/sample-vault';
import { chunkDocument } from '@/lib/chunker';
import { deriveSlug } from '@/lib/slug';
import { cosineSimilarity, rankByCosine } from '@/lib/search';
import { extractMetadataFromChunks } from '@/lib/agents/archivist';
import { extractTimelineFromChunks } from '@/lib/agents/historian';
import { synthesiseAnswer, type ScoredChunk } from '@/lib/agents/researcher';
import type { ChunkRecord, EmbeddingRecord } from '@/lib/db';

async function loadEmbedder() {
  // The worker module registers a message listener on `self` at import time.
  vi.stubGlobal('self', { addEventListener: () => {}, postMessage: () => {} });
  const mod = await import('@/workers/embeddings.worker');
  vi.unstubAllGlobals();
  return mod.computeDeterministicEmbedding;
}

function buildChunks(): { chunks: ChunkRecord[]; names: Record<string, string> } {
  const chunks: ChunkRecord[] = [];
  const names: Record<string, string> = {};
  for (const f of SAMPLE_VAULT_FILES) {
    const slug = deriveSlug(f.name);
    names[slug] = f.name;
    for (const c of chunkDocument({
      slug,
      pages: [{ text: f.content, pageNumber: null, lineOffset: 0 }],
    })) {
      chunks.push({ ...c, embeddingStatus: 'complete' });
    }
  }
  return { chunks, names };
}

describe('sample vault files', () => {
  it('creates two in-memory files whose text equals the constants', async () => {
    const files = createSampleVaultFiles();
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name)).toEqual(['sample.md', 'q3-audit.txt']);
    expect(files.map((f) => f.type)).toEqual(['text/markdown', 'text/plain']);
    for (let i = 0; i < files.length; i++) {
      expect(await files[i].text()).toBe(SAMPLE_VAULT_FILES[i].content);
    }
  });
});

describe('sample vault through the real agents', () => {
  const { chunks, names } = buildChunks();

  it('Archivist extracts authors and titles', () => {
    for (const [slug, author] of [
      ['sample', 'Evelyn Cross'],
      ['q3-audit', 'Marcus Sterling'],
    ]) {
      const file = SAMPLE_VAULT_FILES.find((f) => deriveSlug(f.name) === slug)!;
      const meta = extractMetadataFromChunks(
        chunks.filter((c) => c.documentId === slug),
        file.type,
        file.name
      );
      expect(meta.author).toBe(author);
      expect(meta.title).not.toBeNull();
    }
  });

  it('Historian finds explicit, fiscal and implicit entries', () => {
    const entries = extractTimelineFromChunks(chunks, names);
    const dates = entries.map((e) => e.resolvedDate);
    expect(dates).toContain('2021-09-01');
    expect(dates).toContain('2024-09-14');
    expect(entries.some((e) => /fiscal/i.test(e.uncertaintyNotice ?? ''))).toBe(true);
    expect(entries.some((e) => e.isImplicit)).toBe(true);
  });

  async function ask(question: string) {
    const embed = await loadEmbedder();
    const embeddings: EmbeddingRecord[] = chunks.map((c) => ({
      chunkId: c.chunkId,
      vector: embed(c.text),
    }));
    const q = embed(question);
    expect(cosineSimilarity(q, embeddings[0].vector)).toBeLessThanOrEqual(1);
    const ranked = await rankByCosine(q, embeddings, 5);
    const top: ScoredChunk[] = ranked.map((r) => ({
      ...chunks.find((c) => c.chunkId === r.chunkId)!,
      score: r.score,
    }));
    const answer = synthesiseAnswer(question, top, names);
    for (const cit of answer.citations) {
      const chunk = chunks.find((c) => c.chunkId === cit.chunkId)!;
      expect(chunk.text.includes(cit.excerpt)).toBe(true);
    }
    console.log(
      JSON.stringify({
        question,
        confidenceScore: answer.confidenceScore,
        uncertaintyNotice: answer.uncertaintyNotice,
        documents: answer.citations.map((c) => c.documentName),
      })
    );
    return answer;
  }

  it('Q3 budget question surfaces both conflicting figures', async () => {
    const answer = await ask('What was the Q3 budget allocation?');
    expect(answer.citations.length).toBeGreaterThan(0);
    const excerpts = answer.citations.map((c) => c.excerpt);
    expect(excerpts.some((e) => e.includes('450,000'))).toBe(true);
    expect(excerpts.some((e) => e.includes('310,000'))).toBe(true);
  });

  it('security constitution question cites the ratification date', async () => {
    const answer = await ask('When was the security constitution ratified?');
    expect(answer.citations.some((c) => c.excerpt.includes('14 September 2024'))).toBe(true);
  });
});
