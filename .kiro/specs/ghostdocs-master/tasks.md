# Implementation Plan: GhostDocs MVP

## Overview

Build a fully browser-local document knowledge application with three AI Crew agents (Archivist, Historian, Researcher), semantic search, timeline generation, and Time Capsule export/import. All processing runs in Web Workers; all persistence lives in IndexedDB via Dexie.js. The application is a Next.js 15 static export styled with the Kiroween dark-mode theme.

Tasks are ordered by dependency: project scaffolding → data layer → worker infrastructure → core library functions → agents → UI components → app pages → tests → CI. Tasks within the same wave are independent and can execute in parallel.

---

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Initialise Next.js 15 project with TypeScript strict mode and static export
    - Run `create-next-app` with App Router and TypeScript, then set `output: 'export'` in `next.config.ts`
    - Enable `"strict": true` in `tsconfig.json`; set `"target": "ES2022"`, `"moduleResolution": "bundler"`
    - Add `.gitignore`, `README.md`, and verify `next build` produces an `out/` directory
    - _Requirements: 8.1 (no server-side processing), 9.1 (static export FCP target)_

  - [x] 1.2 Install and pin all runtime dependencies with exact versions
    - Install (exact, no `^` or `~`): `dexie`, `pdfjs-dist`, `@xenova/transformers`, `uuid`
    - Install shadcn/ui peer deps: `@radix-ui/react-*` (via `npx shadcn@latest init`)
    - Install dev deps (exact): `typescript`, `@types/react`, `@types/node`, `vitest`, `@vitest/coverage-v8`, `fast-check`, `@playwright/test`, `@axe-core/playwright`
    - Verify `package.json` has zero `^` or `~` version prefixes for all entries
    - _Requirements: Dependency rules (tech steering)_

  - [x] 1.3 Configure Tailwind CSS v4 and shadcn/ui
    - Install Tailwind v4 and run `npx shadcn@latest init` selecting dark mode `class` and the `slate` base
    - Add shadcn components: `button`, `dialog`, `alert-dialog`, `progress`, `badge`, `scroll-area`, `tooltip`, `separator`
    - Confirm `components/ui/` contains generated component files
    - _Requirements: 10.1 (Kiroween dark mode only)_

  - [x] 1.4 Create `next.config.ts` with static export, PDF.js worker copy, and CSP headers
    - Set `output: 'export'`, `images: { unoptimized: true }`
    - Add a `webpack` config hook that copies `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` to `public/pdf.worker.min.mjs`
    - Define Content Security Policy headers matching the design spec (`connect-src 'self' https://huggingface.co https://cdn-lfs.huggingface.co`, `worker-src 'self' blob:`, `wasm-unsafe-eval`)
    - _Requirements: 8.1–8.5 (zero network leakage), tech steering (PDF.js worker in public/)_

- [x] 2. Kiroween theme
  - [x] 2.1 Implement `tailwind.config.ts` with all Kiroween design tokens
    - Define `darkMode: 'class'` and all `theme.extend.colors`: ghost-void, ghost-crypt, ghost-tomb, ghost-mist, specter-100–900, ectoplasm-100–900, glow-100–600, parchment-100–900, shade-error/warn/success
    - Define `theme.extend.boxShadow`: glow-sm/md/lg, specter-sm/md, crypt-sm/md/lg
    - Define `theme.extend.backgroundImage`: parchment-texture, fog-radial
    - Define `theme.extend.keyframes` and `theme.extend.animation`: ghost-appear (150ms), ghost-appear-slow (200ms), shimmer, glow-pulse, float — all ≤ 200 ms per Req 10.6
    - _Requirements: 10.1 (Kiroween theme), 10.6 (≤200 ms transitions)_

  - [x] 2.2 Create `app/globals.css` with Tailwind base, custom keyframes, and reduced-motion override
    - Import Tailwind layers (`@tailwind base`, `components`, `utilities`)
    - Add `@media (prefers-reduced-motion: reduce)` block that sets `animation-duration: 0.01ms !important` and `transition-duration: 0.01ms !important` on `*, *::before, *::after`
    - Set `html, body` to `background-color: ghost-void`, `color: parchment-900`, `min-height: 100dvh`
    - Add global focus-ring style: `outline: 2px solid theme('colors.specter-300')` with `outline-offset: 2px`
    - _Requirements: 10.3 (visible focus ring ≥2px), 10.7 (prefers-reduced-motion)_

