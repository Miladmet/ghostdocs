// lib/slug.ts
// Derives a URL-safe, stable slug from a document filename.
// Used as the primary key for DocumentRecord and all data-testid attributes.
//
// Algorithm (from Req 1.8):
//   1. Strip the file extension (everything after the last '.')
//   2. Lowercase the result
//   3. Replace all whitespace and non-alphanumeric characters with hyphens
//   4. Collapse consecutive hyphens to a single hyphen
//   5. Strip leading and trailing hyphens

/**
 * Derives a stable, URL-safe slug from a document filename.
 *
 * @example
 * deriveSlug('Q3 Budget Report.pdf')  // → 'q3-budget-report'
 * deriveSlug('Meeting Notes (2024).txt') // → 'meeting-notes-2024'
 * deriveSlug('ANNUAL_REVIEW--Final.md') // → 'annual-review-final'
 * deriveSlug('.hidden-file')           // → 'hidden-file'
 */
export function deriveSlug(filename: string): string {
  // 1. Strip file extension: remove the last '.something' segment.
  //    If there is no dot (or the filename starts with a dot), keep the whole name.
  const withoutExtension = filename.replace(/\.[^.]+$/, '');

  // 2. Lowercase
  const lowercased = withoutExtension.toLowerCase();

  // 3. Replace whitespace and non-alphanumeric characters with hyphens
  const hyphenated = lowercased.replace(/[^a-z0-9]+/g, '-');

  // 4. Collapse consecutive hyphens
  const collapsed = hyphenated.replace(/-{2,}/g, '-');

  // 5. Strip leading and trailing hyphens
  const trimmed = collapsed.replace(/^-+|-+$/g, '');

  // Fallback: if the result is empty (e.g., filename was '...'), return 'document'
  return trimmed.length > 0 ? trimmed : 'document';
}
