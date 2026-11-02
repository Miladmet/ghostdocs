"use client";

import React, { useRef, useState } from "react";
import { Upload, AlertTriangle, FileWarning } from "lucide-react";
import { deriveSlug } from "@/lib/slug";
import { checkDuplicate } from "@/lib/agents/archivist";
import { Button } from "@/components/ui/button";

export interface UploadZoneProps {
  onFilesAccepted: (files: File[], replaceExisting?: boolean) => void;
  externalError?: string | null;
  existingSlugs?: string[];
}

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = [".pdf", ".md", ".markdown", ".txt"];

function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateUploadedFile(file: File): {
  valid: boolean;
  detectedMime: string;
} {
  const mime = (file.type || "").toLowerCase().trim();
  const extAllowed = hasAllowedExtension(file.name);

  if (
    mime === "application/pdf" ||
    mime === "text/markdown" ||
    mime === "text/x-markdown"
  ) {
    return { valid: true, detectedMime: mime };
  }

  if (mime === "text/plain" && extAllowed) {
    return { valid: true, detectedMime: mime };
  }

  // Browsers on Windows/Linux often report "" for .md/.markdown files
  if (mime === "" && extAllowed) {
    return { valid: true, detectedMime: "text/plain" };
  }

  return {
    valid: false,
    detectedMime: mime || "application/octet-stream",
  };
}

export function UploadZone({
  onFilesAccepted,
  externalError,
  existingSlugs = [],
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [duplicateFileQueue, setDuplicateFileQueue] = useState<File[]>([]);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const errors: string[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      const { valid, detectedMime } = validateUploadedFile(file);
      if (!valid) {
        errors.push(
          `Rejected "${file.name}" (detected MIME type: ${detectedMime}). Supported formats: PDF, Markdown (.md), and Plain Text (.txt).`
        );
      } else {
        validFiles.push(file);
      }
    }

    setValidationErrors(errors);

    const immediateAccept: File[] = [];
    const duplicates: File[] = [];

    for (const file of validFiles) {
      const slug = deriveSlug(file.name);
      const isDupInProp = existingSlugs.includes(slug);
      const isDupInDb = isDupInProp || (await checkDuplicate(slug));
      if (isDupInDb) {
        duplicates.push(file);
      } else {
        immediateAccept.push(file);
      }
    }

    if (immediateAccept.length > 0) {
      onFilesAccepted(immediateAccept, false);
    }

    if (duplicates.length > 0) {
      setDuplicateFileQueue(duplicates);
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const confirmDuplicateReplace = () => {
    const toReplace = [...duplicateFileQueue];
    setDuplicateFileQueue([]);
    onFilesAccepted(toReplace, true);
  };

  const cancelDuplicateReplace = () => {
    setDuplicateFileQueue([]);
  };

  const allErrors = [
    ...validationErrors,
    ...(externalError ? [externalError] : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/x-markdown,text/plain"
        data-testid="upload-input"
        aria-label="File upload input"
        onChange={handleInputChange}
        className="sr-only"
      />
      <div
        role="button"
        tabIndex={0}
        data-testid="upload-button"
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`animate-ghost-appear cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-150 ${
          isDragging
            ? "border-glow-400 bg-ghost-tomb shadow-glow-sm"
            : "border-specter-700 bg-ghost-crypt hover:border-specter-400 hover:shadow-glow-sm"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="h-8 w-8 text-specter-300" aria-hidden="true" />
          <p className="text-sm font-medium text-parchment-100">
            Drop forgotten documents into the Time Capsule, or click to browse
          </p>
          <p className="text-xs text-parchment-300">
            Supports PDF, Markdown (.md), and Plain Text (.txt) — 100% browser-local
          </p>
        </div>
      </div>

      {allErrors.length > 0 && (
        <div
          role="alert"
          data-testid="upload-error"
          className="animate-ghost-appear flex items-start gap-2 rounded-lg border border-shade-error/60 bg-ghost-tomb p-3 text-xs text-parchment-100"
        >
          <FileWarning
            className="mt-0.5 h-4 w-4 shrink-0 text-shade-error"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            {allErrors.map((err, idx) => (
              <p key={idx}>{err}</p>
            ))}
          </div>
        </div>
      )}

      {duplicateFileQueue.length > 0 && (
        <div
          role="alertdialog"
          aria-labelledby="duplicate-dialog-title"
          aria-describedby="duplicate-dialog-desc"
          data-testid="duplicate-confirm"
          onKeyDown={(e) => {
            if (e.key === "Escape") cancelDuplicateReplace();
          }}
          className="animate-ghost-appear flex flex-col gap-3 rounded-xl border border-glow-400/60 bg-ghost-tomb p-4 text-sm text-parchment-100 shadow-crypt-md"
        >
          <div className="flex items-center gap-2 font-semibold text-glow-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span id="duplicate-dialog-title">Duplicate Document Detected</span>
          </div>
          <p id="duplicate-dialog-desc" className="text-xs text-parchment-200">
            {duplicateFileQueue.map((f) => f.name).join(", ")} already exists in
            the Chunk Store. Do you want to replace the existing document and
            re-ingest its chunks?
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="duplicate-cancel-button"
              onClick={cancelDuplicateReplace}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              data-testid="duplicate-confirm-button"
              onClick={confirmDuplicateReplace}
            >
              Replace Document
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
