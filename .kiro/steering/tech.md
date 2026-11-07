# GhostDocs — Tech Stack & Architecture Steering

## Architecture Constraint: Browser-Only

**GhostDocs is strictly a client-side application.** There is no backend server, no API routes that touch user data, and no server-side rendering of document content. All processing — parsing, embedding, search, inference — happens inside the user's browser tab.

Enforce this at every layer:
- Next.js is used as a **static export** (`output: 'export'` in `next.config.ts`). API routes that handle user document data are forbidden.
- All heavy processing runs in **Web Workers** to keep the main thread responsive.
- Persistence uses **IndexedDB** (via Dexie.js) — never `localStorage` for binary or large data.

---

## Core Technologies

### Next.js 15
- Version: 15.x (App Router).
- Config: `output: 'export'` — produces a fully static build deployable to any static host.
- Use server components only for static layout/shell; no server components touch document data.
- Client components that use browser APIs must be guarded with `'use client'` and dynamic imports where needed for SSR compatibility during the build step.

### TypeScript
- Strict mode enabled (`"strict": true` in `tsconfig.json`).
- No `any` types — use `unknown` and narrow explicitly.
- Prefer `type` aliases for plain data shapes, `interface` for extensible contracts.
- All files: `.ts` or `.tsx`.

### Tailwind CSS
- Version: 4.x.
- Utility-first; avoid writing raw CSS except for keyframe animations defined in `globals.css`.
- Kiroween theme tokens (colours, shadows, blur radii) are defined in `tailwind.config.ts` under `theme.extend` — never hard-code hex values in component files.
- Dark mode is `class`-based but the `dark` class is permanently applied to `<html>` — do not provide a toggle.

### shadcn/ui
- Component library built on Radix UI primitives.
- Add components via `npx shadcn@latest add <component>` — do not copy-paste component source manually.
- Customise via the component file in `components/ui/` after adding; do not modify `node_modules`.
- Use Lucide icons exclusively (already a shadcn/ui dependency).

### IndexedDB via Dexie.js
- All persistent state (documents, chunks, embeddings, chat history) lives in IndexedDB.
- Define the database schema in a single `lib/db.ts` file using Dexie's typed table API.
- Migrations are handled via Dexie version increments — never drop and recreate the DB.
- Do not store raw `ArrayBuffer` embeddings in a single giant row; store per-chunk embeddings as individual rows keyed by `chunkId`.

### PDF.js (`pdfjs-dist`)
- Use the `pdfjs-dist` npm package.
- The worker script (`pdf.worker.min.mjs`) must be served from `public/` or loaded via CDN — set `GlobalWorkerOptions.workerSrc` before any PDF operation.
- Extract text page-by-page; store page number alongside each text chunk for citation purposes.
- Never block the main thread — wrap PDF parsing in a Web Worker.

### Offline embedding feature extractor (Web Worker)
- Embeddings come from `computeDeterministicEmbedding` in `workers/embeddings.worker.ts`: a deterministic, hash-based 384-dimensional **lexical** feature extractor (word hashes, 4-char stems, character trigrams, tanh, L2 normalisation).
- It runs fully offline: no model download, no network requests, no WASM.
- It is **not** a neural or semantic model. It matches on shared words, stems and trigrams and does not understand synonyms. Do not describe search as "semantic" without that qualification.
- Always run embedding generation in the dedicated Web Worker, never in a React component or on the main thread.
- Communicate with the worker via `postMessage` / `onmessage`; use a typed message protocol defined in `workers/types.ts`.
- Identifier: `ghostdocs-lexical-hash-384-v1` (`EMBEDDING_MODEL_ID` in the worker, `DEFAULT_EMBEDDING_MODEL` in `lib/embeddings.ts`). Bump it if the algorithm changes so stored vectors can be identified.
- A neural model (e.g. all-MiniLM-L6-v2 via Transformers.js) is a possible opt-in future feature, only with explicit user consent for the download. `@xenova/transformers` remains in `package.json` but is currently unused.

---

## Project Structure

```
/app                  # Next.js App Router pages and layouts
/components
  /ui                 # shadcn/ui base components (generated)
  /ghostdocs          # GhostDocs-specific composed components
/lib
  db.ts               # Dexie.js database definition
  embeddings.ts       # Embedding model wrapper (calls worker)
  chunker.ts          # Document chunking logic
  search.ts           # Vector similarity search (cosine)
/workers
  embeddings.worker.ts  # Chunking + offline lexical feature extractor worker
  parser.worker.ts      # PDF.js + text parsing worker
  types.ts              # Shared message types for workers
/public
  pdf.worker.min.mjs  # PDF.js worker script
/styles
  globals.css         # Tailwind base + custom keyframes
```

---

## Performance Expectations

- First Contentful Paint on a cold load (no cached models): ≤ 3 s on a mid-range laptop.
- Document ingestion (10-page PDF): ≤ 5 s total including chunking and embedding.
- Search query response (≤ 1 000 chunks in DB): ≤ 500 ms.
- Main thread must never block for > 50 ms during ingestion or search.

---

## Dependency Rules

- Pin all dependency versions exactly in `package.json` (no `^` or `~`).
- Do not add server-side-only Node.js packages (e.g., `fs`, `path`, native addons) as runtime dependencies.
- Prefer packages with ESM builds and good tree-shaking.
