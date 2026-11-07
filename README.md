# 👻 GhostDocs — Resurrecting Forgotten Organisational Knowledge

> **100% Browser-Local Multi-Agent Knowledge Resurrection Engine · Built with Kiro Spec-Driven Development**

GhostDocs is a privacy-first, browser-only application that resurrects institutional memory from forgotten PDF, Markdown, and Plain-Text documents. Powered by Web Workers, IndexedDB (Dexie.js), PDF.js, and local 384-dimensional lexical vector embeddings (`ghostdocs-lexical-hash-384-v1`), GhostDocs coordinates a three-agent AI Crew (**The Archivist**, **The Historian**, and **The Researcher**) to surface source-cited answers, chronological timelines, and portable **Time Capsules**—without a single byte of document content ever leaving your browser tab.

---

## 🎯 The Problem

When projects end, teams reorganize, or engineers depart, critical organizational knowledge dies inside scattered PDFs, handoff notes, and markdown postmortems. Traditional cloud AI tools require uploading sensitive internal files to external servers, often hallucinate facts without provenance, and flatten chronological context.

## 💡 The Solution: GhostDocs

GhostDocs turns your browser into a local-first knowledge vault styled with a spooky-professional **Kiroween** dark-mode aesthetic:
- **Zero Network Leakage:** Enforced via Content Security Policy (`connect-src 'self'`, same-origin only), Web Worker isolation, Next.js static export (`output: 'export'`), and Playwright canary-token interception tests (`R-PBT-7`).
- **Source-First & Zero Hallucination:** Every answer and timeline card is synthesized strictly from retrieved document chunks and carries a verbatim citation badge (`<= 50` words) verified by property-based round-trip tests (`R-PBT-1`).
- **Explicit Uncertainty Scoring:** Low-confidence answers (`< 0.60`), fiscal/calendar date ambiguities (`Q3 FY2024`), and implicit temporal signals (`"in the previous quarter"`) automatically surface plain-language `UncertaintyNotice` callouts.

---

## ✨ Key Features

1. **Non-Blocking Web Worker Ingestion (`parser.worker.ts` & `embeddings.worker.ts`)**
   - Drag-and-drop upload for `.pdf`, `.md`, `.markdown`, and `.txt` files.
   - Page-by-page PDF extraction (`pdfjs-dist`), password-protected PDF detection, corrupt-page skipping warnings, and duplicate document replacement prompts.
   - 512-token window chunking with 50-token overlap and 384-dimensional local vector embeddings.
   - Embeddings are computed 100% in the browser by `ghostdocs-lexical-hash-384-v1`, a deterministic 384-dimensional lexical feature extractor (word hashes, 4-character stems, character trigrams, tanh, L2 normalisation) running in a Web Worker. There is no model download and there are no network requests, so results are identical online and offline.
   - Trade-off: matching is lexical (shared words, stems, and trigrams) and does not recognise synonyms. An opt-in neural model is on the roadmap.
2. **The 3 AI Crew Agents (`lib/agents/`)**
   - 🗄️ **The Archivist (`lib/agents/archivist.ts`):** Extracts structural metadata (title, ISO/written dates, author, document type) and generates 1–200 word extractive summaries.
   - 📜 **The Historian (`lib/agents/historian.ts`):** Detects explicit ISO 8601 dates, written dates, fiscal year references, and implicit temporal signals; assigns confidence scores (`>= 0.80` explicit, `< 0.80` implicit); and builds a chronological timeline.
   - 🔍 **The Researcher (`lib/agents/researcher.ts`):** Runs `requestIdleCallback`-batched cosine similarity search (`<= 500ms`) across IndexedDB embeddings and synthesizes source-cited answers from the top-5 passages.
3. **Portable Time Capsules (`lib/capsule.ts`)**
   - Bundle all ingested documents, chunks, `Float32Array` embeddings, summaries, and timelines into a single schema-versioned `ghostdocs-capsule-YYYY-MM-DD.json` snapshot that can be exported and re-imported offline.
