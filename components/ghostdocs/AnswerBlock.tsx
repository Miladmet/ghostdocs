"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { CitationBadge } from "./CitationBadge";
import { UncertaintyNotice } from "./UncertaintyNotice";
import type { AnswerRecord } from "@/lib/db";

export interface AnswerBlockProps {
  answer: AnswerRecord;
}

export function AnswerBlock({ answer }: AnswerBlockProps) {
  const {
    questionText,
    synthesisedText,
    citations,
    confidenceScore,
    uncertaintyNotice,
  } = answer;

  return (
    <div
      data-testid="response-block"
      className="animate-ghost-appear flex flex-col gap-3 rounded-xl border border-specter-700/80 bg-ghost-crypt p-4 text-parchment-100 shadow-crypt-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-specter-800/70 pb-2">
        <p className="text-xs font-semibold text-specter-200">
          Q: {questionText}
        </p>
        <Badge
          variant="outline"
          className="font-mono text-[11px] text-ectoplasm-300"
        >
          Confidence: {confidenceScore.toFixed(2)}
        </Badge>
      </div>

      <p className="whitespace-pre-line text-xs leading-relaxed text-parchment-100">
        {synthesisedText}
      </p>

      {citations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-parchment-300">
            Sources:
          </span>
          {citations.map((citation, idx) => (
            <CitationBadge
              key={`${citation.chunkId}-${idx}`}
              citation={citation}
            />
          ))}
        </div>
      )}

      {uncertaintyNotice && <UncertaintyNotice notice={uncertaintyNotice} />}
    </div>
  );
}
