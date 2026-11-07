// lib/pdf-worker-src.ts
// Pure helper resolving the PDF.js worker URL (kept free of pdfjs-dist and
// process.env so it is unit-testable in Node).

export function resolvePdfWorkerSrc(
  envBasePath: string | undefined,
  locationPathname: string | undefined,
): string {
  const basePath = (envBasePath ?? '').trim().replace(/\/+$/, '');
  const workerBasePath =
    basePath ||
    (locationPathname !== undefined && locationPathname.includes('/ghostdocs')
      ? '/ghostdocs'
      : '');
  return `${workerBasePath}/pdf.worker.min.mjs`;
}
