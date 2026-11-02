# Requirements Document

## Introduction

GhostDocs is a browser-only application that resurfaces forgotten organisational knowledge from uploaded documents. Users upload PDF, Markdown, or plain-text files and gain access to an AI-powered research crew — the Archivist, Historian, and Researcher — that surfaces answers, timelines, and insights with mandatory citations. All processing, storage, and inference runs inside the user's browser tab; no document data ever leaves the device.

This document covers the Master Acceptance & Product Specification for the GhostDocs MVP. It defines business objectives, user stories with EARS-format acceptance criteria, functional and non-functional requirements, property-based test invariants, the canonical `data-testid` contract, and a traceability matrix.

---

## Business Objectives

### MVP Scope

| # | Objective |
|---|-----------|
| B-1 | Users can upload PDF, Markdown, and plain-text files and have them fully ingested (chunked, embedded, indexed) without leaving the browser. |
| B-2 | Users can create a shareable, exportable Time Capsule snapshot that bundles documents, extracted entities, summaries, and timelines. |
| B-3 | Users can ask open-ended questions and receive source-cited answers generated exclusively from uploaded document content. |
| B-4 | Users can view an AI-generated chronological timeline of events extracted from uploaded documents, each entry scored for confidence. |
| B-5 | All three AI Crew agents (Archivist, Historian, Researcher) produce visible, attributed output within the same session. |
| B-6 | The application delivers WCAG AA–compliant accessibility within the Kiroween dark-mode theme. |
| B-7 | Zero user document content is transmitted to any external network endpoint. |

### Future Roadmap (Out of MVP Scope)

- Optional opt-in cloud LLM integration (never transmits raw document content without explicit user consent).
- Multi-user collaboration via peer-to-peer WebRTC.
- Plugin system for additional document formats (DOCX, PPTX, EPUB).
- Saved search history and cross-session query memory.
- Automated deduplication detection across Time Capsules.

---

## Glossary

- **GhostDocs**: The browser-only application described in this specification.
- **Time_Capsule**: A persistent, exportable snapshot containing documents, extracted entities, summaries, and timeline data, stored in IndexedDB.
- **Document**: A single uploaded file (PDF, Markdown, or plain text) stored in IndexedDB with its raw text, metadata, and processing status.
- **Chunk**: A text segment of fixed maximum length derived from a Document, stored with its source Document reference, page/line offset, and a unique `chunkId`.
- **Embedding**: A fixed-length numeric vector representation of a Chunk, produced by the Embedding_Worker using `Xenova/all-MiniLM-L6-v2`.
- **Chunk_Store**: The IndexedDB table holding all Chunks and their associated Embeddings.
- **Archivist**: The AI Crew agent responsible for document organisation, metadata extraction, and deduplication detection.
- **Historian**: The AI Crew agent responsible for chronological narrative construction, timeline generation, and temporal reasoning.
- **Researcher**: The AI Crew agent responsible for semantic search, cross-document synthesis, and cited answer generation.
- **Embedding_Worker**: The Web Worker running Transformers.js inference to produce Embeddings without blocking the main thread.
- **Parser_Worker**: The Web Worker running PDF.js and text parsers to extract raw text from uploaded files without blocking the main thread.
- **Semantic_Search**: Cosine-similarity ranking of Chunks against a query Embedding to retrieve the most relevant passages.
- **Citation**: A structured reference comprising document name, page number (PDFs) or line/section (Markdown/TXT), and a verbatim excerpt of ≤ 50 words.
- **Confidence_Score**: A numeric value in the range [0.0, 1.0] expressing an agent's certainty about a Timeline_Entry or Answer, derived from source coverage and signal clarity.
- **Timeline_Entry**: A structured event record containing an event description, resolved date or date range, Confidence_Score, and one or more Citations.
- **Answer**: A structured response to a user question containing a synthesised text, one or more Citations, a Confidence_Score, and an optional Uncertainty_Notice.
- **Uncertainty_Notice**: A plain-language statement explaining why an Answer or Timeline_Entry is less than fully confident (insufficient evidence, conflicting sources, date ambiguity, or partial coverage).
- **Slug**: A URL-safe, lowercase, hyphenated identifier derived from the document filename, used as the stable key for `data-testid` attributes and IndexedDB records.
- **Kiroween**: The GhostDocs visual theme — a spooky-professional dark-mode palette of midnight purples, charcoal blacks, muted teals, and amber/orange ghost-glow highlights.
- **WCAG_AA**: The Web Content Accessibility Guidelines 2.1 Level AA conformance standard, requiring contrast ratios ≥ 4.5:1 for body text and ≥ 3:1 for large text.