4. **Kiroween WCAG AA Accessible UI**
   - Deep midnight purples (`specter-*`), charcoal crypt surfaces (`ghost-*`), muted teals (`ectoplasm-*`), and amber ghost-glow accents (`glow-*`), with `>= 4.5:1` body contrast, `>= 2px` focus rings, ARIA live regions, and `prefers-reduced-motion` support.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Browser["Browser Tab (100% Local)"]
        UI["GhostDocsApp Client Island\n(Next.js Static Export)"]
        DB[("IndexedDB via Dexie.js\ndocuments · chunks · embeddings\ntimelines · answers · capsules")]
        PW["parser.worker.ts\n(PDF.js + Markdown/TXT)"]
        EW["embeddings.worker.ts\n(Lexical Hash 384-d Vectors)"]
        Search["lib/search.ts\n(requestIdleCallback Cosine Ranking)"]
        subgraph Crew["AI Crew Orchestrators"]
            Archivist["🗄️ Archivist Agent"]
            Historian["📜 Historian Agent"]
            Researcher["🔍 Researcher Agent"]
        end
    end

    UI -->|ArrayBuffer Transferable| PW
    PW -->|ParsedPage[]| UI
    UI -->|CHUNK_DOCUMENT / EMBED_CHUNK| EW
    EW -->|Float32Array Transferable| DB
    DB --> Archivist
    DB --> Historian
    DB --> Search
    Search -->|Top-5 Scored Chunks| Researcher
    Archivist --> UI
    Historian --> UI
    Researcher --> UI
```

---

## 🚀 How Kiro Was Used (Advanced Spec-Driven Workflow)

GhostDocs was engineered end-to-end using Kiro's full customization and spec-driven lifecycle:

1. **Kiro Steering (`.kiro/steering/`) — Phase 0 Project Memory:**
   - [`product.md`](.kiro/steering/product.md): Defined the Time Capsule metaphor, the 3 AI Crew personas, and Kiroween UI rules.
   - [`tech.md`](.kiro/steering/tech.md): Enforced the browser-only Next.js static export constraint, Web Worker isolation, Dexie.js schema patterns, and exact dependency pinning.
   - [`principles.md`](.kiro/steering/principles.md): Codified the non-negotiable hierarchy: Privacy-First → Zero Hallucination → Mandatory Citations → Uncertainty Explanation → Source-First Reasoning → Chronological Reasoning.
   - [`testing.md`](.kiro/steering/testing.md): Mandated the canonical `data-testid` contract, Vitest 80% library coverage, and `@axe-core/playwright` zero-violation checks.
2. **Kiro Specs (`.kiro/specs/ghostdocs-master/`):**
   - [`requirements.md`](.kiro/specs/ghostdocs-master/requirements.md): 10 EARS-formatted requirements (82 acceptance criteria), 9 Property-Based Test invariants (`R-PBT-1` through `R-PBT-9`), the canonical `data-testid` contract table, and a full traceability matrix.
   - [`design.md`](.kiro/specs/ghostdocs-master/design.md): 1,158-line technical architecture with Mermaid diagrams, typed Web Worker discriminated union protocols, Dexie.js table definitions, CSP security layers, and Kiroween design tokens.
   - [`tasks.md`](.kiro/specs/ghostdocs-master/tasks.md): 19 top-level tasks (54 subtasks across 13 dependency waves) mapping every requirement to implementation and test verification.
3. **Kiro Agent Hooks (`.kiro/hooks/`):**
   - [`document-uploaded-hook.json`](.kiro/hooks/document-uploaded-hook.json): Validates chunking/embedding invariants (`R-PBT-5`, `R-PBT-6`) when ingestion workers are modified.
   - [`question-asked-hook.json`](.kiro/hooks/question-asked-hook.json): Validates cosine ranking and verbatim citation integrity (`R-PBT-1`, `R-PBT-2`) when search or Researcher modules change.
   - [`time-capsule-created-hook.json`](.kiro/hooks/time-capsule-created-hook.json): Validates chronological sorting (`R-PBT-3`) and `Float32Array` JSON round-tripping when capsule or Historian modules change.

---

## 🛠️ Installation & Running Locally

```bash
# 1. Install dependencies (exact pinned versions)
npm install

# 2. Run development server
npm run dev

# 3. Build static export into out/
npm run build

# 4. Run Vitest unit & fast-check property-based tests (100 runs/property)
npx vitest run --coverage

# 5. Run Playwright E2E acceptance & axe-core accessibility suite
npx playwright test --project=chromium
```
