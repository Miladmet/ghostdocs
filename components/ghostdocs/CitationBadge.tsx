"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CitationRecord } from "@/lib/db";

export interface CitationBadgeProps {
  citation: CitationRecord;
}

export function CitationBadge({ citation }: CitationBadgeProps) {
  const { chunkId, documentName, pageNumber, lineSection, excerpt } = citation;
  const locationLabel =
    pageNumber !== null ? `p. ${pageNumber}` : lineSection ?? "section 1";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="secondary"
              data-testid={`citation-${chunkId}`}
              title={`${documentName} (${locationLabel}): "${excerpt}"`}
              className="cursor-help border border-specter-700 bg-ghost-tomb text-xs text-specter-200 hover:border-glow-400"
            />
          }
        >
          <BookOpen className="mr-1 h-3 w-3 text-glow-300" aria-hidden="true" />
          <span>
            {documentName} · {locationLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs border border-specter-700 bg-ghost-tomb p-2.5 text-xs text-parchment-100">
          <p className="font-semibold text-glow-300">
            {documentName} ({locationLabel})
          </p>
          <p className="mt-1 italic text-parchment-200">
            &ldquo;{excerpt}&rdquo;
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
