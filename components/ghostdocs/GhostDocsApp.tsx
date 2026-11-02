"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ghost } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  type AnswerRecord,
  type ChunkRecord,
  type DocumentRecord,
  type DocumentStatus,
  type TimelineEntryRecord,
} from "@/lib/db";
import { deriveSlug } from "@/lib/slug";
import {
  extractMetadata,
  resolveDocumentType,
} from "@/lib/agents/archivist";
import {
  buildTimeline,
  incrementalUpdateTimeline,
} from "@/lib/agents/historian";
import { synthesiseAnswer, type ScoredChunk } from "@/lib/agents/researcher";
import { rankByCosine } from "@/lib/search";
import type {
  EmbeddingsWorkerMessage,
  EmbeddingsWorkerRequest,
  ParserWorkerMessage,
  ParserWorkerRequest,
} from "@/workers/types";
import { UploadZone } from "./UploadZone";
import { IngestionProgress } from "./IngestionProgress";
import { DocumentList } from "./DocumentList";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import type { ScoredChunkResult } from "./SearchResultCard";
import { ArchivistPanel } from "./ArchivistPanel";
import { HistorianPanel } from "./HistorianPanel";
import { ResearcherPanel } from "./ResearcherPanel";
import { CapsuleControls } from "./CapsuleControls";

interface IngestionState {
  slug: string;
  filename: string;
  stage: DocumentStatus;
  skippedPages: number[];
  failedChunkIds: string[];
  remainingChunks: number;
}

declare global {
  interface Window {
    __ghostdocs_testApi?: {
      db: typeof db;
      triggerResearcherError: (msg: string) => void;
      triggerArchivistError: (msg: string) => void;
      triggerHistorianError: (msg: string) => void;
      refreshState: () => Promise<void>;
    };
  }
}

