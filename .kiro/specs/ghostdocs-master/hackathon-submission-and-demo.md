# GhostDocs — Devpost Hackathon Submission & 3-Minute Demo Script

> ⚡ **Instant Live Demo for Judges:** Visit [https://miladmet.github.io/ghostdocs/](https://miladmet.github.io/ghostdocs/), click **🔮 Load Sample Vault (Instant Demo)**, and click either suggested question pill to see the full AI Crew synthesis, verbatim citations, and timeline in 5 seconds.

---

## Part 1: Devpost Submission Write-up (Prompt 14)

### What It Does
**GhostDocs** is a 100% browser-local knowledge resurrection platform that brings forgotten organizational documents back to life. Users drop PDF, Markdown, and plain-text files into a dark-mode **Kiroween Time Capsule**, where a three-agent AI Crew collaborates entirely inside the browser tab:
- **🗄️ The Archivist** catalogs structural metadata (titles, dates, authors, document types), flags duplicate uploads, and writes 1–200 word extractive summaries.
- **📜 The Historian** scans every chunk for explicit ISO/written dates, fiscal year references (`Q3 FY2024`), and implicit temporal cues (`"in the previous quarter"`), reconstructing an interactive chronological timeline with confidence scores and date-ambiguity notices.
- **🔍 The Researcher** performs sub-500ms lexical vector search (cosine similarity over deterministic 384-dimensional hash-based embeddings computed offline in a Web Worker; it matches shared words, stems and trigrams, not synonyms or meaning) and synthesizes source-cited answers with verbatim passage badges (`<= 50` words) and explicit uncertainty notices whenever confidence falls below `0.60`.

Users can seal their entire session—documents, chunks, 384-dimensional embeddings, summaries, and timelines—into a portable `ghostdocs-capsule-YYYY-MM-DD.json` file that can be shared and restored offline.

### Inspiration
Whenever projects sunset or teams reorganize, critical institutional context gets buried in dead folders of PDFs, markdown postmortems, and text logs. Organizations are often reluctant to upload confidential postmortems or financial audits into cloud RAG services due to data-leakage risks, and standard chatbots frequently hallucinate or strip away chronological causality. We wanted to prove that a **zero-backend, browser-only multi-agent RAG & timeline system** could be fast, verifiable, accessible, and atmospheric.

### How We Built It
- **Frontend & Static Architecture:** Next.js (`output: 'export'`), React 19, TypeScript (`strict: true`), Tailwind CSS v4, and `shadcn/ui` styled with custom Kiroween tokens (`ghost-void`, `ghost-crypt`, `specter-*`, `ectoplasm-*`, `glow-*`, `parchment-*`).
- **Web Worker Pipeline:** `workers/parser.worker.ts` runs `pdfjs-dist` page-by-page without blocking the UI thread (`<= 50ms`), while `workers/embeddings.worker.ts` runs 512-token overlapping chunking and a deterministic offline lexical feature extractor (no model download, no network) for embeddings, using zero-copy `Transferable` `ArrayBuffer` and `Float32Array` messages.
- **IndexedDB Persistence:** `lib/db.ts` defines a typed 6-table `Dexie.js` database (`documents`, `chunks`, `embeddings`, `timelines`, `answers`, `capsules`) with compound secondary indexes (`[documentId+chunkIndex]`).
- **Property-Based & E2E Verification:** 6 Vitest + `fast-check` test suites (100 runs per property) and 8 Playwright E2E + `@axe-core/playwright` accessibility test suites.

### How Kiro Was Used
We used Kiro's full **Spec-Driven Development** workflow from Phase 0:
1. **Steering First (`.kiro/steering/`):** Before generating a single line of code, we authored four steering constitutions (`product.md`, `tech.md`, `principles.md`, `testing.md`). Every Kiro sub-agent automatically inherited our browser-only rule, zero-hallucination citation mandate, and `data-testid` selector contract.
2. **Unified Master Spec (`.kiro/specs/ghostdocs-master/`):**
   - `requirements.md`: 10 EARS-syntax requirements (82 acceptance criteria), 9 Property-Based Test invariants (`R-PBT-1` to `R-PBT-9`), and a full traceability matrix.
   - `design.md`: 1,158 lines of component trees, Mermaid sequence diagrams, Dexie schemas, typed worker unions, and WCAG AA contrast tables.
   - `tasks.md`: 19 top-level tasks (54 subtasks across 13 dependency waves).
3. **Kiro Hooks (`.kiro/hooks/`):** Configured lifecycle hooks for the Document Upload pipeline, Question Asked Crew synthesis, and Time Capsule creation to enforce property tests automatically when core modules change.

### Challenges We Ran Into
- **Keeping Main Thread Blocking Under 50ms:** Running PDF text extraction, 384-dimensional vector inference, and cosine similarity over 1,000 chunks can easily freeze the browser UI. We solved this by moving all parsing and embedding into dedicated Web Workers with `Transferable` buffers and batching cosine similarity across `requestIdleCallback` slices (`{ timeout: 50 }`).
- **Mathematically Guaranteeing Verbatim Citations (`R-PBT-1`):** `fast-check` property testing revealed that naive whitespace splitting (`split(/\s+/).join(' ')`) fails exact substring checks when source documents contain newlines or multiple spaces. We engineered span-based regex slicing in `extractVerbatimPassage` so every citation excerpt is a guaranteed exact substring of its source chunk.

### Accomplishments That We're Proud Of
- **True Zero Network Leakage (`R-PBT-7`):** Proven via Content Security Policy headers and Playwright network interception tests using canary strings (`ghostdocs-canary-secret-phrase-xq7z`).
- **100% WCAG AA Compliance in a Spooky Dark Theme:** Every major application state passes `@axe-core/playwright` with zero violations while maintaining a distinctive Kiroween aesthetic.
- **Complete Spec-to-Test Traceability:** Every requirement maps directly to a `data-testid` contract and automated `fast-check` or Playwright assertion.

### What We Learned
- Writing **Kiro Steering** documents *before* opening Spec mode dramatically increases the precision of Kiro's requirement detailers and task generators.
- Property-based testing (`fast-check`) pairs naturally with EARS requirements to catch subtle edge cases in text chunkers, date parsers, and vector math.

### What's Next for GhostDocs
- Optional opt-in neural embedding model (e.g. all-MiniLM-L6-v2 via Transformers.js) for true semantic search, downloaded only with explicit user consent. Today's search is lexical and does not match synonyms.
- Optional WebGPU local LLM synthesis (`WebLLM`) alongside extractive synthesis.
- Peer-to-peer encrypted Time Capsule sharing over WebRTC.
- Additional local parsers for `.docx`, `.pptx`, and `.epub` archives.

---

## Part 2: Winning 3-Minute Demo Video Script (Prompt 15)

### `[0:00 – 0:25]` Hook & The Problem (Presentation & Impact)
- **Visual:** Dark screen fading into the GhostDocs Kiroween interface (`ghost-void` fog background, glowing purple/amber header). Quick cut of a cluttered folder of dead project PDFs, markdown postmortems, and old budget `.txt` files.
- **Narration:** *"Every year, organizations lose critical institutional memory when projects end and teams move on. Sensitive postmortems, architecture reviews, and financial logs sit forgotten—because uploading confidential files to cloud AI risks data leakage, and generic chatbots hallucinate facts without provenance. Meet **GhostDocs**: a 100% browser-local AI Crew that resurrects forgotten organizational knowledge with zero network leakage."*

### `[0:25 – 1:05]` Kiro Spec-Driven Engineering (Kiro Usage)
- **Visual:** Split-screen showing Kiro IDE with `.kiro/steering/` (`principles.md`, `tech.md`), `.kiro/specs/ghostdocs-master/` (`requirements.md`, `design.md` Mermaid diagrams, `tasks.md` 13 dependency waves), and `.kiro/hooks/`.
- **Narration:** *"We built GhostDocs using Kiro’s Spec-Driven workflow from Phase 0. First, we established four Steering files enforcing our non-negotiable hierarchy: 100% browser-local privacy, zero hallucination, mandatory verbatim citations, and explicit uncertainty scoring. From there, Kiro generated 82 EARS acceptance criteria, 9 `fast-check` property-based test invariants, a 1,158-line technical design, and 54 implementation tasks across 13 dependency waves."*

### `[1:05 – 1:45]` Live Demo: Uploading Forgotten Documents & The Archivist + Historian (Innovation)
- **Visual:** Drag and drop `sample.pdf`, `sample.md`, and `sample.txt` into the `UploadZone`. Show the real-time `parsing → chunking → embedding` progress bar powered by Web Workers (`pdfjs-dist` + the offline lexical feature extractor).
- **Visual:** Pan to **The Archivist** panel (`agent-archivist`) displaying extracted titles, authors (`Clara Vance`, `Evelyn Cross`), dates, and extractive summaries. Then pan to **The Historian** panel (`agent-historian`) showing the reconstructed chronological timeline (`2021-09-01` → `2022-03-14` → `2023-06-15` → `2024-07-01` → `2024-09-14`). Hover over the amber **Uncertainty Notice** on `Q3 FY2024` and `"in the previous quarter"`.
- **Narration:** *"When we drop forgotten PDF, Markdown, and text files into the Time Capsule, Web Workers extract text and generate 384-dimensional lexical feature vectors locally, with no model download, in under 5 seconds without blocking the UI. Immediately, **The Archivist** catalogs metadata and summaries, while **The Historian** reconstructs a chronological timeline—automatically flagging fiscal-versus-calendar date ambiguities and implicit temporal signals with confidence scores."*

### `[1:45 – 2:30]` Live Demo: The Researcher, Citations & Zero Network Leakage (Innovation & Impact)
- **Visual:** Open Chrome DevTools Network tab (or show offline mode). Type *"What was the Q3 budget allocation and when was the security constitution ratified?"* into the search bar and click **Resurrect**.
- **Visual:** Show sub-500ms ranked passages and **The Researcher** panel (`response-block`) rendering a synthesized answer with interactive citation badges (`citation-{chunkId}`). Hover over a badge to show the verbatim excerpt tooltip. Click a search result to scroll its `DocumentCard` into view.
- **Narration:** *"Now let's ask a question with the Network tab open. Using `requestIdleCallback` cosine similarity over IndexedDB, **The Researcher** retrieves the top passages in under 500 milliseconds and synthesizes an answer grounded strictly in our files. Every claim has a hoverable verbatim citation badge, and look at the Network tab: zero bytes of document data ever leave the browser."*

### `[2:30 – 3:00]` Time Capsule Export & Closing (Presentation & Impact)
- **Visual:** Click **Create Time Capsule** → **Export Capsule** (`ghostdocs-capsule-2026-11-01.json` downloads). Flash terminal showing `vitest` property-based tests (100 runs/property) and `playwright` E2E + `axe-core` tests passing green.
- **Narration:** *"Finally, with one click, we seal our entire vault—documents, embeddings, summaries, and timelines—into a portable JSON Time Capsule that any teammate can import offline. Built with Kiro Steering, Specs, Hooks, and verified by Property-Based and Playwright E2E tests: GhostDocs brings dead organizational knowledge back to life—privately, accurately, and locally."*
