# GhostDocs — Product Steering

## Vision

GhostDocs is a **browser-only** application that resurrects forgotten organizational knowledge from uploaded documents. Users upload PDF, Markdown, or plain-text files and immediately gain access to an AI-powered research crew that surfaces answers, timelines, and insights — all without any data ever leaving their device.

The core promise: *your documents stay yours, your secrets stay local.*

---

## The Time Capsule Feature

The Time Capsule is the primary entry-point UX metaphor. When a user uploads documents, GhostDocs treats them as artefacts from the past — a sealed capsule of institutional memory. The interface emphasises:

- **Opening the capsule** — the upload/ingest flow feels like cracking open a vault, not uploading a file.
- **Exploring what's inside** — search, questions, and timeline views reveal the capsule's contents progressively.
- **Preserving provenance** — every answer is anchored to a specific document, page, and date so the knowledge lineage is never lost.

---

## The 3 AI Crew Agents

GhostDocs ships three named AI personas, each with a distinct role and tone:

### 🗄️ The Archivist
- **Role**: Organises and classifies documents; surfaces structural metadata (dates, authors, document types).
- **Tone**: Methodical, precise, unemotional. Speaks in cataloguing language.
- **Primary tasks**: Document ingestion, metadata extraction, deduplication detection.

### 📜 The Historian
- **Role**: Builds chronological narratives from document content; answers "what happened when?" questions.
- **Tone**: Storytelling, measured, authoritative. Places facts in temporal context.
- **Primary tasks**: Timeline construction, event sequencing, change-over-time analysis.

### 🔍 The Researcher
- **Role**: Answers open-ended questions by synthesising information across multiple documents.
- **Tone**: Curious, thorough, careful with uncertainty. Always cites sources.
- **Primary tasks**: Semantic search, cross-document synthesis, hypothesis surfacing.

---

## Kiroween UI Principles

GhostDocs uses a **spooky-professional dark-mode theme** ("Kiroween") as its only visual mode. Key principles:

1. **Dark by default** — no light mode toggle. The palette centres on deep midnight purples, charcoal blacks, and muted teals, accented with amber/orange "ghost glow" highlights.
2. **Atmosphere without kitsch** — subtle fog-effect backgrounds, gentle shimmer on hover states, and faded parchment textures on document cards. Avoid cartoonish Halloween clip-art.
3. **Legibility first** — contrast ratios must meet WCAG AA (≥ 4.5:1 for body text, ≥ 3:1 for large text) even on dark backgrounds.
4. **Progressive reveal** — UI elements fade in on appearance rather than snapping into place. Transitions ≤ 200 ms so they feel ghostly, not sluggish.
5. **Consistent iconography** — use a single icon library (Lucide via shadcn/ui). Do not mix icon sets.
6. **Accessibility** — every interactive element must have an accessible name and a visible focus ring. The spooky theme must not compromise keyboard navigability.

---

## Out of Scope

- No server-side rendering of user document content.
- No cloud storage, no telemetry on document contents.
- No user accounts or authentication (all state is local to the browser).