---

## Requirements

### Requirement 1: Document Upload and Ingestion

**User Story:** As a knowledge worker, I want to upload PDF, Markdown, and plain-text files via drag-and-drop or file picker, so that GhostDocs can process and index my organisational documents locally.

#### Acceptance Criteria

1. THE GhostDocs SHALL accept file uploads via a drag-and-drop zone and a file-picker input, both identified by `data-testid="upload-input"` and `data-testid="upload-button"` respectively.
2. WHEN a user drops or selects one or more files, THE GhostDocs SHALL validate each file by checking its MIME type against `application/pdf`, `text/markdown`, `text/x-markdown`, and `text/plain`, and for any file whose MIME type resolves to `text/plain`, THE GhostDocs SHALL additionally accept it if the file extension is `.md`, `.markdown`, `.txt`, or `.pdf`; files that match neither condition SHALL be rejected before ingestion begins.
3. IF a user drops or selects a file that fails the validation in criterion 2, THEN THE GhostDocs SHALL display an inline error message identified by `data-testid="upload-error"` that names the rejected filename and its detected MIME type, without interrupting ingestion of valid files in the same batch.
4. WHEN a valid file is accepted, THE Parser_Worker SHALL extract its full text content without blocking the main thread for more than 50 ms at any point during extraction.
5. WHEN text extraction is complete, THE Embedding_Worker SHALL chunk the text into segments of at most 512 whitespace-delimited word tokens with a 50-token overlap between consecutive chunks, storing each Chunk with its `chunkId`, source Document reference, and page/line offset in the Chunk_Store; IF a single indivisible token sequence exceeds 512 tokens, THEN THE Embedding_Worker SHALL truncate it to 512 tokens and store a truncation flag on that Chunk.
6. WHEN all Chunks for a Document are stored, THE Embedding_Worker SHALL generate an Embedding for each Chunk and persist it as an individual row in the Chunk_Store keyed by `chunkId`; IF Embedding generation fails for a Chunk, THEN THE GhostDocs SHALL mark that Chunk as `embedding_failed` in the Chunk_Store, display an inline warning identified by `data-testid="embedding-warning-{chunkId}"`, and continue processing remaining Chunks.
7. WHILE a Document is being ingested, THE GhostDocs SHALL display a progress indicator identified by `data-testid="upload-progress"` showing the current ingestion stage — one of `parsing`, `chunking`, or `embedding` — for that Document.
8. WHEN ingestion of a Document is complete, THE GhostDocs SHALL display the Document as a card identified by `data-testid="document-card-{slug}"` in the document list, where `{slug}` is derived by lowercasing the filename, replacing all whitespace and non-alphanumeric characters with hyphens, collapsing consecutive hyphens to one, and stripping the file extension.
9. IF the Parser_Worker encounters a corrupted or unreadable PDF page, THEN THE GhostDocs SHALL skip that page, continue ingesting remaining pages, and display a visible notice identified by `data-testid="parse-warning-{slug}"` listing the skipped page numbers once ingestion completes.
10. IF the Parser_Worker detects that a PDF is password-protected, THEN THE GhostDocs SHALL reject the file, display an error message identified by `data-testid="upload-error"` indicating the file requires a password, and take no further ingestion action for that file.
11. IF a user uploads a file whose filename matches a Document already present in the Chunk_Store, THEN THE GhostDocs SHALL display a confirmation prompt identified by `data-testid="duplicate-confirm"` asking whether to replace the existing Document; IF the user confirms, THEN THE GhostDocs SHALL delete all existing Chunks and Embeddings for that Document before beginning re-ingestion; IF the user cancels, THEN THE GhostDocs SHALL discard the uploaded file without modification.
12. THE GhostDocs SHALL ingest a 10-page PDF document — including parsing, chunking, and embedding — within 5 seconds on a device with at least a 4-core CPU running at 2.0 GHz or faster, 8 GB RAM, and a modern Chromium-based browser.