- [x] 3. IndexedDB schema and data models
  - [x] 3.1 Create `lib/db.ts` with GhostDocsDB Dexie class and all TypeScript interfaces
    - Define all exported TypeScript types and interfaces: `DocumentStatus`, `DocumentType`, `DocumentMetadata`, `DocumentRecord`, `EmbeddingStatus`, `ChunkRecord`, `EmbeddingRecord`, `CitationRecord`, `TimelineEntryRecord`, `AnswerRecord`, `CapsuleBundledData`, `CapsuleRecord`
    - Implement `GhostDocsDB extends Dexie` with version 1 schema: `documents: 'slug, status, ingestedAt'`, `chunks: 'chunkId, documentId, embeddingStatus, chunkIndex, [documentId+chunkIndex]'`, `embeddings: 'chunkId'`, `timelines: 'entryId, resolvedDate, sessionId, isImplicit'`, `answers: 'answerId, createdAt'`, `capsules: 'capsuleId, createdAt, capsuleVersion'`
    - Export singleton `export const db = new GhostDocsDB()`
    - _Requirements: 1.5–1.6 (chunk/embedding storage), 2.1–2.8 (capsule), 4.1–4.10 (answers), 5.1–5.10 (timeline)_

- [x] 4. Web Worker typed message protocol
  - [x] 4.1 Create `workers/types.ts` with all discriminated union message types
    - Define all parser worker types: `ParseDocumentRequest`, `ParseProgressMessage`, `ParsedPage`, `ParseCompleteMessage`, `ParseErrorMessage`; union types `ParserWorkerRequest`, `ParserWorkerMessage`
    - Define all embeddings worker types: `ChunkDocumentRequest`, `ChunkCompleteMessage`, `EmbedChunkRequest`, `EmbedQueryRequest`, `EmbedCompleteMessage`, `EmbedErrorMessage`, `ModelLoadProgressMessage`; union types `EmbeddingsWorkerRequest`, `EmbeddingsWorkerMessage`
    - _Requirements: 1.4 (main thread ≤50ms — worker isolation), 9.4 (main thread budget)_

- [x] 5. Parser Worker
  - [x] 5.1 Create `workers/parser.worker.ts` implementing PDF.js and plain-text/Markdown parsing
    - Set `GlobalWorkerOptions.workerSrc` to `/pdf.worker.min.mjs` at module initialisation
    - Handle `PARSE_DOCUMENT` messages: branch on `mimeType` to invoke PDF.js (`getDocument`) or plain-text/Markdown splitter
    - For PDFs: extract text page-by-page with `page.getTextContent()`, emit `PARSE_PROGRESS` after each page, detect password-protected files (emit `PARSE_ERROR` with `errorCode: 'PASSWORD_PROTECTED'`), skip and record corrupt pages (emit `PARSE_COMPLETE` with `skippedPages` array)
    - For Markdown/TXT: split on newlines, assign `lineOffset` values, emit `PARSE_COMPLETE` with a single `pages` array
    - Transfer `ArrayBuffer` inputs via Transferable to avoid main-thread copying
    - _Requirements: 1.4 (non-blocking), 1.9 (corrupt pages), 1.10 (password-protected), 9.4 (≤50ms main thread)_

- [x] 6. Core library functions
  - [x] 6.1 Create `lib/slug.ts` implementing the slug derivation algorithm
    - Export `deriveSlug(filename: string): string` — lowercase, replace whitespace and non-alphanumeric characters with hyphens, collapse consecutive hyphens, strip file extension
    - _Requirements: 1.8 (document-card-{slug} testid), 7.1 (stable slug key)_

  - [x] 6.2 Create `lib/chunker.ts` implementing 512-token / 50-token overlap windowing
    - Export `chunkText(text: string, maxTokens: number, overlapTokens: number): ChunkOutput[]`
    - Tokenise by whitespace-delimited words (word = token per spec)
    - Produce chunks of `tokenCount` in `[1, 512]` with 50-token overlap between consecutive chunks
    - If a single indivisible token exceeds 512 tokens, truncate and set `truncated: true`
    - Assign `chunkIndex` (0-based position) and propagate `pageNumber` / `lineOffset` from `ParsedPage` input
    - _Requirements: 1.5 (chunking rules), R-PBT-5, R-PBT-6_

  - [x] 6.3 Create `lib/search.ts` implementing cosine similarity ranking with `requestIdleCallback` batching
    - Export `cosineSimilarity(a: Float32Array, b: Float32Array): number` — returns value in `[-1.0, 1.0]`
    - Export `rankByCosine(query: Float32Array, embeddings: EmbeddingRecord[], batchSize?: number): Promise<RankedChunk[]>` — batch in groups of 100 via `requestIdleCallback`, return top-10 sorted descending, `{ timeout: 50 }`
    - Export `RankedChunk` type: `{ chunkId: string; score: number }`
    - _Requirements: 3.2 (≤500ms search), 3.8 (cosine range), 3.9 (determinism), 9.3–9.4, R-PBT-4, R-PBT-7_

  - [x] 6.4 Create `lib/embeddings.ts` as the main-thread wrapper around the embeddings worker
    - Instantiate `embeddings.worker.ts` via `new Worker(new URL('../workers/embeddings.worker.ts', import.meta.url))`
    - Export `embedQuery(queryText: string): Promise<Float32Array>` — sends `EMBED_QUERY` with a UUID `requestId`, resolves on matching `EMBED_COMPLETE`, rejects on `EMBED_ERROR` or 10 s timeout
    - Export `onModelLoadProgress(cb: (progress: number, status: string) => void): void`
    - Document the default model `Xenova/all-MiniLM-L6-v2` in a JSDoc comment
    - _Requirements: 8.3 (model source), 4.10 (10s timeout), 9.4_

