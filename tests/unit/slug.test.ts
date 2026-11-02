import { describe, expect, it } from 'vitest';
import { deriveSlug } from '@/lib/slug';

describe('deriveSlug (Req 1.8)', () => {
  it('converts spaces and mixed case to lowercase hyphenated slug and strips extension', () => {
    expect(deriveSlug('Q3 Budget Report.pdf')).toBe('q3-budget-report');
  });

  it('replaces special characters and collapses consecutive hyphens', () => {
    expect(deriveSlug('Meeting Notes (2024) -- Final!!.txt')).toBe(
      'meeting-notes-2024-final'
    );
    expect(deriveSlug('ANNUAL_REVIEW--Final.md')).toBe('annual-review-final');
  });

  it('strips leading and trailing hyphens', () => {
    expect(deriveSlug('---_ Spec Document _---.markdown')).toBe('spec-document');
  });

  it('returns fallback "document" when filename has no alphanumeric characters', () => {
    expect(deriveSlug('....pdf')).toBe('document');
    expect(deriveSlug('---')).toBe('document');
  });
});