---

### Requirement 2: Time Capsule Creation and Export

**User Story:** As a knowledge archivist, I want to create a persistent exportable Time Capsule from my uploaded documents, so that I can preserve and share a snapshot of organisational memory.

#### Acceptance Criteria

1. WHEN the user initiates Time Capsule creation, THE Archivist SHALL extract metadata (title, detected date, author, document type) from each ingested Document and bundle it with the Document's Chunks, Embeddings, summaries, and Timeline_Entries into a single Time_Capsule record in IndexedDB, completing the full bundle operation within 10 seconds for a corpus of up to 50 documents totalling up to 500 MB.
2. WHEN the user triggers a Time Capsule export, THE GhostDocs SHALL serialise the Time_Capsule record to a UTF-8 encoded JSON file and present it to the user for download, with the filename defaulting to `ghostdocs-capsule-{ISO8601-date}.json` where `{ISO8601-date}` is the UTC date at the moment of export in `YYYY-MM-DD` format.
3. WHEN a Time_Capsule JSON file is imported, THE GhostDocs SHALL restore all Documents, Chunks, Embeddings, Timeline_Entries, and metadata to IndexedDB, skipping without error any record whose `chunkId` or `slug` already exists in the current session, and reporting the count of skipped records and successfully restored records to the user upon completion.
4. IF a Time_Capsule import file is malformed or fails schema validation, THEN THE GhostDocs SHALL display a plain-language error message indicating the nature of the validation failure and leave the existing IndexedDB state unchanged, with zero records written or modified.
5. THE Time_Capsule SHALL include a `capsuleVersion` field containing a positive integer that increments with each breaking schema change, so that THE GhostDocs can apply forward-compatible migrations on import without data loss.
6. IF the `capsuleVersion` value in an imported Time_Capsule file is higher than the maximum version the current application build supports, THEN THE GhostDocs SHALL display an error message indicating the capsule requires a newer application version and abort the import without modifying IndexedDB state.
7. WHEN a Time_Capsule is created, THE Archivist SHALL generate a plain-language summary of between 1 and 200 words for each Document derived solely from that Document's Chunks, and include it in the Time_Capsule record.
8. IF a Document contains insufficient extractable text to produce a summary (fewer than 20 words of body content), THEN THE Archivist SHALL set that Document's summary field to a value indicating no summary is available and continue bundling the remaining Documents without aborting the creation operation.

---

### Requirement 3: Semantic Search

**User Story:** As a researcher, I want to ask free-text questions and receive ranked passages from my documents, so that I can quickly locate relevant information without reading every file.

#### Acceptance Criteria

1. THE GhostDocs SHALL provide a search input identified by `data-testid="search-input"` and a submit control identified by `data-testid="search-submit"`.
2. WHEN the user submits a query of 1–500 characters, THE Embedding_Worker SHALL generate an Embedding for the query text, and THE GhostDocs SHALL rank all Chunks in the Chunk_Store by cosine similarity to the query Embedding, returning the top 10 Chunks (or all Chunks if fewer than 10 exist) as an ordered result list within 500 ms measured from the submit event to the first result rendered in the UI.
3. WHEN the ordered result list is rendered, THE GhostDocs SHALL display each result with the verbatim passage, the source Document name, the page number (for PDF sources) or line reference (for Markdown and plain-text sources), and the cosine similarity score rounded to two decimal places.
4. IF the submitted query is an empty string or contains only whitespace characters, THEN THE GhostDocs SHALL display an inline error message indicating that the query must contain at least one non-whitespace character and SHALL NOT initiate embedding or search.
5. IF the Chunk_Store contains zero Chunks at query time, THEN THE GhostDocs SHALL display a message indicating that no documents have been uploaded yet and SHALL suppress the result list.
6. IF the Chunk_Store contains one or more Chunks and no Chunk has a cosine similarity score above 0.0 with the query Embedding, THEN THE GhostDocs SHALL display a message indicating that no relevant passages were found and SHALL render an empty result list.
7. WHEN a search result is selected, THE GhostDocs SHALL scroll the corresponding document card identified by `data-testid="document-card-{slug}"` into the viewport.
8. FOR ALL query Embeddings Q and Chunk Embeddings C, the cosine similarity score computed by THE GhostDocs SHALL satisfy: `cosine(Q, C) ∈ [−1.0, 1.0]` (range invariant).
9. FOR ALL pairs of queries Q1 and Q2 that are identical strings, THE GhostDocs SHALL return identical ranked result sets (determinism invariant).

