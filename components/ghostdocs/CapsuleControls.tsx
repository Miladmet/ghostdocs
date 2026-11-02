"use client";

import React, { useRef, useState } from "react";
import { PackagePlus, Download, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCapsule,
  exportCapsule,
  importCapsule,
  type ImportResult,
} from "@/lib/capsule";

export interface CapsuleControlsProps {
  onCapsuleImported?: (result: ImportResult) => void;
  onCapsuleCreated?: (capsuleId: string) => void;
}

export function CapsuleControls({
  onCapsuleImported,
  onCapsuleCreated,
}: CapsuleControlsProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lastCapsuleId, setLastCapsuleId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const capsule = await createCapsule();
      setLastCapsuleId(capsule.capsuleId);
      setStatusMessage(
        `Time Capsule sealed (${capsule.documentCount} document${
          capsule.documentCount === 1 ? "" : "s"
        } bundled).`
      );
      onCapsuleCreated?.(capsule.capsuleId);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create Time Capsule."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleExport = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await exportCapsule(lastCapsuleId ?? undefined);
      setStatusMessage("Time Capsule exported as JSON.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to export Time Capsule."
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await importCapsule(file);
      setStatusMessage(
        `Time Capsule imported: ${result.restoredCount} records restored, ${result.skippedCount} duplicate records skipped.`
      );
      onCapsuleImported?.(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to import Time Capsule."
      );
    } finally {
      setIsBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-specter-700/80 bg-ghost-crypt p-4 text-parchment-100 shadow-crypt-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-parchment-100">
            Time Capsule Controls
          </h2>
          <p className="text-xs text-parchment-300">
            Bundle, export, or restore your entire organisational memory snapshot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={isBusy}
            data-testid="capsule-create-button"
            onClick={() => void handleCreate()}
          >
            <PackagePlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Create Time Capsule
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy}
            data-testid="capsule-export-button"
            onClick={() => void handleExport()}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Export Capsule
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            data-testid="capsule-import-button"
            onClick={() => importInputRef.current?.click()}
          >
            <UploadCloud className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Import Capsule
          </Button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            aria-label="Import Time Capsule JSON file"
            data-testid="capsule-import-input"
            onChange={(e) => void handleImportFile(e)}
            className="sr-only"
          />
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          data-testid="capsule-status"
          className="mt-1 flex items-center gap-1.5 text-xs text-ectoplasm-300"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="capsule-error"
          className="mt-1 flex items-center gap-1.5 text-xs text-shade-error"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
