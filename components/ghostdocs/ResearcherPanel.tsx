"use client";

import React from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnswerBlock } from "./AnswerBlock";
import type { AnswerRecord } from "@/lib/db";

export interface ResearcherPanelProps {
  answers: AnswerRecord[];
  isLoading?: boolean;
  error?: string | null;
  onDismissError?: () => void;
}

export function ResearcherPanel({
  answers,
  isLoading = false,
  error = null,
  onDismissError,
}: ResearcherPanelProps) {
  return (
    <section
      aria-label="The Researcher Agent Panel"
      data-testid="agent-researcher"
      className="flex flex-col gap-3 rounded-xl border border-specter-700/80 bg-ghost-crypt p-4 text-parchment-100 shadow-crypt-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ectoplasm-300" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-parchment-100">
            The Researcher
          </h3>
        </div>
        <Badge variant="outline" className="text-[10px] text-ectoplasm-200">
          Source-Cited Synthesis
        </Badge>
      </div>

      <Separator />

      {isLoading ? (
        <div
          role="status"
          data-testid="agent-researcher-loading"
          className="flex items-center gap-2 py-6 text-xs text-ectoplasm-200"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>
            The Researcher is synthesising a source-cited answer from top chunks...
          </span>
        </div>
      ) : error ? (
        <div
          role="alert"
          data-testid="agent-researcher-error"
          className="flex items-center justify-between gap-2 rounded-lg border border-shade-error bg-ghost-tomb p-3 text-xs text-shade-error"
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>Researcher Agent Error: {error}</span>
          </div>
          {onDismissError && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onDismissError}
            >
              Dismiss
            </Button>
          )}
        </div>
      ) : answers.length === 0 ? (
        <p className="py-4 text-xs text-parchment-300">
          Submit a question in the search bar above to receive a source-cited
          synthesis from the Researcher.
        </p>
      ) : (
        <ScrollArea className="max-h-[420px] pr-2">
          <div className="flex flex-col gap-3">
            {answers.map((ans) => (
              <AnswerBlock key={ans.answerId} answer={ans} />
            ))}
          </div>
        </ScrollArea>
      )}
    </section>
  );
}