---

### Requirement 4: Cited Answer Generation (The Researcher Agent)

**User Story:** As a knowledge worker, I want to ask open-ended questions and receive synthesised answers grounded exclusively in my uploaded documents, so that I can trust every claim is traceable to source material.

#### Acceptance Criteria

1. WHEN the user submits a question, THE Researcher SHALL retrieve the top 5 highest-cosine-similarity Chunks from the Chunk_Store via Semantic_Search and synthesise an Answer exclusively from the content of those Chunks.
2. EVERY Answer produced by THE Researcher SHALL include at least one Citation specifying document name, page number or line/section, and a verbatim excerpt of ≤ 50 words.
3. THE Researcher SHALL assign a Confidence_Score in the range [0.0, 1.0] to each Answer, computed as the arithmetic mean of the cosine similarity scores of the retrieved Chunks that were used to synthesise that Answer.
4. WHEN the Confidence_Score of an Answer is below 0.6, THE Researcher SHALL attach an Uncertainty_Notice to the Answer explaining the specific reason for low confidence (insufficient evidence, conflicting sources, date ambiguity, or partial coverage).
5. THE GhostDocs SHALL display each Answer in a block identified by `data-testid="response-block"` and each Uncertainty_Notice in a block identified by `data-testid="uncertainty-notice"`.
6. IF no Chunk in the Chunk_Store has a cosine similarity score above 0.3 for the submitted query, THEN THE Researcher SHALL respond with a message indicating the uploaded documents do not contain sufficient information to answer the question, and attach no Citations.
7. THE Researcher SHALL never include factual claims derived from world knowledge that are absent from the retrieved Chunks (zero hallucination constraint).
8. IF an Answer contains more than one Citation, THEN THE GhostDocs SHALL render each Citation as a badge identified by `data-testid="citation-{chunkId}"`.
9. FOR ALL Answers produced, every Citation's verbatim excerpt SHALL appear verbatim within the source Chunk referenced by that Citation's `chunkId` (citation integrity invariant).
10. IF the Chunk_Store contains zero Chunks or the Semantic_Search worker fails to respond within 10 seconds, THEN THE Researcher SHALL display an error message indicating that the search could not be completed, and SHALL NOT produce an Answer or Citations.

---

### Requirement 5: Timeline Generation (The Historian Agent)

**User Story:** As a historian, I want to view a chronological timeline of events extracted from my uploaded documents, so that I can understand organisational history and how decisions evolved over time.

#### Acceptance Criteria