- [x] 7. Embeddings Worker
  - [x] 7.1 Create `workers/embeddings.worker.ts` with Transformers.js inference and chunking logic
    - Import `@xenova/transformers` pipeline; set `env.cacheDir` to enable browser cache persistence (Req 8.3–8.4)
    - On startup, initialise the `feature-extraction` pipeline for `Xenova/all-MiniLM-L6-v2`; emit `MODEL_LOAD_PROGRESS` messages during loading, then `{ progress: 100, status: 'ready' }`
    - Handle `CHUNK_DOCUMENT`: invoke `lib/chunker.ts`-compatible chunking logic (or import chunker if bundler supports cross-worker imports), emit `CHUNK_COMPLETE`
    - Handle `EMBED_CHUNK`: run pipeline inference, transfer `Float32Array` via Transferable, emit `EMBED_COMPLETE { chunkId, vector }`
    - Handle `EMBED_QUERY`: run pipeline inference, emit `EMBED_COMPLETE { requestId, vector }`; emit `EMBED_ERROR` on failure
    - _Requirements: 1.5–1.6 (chunking, embedding), 8.3–8.4 (offline model), 9.4 (worker isolation)_

- [x] 8. Agent implementations
  - [x] 8.1 Create `lib/agents/archivist.ts`
    - Export `extractMetadata(documentId: string): Promise<DocumentMetadata>` — reads all `ChunkRecord`s for the document from IndexedDB, applies heuristic extraction for title (first non-empty line), date (first ISO 8601 / written date match), author (by-line patterns), documentType (from stored `mimeType`)
    - Export `generateSummary(documentId: string): Promise<string | null>` — concatenates first N chunk texts until 200 words are covered; returns a 1–200-word extractive summary or `null` if fewer than 20 words of body content exist (Req 2.7–2.8)
    - Export `checkDuplicate(slug: string): Promise<boolean>` — queries `db.documents` for existing `slug`
    - _Requirements: 2.1 (metadata extraction), 2.7–2.8 (summary), 6.1–6.4 (archivist panel outputs)_

  - [x] 8.2 Create `lib/agents/historian.ts`
    - Export `buildTimeline(sessionId: string): Promise<TimelineEntryRecord[]>` — reads all chunks from `db.chunks`, scans for explicit dates (ISO 8601 regex, written date patterns, fiscal year patterns) and implicit temporal signals, produces `TimelineEntryRecord[]` with `confidenceScore >= 0.8` for explicit and `< 0.8` for implicit entries
    - Sort output ascending by `resolvedDate` (nulls last), satisfying R-PBT-3
    - Attach `uncertaintyNotice` for ambiguous dates (Req 5.4) and for unresolved implicit signals (Req 5.1)
    - Export `incrementalUpdateTimeline(newDocumentId: string, sessionId: string): Promise<void>` — runs `buildTimeline` and merges new entries without removing existing ones (Req 5.9)
    - _Requirements: 5.1–5.10, R-PBT-3_

  - [x] 8.3 Create `lib/agents/researcher.ts`
    - Export `synthesiseAnswer(questionText: string, topChunks: Array<ChunkRecord & { score: number }>): AnswerRecord` — builds answer text exclusively from retrieved chunk text (zero hallucination, Req 4.7), attaches one `CitationRecord` per chunk used (excerpt ≤ 50 words verbatim from `chunk.text`), computes `confidenceScore` as arithmetic mean of chunk `score` values
    - Attach `uncertaintyNotice` when `confidenceScore < 0.6` with reason classification: `'insufficient_evidence'` if max score < 0.3, `'partial_coverage'` otherwise (Req 4.4–4.6)
    - Return a result with `chunkIds` referencing exactly the top-5 chunks passed in
    - Export `buildCitation(chunk: ChunkRecord, score: number): CitationRecord` as a pure helper
    - _Requirements: 4.1–4.10, R-PBT-1, R-PBT-2_

- [x] 9. Shadcn/ui component additions and shared UI primitives
  - [x] 9.1 Verify all required shadcn/ui components are installed and apply Kiroween token overrides
    - Confirm `components/ui/` contains: button, dialog, alert-dialog, progress, badge, scroll-area, tooltip, separator
    - Override the default `cn`-composed styles in each component to use Kiroween tokens (ghost-crypt backgrounds, specter-500 primary, parchment-900 text, glow-400 accent) without modifying `node_modules`
    - _Requirements: 10.2 (WCAG AA contrast in theme), 10.3 (focus rings)_

