// workers/parser.worker.ts
import { getDocument, GlobalWorkerOptions, PasswordException } from 'pdfjs-dist';
import { resolvePdfWorkerSrc } from '../lib/pdf-worker-src';
import type {
  ParseDocumentRequest,
  ParseCompleteMessage,
  ParseErrorMessage,
  ParseProgressMessage,
  ParsedPage,
} from './types';

// Set the worker source before any PDF operations.
// pdf.worker.min.mjs is served from public/, so under a base path (GitHub Pages:
// /ghostdocs) it lives at <basePath>/pdf.worker.min.mjs. NEXT_PUBLIC_BASE_PATH is
// inlined by Next at build time; the pathname check is a fallback.
//
// Note: PDF.js logs "Warning: Setting up fake worker." here. This is expected and
// harmless. getDocument runs inside our own dedicated Web Worker, so pdf.js tries
// to start a nested worker, but getWorkerSrc() references window.location, which
// does not exist in a worker context. The error is caught and pdf.js falls back to
// its in-thread ("fake") worker, loading workerSrc via dynamic import(); that is why
// workerSrc must still point at the base-path-correct URL. Parsing therefore runs
// on this worker's thread, still off the main thread, so Req 1.4 / 9.4 (<= 50 ms
// main-thread blocking) are unaffected. Based on the pdfjs-dist 6.5.438 source
// (PDFWorker.#initialize / #setupFakeWorker / getWorkerSrc in build/pdf.mjs);
// recheck when upgrading pdfjs-dist.
GlobalWorkerOptions.workerSrc = resolvePdfWorkerSrc(
  process.env.NEXT_PUBLIC_BASE_PATH,
  typeof self !== 'undefined' && self.location ? self.location.pathname : undefined,
);

// ─── Main message handler ──────────────────────────────────────────────────

self.addEventListener('message', async (event: MessageEvent<ParseDocumentRequest>) => {
  const { type, slug, fileName, mimeType, buffer } = event.data;

  if (type !== 'PARSE_DOCUMENT') return;

  // Determine parsing strategy by MIME type, falling back to file extension
  const isPdf =
    mimeType === 'application/pdf' ||
    fileName.toLowerCase().endsWith('.pdf');

  try {
    if (isPdf) {
      await parsePdf(slug, buffer);
    } else {
      parseText(slug, buffer);
    }
  } catch (err) {
    const errorMsg: ParseErrorMessage = {
      type: 'PARSE_ERROR',
      slug,
      errorCode: 'UNKNOWN',
      message: err instanceof Error ? err.message : 'Unknown parsing error',
    };
    self.postMessage(errorMsg);
  }
});

// ─── PDF Parser ────────────────────────────────────────────────────────────

async function parsePdf(slug: string, buffer: ArrayBuffer): Promise<void> {
  let loadingTask;

  try {
    loadingTask = getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const pages: ParsedPage[] = [];
    const skippedPages: number[] = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .trim();

        if (text.length > 0) {
          pages.push({
            pageNumber: pageNum,
            lineOffset: 0,
            text,
          });
        }

        const progressMsg: ParseProgressMessage = {
          type: 'PARSE_PROGRESS',
          slug,
          pagesComplete: pageNum,
          totalPages,
          stage: 'parsing',
        };
        self.postMessage(progressMsg);
      } catch {
        // Skip corrupt/unreadable pages and record them
        skippedPages.push(pageNum);
      }
    }

    const completeMsg: ParseCompleteMessage = {
      type: 'PARSE_COMPLETE',
      slug,
      pages,
      pageCount: totalPages,
      skippedPages,
    };
    self.postMessage(completeMsg);
  } catch (err) {
    // Check for password-protected PDF
    if (err instanceof PasswordException) {
      const errorMsg: ParseErrorMessage = {
        type: 'PARSE_ERROR',
        slug,
        errorCode: 'PASSWORD_PROTECTED',
        message: 'This PDF is password-protected and cannot be ingested.',
      };
      self.postMessage(errorMsg);
      return;
    }

    // Re-throw other errors to be caught by outer try/catch
    throw err;
  }
}

// ─── Plain-text / Markdown Parser ─────────────────────────────────────────

function parseText(slug: string, buffer: ArrayBuffer): void {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(buffer);
  const lines = text.split('\n');

  const pages: ParsedPage[] = [];
  let currentLines: string[] = [];
  let sectionStartLine = 0;
  const SECTION_SIZE = 100; // Group lines into sections of ~100 lines each

  for (let i = 0; i < lines.length; i++) {
    currentLines.push(lines[i]);

    if (currentLines.length >= SECTION_SIZE || i === lines.length - 1) {
      const sectionText = currentLines.join('\n').trim();
      if (sectionText.length > 0) {
        pages.push({
          pageNumber: null,
          lineOffset: sectionStartLine,
          text: sectionText,
        });
      }
      sectionStartLine = i + 1;
      currentLines = [];
    }
  }

  // If no sections were created (empty file), emit one empty page
  if (pages.length === 0) {
    pages.push({ pageNumber: null, lineOffset: 0, text: '' });
  }

  const completeMsg: ParseCompleteMessage = {
    type: 'PARSE_COMPLETE',
    slug,
    pages,
    pageCount: null,
    skippedPages: [],
  };
  self.postMessage(completeMsg);
}
