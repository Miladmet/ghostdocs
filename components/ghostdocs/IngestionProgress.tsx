"use client";

import React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { DocumentStatus } from "@/lib/db";

export interface IngestionProgressProps {
  slug: string;
  filename?: string;
  stage: DocumentStatus;
  skippedPages?: number[];
  failedChunkIds?: string[];
}

const STAGE_PROGRESS: Record<DocumentStatus, number> = {
  pending: 10,
  parsing: 35,
  chunking: 65,
  embedding: 85,
  complete: 100,
  error: 100,
};

export function IngestionProgress({
  slug,
  filename,
  stage,
  skippedPages = [],
  failedChunkIds = [],
}: IngestionProgressProps) {
  const isActive =
    stage === "pending" ||
    stage === "parsing" ||
    stage === "chunking" ||
    stage === "embedding";

  return (
    <div className="flex flex-col gap-2">
      {isActive && (
        <div
          data-testid="upload-progress"
          className="animate-ghost-appear rounded-lg border border-specter-700/60 bg-ghost-crypt p-3"
        >
          <div
            data-testid={`ingestion-progress-${slug}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between text-xs text-parchment-200">
              <span className="flex items-center gap-1.5 font-medium">
                <Loader2
                  className="h-3.5 w-3.5 animate-spin text-specter-300"
                  aria-hidden="true"
                />
                Ingesting {filename ?? slug}
              </span>
              <span className="rounded bg-ghost-tomb px-2 py-0.5 font-mono text-specter-200 uppercase">
                {stage}
              </span>
            </div>
            <Progress
              value={STAGE_PROGRESS[stage] ?? 50}
              aria-label={`Ingestion progress for ${filename ?? slug}: ${stage}`}
            />
          </div>
        </div>
      )}

      {skippedPages.length > 0 && (
        <div
          role="status"
          data-testid={`parse-warning-${slug}`}
          className="flex items-center gap-2 rounded-md border border-shade-warn/50 bg-ghost-tomb px-3 py-2 text-xs text-glow-200"
        >
          <AlertCircle
            className="h-4 w-4 shrink-0 text-shade-warn"
            aria-hidden="true"
          />
          <span>
            Skipped corrupted or unreadable PDF pages:{" "}
            {skippedPages.join(", ")}
          </span>
        </div>
      )}

      {failedChunkIds.map((chunkId) => (
        <div
          key={chunkId}
          role="status"
          data-testid={`embedding-warning-${chunkId}`}
          className="flex items-center gap-2 rounded-md border border-shade-warn/50 bg-ghost-tomb px-3 py-2 text-xs text-glow-200"
        >
          <AlertCircle
            className="h-4 w-4 shrink-0 text-shade-warn"
            aria-hidden="true"
          />
          <span>
            Embedding failed for chunk <code>{chunkId}</code>; remaining chunks
            processed normally.
          </span>
        </div>
      ))}
    </div>
  );
}
