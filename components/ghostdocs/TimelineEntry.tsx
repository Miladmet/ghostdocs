"use client";

import React from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CitationBadge } from "./CitationBadge";
import { UncertaintyNotice } from "./UncertaintyNotice";
import type { TimelineEntryRecord } from "@/lib/db";

export interface TimelineEntryProps {
  entry: TimelineEntryRecord;
}

export function TimelineEntry({ entry }: TimelineEntryProps) {
  const {
    eventDescription,
    resolvedDate,
    resolvedDateEnd,
    confidenceScore,
    citations,
    uncertaintyNotice,
    isImplicit,
  } = entry;

  const dateLabel = resolvedDate
    ? resolvedDateEnd
      ? `${resolvedDate} → ${resolvedDateEnd}`
      : resolvedDate
    : "Unresolved Date (Implicit Signal)";

  return (
    <div
      data-testid="timeline-entry"
      data-resolved-date={resolvedDate ?? ""}
      className="animate-ghost-appear relative rounded-xl border border-specter-800 bg-ghost-crypt p-3.5 text-parchment-100 shadow-crypt-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-glow-300">
          <Clock className="h-3.5 w-3.5 text-glow-400" aria-hidden="true" />
          <span>{dateLabel}</span>
        </span>
        <Badge
          variant={isImplicit ? "outline" : "secondary"}
          className="font-mono text-[11px] text-ectoplasm-300"
        >
          Confidence: {confidenceScore.toFixed(2)}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-parchment-100">
        {eventDescription.slice(0, 500)}
      </p>

      {uncertaintyNotice && <UncertaintyNotice notice={uncertaintyNotice} />}

      {citations.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {citations.map((c, idx) => (
            <CitationBadge key={`${c.chunkId}-${idx}`} citation={c} />
          ))}
        </div>
      )}
    </div>
  );
}