1. WHEN the user requests timeline generation, THE Historian SHALL scan all ingested Chunks for explicit dates (ISO 8601, written dates, fiscal year references) and implicit temporal signals ("previous quarter", "following the merger") and produce a set of Timeline_Entries; IF an implicit temporal signal cannot be resolved to a concrete date or date range, THEN THE Historian SHALL attach an Uncertainty_Notice to that Timeline_Entry and position it after all resolved entries in the rendered list.
2. THE GhostDocs SHALL render Timeline_Entries in ascending chronological order by resolved date within a container identified by `data-testid="timeline-container"`.
3. EACH Timeline_Entry SHALL display: an event description of ≤ 500 characters, a resolved date or date range, a Confidence_Score, and at least one Citation.
4. IF THE Historian encounters a date that is ambiguous (e.g., fiscal vs. calendar year), THEN THE Historian SHALL attach an Uncertainty_Notice to that Timeline_Entry visible inline beneath the entry's event description, explaining both possible interpretations.
5. IF no date signals are found in any ingested Chunk, THEN THE Historian SHALL display the message "No temporal signals were found in the uploaded documents." and render an empty timeline container.
6. FOR ALL sets of Timeline_Entries produced from the same Chunk_Store, the entries SHALL be ordered such that for any two entries E1 and E2 where E1.resolvedDate < E2.resolvedDate, E1 appears before E2 in the rendered list (chronological ordering invariant).
7. FOR ALL Timeline_Entries, the Confidence_Score SHALL satisfy: `score ∈ [0.0, 1.0]`; entries derived from explicit date signals SHALL receive a Confidence_Score ≥ 0.8, and entries derived exclusively from implicit temporal signals SHALL receive a Confidence_Score < 0.8.
8. FOR ALL Timeline_Entries, every Citation's verbatim excerpt SHALL appear verbatim within the source Chunk referenced by that Citation's `chunkId` (citation integrity invariant for timeline).
9. WHEN new Documents are ingested into an existing session, THE Historian SHALL incrementally update the timeline to incorporate events from the new Documents within 5 seconds of ingestion completion, without removing existing Timeline_Entries whose source Chunks remain present in the Chunk_Store.
10. WHEN the user requests timeline generation for a Chunk_Store containing up to 1,000 Chunks, THE Historian SHALL complete the full timeline construction and render all Timeline_Entries within 10 seconds.

---

### Requirement 6: AI Crew Agent Panels

**User Story:** As a user, I want to see the three AI Crew agents — Archivist, Historian, Researcher — displayed as distinct panels with their outputs, so that I can understand which agent produced each piece of information.

#### Acceptance Criteria

1. THE GhostDocs SHALL render the Archivist agent output in a panel identified by `data-testid="agent-archivist"`.
2. THE GhostDocs SHALL render the Historian agent output in a panel identified by `data-testid="agent-historian"`.
3. THE GhostDocs SHALL render the Researcher agent output in a panel identified by `data-testid="agent-researcher"`.
4. WHEN a Document is ingested, THE Archivist SHALL display the extracted metadata (title, detected date, author, document type) in the Archivist panel; IF a metadata field cannot be extracted, THEN THE Archivist SHALL display "Unknown [field name]" as the placeholder value for that field.
5. WHEN a question is submitted, THE Researcher SHALL display the synthesised Answer in the Researcher panel; IF the Researcher encounters an error, THEN THE Historian SHALL not display any related Timeline_Entries until the Researcher's error state is resolved or dismissed.
6. WHILE any agent is processing, THE GhostDocs SHALL display a loading indicator identified by `data-testid="agent-{name}-loading"` within that agent's panel and clear all stale output from any prior query in the same render cycle that the loading indicator appears.
7. IF an agent encounters a processing error, THEN THE GhostDocs SHALL display a plain-language error message identified by `data-testid="agent-{name}-error"` within that agent's panel, naming the agent and describing the failure without exposing internal stack traces.

---

### Requirement 7: Document Management

**User Story:** As a user, I want to view, manage, and delete individual uploaded documents, so that I can keep my document set relevant and accurate.

#### Acceptance Criteria

