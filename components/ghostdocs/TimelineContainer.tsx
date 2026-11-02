"use client";

import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sortTimelineEntries } from "@/lib/agents/historian";
import { TimelineEntry } from "./TimelineEntry";
import type { TimelineEntryRecord } from "@/lib/db";

export interface TimelineContainerProps {
  entries: TimelineEntryRecord[];
  hasDocuments?: boolean;
}

export function TimelineContainer({
  entries,
  hasDocuments = false,
}: TimelineContainerProps) {
  const sorted = sortTimelineEntries(entries);

  return (
    <div data-testid="timeline-container" className="flex flex-col gap-3">
      {sorted.length === 0 ? (
        <div
          data-testid="timeline-empty-state"
          className="rounded-xl border border-specter-800/50 bg-ghost-crypt p-5 text-center text-xs text-parchment-300"
        >
          {hasDocuments
            ? "No temporal signals were found in the uploaded documents."
            : "Upload documents to generate a timeline. No temporal signals were found in the uploaded documents."}
        </div>
      ) : (
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="flex flex-col gap-3">
            {sorted.map((entry) => (
              <TimelineEntry key={entry.entryId} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
