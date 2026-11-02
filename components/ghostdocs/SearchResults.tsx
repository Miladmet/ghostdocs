"use client";

import React from "react";
import { SearchResultCard, type ScoredChunkResult } from "./SearchResultCard";

export interface SearchResultsProps {
  results: ScoredChunkResult[];
  hasDocuments: boolean;
  hasSearched: boolean;
}

export function SearchResults({
  results,
  hasDocuments,
  hasSearched,
}: SearchResultsProps) {
  if (!hasDocuments) {
    return (
      <div
        data-testid="search-empty-state"
        className="rounded-xl border border-specter-800/50 bg-ghost-crypt p-4 text-center text-xs text-parchment-300"
      >
        Upload documents to begin searching. No documents have been uploaded yet.
      </div>
    );
  }

  if (hasSearched && results.length === 0) {
    return (
      <div
        data-testid="search-no-results"
        className="rounded-xl border border-specter-800/50 bg-ghost-crypt p-4 text-center text-xs text-parchment-300"
      >
        No relevant passages were found for your query.
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" aria-label="Search results">
      {results.slice(0, 10).map((res) => (
        <SearchResultCard key={res.chunkId} result={res} />
      ))}
    </div>
  );
}