1. THE GhostDocs SHALL display all ingested Documents as cards in a scrollable list, each card identified by `data-testid="document-card-{slug}"`.
2. WHEN the user activates the delete control for a Document, THE GhostDocs SHALL display a confirmation dialog identified by `data-testid="delete-confirm-dialog"` before removing the Document, all associated Chunks, and all associated Embeddings from IndexedDB.
3. THE delete control for each Document SHALL be identified by `data-testid="delete-document-{slug}"`.
4. WHEN a Document is deleted, THE GhostDocs SHALL update the timeline and search index to exclude entries derived exclusively from the deleted Document; all IndexedDB deletions and UI updates SHALL complete atomically before the confirmation dialog closes.
5. IF a Document deletion fails partially (some Chunks or Embeddings cannot be removed from IndexedDB), THEN THE GhostDocs SHALL display an error message identified by `data-testid="delete-error-{slug}"` describing the failure and leave the Document card visible in the list.
6. IF a Document deletion would leave the Chunk_Store empty, THEN THE GhostDocs SHALL display an empty state for the search result list identified by `data-testid="search-empty-state"` with the message "Upload documents to begin searching." and an empty state for the timeline identified by `data-testid="timeline-empty-state"` with the message "Upload documents to generate a timeline."

---

### Requirement 8: Privacy and Zero Network Leakage

**User Story:** As a privacy-conscious user, I want certainty that none of my document content is ever transmitted over the network, so that sensitive organisational information stays on my device.

#### Acceptance Criteria

1. THE GhostDocs SHALL perform all document parsing, chunking, embedding, search, and inference exclusively within the browser process using Web Workers and IndexedDB — no server-side processing.
2. THE GhostDocs SHALL not issue any `fetch`, `XMLHttpRequest`, or WebSocket request that carries document text, Chunks, or Embeddings as payload.
3. THE Embedding_Worker SHALL load the `Xenova/all-MiniLM-L6-v2` model from the browser cache or the HuggingFace CDN (model weights only, no document data) and subsequently operate offline.
4. IF the browser is offline after the model weights are cached, THEN THE GhostDocs SHALL continue to function for all operations defined in criteria 1 through 3 with results indistinguishable from online operation.
5. THE GhostDocs SHALL not include document text, Chunk content, or Embedding vectors in any network request body, query string, or header during any session in which documents are present (zero network leakage invariant).

---

### Requirement 9: Performance

**User Story:** As a user, I want the application to remain responsive and fast even while ingesting and querying large document sets, so that the experience is not interrupted.

#### Acceptance Criteria

1. THE GhostDocs SHALL achieve a First Contentful Paint of ≤ 3 seconds on a device with at least a 4-core CPU running at 2.0 GHz or faster, 8 GB RAM, a 50 Mbps network connection, and a modern Chromium-based browser on a cold load with no cached model weights.
2. THE GhostDocs SHALL complete ingestion of a 10-page PDF of ≤ 5 MB — including text extraction, chunking, and embedding — within 5 seconds on the hardware baseline defined in criterion 1.
3. THE GhostDocs SHALL return Semantic_Search results within 500 ms measured from the submit event to the first result rendered in the UI, for a Chunk_Store containing up to 1,000 Chunks, on the hardware baseline defined in criterion 1.
4. THE GhostDocs SHALL not block the main thread for more than 50 ms at any point during ingestion, embedding, or search operations.
5. WHILE the Embedding_Worker is generating Embeddings, THE GhostDocs SHALL respond to user inputs — including navigation, search submission, and document deletion — within 100 ms of the input event.

---

### Requirement 10: Accessibility and Kiroween Theme

**User Story:** As a user with accessibility needs, I want GhostDocs to be fully keyboard-navigable and meet WCAG AA contrast standards within its dark-mode theme, so that I can use the application regardless of my assistive technology.

#### Acceptance Criteria

