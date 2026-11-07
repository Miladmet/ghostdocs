"use client";

import React, { useState } from "react";
import { Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const QUERY_SUGGESTIONS = [
  { id: "q3-budget", text: "What was the Q3 budget allocation?" },
  {
    id: "security-constitution",
    text: "When was the security constitution ratified?",
  },
] as const;

export interface SearchBarProps {
  onSearch: (query: string) => Promise<void> | void;
  isSearching?: boolean;
  hasDocuments?: boolean;
}

export function SearchBar({
  onSearch,
  isSearching = false,
  hasDocuments = true,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitQuery = async (text: string) => {
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      setError("Query must contain at least one non-whitespace character.");
      return;
    }

    if (trimmed.length > 500) {
      setError("Query must not exceed 500 characters.");
      return;
    }

    setError(null);
    await onSearch(trimmed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuery(query);
  };

  const handleSuggestionClick = async (text: string) => {
    setQuery(text);
    await submitQuery(text);
  };

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-specter-300"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ask the crew or search passages across your Time Capsule..."
            aria-label="Search documents or ask a question"
            data-testid="search-input"
            maxLength={500}
            className="h-9 w-full rounded-lg border border-specter-700 bg-ghost-crypt pr-3 pl-9 text-sm text-parchment-100 placeholder:text-parchment-400 focus:border-specter-400"
          />
        </div>
        <Button
          type="submit"
          data-testid="search-submit"
          disabled={isSearching}
          className="h-9 px-4"
        >
          {isSearching ? "Searching..." : "Resurrect"}
        </Button>
      </form>

      <div
        role="group"
        aria-label="Suggested questions"
        className="flex flex-wrap gap-2"
      >
        {QUERY_SUGGESTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`query-suggestion-${s.id}`}
            disabled={isSearching}
            onClick={() => handleSuggestionClick(s.text)}
            className="rounded-full border border-specter-700 bg-ghost-crypt px-3 py-1 text-xs text-specter-200 transition-colors hover:border-specter-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s.text}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="search-error"
          className="flex items-center gap-1.5 text-xs text-shade-error"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!hasDocuments && !error && (
        <p className="text-xs text-parchment-300">
          No documents have been uploaded yet.
        </p>
      )}
    </div>
  );
}