- [x] 10. Core GhostDocs UI components
  - [x] 10.1 Create `components/ghostdocs/UploadZone.tsx`
    - Render a drag-and-drop zone (`data-testid="upload-button"`) and hidden `<input type="file" multiple>` (`data-testid="upload-input"`) accepting `.pdf`, `.md`, `.markdown`, `.txt`
    - Validate MIME type AND extension per Req 1.2 before calling `onFilesAccepted`; render `data-testid="upload-error"` inline for each rejected file naming the filename and MIME type (Req 1.3)
    - Show `data-testid="duplicate-confirm"` confirmation prompt when `checkDuplicate()` returns true (Req 1.11)
    - Kiroween styling: ghost-crypt background, glow-sm shadow on drag-over, ghost-appear entry animation
    - Accessible: `aria-label`, keyboard-activatable (Enter/Space on the zone), visible focus ring
    - _Requirements: 1.1–1.3, 1.11, 10.3–10.4_

  - [x] 10.2 Create `components/ghostdocs/IngestionProgress.tsx`
    - Accept props `slug: string; stage: 'parsing' | 'chunking' | 'embedding' | 'complete' | 'error'`
    - Render shadcn `Progress` bar with label showing current stage; `data-testid="upload-progress"` (generic) and `data-testid="ingestion-progress-{slug}"` (per-document)
    - Render `data-testid="parse-warning-{slug}"` with skipped page numbers list when `skippedPages` is non-empty (Req 1.9)
    - Render `data-testid="embedding-warning-{chunkId}"` for each chunk marked `embedding_failed` (Req 1.6)
    - Hide component when `stage === 'complete'`
    - _Requirements: 1.6–1.7, 1.9_

  - [x] 10.3 Create `components/ghostdocs/DocumentCard.tsx`
    - Accept `document: DocumentRecord; onDelete: (slug: string) => void`
    - Render card with `data-testid="document-card-{slug}"`, showing filename, document type badge, detected date, author, page count, and summary (truncated to 3 lines with expand)
    - Render delete icon button with `data-testid="delete-document-{slug}"`; on click, open `DeleteConfirmDialog`
    - Apply parchment-texture background-image overlay, ghost-crypt base, crypt-sm shadow, ghost-appear animation on mount
    - If any metadata field is missing, display "Unknown [field name]" per Req 6.4
    - _Requirements: 1.8, 6.1, 6.4, 7.1, 7.3_

  - [x] 10.4 Create `components/ghostdocs/DeleteConfirmDialog.tsx`
    - Use shadcn `AlertDialog`; render `data-testid="delete-confirm-dialog"`
    - On confirm: call `onDelete(slug)`, which atomically deletes document + all chunks + all embeddings from IndexedDB and updates UI (Req 7.2, 7.4)
    - On partial failure: render `data-testid="delete-error-{slug}"` with failure description and leave document card visible (Req 7.5)
    - After full deletion, if Chunk_Store is empty, trigger display of `data-testid="search-empty-state"` and `data-testid="timeline-empty-state"` (Req 7.6)
    - _Requirements: 7.2–7.6_

  - [x] 10.5 Create `components/ghostdocs/DocumentList.tsx`
    - Use shadcn `ScrollArea`; render list of `DocumentCard` components; subscribe to Dexie live query on `db.documents` ordered by `ingestedAt` descending
    - Render `data-testid="search-empty-state"` with "Upload documents to begin searching." when no documents exist (Req 7.6)
    - _Requirements: 7.1, 7.6_

  - [x] 10.6 Create `components/ghostdocs/SearchBar.tsx`
    - Render `<input>` with `data-testid="search-input"` and submit button with `data-testid="search-submit"`
    - Validate non-empty / non-whitespace on submit; if invalid, show inline error and do not call `onSearch` (Req 3.4); if Chunk_Store is empty, show "no documents" message (Req 3.5)
    - Support Enter keypress to submit (Req 10.4)
    - _Requirements: 3.1, 3.4–3.5, 10.4_

  - [x] 10.7 Create `components/ghostdocs/SearchResults.tsx` and `SearchResultCard.tsx`
    - `SearchResults` renders ordered list of up to 10 results; shows "no relevant passages found" message when result list is empty but corpus is non-empty (Req 3.6)
    - `SearchResultCard` renders: verbatim passage, source document name, page number or line reference, cosine similarity score rounded to 2 decimal places (Req 3.3)
    - On result card click, scroll `document-card-{slug}` into viewport (Req 3.7)
    - Assign `data-testid="search-result-{chunkId}"` to each card
    - _Requirements: 3.2–3.7_

  - [x] 10.8 Create `components/ghostdocs/CitationBadge.tsx` and `UncertaintyNotice.tsx`
    - `CitationBadge`: render shadcn `Badge` with `data-testid="citation-{chunkId}"`; wrap in shadcn `Tooltip` showing document name, page/line, and verbatim excerpt on hover
    - `UncertaintyNotice`: render `data-testid="uncertainty-notice"` block with amber/glow styling, icon, and plain-language explanation text (Req 4.4–4.5, 5.4)
    - _Requirements: 4.5, 4.8, 5.4_

  - [x] 10.9 Create `components/ghostdocs/AnswerBlock.tsx`
    - Accept `answer: AnswerRecord`; render `data-testid="response-block"` containing synthesised text, multiple `CitationBadge` components (one per citation when `citations.length > 1`, Req 4.8), and optional `UncertaintyNotice`
    - Apply ghost-appear animation on mount
    - _Requirements: 4.2, 4.5, 4.8_

  - [x] 10.10 Create `components/ghostdocs/TimelineEntry.tsx` and `TimelineContainer.tsx`
    - `TimelineEntry`: render event description (≤500 chars), resolved date or date range, confidence score chip, citation badges, and optional `UncertaintyNotice` beneath the entry description (Req 5.3–5.4)
    - `TimelineContainer`: accept `entries: TimelineEntryRecord[]`; sort ascending by `resolvedDate` (nulls last) before render; wrap in `data-testid="timeline-container"`; use shadcn `ScrollArea`
    - Render `data-testid="timeline-empty-state"` with "No temporal signals were found…" when `entries` is empty (Req 5.5)
    - _Requirements: 5.1–5.6, R-PBT-3_

  - [x] 10.11 Create `components/ghostdocs/ArchivistPanel.tsx`, `HistorianPanel.tsx`, `ResearcherPanel.tsx`
    - Each panel renders: `data-testid="agent-{name}"` container, `data-testid="agent-{name}-loading"` spinner (visible while processing), `data-testid="agent-{name}-error"` error block (visible on error, no stack traces, Req 6.7)
    - On each new query/ingest cycle, clear stale output and show loading indicator in the same render tick (Req 6.6)
    - `ArchivistPanel`: renders document metadata grid per ingested document; `HistorianPanel`: renders `TimelineContainer`; `ResearcherPanel`: renders list of `AnswerBlock` components
    - _Requirements: 6.1–6.7_

  - [x] 10.12 Create `components/ghostdocs/CapsuleControls.tsx`
    - Render `data-testid="capsule-create-button"` (triggers Archivist bundle operation, Req 2.1), `data-testid="capsule-export-button"` (triggers JSON download, Req 2.2), `data-testid="capsule-import-input"` (hidden `<input type="file" accept=".json">`, Req 2.3–2.6)
    - Show progress/loading state during capsule creation (up to 10s for 50 docs, Req 2.1)
    - _Requirements: 2.1–2.6_

