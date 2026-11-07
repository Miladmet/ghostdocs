import { describe, it, expect } from 'vitest';
import { resolvePdfWorkerSrc } from '../../lib/pdf-worker-src';

const PAGES_PATH = '/ghostdocs/_next/static/chunks/x.js';
const ROOT_PATH = '/_next/static/chunks/x.js';

describe('resolvePdfWorkerSrc', () => {
  it('uses the env base path', () => {
    expect(resolvePdfWorkerSrc('/ghostdocs', ROOT_PATH)).toBe('/ghostdocs/pdf.worker.min.mjs');
  });

  it('trims whitespace and trailing slashes from env', () => {
    expect(resolvePdfWorkerSrc(' /ghostdocs/ ', undefined)).toBe('/ghostdocs/pdf.worker.min.mjs');
    expect(resolvePdfWorkerSrc('/ghostdocs//', undefined)).toBe('/ghostdocs/pdf.worker.min.mjs');
  });

  it('falls back to the pathname when env is undefined or empty', () => {
    expect(resolvePdfWorkerSrc(undefined, PAGES_PATH)).toBe('/ghostdocs/pdf.worker.min.mjs');
    expect(resolvePdfWorkerSrc('', PAGES_PATH)).toBe('/ghostdocs/pdf.worker.min.mjs');
  });

  it('uses the root path without env or /ghostdocs pathname', () => {
    expect(resolvePdfWorkerSrc(undefined, ROOT_PATH)).toBe('/pdf.worker.min.mjs');
    expect(resolvePdfWorkerSrc(undefined, undefined)).toBe('/pdf.worker.min.mjs');
  });

  it('env value always wins over the pathname', () => {
    expect(resolvePdfWorkerSrc('/other', PAGES_PATH)).toBe('/other/pdf.worker.min.mjs');
  });
});