1. THE GhostDocs SHALL apply the Kiroween dark-mode theme as the sole visual mode — no light-mode toggle SHALL be provided.
2. THE GhostDocs SHALL meet WCAG AA contrast ratios: ≥ 4.5:1 for body text and interactive element labels, and ≥ 3:1 for large text (≥ 18 pt or ≥ 14 pt bold) against their backgrounds.
3. EVERY interactive element in THE GhostDocs SHALL have an accessible name (via `aria-label`, `aria-labelledby`, or visible label text) and a visible focus ring of ≥ 2 CSS pixels in width around the full perimeter of the element with a contrast ratio of ≥ 3:1 against the adjacent background, in conformance with WCAG 2.2 SC 2.4.11.
4. THE GhostDocs SHALL be fully operable via keyboard alone: Tab and Shift+Tab SHALL move focus between interactive elements, Enter and Space SHALL activate buttons and links, and Escape SHALL close dialogs and dismiss confirmation prompts, covering file upload activation, search submission, document deletion confirmation, and agent panel navigation.
5. WHEN a new page state is reached (after upload completion, search results display, or timeline render), THE GhostDocs SHALL announce the state change to screen readers using an ARIA live region.
6. THE GhostDocs SHALL render UI element entry transitions with a duration of ≤ 200 ms to satisfy the Kiroween "ghostly, not sluggish" motion principle.
7. IF the user has enabled reduced motion in their operating system (`prefers-reduced-motion: reduce`), THEN THE GhostDocs SHALL suppress all entry transitions and decorative animations while preserving functional state changes.

---

## Canonical `data-testid` Contract

The following table is the authoritative reference for Playwright E2E selectors. Every element listed MUST have the specified `data-testid` value in the rendered DOM. Additional `data-testid` attributes may be added as the feature set grows; this table is a minimum floor.

| Element | `data-testid` | Notes |
|---|---|---|
| File upload input (`<input type="file">`) | `upload-input` | Hidden input activated by upload button |
| Upload trigger button | `upload-button` | Visible drag-and-drop zone or button |
| Search text input | `search-input` | Primary query field |
| Search submit button | `search-submit` | Triggers query execution |
| Document card (per document) | `document-card-{slug}` | `slug` is the URL-safe document identifier |
| Delete document button (per document) | `delete-document-{slug}` | Triggers deletion confirmation prompt |
| Archivist agent panel | `agent-archivist` | Container for Archivist output |
| Historian agent panel | `agent-historian` | Container for Historian output |
| Researcher agent panel | `agent-researcher` | Container for Researcher output |
| Answer/response block | `response-block` | Container for a single synthesised Answer |
| Citation badge (per citation) | `citation-{chunkId}` | `chunkId` is the stable chunk identifier |
| Timeline container | `timeline-container` | Wraps all Timeline_Entries |
| Uncertainty notice | `uncertainty-notice` | Attached to low-confidence Answers or Timeline_Entries |
| Time Capsule create button | `capsule-create-button` | Initiates Time Capsule creation |
| Time Capsule export button | `capsule-export-button` | Triggers JSON export |
| Time Capsule import input | `capsule-import-input` | Hidden file input for capsule import |
| Ingestion progress indicator | `ingestion-progress-{slug}` | Per-document progress during ingest |

---

## Property-Based Test Invariants

The following invariants MUST be validated by automated tests. Vitest unit tests cover the pure-logic invariants (R-PBT-1 through R-PBT-6); Playwright E2E tests cover the end-to-end invariants (R-PBT-7 through R-PBT-9).

### R-PBT-1: Citation Integrity (Round-Trip)

FOR ALL Answers and Timeline_Entries produced by any agent, every Citation's verbatim excerpt SHALL appear verbatim (exact substring match) within the Chunk retrieved from the Chunk_Store by that Citation's `chunkId`.

**Test approach**: Property-based test over a generated corpus of Chunks. For any generated Chunk C and any Answer synthesised from C, assert `C.text.includes(citation.excerpt)`.

### R-PBT-2: Confidence Score Range Invariant

FOR ALL Confidence_Scores produced by any agent, the score SHALL satisfy: `score >= 0.0 && score <= 1.0`.

**Test approach**: Property-based test generating varied cosine similarity distributions; assert output score is always in range.

### R-PBT-3: Chronological Ordering Invariant

FOR ALL sets of Timeline_Entries produced from any Chunk_Store, for any two entries E1 and E2 where `E1.resolvedDate < E2.resolvedDate`, E1 SHALL appear at a lower rendered index than E2.

**Test approach**: Property-based test generating shuffled sets of dated events; assert `sortTimelineEntries(entries)` produces a strictly non-decreasing date sequence.

### R-PBT-4: Cosine Similarity Range Invariant