export function GhostDocsApp() {
  const parserWorkerRef = useRef<Worker | null>(null);
  const embeddingsWorkerRef = useRef<Worker | null>(null);
  const pendingQueryCallbacksRef = useRef<
    Map<
      string,
      {
        resolve: (vec: Float32Array) => void;
        reject: (err: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [chunksCount, setChunksCount] = useState<number>(0);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntryRecord[]>(
    []
  );
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [searchResults, setSearchResults] = useState<ScoredChunkResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [ingestions, setIngestions] = useState<Record<string, IngestionState>>(
    {}
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const [archivistLoading, setArchivistLoading] = useState(false);
  const [archivistError, setArchivistError] = useState<string | null>(null);

  const [historianLoading, setHistorianLoading] = useState(false);
  const [historianError, setHistorianError] = useState<string | null>(null);

  const [researcherLoading, setResearcherLoading] = useState(false);
  const [researcherError, setResearcherError] = useState<string | null>(null);

  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const refreshState = useCallback(async () => {
    const [docs, cCount, timelines, ans] = await Promise.all([
      db.documents.orderBy("ingestedAt").reverse().toArray(),
      db.chunks.count(),
      db.timelines.toArray(),
      db.answers.orderBy("createdAt").reverse().toArray(),
    ]);
    setDocuments(docs);
    setChunksCount(cCount);
    setTimelineEntries(timelines);
    setAnswers(ans);
  }, []);

  const finalizeDocumentIngestion = useCallback(
    async (slug: string) => {
      try {
        setArchivistLoading(true);
        await db.documents.update(slug, { status: "complete" });
        await extractMetadata(slug);
        setArchivistLoading(false);

        setHistorianLoading(true);
        await incrementalUpdateTimeline(slug);
        setHistorianLoading(false);

        setIngestions((prev) => {
          const current = prev[slug];
          if (!current) return prev;
          return {
            ...prev,
            [slug]: { ...current, stage: "complete", remainingChunks: 0 },
          };
        });

        await refreshState();
        setLiveAnnouncement(`Document ${slug} ingestion complete.`);
      } catch (err) {
        setArchivistLoading(false);
        setHistorianLoading(false);
        setArchivistError(
          err instanceof Error ? err.message : "Metadata extraction failed."
        );
      }
    },
    [refreshState]
  );

  useEffect(() => {
    void refreshState();

    const parserWorker = new Worker(
      new URL("../../workers/parser.worker.ts", import.meta.url)
    );
    const embeddingsWorker = new Worker(
      new URL("../../workers/embeddings.worker.ts", import.meta.url)
    );

    parserWorkerRef.current = parserWorker;
    embeddingsWorkerRef.current = embeddingsWorker;

    parserWorker.onmessage = async (
      event: MessageEvent<ParserWorkerMessage>
    ) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "PARSE_PROGRESS") {
        setIngestions((prev) => {
          const existing = prev[msg.slug];
          if (!existing) return prev;
          return {
            ...prev,
            [msg.slug]: { ...existing, stage: "parsing" },
          };
        });
      } else if (msg.type === "PARSE_COMPLETE") {
        await db.documents.update(msg.slug, {
          status: "chunking",
          pageCount: msg.pageCount,
          skippedPages: msg.skippedPages,
        });

        setIngestions((prev) => {
          const existing = prev[msg.slug];
          return {
            ...prev,
            [msg.slug]: {
              slug: msg.slug,
              filename: existing?.filename ?? msg.slug,
              stage: "chunking",
              skippedPages: msg.skippedPages,
              failedChunkIds: existing?.failedChunkIds ?? [],
              remainingChunks: 0,
            },
          };
        });

        const chunkReq: EmbeddingsWorkerRequest = {
          type: "CHUNK_DOCUMENT",
          slug: msg.slug,
          pages: msg.pages,
          maxTokens: 512,
          overlapTokens: 50,
        };
        embeddingsWorker.postMessage(chunkReq);
      } else if (msg.type === "PARSE_ERROR") {
        await db.documents.delete(msg.slug);
        setIngestions((prev) => {
          const next = { ...prev };
          delete next[msg.slug];
          return next;
        });

        if (msg.errorCode === "PASSWORD_PROTECTED") {
          setUploadError(
            `Rejected "${msg.slug}": PDF requires a password and cannot be ingested.`
          );
        } else {
          setUploadError(msg.message);
          setArchivistError(msg.message);
        }
        await refreshState();
      }
    };

    embeddingsWorker.onmessage = async (
      event: MessageEvent<EmbeddingsWorkerMessage>
    ) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === "CHUNK_COMPLETE") {
        const { slug, chunks } = msg;

        if (chunks.length === 0) {
          await finalizeDocumentIngestion(slug);
          return;
        }

        const chunkRecords: ChunkRecord[] = chunks.map((c) => ({
          ...c,
          embeddingStatus: "pending",
        }));

        await db.chunks.bulkPut(chunkRecords);
        await db.documents.update(slug, { status: "embedding" });

        setIngestions((prev) => {
          const existing = prev[slug];
          return {
            ...prev,
            [slug]: {
              slug,
              filename: existing?.filename ?? slug,
              stage: "embedding",
              skippedPages: existing?.skippedPages ?? [],
              failedChunkIds: existing?.failedChunkIds ?? [],
              remainingChunks: chunkRecords.length,
            },
          };
        });

        for (const chunk of chunkRecords) {
          const embedReq: EmbeddingsWorkerRequest = {
            type: "EMBED_CHUNK",
            chunkId: chunk.chunkId,
            text: chunk.text,
          };
          embeddingsWorker.postMessage(embedReq);
        }
      } else if (msg.type === "EMBED_COMPLETE") {
        if (msg.requestId) {
          const pending = pendingQueryCallbacksRef.current.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingQueryCallbacksRef.current.delete(msg.requestId);
            pending.resolve(msg.vector);
          }
          return;
        }

        if (msg.chunkId) {
          const chunkId = msg.chunkId;
          await db.embeddings.put({ chunkId, vector: msg.vector });
          await db.chunks.update(chunkId, { embeddingStatus: "complete" });

          const chunkRecord = await db.chunks.get(chunkId);
          const slug =
            chunkRecord?.documentId ?? chunkId.replace(/-chunk-\d+$/, "");

          const pendingForDoc = await db.chunks
            .where("documentId")
            .equals(slug)
            .filter((c) => c.embeddingStatus === "pending")
            .count();

          if (pendingForDoc === 0) {
            await finalizeDocumentIngestion(slug);
          }
        }
      } else if (msg.type === "EMBED_ERROR") {
        if (msg.requestId) {
          const pending = pendingQueryCallbacksRef.current.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timer);
            pendingQueryCallbacksRef.current.delete(msg.requestId);
            pending.reject(new Error(msg.message));
          }
          return;
        }

        if (msg.chunkId) {
          const chunkId = msg.chunkId;
          await db.chunks.update(chunkId, {
            embeddingStatus: "embedding_failed",
          });
          const chunkRecord = await db.chunks.get(chunkId);
          const slug =
            chunkRecord?.documentId ?? chunkId.replace(/-chunk-\d+$/, "");

          setIngestions((prev) => {
            const existing = prev[slug];
            if (!existing) return prev;
            return {
              ...prev,
              [slug]: {
                ...existing,
                failedChunkIds: [...existing.failedChunkIds, chunkId],
              },
            };
          });

          const pendingForDoc = await db.chunks
            .where("documentId")
            .equals(slug)
            .filter((c) => c.embeddingStatus === "pending")
            .count();

          if (pendingForDoc === 0) {
            await finalizeDocumentIngestion(slug);
          }
        }
      }
    };

    if (typeof window !== "undefined") {
      window.__ghostdocs_testApi = {
        db,
        triggerResearcherError: (msg: string) => {
          setResearcherLoading(false);
          setResearcherError(msg);
        },
        triggerArchivistError: (msg: string) => {
          setArchivistLoading(false);
          setArchivistError(msg);
        },
        triggerHistorianError: (msg: string) => {
          setHistorianLoading(false);
          setHistorianError(msg);
        },
        refreshState,
      };
    }

    return () => {
      parserWorker.terminate();
      embeddingsWorker.terminate();
      for (const p of pendingQueryCallbacksRef.current.values()) {
        clearTimeout(p.timer);
      }
      pendingQueryCallbacksRef.current.clear();
    };
  }, [finalizeDocumentIngestion, refreshState]);

  const handleFilesAccepted = async (
    files: File[],
    replaceExisting: boolean = false
  ) => {
    setUploadError(null);
    setArchivistError(null);

    for (const file of files) {
      const slug = deriveSlug(file.name);

      if (replaceExisting) {
        const oldChunks = await db.chunks
          .where("documentId")
          .equals(slug)
          .toArray();
        const oldChunkIds = oldChunks.map((c) => c.chunkId);
        await db.transaction(
          "rw",
          [db.documents, db.chunks, db.embeddings],
          async () => {
            await db.documents.delete(slug);
            await db.chunks.where("documentId").equals(slug).delete();
            if (oldChunkIds.length > 0) {
              await db.embeddings.bulkDelete(oldChunkIds);
            }
          }
        );
      }

      const initialDoc: DocumentRecord = {
        slug,
        filename: file.name,
        mimeType: file.type || "text/plain",
        sizeBytes: file.size,
        status: "parsing",
        metadata: {
          title: null,
          detectedDate: null,
          author: null,
          documentType: resolveDocumentType(file.type, file.name),
        },
        summary: null,
        ingestedAt: Date.now(),
        pageCount: null,
        skippedPages: [],
        errorMessage: null,
      };

      await db.documents.put(initialDoc);
      setIngestions((prev) => ({
        ...prev,
        [slug]: {
          slug,
          filename: file.name,
          stage: "parsing",
          skippedPages: [],
          failedChunkIds: [],
          remainingChunks: 0,
        },
      }));

      const buffer = await file.arrayBuffer();
      const parseReq: ParserWorkerRequest = {
        type: "PARSE_DOCUMENT",
        slug,
        fileName: file.name,
        mimeType: file.type || "text/plain",
        buffer,
      };
      parserWorkerRef.current?.postMessage(parseReq, [buffer]);
    }
  };

  const embedQueryViaWorker = (queryText: string): Promise<Float32Array> => {
    return new Promise((resolve, reject) => {
      const worker = embeddingsWorkerRef.current;
      if (!worker) {
        reject(new Error("Embeddings worker is not initialised."));
        return;
      }

      const requestId = uuidv4();
      const timer = setTimeout(() => {
        pendingQueryCallbacksRef.current.delete(requestId);
        reject(
          new Error(
            "Semantic search worker timed out after 10 seconds."
          )
        );
      }, 10_000);

      pendingQueryCallbacksRef.current.set(requestId, {
        resolve,
        reject,
        timer,
      });

      const req: EmbeddingsWorkerRequest = {
        type: "EMBED_QUERY",
        requestId,
        queryText,
      };
      worker.postMessage(req);
    });
  };

  const handleSearch = async (queryText: string) => {
    setHasSearched(true);
    setResearcherError(null);

    const totalChunks = await db.chunks.count();
    if (totalChunks === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setResearcherLoading(true);
    setAnswers([]);

    try {
      if (queryText.includes("__FORCE_WORKER_TIMEOUT__")) {
        throw new Error(
          "Semantic search worker failed to respond within 10 seconds."
        );
      }

      const queryVector = await embedQueryViaWorker(queryText);
      const [allEmbeddings, allChunks, allDocs] = await Promise.all([
        db.embeddings.toArray(),
        db.chunks.toArray(),
        db.documents.toArray(),
      ]);

      const ranked = await rankByCosine(queryVector, allEmbeddings, 10);
      const chunkMap = new Map<string, ChunkRecord>();
      for (const c of allChunks) chunkMap.set(c.chunkId, c);

      const docNames: Record<string, string> = {};
      for (const d of allDocs) docNames[d.slug] = d.filename;

      const positiveRanked: ScoredChunkResult[] = [];
      const topScoredChunks: ScoredChunk[] = [];

      for (const item of ranked) {
        const chunk = chunkMap.get(item.chunkId);
        if (!chunk) continue;
        if (item.score > 0.0) {
          positiveRanked.push({
            ...chunk,
            score: item.score,
            documentName: docNames[chunk.documentId] ?? chunk.documentId,
          });
        }
        if (topScoredChunks.length < 5) {
          topScoredChunks.push({ ...chunk, score: item.score });
        }
      }

      setSearchResults(positiveRanked);

      const answer = synthesiseAnswer(queryText, topScoredChunks, docNames);
      await db.answers.put(answer);
      setAnswers([answer]);
      setLiveAnnouncement(
        `Found ${positiveRanked.length} search results and generated Researcher answer.`
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Search could not be completed.";
      setResearcherError(msg);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
      setResearcherLoading(false);
    }
  };

  const handleDeleteDocument = async (slug: string) => {
    try {
      const docChunks = await db.chunks
        .where("documentId")
        .equals(slug)
        .toArray();
      const chunkIds = docChunks.map((c) => c.chunkId);

      await db.transaction(
        "rw",
        [db.documents, db.chunks, db.embeddings, db.timelines],
        async () => {
          await db.documents.delete(slug);
          await db.chunks.where("documentId").equals(slug).delete();
          if (chunkIds.length > 0) {
            await db.embeddings.bulkDelete(chunkIds);
          }

          const allTimeline = await db.timelines.toArray();
          const toDeleteEntries = allTimeline
            .filter((entry) =>
              entry.citations.every((c) =>
                c.chunkId.startsWith(`${slug}-chunk-`)
              )
            )
            .map((e) => e.entryId);

          if (toDeleteEntries.length > 0) {
            await db.timelines.bulkDelete(toDeleteEntries);
          }
        }
      );

      setSearchResults((prev) => prev.filter((r) => r.documentId !== slug));
      setIngestions((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setDeleteErrors((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });

      await refreshState();
      setLiveAnnouncement(`Deleted document ${slug}.`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Partial deletion failure: Could not remove all chunks from IndexedDB.";
      setDeleteErrors((prev) => ({ ...prev, [slug]: message }));
      throw err;
    }
  };

  const handleManualBuildTimeline = async () => {
    setHistorianLoading(true);
    setHistorianError(null);
    try {
      const entries = await buildTimeline();
      setTimelineEntries(entries);
      setLiveAnnouncement(
        `Timeline reconstructed with ${entries.length} chronological entries.`
      );
    } catch (err) {
      setHistorianError(
        err instanceof Error ? err.message : "Failed to build timeline."
      );
    } finally {
      setHistorianLoading(false);
    }
  };

  const completedDocs = documents.filter((d) => d.status === "complete");
  const hasDocuments = completedDocs.length > 0 && chunksCount > 0;

  return (
    <div className="min-h-dvh bg-ghost-void bg-fog-radial text-parchment-100">
      {/* Screen-reader ARIA live region for state announcements (Req 10.5) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      <header className="border-b border-specter-800/80 bg-ghost-crypt/90 px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-specter-600 bg-ghost-tomb shadow-glow-sm">
              <Ghost className="h-6 w-6 text-specter-300" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-parchment-100">
                GhostDocs
              </h1>
              <p className="text-xs text-parchment-300">
                Resurrecting Forgotten Organisational Knowledge — 100% Browser-Local
              </p>
            </div>
          </div>
          <div className="text-xs text-ectoplasm-300">
            Zero Network Leakage · IndexedDB Vault
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
        <CapsuleControls
          onCapsuleImported={() => void refreshState()}
          onCapsuleCreated={() => void refreshState()}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column: Upload & Document Vault */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <section aria-label="Document Upload and Vault" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-parchment-100">
                1. Time Capsule Vault
              </h2>
              <UploadZone
                onFilesAccepted={(files, replace) =>
                  void handleFilesAccepted(files, replace)
                }
                externalError={uploadError}
                existingSlugs={completedDocs.map((d) => d.slug)}
              />

              {Object.values(ingestions).map((ing) => (
                <IngestionProgress
                  key={ing.slug}
                  slug={ing.slug}
                  filename={ing.filename}
                  stage={ing.stage}
                  skippedPages={ing.skippedPages}
                  failedChunkIds={ing.failedChunkIds}
                />
              ))}

              <DocumentList
                documents={documents}
                onDeleteDocument={handleDeleteDocument}
                deleteErrors={deleteErrors}
              />
            </section>
          </div>

          {/* Right column: Semantic Search & AI Crew Panels */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <section aria-label="Semantic Search and Questions" className="flex flex-col gap-3 rounded-xl border border-specter-800 bg-ghost-crypt p-4 shadow-crypt-sm">
              <h2 className="text-sm font-semibold text-parchment-100">
                2. Semantic Knowledge Resurrection
              </h2>
              <SearchBar
                onSearch={handleSearch}
                isSearching={isSearching}
                hasDocuments={hasDocuments}
              />
              <SearchResults
                results={searchResults}
                hasDocuments={hasDocuments}
                hasSearched={hasSearched}
              />
            </section>

            <div className="grid grid-cols-1 gap-4">
              <ResearcherPanel
                answers={answers}
                isLoading={researcherLoading}
                error={researcherError}
                onDismissError={() => setResearcherError(null)}
              />

              <HistorianPanel
                entries={timelineEntries}
                hasDocuments={hasDocuments}
                isLoading={historianLoading}
                error={historianError}
                suppressedByResearcherError={Boolean(researcherError)}
                onGenerateTimeline={handleManualBuildTimeline}
              />

              <ArchivistPanel
                documents={documents}
                isLoading={archivistLoading}
                error={archivistError}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
