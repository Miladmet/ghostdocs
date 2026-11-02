import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cosineSimilarity, rankByCosine } from '@/lib/search';
import type { EmbeddingRecord } from '@/lib/db';

describe('lib/search.ts (Req 3.2, 3.8, 3.9, R-PBT-4, R-PBT-8)', () => {
  it('computes 1.0 for identical vectors, 0.0 for orthogonal, -1.0 for opposite, and 0.0 for zero vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([1, 0, 0]);
    const orth = new Float32Array([0, 1, 0]);
    const opp = new Float32Array([-1, 0, 0]);
    const zero = new Float32Array([0, 0, 0]);

    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(a, orth)).toBeCloseTo(0.0, 5);
    expect(cosineSimilarity(a, opp)).toBeCloseTo(-1.0, 5);
    expect(cosineSimilarity(a, zero)).toBe(0);
  });

  it('throws on vector length mismatch', () => {
    expect(() =>
      cosineSimilarity(new Float32Array([1, 2]), new Float32Array([1]))
    ).toThrow(/length mismatch/i);
  });

  it('Property 4 (R-PBT-4): cosineSimilarity is always in [-1.0, 1.0]', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 }), {
          minLength: 384,
          maxLength: 384,
        }),
        fc.array(fc.float({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 }), {
          minLength: 384,
          maxLength: 384,
        }),
        (arrA, arrB) => {
          const score = cosineSimilarity(
            new Float32Array(arrA),
            new Float32Array(arrB)
          );
          return !Number.isNaN(score) && score >= -1.0 && score <= 1.0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7 / R-PBT-8: rankByCosine is deterministic and returns sorted top-N results', async () => {
    const query = new Float32Array([1, 0, 0, 0]);
    const store: EmbeddingRecord[] = [
      { chunkId: 'c-low', vector: new Float32Array([0.1, 0.9, 0, 0]) },
      { chunkId: 'c-high', vector: new Float32Array([0.95, 0.05, 0, 0]) },
      { chunkId: 'c-mid', vector: new Float32Array([0.5, 0.5, 0, 0]) },
    ];

    const run1 = await rankByCosine(query, store, 10, 1);
    const run2 = await rankByCosine(query, store, 10, 1);

    expect(run1).toEqual(run2);
    expect(run1.map((r) => r.chunkId)).toEqual(['c-high', 'c-mid', 'c-low']);
    expect(await rankByCosine(query, [], 10)).toEqual([]);
  });
});