- [x] 11. Time Capsule feature (`lib/capsule.ts`)
  - [x] 11.1 Implement Time Capsule creation, export, and import logic
    - Export `createCapsule(): Promise<CapsuleRecord>` — reads all documents, chunks, embeddings, and timeline entries from IndexedDB; converts `Float32Array` vectors to `number[]` for JSON compatibility; wraps in `CapsuleBundledData`; writes `CapsuleRecord` to `db.capsules`; completes within 10s for ≤50 docs (Req 2.1)
    - Export `exportCapsule(capsuleId: string): void` — serialises capsule to UTF-8 JSON, triggers browser download with filename `ghostdocs-capsule-{YYYY-MM-DD}.json` using UTC date (Req 2.2)
    - Export `importCapsule(file: File): Promise<ImportResult>` — validates JSON structure and `capsuleVersion`; aborts with zero writes if malformed (Req 2.4); aborts with error if `capsuleVersion > CURRENT_CAPSULE_VERSION` (Req 2.6); uses Dexie `bulkPut` in `add` mode (skip existing keys, Req 2.3); returns `{ restoredCount, skippedCount }` (Req 2.3); reconstructs `Float32Array` from `number[]` arrays
    - Export `CURRENT_CAPSULE_VERSION = 1` constant
    - _Requirements: 2.1–2.8_

- [x] 12. Root GhostDocsApp orchestrator
  - [x] 12.1 Create `components/ghostdocs/GhostDocsApp.tsx` as the root client orchestrator
    - Marked `'use client'`; instantiates `parser.worker.ts` and `embeddings.worker.ts` via `useRef` on mount; tears down workers on unmount
    - Subscribes to Dexie live queries (`useLiveQuery`) for `documents`, `chunks`, `timelines`, `answers`
    - Routes `ParserWorkerMessage` events: `PARSE_COMPLETE` → trigger chunking via embeddings worker; `PARSE_ERROR` → update document status and agent error state
    - Routes `EmbeddingsWorkerMessage` events: `CHUNK_COMPLETE` → `db.chunks.bulkAdd`; `EMBED_COMPLETE` → `db.embeddings.add`, update chunk status; `MODEL_LOAD_PROGRESS` → update model load progress bar
    - Coordinates the full ingestion pipeline (Req 1.4–1.8), Archivist post-ingestion trigger, Historian incremental update trigger (Req 5.9)
    - Provides ARIA live region (`role="status"`, `aria-live="polite"`) for announcing state changes (Req 10.5)
    - Renders full layout: `UploadZone`, `DocumentList`, `SearchBar`, `SearchResults`, `ArchivistPanel`, `HistorianPanel`, `ResearcherPanel`, `CapsuleControls`
    - _Requirements: 1.4–1.8, 5.9, 9.4–9.5, 10.5_

