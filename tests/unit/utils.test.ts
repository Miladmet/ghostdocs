import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('lib/utils.ts cn helper', () => {
  it('merges tailwind class names properly', () => {
    expect(cn('px-2 py-1', 'bg-blue-500')).toBe('px-2 py-1 bg-blue-500');
  });

  it('handles conditional class names and overrides', () => {
    expect(cn('p-4', false && 'hidden', true && 'block')).toBe('p-4 block');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles empty or undefined inputs', () => {
    expect(cn()).toBe('');
    expect(cn('', undefined, null)).toBe('');
  });
});
