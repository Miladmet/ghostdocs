"use client";

import React, { useState } from "react";
import { FileText, Trash2, Calendar, User, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import type { DocumentRecord } from "@/lib/db";

export interface DocumentCardProps {
  document: DocumentRecord;
  onDelete: (slug: string) => Promise<void>;
  deleteError?: string | null;
}

export function DocumentCard({
  document,
  onDelete,
  deleteError,
}: DocumentCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { slug, filename, metadata, summary, pageCount, skippedPages } =
    document;

  const displayTitle = metadata?.title || "Unknown title";
  const displayDate = metadata?.detectedDate || "Unknown date";
  const displayAuthor = metadata?.author || "Unknown author";
  const displayType = metadata?.documentType || "Unknown documentType";

  const handleConfirmDelete = async (targetSlug: string) => {
    try {
      await onDelete(targetSlug);
      setConfirmOpen(false);
    } catch {
      // Keep dialog/card visible on error per Req 7.5
    }
  };

  return (
    <article
      id={`document-card-${slug}`}
      data-testid={`document-card-${slug}`}
      className="animate-ghost-appear rounded-xl border border-specter-800/80 bg-ghost-crypt bg-parchment-texture p-4 text-parchment-100 shadow-crypt-sm transition-all duration-150 hover:border-specter-600"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileText
            className="mt-0.5 h-4 w-4 shrink-0 text-specter-300"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-parchment-100">
              {filename}
            </h3>
            <p className="truncate text-xs text-parchment-300">
              Title: {displayTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="uppercase text-[10px]">
            {displayType}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${filename}`}
            data-testid={`delete-document-${slug}`}
            onClick={() => setConfirmOpen(true)}
            className="text-parchment-300 hover:text-shade-error"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-parchment-200">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-ectoplasm-300" aria-hidden="true" />
          <span>{displayDate}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <User className="h-3.5 w-3.5 text-ectoplasm-300" aria-hidden="true" />
          <span>{displayAuthor}</span>
        </span>
        {pageCount !== null && (
          <span className="text-parchment-300">
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
        )}
      </div>

      {summary && (
        <div className="mt-2.5 text-xs leading-relaxed text-parchment-200">
          <p className={expanded ? "" : "line-clamp-3"}>{summary}</p>
          {summary.length > 180 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-[11px] font-medium text-specter-300 underline hover:text-specter-200"
            >
              {expanded ? "Show less" : "Read full summary"}
            </button>
          )}
        </div>
      )}

      {skippedPages && skippedPages.length > 0 && (
        <div
          role="status"
          data-testid={`parse-warning-${slug}`}
          className="mt-2 flex items-center gap-1.5 rounded border border-shade-warn/50 bg-ghost-tomb px-2.5 py-1.5 text-xs text-glow-200"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-shade-warn" aria-hidden="true" />
          <span>Skipped corrupted pages: {skippedPages.join(", ")}</span>
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          data-testid={`delete-error-${slug}`}
          className="mt-2 flex items-center gap-1.5 rounded border border-shade-error bg-ghost-tomb px-2.5 py-1.5 text-xs text-shade-error"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{deleteError}</span>
        </div>
      )}

      <DeleteConfirmDialog
        open={confirmOpen}
        slug={slug}
        filename={filename}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
        errorMessage={deleteError}
      />
    </article>
  );
}