- [x] 13. App Router pages
  - [x] 13.1 Create `app/layout.tsx` (server component) and `app/page.tsx` (dynamic import)
    - `app/layout.tsx`: server component; applies `dark` class to `<html>` element permanently; imports `globals.css`; sets `<html lang="en">`; no document data access
    - `app/page.tsx`: server component shell; dynamically imports `GhostDocsApp` via `next/dynamic` with `{ ssr: false }` to prevent build-time SSR failures from IndexedDB / Web Worker APIs; renders a static loading skeleton visible before hydration
    - _Requirements: 8.1 (no server-side document processing), 10.1 (dark class permanent)_

- [x] 14. Checkpoint — Build verification
  - Run `next build` and confirm the `out/` directory is produced with zero errors or warnings
  - Run `tsc --noEmit` and confirm zero TypeScript errors
  - Ensure all `data-testid` attributes from the requirements contract table are present in the component files (grep check)
  - Ask the user if they have any questions before proceeding to tests.

- [x] 15. Test fixtures
  - [x] 15.1 Create `tests/fixtures/sample.pdf`, `tests/fixtures/sample.md`, and `tests/fixtures/sample.txt`
    - `sample.pdf`: a synthetic 3-page PDF containing at least one explicit ISO 8601 date ("The project launched on 2023-06-15"), one written date ("On the fourteenth of March 2022"), one fiscal year reference ("Q3 FY2024"), and the canary phrase `ghostdocs-canary-secret-phrase-xq7z` for network-leakage testing; contains a citable passage for Researcher tests
    - `sample.md`: a synthetic Markdown file with headings, a date in prose ("Following the merger in September 2021"), and passages that can be used for cross-document citation tests
    - `sample.txt`: a synthetic plain-text file with an implicit temporal signal ("In the previous quarter, revenues fell") and conflicting information about the same topic covered differently in `sample.md`
    - All content must be entirely synthetic and non-sensitive
    - _Requirements: test fixtures (testing steering), R-PBT-7 (canary phrase)_

- [x] 16. Vitest unit tests
  - [x] 16.1 Create `tests/unit/slug.test.ts` — unit tests for `lib/slug.ts`
    - Test cases: filename with spaces, filename with mixed case, filename with special characters, filename with consecutive hyphens, filename with extension stripping
    - _Requirements: 1.8 (slug derivation correctness)_

  - [x] 16.2 Create `tests/unit/chunker.test.ts` — property-based and unit tests for `lib/chunker.ts`
    - Unit tests: single-token document, exact 512-token document, document requiring overlap, truncation flag for oversized indivisible token
    - Property test for **Property 5 (Chunk Size Invariant)**: `fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 50000 }), (text) => chunks.every(c => c.tokenCount >= 1 && c.tokenCount <= 512)))`, 100 runs
    - Property test for **Property 6 (Chunking Coverage Round-Trip)**: for any generated text, every non-whitespace character from the original is present in the joined chunk texts, 100 runs
    - **Validates: R-PBT-5, R-PBT-6, Req 1.5**
    - _Requirements: 1.5, R-PBT-5, R-PBT-6_

  - [x] 16.3 Create `tests/unit/search.test.ts` — property-based tests for `lib/search.ts`
    - Unit tests: identical vectors produce score 1.0, orthogonal vectors produce score 0.0, opposing vectors produce score -1.0, zero vector handled without NaN/Infinity
    - Property test for **Property 4 (Cosine Similarity Range)**: `fc.assert(fc.property(fc.array(fc.float(), { minLength: 384, maxLength: 384 }), fc.array(fc.float(), { minLength: 384, maxLength: 384 }), (a, b) => { const s = cosineSimilarity(new Float32Array(a), new Float32Array(b)); return s >= -1.0 && s <= 1.0; }))`, 100 runs
    - **Validates: R-PBT-4, Req 3.8**
    - _Requirements: 3.8–3.9, R-PBT-4_

  - [x] 16.4 Create `tests/unit/historian.test.ts` — property-based tests for chronological sort in `lib/agents/historian.ts`
    - Unit tests: explicit ISO date extraction, written date parsing, fiscal year reference detection, implicit signal detection, `uncertaintyNotice` attached to implicit entries
    - Property test for **Property 3 (Chronological Ordering)**: generate shuffled arrays of `TimelineEntryRecord` with arbitrary `resolvedDate` ISO strings, assert sorted output is non-decreasing, 100 runs
    - **Validates: R-PBT-3, Req 5.2, 5.6–5.7**
    - _Requirements: 5.1–5.7, R-PBT-3_

  - [x] 16.5 Create `tests/unit/researcher.test.ts` — property-based tests for `lib/agents/researcher.ts`
    - Unit tests: `buildCitation` excerpt is verbatim substring of chunk text, `confidenceScore` is mean of input scores, `uncertaintyNotice` is non-null when score < 0.6, `uncertaintyNotice` is null when score >= 0.6
    - Property test for **Property 1 (Citation Integrity Round-Trip)**: generate arbitrary chunk texts, assert `citation.excerpt` is always a substring of the source chunk text, 100 runs
    - Property test for **Property 2 (Confidence Score Range)**: generate varied cosine score distributions `(0.0–1.0)`, assert output `confidenceScore` always in `[0.0, 1.0]`, 100 runs
    - Property test for **Property 10 (Low-Confidence Answers Include Uncertainty Notice)**: for any answer with `confidenceScore < 0.6`, `uncertaintyNotice` is non-null and non-empty, 100 runs
    - **Validates: R-PBT-1, R-PBT-2, Properties 1, 2, 10**
    - _Requirements: 4.2–4.6, 4.9, R-PBT-1, R-PBT-2_

  - [x] 16.6 Create `tests/unit/capsule.test.ts` — unit tests for `lib/capsule.ts`
    - Test: `Float32Array` round-trips correctly through `number[]` JSON serialisation and back
    - Test: import with `capsuleVersion > CURRENT_CAPSULE_VERSION` throws/rejects before any IndexedDB write
    - Test: import of malformed JSON leaves state unchanged
    - Test: duplicate `chunkId` on import is skipped without error; `skippedCount` is reported correctly
    - _Requirements: 2.3–2.6_

