"use client";

import React, { useEffect } from "react";
import { Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DeleteConfirmDialogProps {
  open: boolean;
  slug: string;
  filename: string;
  onConfirm: (slug: string) => Promise<void>;
  onCancel: () => void;
  errorMessage?: string | null;
}

export function DeleteConfirmDialog({
  open,
  slug,
  filename,
  onConfirm,
  onCancel,
  errorMessage,
}: DeleteConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`delete-title-${slug}`}
        aria-describedby={`delete-desc-${slug}`}
        data-testid="delete-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        className="animate-ghost-appear w-full max-w-md rounded-xl border border-specter-700 bg-ghost-tomb p-5 text-parchment-100 shadow-crypt-lg"
      >
        <div className="flex items-center gap-2 text-base font-semibold text-parchment-100">
          <Trash2 className="h-5 w-5 text-shade-error" aria-hidden="true" />
          <h3 id={`delete-title-${slug}`}>Delete Document</h3>
        </div>
        <p
          id={`delete-desc-${slug}`}
          className="mt-2 text-xs leading-relaxed text-parchment-200"
        >
          Are you sure you want to banish <strong>{filename}</strong> from the
          Time Capsule? This will permanently remove the document, all extracted
          chunks, embeddings, and derived timeline entries from IndexedDB.
        </p>

        {errorMessage && (
          <div
            role="alert"
            data-testid={`delete-error-${slug}`}
            className="mt-3 flex items-center gap-2 rounded-md border border-shade-error bg-ghost-crypt p-2.5 text-xs text-shade-error"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="delete-cancel-button"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            data-testid="delete-confirm-button"
            onClick={() => void onConfirm(slug)}
          >
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
