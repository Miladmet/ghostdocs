"use client";

import React from "react";
import { ScrollText, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TimelineContainer } from "./TimelineContainer";
import type { TimelineEntryRecord } from "@/lib/db";

export interface HistorianPanelProps {
  entries: TimelineEntryRecord[];
  hasDocuments: boolean;
  isLoading?: boolean;
  error?: string | null;
  suppressedByResearcherError?: boolean;
  onGenerateTimeline?: () => Promise<void> | void;
}

export function HistorianPanel({
  entries,
  hasDocuments,
  isLoading = false,
  error = null,
  suppressedByResearcherError = false,
  onGenerateTimeline,
}: HistorianPanelProps) {
  return (
    <section
      aria-label="The Historian Agent Panel"
      data-testid="agent-historian"
      className="flex flex-col gap-3 rounded-xl border border-specter-700/80 bg-ghost-crypt p-4 text-parchment-100 shadow-crypt-md"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-glow-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-parchment-100">
            The Historian
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] text-glow-200">
            Chronological Reconstruction
          </Badge>
          {onGenerateTimeline && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              data-testid="generate-timeline-button"
              onClick={() => void onGenerateTimeline()}
              disabled={isLoading}
            >
              Rebuild Timeline
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div
          role="status"
          data-testid="agent-historian-loading"
          className="flex items-center gap-2 py-6 text-xs text-glow-200"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>The Historian is reconstructing the chronological timeline...</span>
        </div>
      ) : error ? (
        <div
          role="alert"
          data-testid="agent-historian-error"
          className="flex items-start gap-2 rounded-lg border border-shade-error bg-ghost-tomb p-3 text-xs text-shade-error"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Historian Agent Error: {error}</span>
        </div>
      ) : suppressedByResearcherError ? (
        <p className="py-4 text-xs text-parchment-300">
          Timeline display paused until the Researcher Agent error state is
          resolved or dismissed.
        </p>
      ) : (
        <TimelineContainer entries={entries} hasDocuments={hasDocuments} />
      )}
    </section>
  );
}