- [x] 17. Playwright E2E tests
  - [x] 17.1 Create `tests/e2e/upload.spec.ts`
    - Happy path: drag-and-drop `sample.pdf` → verify `ingestion-progress-{slug}` cycles through `parsing` → `chunking` → `embedding` → `document-card-{slug}` appears; verify `agent-archivist` shows extracted metadata
    - Error cases: upload unsupported `.docx` → `upload-error` appears with filename and MIME type; upload password-protected PDF mock → `upload-error` shows password message
    - Duplicate detection: upload same file twice → `duplicate-confirm` dialog appears; cancel → card unchanged; confirm → re-ingestion completes
    - Axe-core accessibility scan after each major state change
    - _Requirements: 1.1–1.12_

  - [x] 17.2 Create `tests/e2e/search.spec.ts`
    - Happy path: upload `sample.pdf`, submit a query matching known content → top results include expected passage, source name, page number, score; all within 500ms (`Date.now()` before submit → `waitForSelector` of first result)
    - Empty query: submit whitespace → `search-input` error shown, no results rendered
    - Empty corpus: no documents uploaded → "no documents" message shown
    - **Property 7 (Search Determinism E2E)**: submit identical query twice, assert `data-testid="search-result-*"` elements are identical in both order and content
    - Axe-core scan on results state
    - _Requirements: 3.1–3.9, R-PBT-8_

  - [x] 17.3 Create `tests/e2e/timeline.spec.ts`
    - Happy path: upload `sample.pdf` and `sample.md`, request timeline → `timeline-container` renders; entries appear in ascending date order; each entry shows description, date, confidence score, citation badge
    - Ambiguous date: `sample.pdf` contains fiscal year ref → corresponding entry has `uncertainty-notice` inline
    - Empty corpus: "No temporal signals were found…" message shown in `timeline-container`
    - Incremental update: add `sample.txt` after initial timeline → new events appear without removing existing entries
    - Axe-core scan
    - _Requirements: 5.1–5.10, R-PBT-3_

  - [x] 17.4 Create `tests/e2e/agents.spec.ts`
    - Archivist panel: upload document → `agent-archivist` shows metadata fields; missing field shows "Unknown [field name]"
    - Researcher panel: submit question → `agent-researcher-loading` visible during processing → `response-block` renders with synthesised text and `citation-{chunkId}` badges; confidence < 0.6 → `uncertainty-notice` visible
    - Historian panel: `agent-historian` renders `timeline-container`
    - Loading/error states: simulate worker timeout (mock) → `agent-researcher-error` shown without stack trace
    - Axe-core scan on all three panel states
    - _Requirements: 4.1–4.10, 6.1–6.7_

  - [x] 17.5 Create `tests/e2e/capsule.spec.ts`
    - Happy path: upload documents → click `capsule-create-button` → click `capsule-export-button` → JSON file downloaded; re-import via `capsule-import-input` → documents and timeline restored; `restoredCount` reported
    - Duplicate import: import same capsule twice → second import reports `skippedCount > 0`
    - Malformed JSON: import invalid `.json` → error message shown, no state change
    - Version guard: import capsule with `capsuleVersion = 999` → error message indicates newer app version required
    - Axe-core scan
    - _Requirements: 2.1–2.8_

  - [x] 17.6 Create `tests/e2e/document-management.spec.ts`
    - Delete happy path: upload `sample.pdf` → `delete-document-{slug}` → `delete-confirm-dialog` → confirm → card removed, `db.chunks` has no records for that `documentId`
    - **Property 9 (Deletion Completeness E2E)**: after deletion, search for a phrase unique to the deleted document → zero results referencing that document's slug
    - Empty corpus after deletion: `search-empty-state` and `timeline-empty-state` shown
    - Axe-core scan
    - _Requirements: 7.1–7.6, R-PBT-9_

  - [x] 17.7 Create `tests/e2e/privacy.spec.ts`
    - **Property 8 (Zero Network Leakage E2E)**: register `page.on('request', ...)` before uploading a document containing `ghostdocs-canary-secret-phrase-xq7z`; perform upload, search, answer generation, timeline generation; assert no captured request URL, body, or headers contains the canary string
    - Verify that all non-model-weight requests match `'self'` origin only
    - Axe-core scan
    - _Requirements: 8.1–8.5, R-PBT-7_

  - [x] 17.8 Create `tests/e2e/accessibility.spec.ts`
    - Run axe-core on: initial empty state, post-upload state with documents, search results state, timeline state, researcher answer state, capsule controls visible state
    - Assert zero violations for each state
    - Keyboard navigation test: Tab through all interactive elements; verify focus moves in logical order; Enter activates upload, Space activates delete; Escape closes dialogs
    - Focus ring test: verify each focused element has a CSS outline visible (check `getComputedStyle` `outline-width >= '2px'`)
    - _Requirements: 10.1–10.7_

