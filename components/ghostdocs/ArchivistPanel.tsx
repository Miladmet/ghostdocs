"use client";

import React from "react";
import { Archive, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DocumentRecord } from "@/lib/db";

export interface ArchivistPanelProps {
  documents: DocumentRecord[];
  isLoading?: boolean;
  error?: string | null;
}

export function ArchivistPanel({
  documents,
  isLoading = false,
  error = null,
}: ArchivistPanelProps) {
  const completedDocs = documents.filter((d) => d.status === "complete");

  return (
    <section
      aria-label="The Archivist Agent Panel"
      data-testid="agent-archivist"
      className="flex flex-col gap-3 rounded-xl border border-specter-700/80 bg-ghost-crypt p-4 text-parchment-100 shadow-crypt-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-specter-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-parchment-100">
            The Archivist
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px] text-specter-200">
          Cataloguing &amp; Metadata
        </Badge>
      </div>

      <Separator />

      {isLoading ? (
        <div
          role="status"
          data-testid="agent-archivist-loading"
          className="flex items-center gap-2 py-6 text-xs text-specter-200"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>The Archivist is cataloguing document metadata...</span>
        </div>
      ) : error ? (
        <div
          role="alert"
          data-testid="agent-archivist-error"
          className="flex items-start gap-2 rounded-lg border border-shade-error bg-ghost-tomb p-3 text-xs text-shade-error"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Archivist Agent Error: {error}</span>
        </div>
      ) : completedDocs.length === 0 ? (
        <p className="py-4 text-xs text-parchment-300">
          Awaiting artefacts. Upload a document to inspect extracted metadata.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {completedDocs.map((doc) => {
            const title = doc.metadata?.title || "Unknown title";
            const detectedDate = doc.metadata?.detectedDate || "Unknown date";
            const author = doc.metadata?.author || "Unknown author";
            const docType =
              doc.metadata?.documentType || "Unknown documentType";

            return (
              <div
                key={doc.slug}
                className="animate-ghost-appear rounded-lg border border-specter-800 bg-ghost-tomb/60 p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2 font-semibold text-parchment-100">
                  <span className="truncate">{doc.filename}</span>
                  <Badge variant="secondary" className="uppercase text-[10px]">
                    {docType}
                  </Badge>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-1 text-parchment-200 sm:grid-cols-2">
                  <div>
                    <dt className="inline font-medium text-parchment-300">
                      Title:{" "}
                    </dt>
                    <dd className="inline">{title}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-parchment-300">
                      Date:{" "}
                    </dt>
                    <dd className="inline">{detectedDate}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-parchment-300">
                      Author:{" "}
                    </dt>
                    <dd className="inline">{author}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-parchment-300">
                      Type:{" "}
                    </dt>
                    <dd className="inline">{docType}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
