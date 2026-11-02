"use client";

import React from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChunkRecord } from "@/lib/db";

export interface ScoredChunkResult extends ChunkRecord {
  score: number;
  documentName: string;
}

export interface SearchResultCardProps {
  result: ScoredChunkResult;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const { chunkId, documentId, documentName, text, pageNumber, lineOffset, score } =
    result;

  const locationLabel =
    pageNumber !== null
      ? `Page ${pageNumber}`
      : `Line ${(lineOffset ?? 0) + 1}`;

  const handleSelect = () => {
    const cardEl = document.getElementById(`document-card-${documentId}`);
    if (cardEl && typeof cardEl.scrollIntoView === "function") {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  return (
    <button
      type="button"
      data-testid={`search-result-${chunkId}`}
      onClick={handleSelect}
      className="animate-ghost-appear w-full rounded-lg border border-specter-800 bg-ghost-crypt p-3 text-left transition-all duration-150 hover:border-specter-500 hover:shadow-glow-sm"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-parchment-300">
        <span className="inline-flex items-center gap-1.5 font-medium text-specter-200">
          <FileText className="h-3.5 w-3.5 text-specter-300" aria-hidden="true" />
          <span>{documentName}</span>
          <span>·</span>
          <span>{locationLabel}</span>
        </span>
        <Badge variant="outline" className="font-mono text-[11px] text-ectoplasm-300">
          {score.toFixed(2)}
        </Badge>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-parchment-100 line-clamp-4">
        {text}
      </p>
    </button>
  );
}