- [x] 18. CI configuration
  - [x] 18.1 Create `.github/workflows/ci.yml` GitHub Actions workflow
    - Trigger on `push` and `pull_request` to `main`
    - Jobs: `typecheck` (`tsc --noEmit`), `unit-tests` (`npx vitest run --coverage`), `e2e-tests` (`next build && npx playwright test --reporter=html`), `build` (`next build`)
    - Install Playwright browsers with `npx playwright install --with-deps chromium`
    - Upload Playwright HTML report as artefact on failure
    - Cache `node_modules` and Playwright browser binaries between runs
    - Fail the PR if unit test coverage for `lib/` falls below 80% line coverage
    - _Requirements: CI requirements (testing steering)_

- [x] 19. Final checkpoint — Full suite verification
  - Run `tsc --noEmit` — assert zero TypeScript errors
  - Run `npx vitest run` — assert all unit tests pass and coverage threshold met
  - Run `next build` — assert static export succeeds with zero errors or warnings
  - Ask the user if they have any questions or want to adjust any tasks before marking the spec complete.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP iteration; however, no tasks are marked optional in this spec because all requirements are considered MVP scope per the product steering document.
- The design document specifies Transformers.js v2 (`@xenova/transformers`) as the embedding package — use this unless the user explicitly requests v3 (`@huggingface/transformers`).
- The embeddings worker handles both chunking and embedding to avoid cross-worker import complexities; this matches the design's sequence diagram where `CHUNK_DOCUMENT` is sent to the embeddings worker.
- All `data-testid` values must exactly match the canonical contract table in `requirements.md` — any divergence will break E2E selectors.
- Dexie `bulkAdd` throws on duplicate keys by default; use `bulkPut` in "add" mode (or wrap in try/catch) for capsule import to achieve silent-skip behaviour per Req 2.3.
- The `requestIdleCallback` batching in `lib/search.ts` is the primary mechanism for keeping cosine search under 500ms without blocking the main thread; do not replace it with a synchronous loop.
- PDF.js `GlobalWorkerOptions.workerSrc` must be set before any `getDocument` call; set it at the top of `parser.worker.ts` module scope.
- Property-based tests use `fast-check` with `numRuns: 100`; do not lower this threshold in CI.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1", "2.2", "4.1"] },
    { "id": 3, "tasks": ["3.1", "6.1"] },
    { "id": 4, "tasks": ["5.1", "6.2", "6.3", "6.4", "9.1"] },
    { "id": 5, "tasks": ["7.1", "8.1", "8.2", "8.3", "11.1"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12"] },
    { "id": 7, "tasks": ["12.1"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["15.1"] },
    { "id": 10, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5", "16.6"] },
    { "id": 11, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6", "17.7", "17.8"] },
    { "id": 12, "tasks": ["18.1"] }
  ]
}
```