FOR ALL pairs of query Embedding Q and Chunk Embedding C, the cosine similarity score SHALL satisfy: `similarity >= -1.0 && similarity <= 1.0`.

**Test approach**: Property-based test over randomly generated unit vectors and non-unit vectors; assert cosine result is always in `[-1, 1]`.

### R-PBT-5: Chunking Size Invariant

FOR ALL Chunks produced by the chunker from any Document, the token count of each Chunk SHALL satisfy: `tokenCount >= 1 && tokenCount <= 512`.

**Test approach**: Property-based test over generated documents of varying lengths (1 token to 100,000 tokens); assert every chunk in the output satisfies the size constraint.

### R-PBT-6: Chunking Coverage Invariant (Round-Trip)

FOR ALL Documents, the concatenation of all Chunk texts derived from that Document SHALL contain every non-whitespace character from the original Document text (no content loss).

**Test approach**: Property-based test over generated text corpora; assert `originalText.replace(/\s+/g, '') ⊆ chunks.map(c => c.text).join('').replace(/\s+/g, '')`.

### R-PBT-7: Zero Network Leakage Invariant (E2E)

FOR ALL network requests issued during a session in which one or more Documents are present, none SHALL include document text, Chunk text, or Embedding vectors as request body, query string, or header payload.

**Test approach**: Playwright test intercepting all outbound network requests via `page.on('request', ...)` and asserting none carry document content.

### R-PBT-8: Search Determinism Invariant (E2E)

FOR ALL identical query strings submitted in the same session against the same Chunk_Store, THE GhostDocs SHALL return identical ranked result sets (same `chunkId` order, same scores).

**Test approach**: Playwright test submitting the same query twice and asserting identical DOM output in `search-result-*` elements.

### R-PBT-9: Deletion Completeness Invariant (E2E)

WHEN a Document is deleted, FOR ALL Chunks whose `documentId` matches the deleted Document, those Chunks and their Embeddings SHALL no longer be returned in any subsequent Semantic_Search result.

**Test approach**: Playwright test uploading a document, searching for a known phrase, deleting the document, repeating the search, and asserting no results reference the deleted document's slug.

---

## Traceability Matrix

| Requirement | Acceptance Criteria | MVP Success Criterion | Test Type | `data-testid` / Invariant |
|---|---|---|---|---|
| Req 1 — Upload & Ingestion | 1.1–1.12 | B-1 | E2E (Playwright) | `upload-input`, `upload-button`, `document-card-{slug}`, `upload-progress` |
| Req 2 — Time Capsule | 2.1–2.8 | B-2 | E2E (Playwright) | `capsule-create-button`, `capsule-export-button`, `capsule-import-input` |
| Req 3 — Semantic Search | 3.1–3.9 | B-3 | E2E + Unit PBT | `search-input`, `search-submit`, R-PBT-4, R-PBT-8 |
| Req 4 — Cited Answers (Researcher) | 4.1–4.10 | B-3, B-5 | E2E + Unit PBT | `response-block`, `uncertainty-notice`, `citation-{chunkId}`, R-PBT-1, R-PBT-2 |
| Req 5 — Timeline (Historian) | 5.1–5.10 | B-4, B-5 | E2E + Unit PBT | `timeline-container`, `uncertainty-notice`, R-PBT-1, R-PBT-2, R-PBT-3 |
| Req 6 — Agent Panels | 6.1–6.7 | B-5 | E2E (Playwright) | `agent-archivist`, `agent-historian`, `agent-researcher` |
| Req 7 — Document Management | 7.1–7.6 | B-1 | E2E (Playwright) | `document-card-{slug}`, `delete-document-{slug}`, `delete-confirm-dialog`, R-PBT-9 |
| Req 8 — Privacy / Zero Leakage | 8.1–8.5 | B-7 | E2E + Unit PBT | R-PBT-7 |
| Req 9 — Performance | 9.1–9.5 | B-1, B-3 | E2E (Playwright timing) | `upload-progress` |
| Req 10 — Accessibility & Theme | 10.1–10.7 | B-6 | E2E axe-core | All interactive `data-testid` elements |
