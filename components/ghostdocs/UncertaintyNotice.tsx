"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

export interface UncertaintyNoticeProps {
  notice: string;
}

export function UncertaintyNotice({ notice }: UncertaintyNoticeProps) {
  return (
    <div
      role="note"
      data-testid="uncertainty-notice"
      className="animate-ghost-appear mt-2 flex items-start gap-2 rounded-lg border border-glow-500/60 bg-ghost-tomb/90 p-3 text-xs text-glow-100 shadow-specter-sm"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-glow-400"
        aria-hidden="true"
      />
      <div>
        <span className="font-semibold text-glow-300">Uncertainty Notice: </span>
        <span>{notice}</span>
      </div>
    </div>
  );
}
