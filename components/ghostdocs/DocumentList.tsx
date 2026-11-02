"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentCard } from "./DocumentCard";
import type { DocumentRecord } from "@/lib/db";

export interface DocumentListProps {
  documents: DocumentRecord[];
  onDeleteDocument: (slug: string) => Promise<void>;
  deleteErrors?: Record<string, string>;
}

export function DocumentList({
  documents,
  onDeleteDocument,
  deleteErrors = {},
}: DocumentListProps) {
  const completedDocs = documents.filter((d) => d.status === "complete");

  if (completedDocs.length === 0) {
    return (
      <div className="rounded-xl border border-specter-800/50 bg-ghost-crypt p-6 text-center text-xs text-parchment-300">
        No documents in the vault yet. Drop PDF, Markdown, or TXT files above to
        resurrect their knowledge.
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-[420px] pr-2">
      <div className="flex flex-col gap-3">
        {completedDocs.map((doc) => (
          <DocumentCard
            key={doc.slug}
            document={doc}
            onDelete={onDeleteDocument}
            deleteError={deleteErrors[doc.slug] ?? null}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
